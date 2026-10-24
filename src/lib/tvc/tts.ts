// TTS cho cac tool can audio. Provider chain env-driven (CR-018/056):
//   TTS_PROVIDER - 'auto' (default = openai -> edge -> gemini) | mot provider
//   TTS_MODEL    - default 'gpt-4o-mini-tts' (chat luong tot, re)
//   TTS_VOICE_A / TTS_VOICE_B - giong OpenAI 2 nhan vat (alloy / nova)
//   TTS_EDGE_VOICE_* - giong edge-tts neural (mien phi, khong can key)
//   TTS_GEMINI_VOICE_A/B - giong Gemini TTS (Kore / Charon)
//   TTS_GEMINI_MODEL - default 'gemini-2.5-flash-preview-tts'
// Ho tro nhieu key (*_API_KEY="k1,k2", *_API_KEY_2...) qua expandKeys - key
// loi/quota thi thu key tiep, roi provider tiep. Het provider -> null, route
// bo qua audio (khong chan generate).
// Luu y: edge-tts bi MS chan WS tu IP datacenter (Vercel) nen gemini la
// provider quyet dinh tren production; edge van huu ich cho local/self-host.

import { createAdminClient } from "@/lib/supabase/admin";
import { expandKeys, aiProviderAllowed, aiEndpointAllowed } from "@/lib/ai";

// TTS_BASE_URL/TTS_API_KEY: endpoint+credential rieng khi TTS khac text
// provider. Mac dinh OpenAI; destination phai nam trong AI_ALLOWED_ENDPOINTS.
const TTS_BASE_URL = (process.env.TTS_BASE_URL ?? "https://api.openai.com/v1")
  .replace(/\/$/, "");
const MAX_TURNS = 12;

// Giong edge-tts mac dinh theo ngu canh - override bang env khi can.
const EDGE_VOICE = {
  en_a: process.env.TTS_EDGE_VOICE_A ?? "en-US-AndrewNeural",
  en_b: process.env.TTS_EDGE_VOICE_B ?? "en-US-AvaNeural",
  vi: process.env.TTS_EDGE_VOICE_VI ?? "vi-VN-HoaiMyNeural",
};

// Giong Gemini TTS (prebuilt names, tu nhan dien ngon ngu) - provider quan
// trong tren serverless vi MS chan WS upgrade tu IP datacenter (edge-tts
// chi chay duoc o moi truong co IP residential).
const GEMINI_VOICE = {
  a: process.env.TTS_GEMINI_VOICE_A ?? "Kore",
  b: process.env.TTS_GEMINI_VOICE_B ?? "Charon",
};

// Provider flag theo TTS_PROVIDER: auto = tat ca; con lai = chi provider do.
function ttsProviders() {
  const provider = process.env.TTS_PROVIDER ?? "auto";
  const want = (p: string) => provider === "auto" || provider === p;
  return {
    openai: want("openai") && aiProviderAllowed("openai"),
    edge: want("edge") && aiProviderAllowed("edge"),
    gemini: want("gemini") && aiProviderAllowed("gemini"),
  };
}

// Gemini TTS tra raw PCM 24kHz s16 mono -> goi WAV header de thanh file hop
// le (pptx addMedia + <audio> deu ho tro wav).
function pcmToWav(pcm: Buffer, sampleRate = 24_000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Gemini TTS qua generateContent - responseModalities AUDIO, tra base64 PCM.
// Thu tung key trong expandKeys("gemini"); quota/5xx skip key tiep.
async function geminiSegment(
  text: string,
  voiceName: string,
  keys: string[],
  deadlineAt: number,
): Promise<Buffer | null> {
  const model = process.env.TTS_GEMINI_MODEL ?? "gemini-2.5-flash-preview-tts";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  if (!aiEndpointAllowed(url)) return null;
  for (const key of keys) {
    const left = deadlineAt - Date.now();
    if (left < 1_000) break;
    try {
      const res = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.slice(0, 4000) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
          },
        }),
        signal: AbortSignal.timeout(Math.min(30_000, left)),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
      };
      const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) return Buffer.from(b64, "base64");
    } catch {
      // Timeout/network - thu key tiep.
    }
  }
  return null;
}

