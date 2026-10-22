#!/usr/bin/env node
/**
 * check-rtm.mjs - mechanical RTM (requirements traceability) gate.
 *
 * "RTM coverage 100%" is currently asserted in a report; this script computes
 * it. Every `AC-x.y` id DECLARED in requirements docs must appear in at least
 * one test file. Uncovered ACs fail the gate (exit 1) - an AC with no test is
 * incomplete, not untested-by-choice (tester SKILL §8).
 *
 * Usage:
 *   node scripts/check-rtm.mjs [--docs docs] [--tests tests,e2e,scripts]
 *
 *   --docs   comma-separated dirs to scan for AC declarations (default: docs)
 *   --tests  comma-separated dirs to scan for test references
 *            (default: tests,e2e,scripts) - plus any *.test.* / *.spec.* file
 *            anywhere in the repo.
 *
 * Waivers: `.rtm-waivers.json` at repo root maps AC ids to a reason string -
 * the mechanism for brownfield adoption: pre-gate ACs with no test reference
 * are recorded as EXPLICIT DEBT (printed every run) instead of silently
 * passing or blocking the whole harness rollout. New uncovered ACs still
 * fail. Removing the debt = add the test reference AND delete the waiver.
 *
 * Skips cleanly (exit 0) when no AC declarations exist - projects that have
 * not run the BA phase have nothing to trace.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : fallback;
}

const DOC_DIRS = arg('docs', ['docs']);
const TEST_DIRS = arg('tests', ['tests', 'e2e', 'scripts']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor', 'out']);
// AC ids are two-part (AC-x.y) per the BA template convention; a project that
// adopts three-part ids must extend this regex - the gate would miss them.
const AC_RE = /AC-(?:N-)?\d+\.\d+/g;
const TEST_FILE_RE = /\.(test|spec)\.[a-z]+$/;
// A docs file counts as a declaration source only when it is a requirements
// doc: filename matches PRD/requirements/spec/CR-N, or it carries Gherkin
// scenario blocks (the BA template's `Scenario: AC-x.y` form). ADRs/notes that
// merely mention an AC id must not create phantom requirements.
const REQ_FILE_RE = /prd|requirement|spec|cr-\d/i;

function isReqDoc(path, text) {
  return REQ_FILE_RE.test(path) || /Scenario\s*:/.test(text);
}

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, filter, out);
    } else if (filter(p)) out.push(p);
  }
  return out;
}

// Locked/unreadable files (sync clients, OneDrive placeholders) must not
// crash the gate - skip them with a warning instead.
const unreadable = [];
const tryRead = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    unreadable.push(f);
    return null;
  }
};

function collectIds(files) {
  const ids = new Map(); // id -> first file seen in
  for (const f of files) {
    const text = tryRead(f);
    if (text === null) continue;
    for (const m of text.matchAll(AC_RE)) if (!ids.has(m[0])) ids.set(m[0], f);
  }
  return ids;
}

// Declared ACs: AC-x.y ids in requirements docs under --docs.
const docFiles = DOC_DIRS.flatMap((d) => walk(d, (p) => extname(p) === '.md'))
  .filter((f) => {
    const t = tryRead(f);
    return t !== null && isReqDoc(f, t);
  });
const declared = collectIds(docFiles);

// Covered ACs: ids in test dirs + any *.test.* / *.spec.* file repo-wide.
const testFiles = [
  ...TEST_DIRS.flatMap((d) => walk(d, () => true)),
  ...walk('.', (p) => TEST_FILE_RE.test(p)),
];
const covered = collectIds(testFiles);
if (unreadable.length)
  console.log(`rtm: ${unreadable.length} unreadable file(s) skipped: ${unreadable.slice(0, 5).join(', ')}`);

if (declared.size === 0) {
  console.log('rtm: no AC-x.y declarations found under docs/ - skipping (pre-BA project)');
  process.exit(0);
}

const waiverPath = join(process.cwd(), '.rtm-waivers.json');
const waivers = existsSync(waiverPath)
  ? JSON.parse(readFileSync(waiverPath, 'utf8'))
  : {};

const uncovered = [...declared].filter(([id]) => !covered.has(id));
const unwaived = uncovered.filter(([id]) => !(id in waivers));
const waived = uncovered.filter(([id]) => id in waivers);
const orphans = [...covered].filter(([id]) => !declared.has(id));

console.log(
  `rtm: ${declared.size} ACs declared, ${declared.size - uncovered.length} covered` +
    (waived.length ? `, ${waived.length} waived` : ''),
);
for (const [id, f] of unwaived) console.log(`  UNCOVERED ${id}  (declared in ${f})`);
for (const [id] of waived) console.log(`  WAIVED    ${id}  (${waivers[id]})`);
for (const [id, f] of orphans) console.log(`  warn: test references ${id} not in any requirement doc (${f})`);

if (unwaived.length) {
  console.error(`rtm: FAIL - ${unwaived.length} AC(s) have no test reference`);
  process.exit(1);
}
console.log('rtm: PASS');
