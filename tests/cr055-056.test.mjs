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
