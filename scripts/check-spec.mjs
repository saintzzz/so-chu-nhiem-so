#!/usr/bin/env node
/**
 * check-spec.mjs - deterministic spec linter (CR-2026-05 P0-2).
 *
 * Scans committed spec artifacts (docs files whose name contains prd, srs,
 * spec, or requirements - case-insensitive) for the failure modes that turn
 * into rework later:
 *
 *   FAIL  - requirement/NFR lines with no number (capacity, latency, uptime,
 *           security, scale words present but zero digits)
 *   FAIL  - vague banned terms in requirement context ("user-friendly",
 *           "seamless", "robust", "fast", "appropriate", "as needed", ...)
 *   FAIL  - user-story blocks ("**As a**") with no AC-x.y / Scenario anchor
 *   WARN  - unresolved markers (TBD / TODO / open question / placeholder)
 *   `--strict` promotes WARN to FAIL. Exit 1 on any FAIL, 0 otherwise.
 *
 * Suppression: a line containing `spec-lint-ignore` is skipped; a file whose
 * frontmatter contains `check-spec: off` is skipped. INTENT.md is never
 * linted - the originator's own words are allowed to be vague (resolving
 * them is the BA's job).
 *
 * Skips cleanly (exit 0, one line) when no spec artifacts exist - same
 * contract as check-vercel-config.mjs.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd(); // run from repo root, like check-vercel-config.mjs
const STRICT = process.argv.includes('--strict');
const SPEC_RE = /(prd|srs|spec|requirements)/i;
const SKIP_NAMES = /^(intent|memory|readme|changelog|contributing|review|runs)\.md$/i;

// Words that signal a measurable requirement - if present, a digit must be too.
const NFR_SIGNAL = /\b(performance|latency|capacity|concurrent|throughput|uptime|availability|scalab\w*|response time|load time|page load|rps|requests per second|users? online|recovery|rto|rpo|retention|wcag|uptime|sla|slo)\b/i;

// Terms that are unverifiable by construction in a spec context.
const VAGUE_TERMS = /\b(user-friendly|intuitive|seamless(?:ly)?|robust|fast|quick(?:ly)?|easy to use|easy-to-use|appropriate(?:ly)?|suitable|adequate(?:ly)?|as needed|if needed|where possible|best practice|high quality|high-quality|modern|flexible|efficient(?:ly)?)\b/i;

const OPEN_MARKERS = /\b(TBD|TODO|FIXME|open question|placeholder|to be decided|to be determined)\b/i;

// Lines that are allowed to be prose: headings, tables of contents, quotes,
// comments, and meta sections about the document itself.
function isProseContext(line) {
  const t = line.trim();
  if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('<!--')) return true;
  if (/^\|[\s-]+\|/.test(t)) return true; // separator row
  if (/^\*\*(status|origin|change|verdict|priority|effort|business value)\b/i.test(t)) return true;
  return false;
}

// Requirement-ish lines: numbered reqs, bullets in requirement sections,
// "shall/must/should" statements, NFR table rows.
function isRequirementLine(line) {
  const t = line.trim();
  if (/\b(shall|must|required|requirement|nfr|non-functional)\b/i.test(t)) return true;
  if (/^\|\s*[^|]+\|/.test(t)) return true; // table row (NFR matrices)
  if (/^[-*]\s+/.test(t)) return true;     // bullet
  if (/^(FR|NFR|REQ|US|AC|BR)-?\d/i.test(t)) return true;
  return false;
}

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory() && !e.startsWith('.') && e !== 'node_modules') yield* walk(p);
    else if (s.isFile() && e.endsWith('.md')) yield p;
  }
}

function findSpecFiles() {
  const docs = join(ROOT, 'docs');
  const candidates = [];
  for (const base of [docs, ROOT]) {
    let files = [];
    try { files = base === docs ? [...walk(docs)] : readdirSync(base).filter(f => f.endsWith('.md')).map(f => join(base, f)); } catch { continue; }
    for (const f of files) {
      const name = f.split(/[\\/]/).pop();
      if (SKIP_NAMES.test(name)) continue;
      if (SPEC_RE.test(name) || (base === docs && SPEC_RE.test(relative(docs, f)))) candidates.push(f);
    }
  }
  return [...new Set(candidates)];
}

const files = findSpecFiles();
if (!files.length) {
  console.log('check-spec: no spec artifacts found (docs/*prd|srs|spec|requirements*) - skip');
  process.exit(0);
}

const fails = [], warns = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (/^---[\s\S]*?check-spec:\s*off[\s\S]*?---/.test(text.slice(0, 400))) continue;
  const rel = relative(ROOT, file);
  const lines = text.split('\n');
  let inFence = false;

  lines.forEach((line, i) => {
    if (/^```/.test(line.trim())) { inFence = !inFence; return; }
    if (inFence || line.includes('spec-lint-ignore')) return;
    const loc = `${rel}:${i + 1}`;
    if (isProseContext(line)) return;

    if (OPEN_MARKERS.test(line)) {
      warns.push(`${loc}  unresolved marker: ${line.trim().slice(0, 100)}`);
      return; // marker warnings trump further checks on the same line
    }
    if (!isRequirementLine(line)) return;
    if (NFR_SIGNAL.test(line) && !/\d/.test(line)) {
      fails.push(`${loc}  measurable-sounding requirement with no number: ${line.trim().slice(0, 100)}`);
    }
    if (VAGUE_TERMS.test(line)) {
      const term = line.match(VAGUE_TERMS)[1];
      fails.push(`${loc}  vague term "${term}" in requirement context: ${line.trim().slice(0, 100)}`);
    }
  });

  // User stories must carry an AC anchor (P0-1 enforcement).
  const storyBlocks = text.split(/(?=\*\*As a\*\*|^As a\s)/gim).filter(b => /^\s*\*{0,2}As a\*{0,2}/im.test(b));
  storyBlocks.forEach((b, i) => {
    if (!/AC-\d+\.\d+|Scenario:/.test(b)) {
      warns.push(`${rel}  user-story block #${i + 1} has no AC-x.y/Scenario anchor`);
    }
  });
}

for (const w of warns) console.log(`WARN  ${w}`);
for (const f of fails) console.log(`FAIL  ${f}`);
if (STRICT && warns.length) fails.push(...warns.map(w => `[strict] ${w}`));

console.log(`\ncheck-spec: ${files.length} spec file(s), ${fails.length} fail, ${warns.length} warn${STRICT ? ' (strict)' : ''}`);
process.exit(fails.length || (STRICT && warns.length) ? 1 : 0);
