// CR-055/056 coverage - tenant index audit + TTS tach sang audio endpoint.
// Chay: node --test tests/cr055-056.test.mjs
// AC-55.x: static guard tren migration file.
// AC-56.x: static guard tren audio route + generate route + tool-runner
// (integration browser/DB thuoc qa-full-coverage).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const MIG = read("supabase/migrations/20261023_cr055_tenant_indexes.sql");
const AUDIO = read("src/app/api/studio/tools/[code]/audio/route.ts");
const GEN = read("src/app/api/studio/tools/[code]/generate/route.ts");
const RUNNER = read("src/components/tvc/tool-runner.tsx");

// ---------- CR-055: tenant index audit ----------

test("AC-55.1: activity_announcements co index school_id", () => {
  assert.match(MIG, /idx_activity_announcements_school/);
  assert.match(MIG, /activity_announcements\s*\(school_id\)/);
});

test("AC-55.2: emulation_scores co index (period, class_id)", () => {
  assert.match(MIG, /idx_emulation_scores_period_class/);
  assert.match(MIG, /emulation_scores\s*\(period,\s*class_id\)/);
});

test("AC-55.3: index tao bang concurrently - khong lock ghi", () => {
  const count = (MIG.match(/concurrently/gi) ?? []).length;
  assert.ok(count >= 2);
});

test("AC-55.4: migration nam trong supabase/migrations", () => {
  assert.ok(MIG.length > 50);
});

// ---------- CR-056: TTS tach sang audio endpoint ----------

test("AC-56.1: audio route nhan doc + tra inserts", () => {
  assert.match(AUDIO, /export async function POST/);
  assert.match(AUDIO, /inserts/);
  assert.match(AUDIO, /body\.doc/);
});

test("AC-56.2: audio route co RBAC + feature + quota nhu generate", () => {
  assert.match(AUDIO, /hasAnyRole\(profile, TOOL_ROLES\)/);
  assert.match(AUDIO, /hasFeature\("studio\.ai"\)/);
  assert.match(AUDIO, /takeAiQuota/);
  assert.match(AUDIO, /getClaims/);
});

test("AC-56.3: tool-runner goi audio endpoint sau generate va merge", () => {
  assert.match(RUNNER, /\/api\/studio\/tools\/\$\{tool\.code\}\/audio/);
  assert.match(RUNNER, /fetchAudio\(data\.doc\)/);
  assert.match(RUNNER, /audioPending/);
});

test("AC-56.4: generate route khong con goi TTS noi bo", () => {
  assert.doesNotMatch(GEN, /synthesizeSpeech/);
  assert.doesNotMatch(GEN, /synthesizeDialogue/);
  assert.doesNotMatch(GEN, /uploadTtsAudio/);
});

test("AC-56.5: audio fail -> tra inserts rong, doc khong bi anh huong", () => {
  // Route tra { inserts: [] } tren moi nhanh fail: thieu doc, het quota,
  // roster PII error, TTS provider null.
  const count = (AUDIO.match(/inserts: \[\]/g) ?? []).length;
  assert.ok(count >= 3);
});

test("AC-56.6: A-03 dialogue dung synthesizeDialogue, narration dung synthesizeSpeech", () => {
  assert.match(AUDIO, /extractDialogueTurns/);
  assert.match(AUDIO, /synthesizeDialogue/);
  assert.match(AUDIO, /synthesizeSpeech/);
  // PII: pseudonymize truoc khi gui TTS (r30 H).
  assert.match(AUDIO, /pseudonymizeNames/);
  assert.match(AUDIO, /roster\.error/);
});

// ---------- External review round: dialogue extractor + budget reserve
// + capped media download (findings tu Codex web review) ----------

// Import tts.ts that: stub 2 alias import (@/lib/*) bang no-op de node doc
// truc tiep .ts (type stripping) ma khong can bundler.
const ttsTmp = join(ROOT, "tests/.tmp-tts.ts");
{
  const src = read("src/lib/tvc/tts.ts")
    .replace(
      /import \{ createAdminClient \} from "@\/lib\/supabase\/admin";/,
      "const createAdminClient = () => null;",
    )
    .replace(
      /import \{ expandKeys, aiProviderAllowed, aiEndpointAllowed \} from "@\/lib\/ai";/,
      "const expandKeys = () => []; const aiProviderAllowed = () => false; const aiEndpointAllowed = () => false;",
    );
  const { writeFileSync } = await import("node:fs");
  writeFileSync(ttsTmp, src);
}
const { extractDialogueTurns } = await import(ttsTmp);

test("REV-1: section Hoi thoai cho phep nhan vat A:/B: (dang SGK)", () => {
  const doc = {
    sections: [{
      title: "Hội thoại",
      blocks: [{ kind: "list", items: ["A: Xin chào bạn.", "B: Chào bạn, khỏe không?"] }],
    }],
  };
  const turns = extractDialogueTurns(doc);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].speaker, "A");
  assert.equal(turns[1].speaker, "B");
});

test("REV-1b: ngoai section dialogue thi A:/B: van bi chan (lua chon MCQ)", () => {
  const doc = {
    sections: [{
      title: "Bài tập",
      blocks: [{ kind: "list", items: ["A: dap an 1", "B: dap an 2", "C: dap an 3"] }],
    }],
  };
  assert.equal(extractDialogueTurns(doc).length, 0);
});

test("REV-2: hai nhan vat noi cung mot cau khong bi mat luot", () => {
  const doc = {
    sections: [{
      title: "Dialogue",
      blocks: [{ kind: "list", items: ["Alice: Hello.", "Bob: Hello.", "Alice: How are you?"] }],
    }],
  };
  const turns = extractDialogueTurns(doc);
  assert.equal(turns.length, 3);
  assert.equal(turns[1].speaker, "Bob");
});

test("REV-3: pass mp3 chung 30s cho gemini fallback (ca 2 ham)", () => {
  const src = read("src/lib/tvc/tts.ts");
  const count = (src.match(/mp3DeadlineAt = useGemini \? deadlineAt - 30_000/g) ?? []).length;
  assert.equal(count, 2, "synthesizeDialogue + synthesizeSpeech deu phai reserve");
});

test("REV-4: media download cap bang stream, khong doc arrayBuffer het", () => {
  const src = read("src/lib/tvc/pptx.ts");
  assert.match(src, /async function readCapped/);
  const uses = (src.match(/await readCapped\(/g) ?? []).length;
  assert.ok(uses >= 2, "audio + image deu phai qua readCapped");
  assert.doesNotMatch(src, /await r\.arrayBuffer\(\)/);
});
