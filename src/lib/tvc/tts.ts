// TTS cho A-03 (hoi thoai nghe). Provider env-driven:
//   TTS_PROVIDER - hien chi ho tro 'openai' (default khi co OPENAI_API_KEY)
//   TTS_MODEL    - default 'gpt-4o-mini-tts' (chat luong tot, re)
//   TTS_VOICE_A / TTS_VOICE_B - giong 2 nhan vat (default alloy / nova)
// Khong co key -> tra null, route bo qua audio (khong chan generate).

import { createAdminClient } from "@/lib/supabase/admin";

const TTS_URL = "https://api.openai.com/v1/audio/speech";
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

async function ttsSegment(text: string, voice: string): Promise<Buffer | null> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.TTS_MODEL ?? "gpt-4o-mini-tts";
  if (!key) return null;
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, voice, input: text.slice(0, 4000) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// Mp3 la stream frame - noi binary hop le playback trong moi player hien dai.
export async function synthesizeDialogue(turns: Turn[]): Promise<Buffer | null> {
  if (!turns.length) return null;
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
    const segs = await Promise.all(
      turns.slice(i, i + 4).map((t) =>
        ttsSegment(t.line, speakers.get(t.speaker) ?? voiceA),
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
