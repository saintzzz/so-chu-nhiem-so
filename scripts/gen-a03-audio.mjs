#!/usr/bin/env node
/**
 * Gen audio that cho material A-03 (hoi thoai) bang edge-tts (local,
 * Microsoft neural voices - mien phi, khong can API key), upload len
 * bucket public `tvc-media`, roi chen block {kind:"audio"} vao doc.
 *
 * Usage:
 *   node scripts/gen-a03-audio.mjs <material_id> [--voice-a en-US-AriaNeural] [--voice-b en-US-GuyNeural]
 *
 * Can env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service
 * role de bypass RLS khi patch doc + upload storage).
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const materialId = process.argv[2];
if (!materialId) {
  console.error("usage: gen-a03-audio.mjs <material_id>");
  process.exit(1);
}
const argVal = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const VOICE_A = argVal("--voice-a", "en-US-AriaNeural");
const VOICE_B = argVal("--voice-b", "en-US-GuyNeural");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

// Trich luot hoi thoai "Name: line" - giong extractDialogueTurns trong
// src/lib/tvc/tts.ts nhung doc lap (script chay ngoai Next runtime).
const MAX_TURNS = 12;
const NON_DIALOGUE = new Set([
  "mc", "mcq", "tf", "true", "false", "fill", "exercise", "question", "q",
  "a", "b", "c", "d", "answer", "key", "note", "task", "activity",
]);
function collectTurns(sections, turns, seen) {
  for (const sec of sections) {
    for (const b of sec.blocks ?? []) {
      const texts = b.kind === "list" ? b.items ?? [] : b.text ? [b.text] : [];
      for (const t of texts) {
        const m = /^\s*([A-Z][A-Za-z' ]{0,20})\s*[:：]\s*(.+)$/.exec(String(t).trim());
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
function extractTurns(doc) {
  const turns = [];
  const seen = new Set();
  const dialogueSecs = (doc?.sections ?? []).filter((s) =>
    /dialogue|hội thoại|conversation|hoi thoai/i.test(s.title ?? ""),
  );
  collectTurns(dialogueSecs, turns, seen);
  if (turns.length < 2) collectTurns(doc?.sections ?? [], turns, seen);
  return turns;
}

const { data: mat, error: mErr } = await supabase
  .from("tvc_materials")
  .select("id, title, school_id, content")
  .eq("id", materialId)
  .single();
if (mErr || !mat) {
  console.error("material not found:", mErr?.message);
  process.exit(1);
}

const turns = extractTurns(mat.content);
if (turns.length < 2) {
  console.error(`chi thay ${turns.length} luot hoi thoai - can it nhat 2 "Name: line"`);
  process.exit(1);
}
console.log(`${turns.length} turns:`, turns.map((t) => `${t.speaker}: ${t.line.slice(0, 40)}`));

const speakers = new Map();
for (const t of turns) {
  if (!speakers.has(t.speaker)) speakers.set(t.speaker, speakers.size === 0 ? VOICE_A : VOICE_B);
}

const dir = mkdtempSync(join(tmpdir(), "a03-"));
try {
  const parts = [];
  for (let i = 0; i < turns.length; i++) {
    const f = join(dir, `seg${i}.mp3`);
    execFileSync("edge-tts", [
      "--voice", speakers.get(turns[i].speaker),
      "--text", turns[i].line,
      "--write-media", f,
    ]);
    parts.push(f);
    process.stdout.write(`  [${i + 1}/${turns.length}] ${speakers.get(turns[i].speaker)}\n`);
  }
  // mp3 concat binary - frame stream, player hien dai deu doc duoc.
  const buf = Buffer.concat(parts.map((f) => readFileSync(f)));
  const path = `${mat.school_id ?? "shared"}/a03/${crypto.randomUUID()}.mp3`;
  const { error: upErr } = await supabase.storage
    .from("tvc-media")
    .upload(path, buf, { contentType: "audio/mpeg" });
  if (upErr) throw upErr;

  const content = mat.content;
  const secIdx = content.sections.findIndex(
    (s) => extractTurns({ sections: [s] }).length >= 2,
  );
  const target = secIdx >= 0 ? secIdx : 0;
  content.sections[target].blocks = [
    {
      kind: "audio",
      path,
      caption: `Audio hội thoại - ${turns.length} lượt (${[...speakers.keys()].join(" & ")})`,
    },
    ...(content.sections[target].blocks ?? []),
  ];
  const { error: pErr } = await supabase
    .from("tvc_materials")
    .update({ content })
    .eq("id", materialId);
  if (pErr) throw pErr;
  console.log(`OK -> tvc-media/${path} (${buf.length} bytes)`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
