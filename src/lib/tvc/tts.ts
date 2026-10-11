// TTS cho A-03 (hoi thoai nghe). Provider env-driven:
//   TTS_PROVIDER - hien chi ho tro 'openai' (default khi co OPENAI_API_KEY)
//   TTS_MODEL    - default 'gpt-4o-mini-tts' (chat luong tot, re)
//   TTS_VOICE_A / TTS_VOICE_B - giong 2 nhan vat (default alloy / nova)
// Ho tro nhieu key (OPENAI_API_KEY="k1,k2", OPENAI_API_KEY_2...) qua
// expandKeys - key loi/quota thi thu key tiep. Het key -> null, route bo
// qua audio (khong chan generate).

import { createAdminClient } from "@/lib/supabase/admin";
import { expandKeys, aiProviderAllowed, aiEndpointAllowed } from "@/lib/ai";

// TTS_BASE_URL/TTS_API_KEY: endpoint+credential rieng khi TTS khac text
// provider. Mac dinh OpenAI; destination phai nam trong AI_ALLOWED_ENDPOINTS.
const TTS_BASE_URL = (process.env.TTS_BASE_URL ?? "https://api.openai.com/v1")
  .replace(/\/$/, "");
const MAX_TURNS = 12;

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
): Promise<Buffer | null> {
  const model = process.env.TTS_MODEL ?? "gpt-4o-mini-tts";
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
  return null;
}

// Mp3 la stream frame - noi binary hop le playback trong moi player hien dai.
// deadlineMs: nguyen budget route con lai - moi batch check, het gio thi bo
// audio thay vi pha vao timeout route (r3 finding 7).
export async function synthesizeDialogue(
  turns: Turn[],
  deadlineMs = 90_000,
): Promise<Buffer | null> {
  // R16: TTS cung la external AI processor - phai tuan theo
  // AI_ALLOWED_PROVIDERS giong text providers.
  if (!aiProviderAllowed("openai")) return null;
  // R3: destination thuc te cung phai nam trong AI_ALLOWED_ENDPOINTS - text
  // providers qua openaiBaseUrl() da fail-closed, TTS khong duoc la lo thoat.
  const url = `${TTS_BASE_URL}/audio/speech`;
  if (!aiEndpointAllowed(url)) return null;
  // TTS_API_KEY cho phep tach credential khi endpoint TTS khac text endpoint -
  // khong gui bearer key cua compatible-provider len host khac.
  const keys = (process.env.TTS_API_KEY ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const effectiveKeys = keys.length ? keys : expandKeys("openai");
  if (!turns.length || !effectiveKeys.length) return null;
  const deadlineAt = Date.now() + deadlineMs;
  const voiceA = process.env.TTS_VOICE_A ?? "alloy";
  const voiceB = process.env.TTS_VOICE_B ?? "nova";
  const speakers = new Map<string, string>();
  for (const t of turns) {
    if (!speakers.has(t.speaker)) {
      speakers.set(t.speaker, speakers.size === 0 ? voiceA : voiceB);
    }
  }
  const parts: Buffer[] = [];
  // Gioi han 4 song song de khong doi qua lau.
  for (let i = 0; i < turns.length; i += 4) {
    if (deadlineAt - Date.now() < 8_000) return null; // het budget - bo audio, giu doc.
    const segs = await Promise.all(
      turns.slice(i, i + 4).map((t) =>
        ttsSegment(
          t.line,
          speakers.get(t.speaker) ?? voiceA,
          effectiveKeys,
          url,
          deadlineAt,
        ),
      ),
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
