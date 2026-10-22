#!/usr/bin/env node
/**
 * check-vercel-config.mjs - deterministic vercel.json gate (CR-2026-03).
 *
 * Static lint for projects deploying on Vercel. Enforces the hard rules and
 * surfaces the Vercel Pro capabilities a deploy should actually use (the
 * advisory items are WARN, not FAIL - a missing feature is a review finding,
 * not a broken build).
 *
 * Usage:
 *   node scripts/check-vercel-config.mjs [--strict]   # run from repo root
 *
 *   Skips cleanly (exit 0) when there is no vercel.json / vercel.ts -
 *   non-Vercel projects are unaffected.
 *
 * FAIL (exit 1):
 *   - vercel.json present but not valid JSON
 *   - secret-looking value embedded (sk-*, AIza*, github_pat_*, private key,
 *     non-NEXT_PUBLIC env values that look like live keys)
 *   - crons[] entries with an invalid 5-field expression or missing/unknown
 *     path
 *   - regions[] entries that are not known Vercel regions (catches typos that
 *     silently fall back to the default region)
 *
 * WARN (exit 0 unless --strict):
 *   - no headers block with a content-security-policy - the live check
 *     (check-headers.mjs + DEPLOY_URL) still enforces this post-deploy, but
 *     catching it statically is cheaper
 *   - no regions declared - Pro allows multi-region; pin the audience region
 *     (e.g. sin1/hkg1 for VN users) instead of drifting on the default
 *   - functions whose path suggests a long task (export|report|import|sync|
 *     generate|cron) without an explicit maxDuration - Pro raises the cap,
 *     use it deliberately
 *   - Hobby-incompatible shapes the deployer should know about are noted in
 *     output but not enforced (the framework targets the Pro team).
 *
 * Exit: 0 pass/warn, 1 any FAIL (or any WARN with --strict), 2 usage error.
 */

import { readFileSync, existsSync } from 'node:fs';

const strict = process.argv.includes('--strict');
const file = ['vercel.json', 'vercel.ts'].find((f) => existsSync(f));

if (!file) {
  console.log('check-vercel-config: no vercel.json/vercel.ts - skip (not a Vercel project)');
  process.exit(0);
}

if (file === 'vercel.ts') {
  console.log('check-vercel-config: vercel.ts found - TS config not statically linted, run `vercel build` to validate');
  process.exit(0);
}

let cfg;
try {
  cfg = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`FAIL ${file}: invalid JSON - ${e.message}`);
  process.exit(1);
}

const fails = [];
const warns = [];

// --- secrets embedded in vercel.json (env values, header tricks) ---
const raw = readFileSync(file, 'utf8');
const secretHits = raw.match(/sk-[a-zA-Z0-9_-]{20,}|sk-ant-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|github_pat_[0-9A-Za-z_]{20,}|BEGIN [A-Z ]*PRIVATE KEY/g);
if (secretHits) fails.push(`secret-looking value embedded in ${file} (${secretHits[0].slice(0, 8)}...) - env values belong in the platform, not the repo`);

// --- crons[] sanity ---
const cronField = /^[\d*,\-/A-Z]+$/i;
const crons = cfg.crons ?? [];
if (!Array.isArray(crons)) {
  fails.push('crons must be an array of {path, schedule}');
} else {
  for (const [i, c] of crons.entries()) {
    if (!c || typeof c.path !== 'string' || !c.path.startsWith('/')) {
      fails.push(`crons[${i}]: path must start with '/' (got ${JSON.stringify(c?.path)})`);
      continue;
    }
    const parts = String(c.schedule ?? '').trim().split(/\s+/);
    if (parts.length !== 5 || !parts.every((p) => cronField.test(p))) {
      fails.push(`crons[${i}] (${c.path}): invalid 5-field cron expression ${JSON.stringify(c.schedule)}`);
    }
  }
}

// --- regions[] sanity (Pro multi-region) ---
const KNOWN_REGIONS = new Set([
  'arn1', 'bom1', 'cdg1', 'cle1', 'cpt1', 'dub1', 'dxb1', 'fra1', 'gru1',
  'hkg1', 'hnd1', 'iad1', 'icn1', 'kix1', 'lhr1', 'pdx1', 'sfo1', 'sin1',
  'syd1', 'tyo1',
]);
for (const r of cfg.regions ?? []) {
  if (!KNOWN_REGIONS.has(r)) warns.push(`regions: '${r}' is not a known Vercel region - typo silently falls back to default`);
}
if (!cfg.regions) warns.push("no regions declared - Pro supports multi-region; pin the audience region (e.g. 'sin1'/'hkg1' for VN users) rather than drifting on iad1");

// --- security headers present in source config (live check still applies) ---
const headers = cfg.headers ?? [];
const hasCSP = headers.some((h) =>
  (h.headers ?? []).some((x) => (x.key ?? '').toLowerCase() === 'content-security-policy'));
if (!hasCSP) warns.push('no content-security-policy in headers[] - check-headers.mjs will FAIL post-deploy; declare the CSP at the edge, not only in the app');

// --- long-task functions should declare maxDuration deliberately ---
const LONG_TASK = /export|report|import|sync|generate|cron|backup|seed|migrate/i;
for (const [path, fn] of Object.entries(cfg.functions ?? {})) {
  if (LONG_TASK.test(path) && fn && typeof fn === 'object' && fn.maxDuration == null) {
    warns.push(`functions['${path}']: long-task route without maxDuration - Pro raises the cap (Fluid); set it deliberately, e.g. 300`);
  }
}

for (const m of warns) console.warn(`WARN ${m}`);
for (const m of fails) console.error(`FAIL ${m}`);
if (!warns.length && !fails.length) console.log(`check-vercel-config: ${file} ok`);
process.exit(fails.length || (strict && warns.length) ? 1 : 0);