// edge-tts: endpoint doc to cua Microsoft, mien phi - provider fallback cuoi.
// TTS_PROVIDER=edge de ep dung rieng; =openai de tat edge.
// CR-056: msedge-tts 2.1.0 chet tu 10/2026 (MS chi chap nhan Sec-MS-GEC v2)
// -> doi sang fork @andresaya/edge-tts da port thuat toan v2.
async function edgeSegment(
  text: string,
  voice: string,
  deadlineAt: number,
): Promise<Buffer | null> {
  if (!aiProviderAllowed("edge")) return null;
  // R3: endpoint thuc te cua edge-tts cung qua AI_ALLOWED_ENDPOINTS.
  if (!aiEndpointAllowed("https://api.msedgeservices.com")) return null;
  // Deadline cover ca mo WebSocket lan stream - fallback het budget thi bo
  // qua thay vi lech khoi budget route. AbortSignal truyen thang vao options.
  const left = deadlineAt - Date.now();
  if (left < 2_000) return null;
  const { EdgeTTS } = await import("@andresaya/edge-tts");
  const tts = new EdgeTTS();
  try {
    const chunks: Buffer[] = [];
    for await (const c of tts.synthesizeStream(text.slice(0, 4000), voice, {
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
      signal: AbortSignal.timeout(Math.min(25_000, left)),
    })) chunks.push(Buffer.from(c));
    return chunks.length ? Buffer.concat(chunks) : null;
  } catch (e) {
    console.error("[tts-edge] failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

interface Turn { speaker: string; line: string }

// Prefix bai tap khong phai luot hoi thoai du match dang "X: ...".
const NON_DIALOGUE = new Set([
  "mc", "mcq", "tf", "true", "false", "fill", "exercise", "question", "q",
  "a", "b", "c", "d", "answer", "key", "note", "task", "activity",
]);
// Nhan "A:"/"B:" trong section tua Dialogue/Hoi thoai la TEN NHAN VAT
// (dang sach giao khoa), khong phai lua chon MCQ - chi chan o quet fallback.
const LETTER_SPEAKERS = new Set(["a", "b", "c", "d"]);

function collectTurns(
  sections: { title?: string; blocks?: { kind: string; text?: string; items?: string[] }[] }[],
  turns: Turn[],
  seen: Set<string>,
  letterSpeakers = false,
) {
  for (const sec of sections) {
    for (const b of sec.blocks ?? []) {
      const texts: string[] =
        b.kind === "list" ? (b.items ?? []) : b.text ? [b.text] : [];
      for (const t of texts) {
        const m = /^\s*([A-Z][A-Za-z' ]{0,20})\s*[:：]\s*(.+)$/.exec(t.trim());
        if (!m) continue;
        const speaker = m[1].trim().toLowerCase();
        if (
          NON_DIALOGUE.has(speaker) &&
          !(letterSpeakers && LETTER_SPEAKERS.has(speaker))
        ) continue;
        const line = m[2].trim();
        // Dedup theo cap speaker|line: hai nhan vat noi cung mot cau van la
        // hai luot ("Alice: Hello." -> "Bob: Hello." khong mat luot Bob).
        const k = `${speaker}|${line.toLowerCase()}`;
        if (!line || seen.has(k)) continue;
        seen.add(k);
        turns.push({ speaker: m[1].trim(), line });
        if (turns.length >= MAX_TURNS) return;
      }
    }
  }
}

// Trich lượt hoi thoai "Name: text" - uu tien section co title kieu
// "Dialogue"/"Hội thoại"; khong thay thi quet toan doc (da loc prefix bai tap).
export function extractDialogueTurns(doc: {
  sections?: { title?: string; blocks?: { kind: string; text?: string; items?: string[] }[] }[];
}): Turn[] {
  const turns: Turn[] = [];
  const seen = new Set<string>();
  const dialogueSecs = (doc.sections ?? []).filter((s) =>
    /dialogue|hội thoại|conversation|hoi thoai/i.test(s.title ?? ""),
  );
  collectTurns(dialogueSecs, turns, seen, true);
  if (turns.length < 2) {
    // Quet phan con lai (khong quet lai section dialogue da doc).
    const rest = (doc.sections ?? []).filter((s) => !dialogueSecs.includes(s));
    collectTurns(rest, turns, seen);
  }
  return turns;
}

async function ttsSegment(
  text: string,
  voice: string,
  keys: string[],
  url: string,
  deadlineAt: number,
  edgeVoice?: string,
): Promise<Buffer | null> {
  const model = process.env.TTS_MODEL ?? "gpt-4o-mini-tts";
  const use = ttsProviders();
  // Provider 1: OpenAI-compatible /audio/speech (het key thi sang edge).
  if (keys.length && use.openai) {
    for (const key of keys) {
      // R4: budget tinh lai TRUOC MOI KEY - truoc day moi key nhan lai
      // timeout day du nen 30s budget chay toi 90s khi key loi.
      const left = deadlineAt - Date.now();
      if (left < 1_000) break;
      try {
        const res = await fetch(url, {
          method: "POST",
          // R4: khong follow redirect - 307/308 forward body + bearer key sang
          // host ngoai allowlist.
          redirect: "error",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, voice, input: text.slice(0, 4000) }),
          signal: AbortSignal.timeout(Math.min(30_000, left)),
        });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      } catch {
        // Timeout/network/redirect - thu key tiep.
      }
    }
  }
  // Provider 2: edge-tts mien phi (bo qua khi TTS_PROVIDER=openai/gemini).
  if (use.edge) {
    return edgeSegment(text, edgeVoice ?? EDGE_VOICE.en_a, deadlineAt);
  }
  return null;
}

// Mp3 la stream frame - noi binary hop le playback trong moi player hien dai.
// deadlineMs: nguyen budget route con lai - moi batch check, het gio thi bo
// audio thay vi pha vao timeout route (r3 finding 7).
export async function synthesizeDialogue(
  turns: Turn[],
  deadlineMs = 90_000,
): Promise<Buffer | null> {
  if (!turns.length) return null;
  // R16: TTS cung la external AI processor - phai tuan theo
  // AI_ALLOWED_PROVIDERS giong text providers.
  const use = ttsProviders();
  if (!use.openai && !use.edge && !use.gemini) return null;
  const useOpenai = use.openai, useEdge = use.edge, useGemini = use.gemini;
  // R3: destination thuc te cung phai nam trong AI_ALLOWED_ENDPOINTS - text
  // providers qua openaiBaseUrl() da fail-closed, TTS khong duoc la lo thoat.
  const url = `${TTS_BASE_URL}/audio/speech`;
  const keys = useOpenai && aiEndpointAllowed(url)
    ? ((process.env.TTS_API_KEY ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean).length
        ? (process.env.TTS_API_KEY ?? "").split(",").map((s) => s.trim()).filter(Boolean)
        : expandKeys("openai"))
    : [];
  const deadlineAt = Date.now() + deadlineMs;
  const voiceA = process.env.TTS_VOICE_A ?? "alloy";
  const voiceB = process.env.TTS_VOICE_B ?? "nova";
  // Moi nhan vat map 1 giong tren tung provider.
  const speakers = new Map<string, { openai: string; edge: string; gemini: string }>();
  for (const t of turns) {
    if (!speakers.has(t.speaker)) {
      speakers.set(
        t.speaker,
        speakers.size === 0
          ? { openai: voiceA, edge: EDGE_VOICE.en_a, gemini: GEMINI_VOICE.a }
          : { openai: voiceB, edge: EDGE_VOICE.en_b, gemini: GEMINI_VOICE.b },
      );
    }
  }
  // Pass 1: openai -> edge (mp3 frame concat hop le). Khi co gemini fallback
  // thi chung 30s cuoi cho pass 2 - n key openai timeout noi tiep khong duoc
  // an sach budget khien gemini (can >=8s) khong bao gio duoc chay.
  const mp3DeadlineAt = useGemini ? deadlineAt - 30_000 : deadlineAt;
  if (useOpenai || useEdge) {
    const parts: Buffer[] = [];
    let ok = true;
    // Gioi han 4 song song de khong doi qua lau.
    for (let i = 0; i < turns.length; i += 4) {
      if (mp3DeadlineAt - Date.now() < 8_000) { ok = false; break; }
      const segs = await Promise.all(
        turns.slice(i, i + 4).map((t) => {
          const v = speakers.get(t.speaker) ?? { openai: voiceA, edge: EDGE_VOICE.en_a, gemini: GEMINI_VOICE.a };
          return ttsSegment(t.line, v.openai, keys, url, mp3DeadlineAt, v.edge);
        }),
      );
      if (segs.some((s) => !s)) { ok = false; break; }
      parts.push(...(segs as Buffer[]));
    }
    if (ok && parts.length) return Buffer.concat(parts);
  }
  // Pass 2: gemini - PCM concat -> WAV. Chay o function level de file output
  // dong nhat format (khong tron mp3+pcm trong 1 stream).
  if (useGemini) {
    const gkeys = expandKeys("gemini");
    const pcmParts: Buffer[] = [];
    let ok = true;
    for (let i = 0; i < turns.length; i += 4) {
      if (deadlineAt - Date.now() < 8_000) { ok = false; break; }
      const segs = await Promise.all(
        turns.slice(i, i + 4).map((t) => {
          const v = speakers.get(t.speaker) ?? { openai: voiceA, edge: EDGE_VOICE.en_a, gemini: GEMINI_VOICE.a };
          return geminiSegment(t.line, v.gemini, gkeys, deadlineAt);
        }),
      );
      if (segs.some((s) => !s)) { ok = false; break; }
      pcmParts.push(...(segs as Buffer[]));
    }
    if (ok && pcmParts.length) return pcmToWav(Buffer.concat(pcmParts));
  }
  return null;
}

// CR-018 P1/P2: narration 1 giong cho bai doc (A-01), tu vung (A-02) va
// van ban Tieng Viet (V-02). Text dai -> chunk theo cau, noi mp3 theo thu tu.
export async function synthesizeSpeech(
  text: string,
  deadlineMs = 60_000,
  voice?: string,
  lang: "en" | "vi" = "en",
): Promise<Buffer | null> {
  if (!text.trim()) return null;
  const use = ttsProviders();
  if (!use.openai && !use.edge && !use.gemini) return null;
  const useOpenai = use.openai, useEdge = use.edge, useGemini = use.gemini;
  const url = `${TTS_BASE_URL}/audio/speech`;
  const keys =
    useOpenai && aiEndpointAllowed(url)
      ? ((process.env.TTS_API_KEY ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean).length
          ? (process.env.TTS_API_KEY ?? "").split(",").map((s) => s.trim()).filter(Boolean)
          : expandKeys("openai"))
      : [];
  if (!keys.length && !useEdge && !useGemini) return null;

  const deadlineAt = Date.now() + deadlineMs;
  const v = voice ?? process.env.TTS_VOICE_A ?? "alloy";
  const edgeV = lang === "vi" ? EDGE_VOICE.vi : EDGE_VOICE.en_a;
  // Chia text >3900 ky tu theo ranh gioi cau de khong cat giua tu.
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > 3900 && chunks.length < 6) {
    const cut = rest.lastIndexOf(".", 3900);
    chunks.push(rest.slice(0, cut > 2000 ? cut + 1 : 3900));
    rest = rest.slice(chunks[chunks.length - 1].length).trim();
  }
  if (rest) chunks.push(rest.slice(0, 3900));

  // Pass 1: openai -> edge (mp3). Chung 30s cho pass gemini nhu tren.
  const mp3DeadlineAt = useGemini ? deadlineAt - 30_000 : deadlineAt;
  if (useOpenai || useEdge) {
    const parts: Buffer[] = [];
    let ok = true;
    for (let i = 0; i < chunks.length; i += 2) {
      if (mp3DeadlineAt - Date.now() < 8_000) { ok = false; break; }
      const segs = await Promise.all(
        chunks
          .slice(i, i + 2)
          .map((c) => ttsSegment(c, v, keys, url, mp3DeadlineAt, edgeV)),
      );
      if (segs.some((s) => !s)) { ok = false; break; }
      parts.push(...(segs as Buffer[]));
    }
    if (ok && parts.length) return Buffer.concat(parts);
  }
  // Pass 2: gemini PCM -> WAV (dong nhat format ca file).
  if (useGemini) {
    const gkeys = expandKeys("gemini");
    const pcmParts: Buffer[] = [];
    let ok = true;
    for (let i = 0; i < chunks.length; i += 2) {
      if (deadlineAt - Date.now() < 8_000) { ok = false; break; }
      const segs = await Promise.all(
        chunks
          .slice(i, i + 2)
          .map((c) => geminiSegment(c, GEMINI_VOICE.a, gkeys, deadlineAt)),
      );
      if (segs.some((s) => !s)) { ok = false; break; }
      pcmParts.push(...(segs as Buffer[]));
    }
    if (ok && pcmParts.length) return pcmToWav(Buffer.concat(pcmParts));
  }
  return null;
}

// Upload mp3/wav len bucket public tvc-media; tra path tuong doi cho doc
// block. Gemini TTS tra PCM -> pcmToWav, nen detect RIFF magic de dung
// extension + content-type (pptx addMedia va <audio> deu doc wav duoc).
export async function uploadTtsAudio(
  schoolId: string | null,
  buffer: Buffer,
): Promise<string | null> {
  const isWav = buffer.length > 12 && buffer.toString("latin1", 0, 4) === "RIFF";
  const supabase = createAdminClient();
  const path = `${schoolId ?? "shared"}/a03/${crypto.randomUUID()}.${isWav ? "wav" : "mp3"}`;
  const { error } = await supabase.storage
    .from("tvc-media")
    .upload(path, buffer, {
      contentType: isWav ? "audio/wav" : "audio/mpeg",
      upsert: false,
    });
  if (error) {
    console.error("[tts] upload failed:", error.message);
    return null;
  }
  return path;
}
