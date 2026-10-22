// TTS cho cac tool can audio. Provider chain env-driven (CR-018):
//   TTS_PROVIDER - 'openai' | 'edge' | 'auto' (default auto = openai -> edge)
//   TTS_MODEL    - default 'gpt-4o-mini-tts' (chat luong tot, re)
//   TTS_VOICE_A / TTS_VOICE_B - giong OpenAI 2 nhan vat (alloy / nova)
//   TTS_EDGE_VOICE_* - giong edge-tts neural (mien phi, khong can key)
// Ho tro nhieu key (OPENAI_API_KEY="k1,k2", OPENAI_API_KEY_2...) qua
// expandKeys - key loi/quota thi thu key tiep, roi edge-tts. Het provider
// -> null, route bo qua audio (khong chan generate).

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

// edge-tts: endpoint doc to cua Microsoft, mien phi - provider fallback cuoi.
// TTS_PROVIDER=edge de ep dung rieng; =openai de tat edge.
async function edgeSegment(
  text: string,
  voice: string,
  deadlineAt: number,
): Promise<Buffer | null> {
  if (!aiProviderAllowed("edge")) return null;
  // R3: endpoint thuc te cua edge-tts cung qua AI_ALLOWED_ENDPOINTS.
  if (!aiEndpointAllowed("https://speech.platform.bing.com")) return null;
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    );
    const { audioStream } = tts.toStream(text.slice(0, 4000));
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => audioStream.destroy(), Math.min(25_000, deadlineAt - Date.now()));
    try {
      for await (const c of audioStream as AsyncIterable<Buffer>) chunks.push(c);
    } finally {
      clearTimeout(timeout);
    }
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

function collectTurns(
  sections: { title?: string; blocks?: { kind: string; text?: string; items?: string[] }[] }[],
  turns: Turn[],
  seen: Set<string>,
) {
  for (const sec of sections) {
    for (const b of sec.blocks ?? []) {
      const texts: string[] =
        b.kind === "list" ? (b.items ?? []) : b.text ? [b.text] : [];
      for (const t of texts) {
        const m = /^\s*([A-Z][A-Za-z' ]{0,20})\s*[:：]\s*(.+)$/.exec(t.trim());
        if (!m) continue;
        if (NON_DIALOGUE.has(m[1].trim().toLowerCase())) continue;
        const line = m[2].trim();
        const k = line.toLowerCase();
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
  collectTurns(dialogueSecs, turns, seen);
  if (turns.length < 2) {
    collectTurns(doc.sections ?? [], turns, seen);
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
  // Provider 1: OpenAI-compatible /audio/speech (het key thi sang edge).
  if (keys.length && (process.env.TTS_PROVIDER ?? "auto") !== "edge") {
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
  // Provider 2: edge-tts mien phi (bo qua khi TTS_PROVIDER=openai).
  if ((process.env.TTS_PROVIDER ?? "auto") !== "openai") {
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
  const provider = process.env.TTS_PROVIDER ?? "auto";
  // R16: TTS cung la external AI processor - phai tuan theo
  // AI_ALLOWED_PROVIDERS giong text providers.
  const useOpenai = provider !== "edge" && aiProviderAllowed("openai");
  const useEdge = provider !== "openai" && aiProviderAllowed("edge");
  if (!useOpenai && !useEdge) return null;
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
  // OpenAI: 2 giong alloy/nova. Edge: 2 giong neural tieng Anh.
  const speakers = new Map<string, { openai: string; edge: string }>();
  for (const t of turns) {
    if (!speakers.has(t.speaker)) {
      speakers.set(
        t.speaker,
        speakers.size === 0
          ? { openai: voiceA, edge: EDGE_VOICE.en_a }
          : { openai: voiceB, edge: EDGE_VOICE.en_b },
      );
    }
  }
  const parts: Buffer[] = [];
  // Gioi han 4 song song de khong doi qua lau.
  for (let i = 0; i < turns.length; i += 4) {
    if (deadlineAt - Date.now() < 8_000) return null; // het budget - bo audio, giu doc.
    const segs = await Promise.all(
      turns.slice(i, i + 4).map((t) => {
        const v = speakers.get(t.speaker) ?? { openai: voiceA, edge: EDGE_VOICE.en_a };
        return ttsSegment(t.line, v.openai, keys, url, deadlineAt, v.edge);
      }),
    );
    if (segs.some((s) => !s)) return null;
    parts.push(...(segs as Buffer[]));
  }
  return Buffer.concat(parts);
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
  const provider = process.env.TTS_PROVIDER ?? "auto";
  const useOpenai = provider !== "edge" && aiProviderAllowed("openai");
  const useEdge = provider !== "openai" && aiProviderAllowed("edge");
  if (!useOpenai && !useEdge) return null;
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
  if (!keys.length && !useEdge) return null;

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

  const parts: Buffer[] = [];
  for (let i = 0; i < chunks.length; i += 2) {
    if (deadlineAt - Date.now() < 8_000) return null;
    const segs = await Promise.all(
      chunks
        .slice(i, i + 2)
        .map((c) => ttsSegment(c, v, keys, url, deadlineAt, edgeV)),
    );
    if (segs.some((s) => !s)) return null;
    parts.push(...(segs as Buffer[]));
  }
  return Buffer.concat(parts);
}

// Upload mp3 len bucket public tvc-media; tra path tuong doi cho doc block.
export async function uploadTtsAudio(
  schoolId: string | null,
  buffer: Buffer,
): Promise<string | null> {
  const supabase = createAdminClient();
  const path = `${schoolId ?? "shared"}/a03/${crypto.randomUUID()}.mp3`;
  const { error } = await supabase.storage
    .from("tvc-media")
    .upload(path, buffer, { contentType: "audio/mpeg", upsert: false });
  if (error) {
    console.error("[tts] upload failed:", error.message);
    return null;
  }
  return path;
}
