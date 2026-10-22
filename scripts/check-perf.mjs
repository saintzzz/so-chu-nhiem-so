#!/usr/bin/env node
/* check-perf.mjs - post-deploy performance probe (CR-2026-07).
 *
 * The enforcement half of "performance verification is mandatory": hits the
 * live URL(s) and FAILS when measured numbers exceed the budgets declared in
 * .perf-budgets.json at repo root. Numbers, not vibes - a stub AC cannot
 * satisfy this gate.
 *
 * Usage:
 *   node scripts/check-perf.mjs <base-url>           # measure + compare
 *   node scripts/check-perf.mjs <base-url> --samples 5
 *
 * .perf-budgets.json shape (all optional):
 *   {
 *     "routes": ["/", "/login"],        // default ["/"]
 *     "ttfb_ms": 1000,                  // max TTFB per route
 *     "response_ms": 3000,              // max full response per route
 *     "max_bytes": 5242880              // max transfer size per route
 *   }
 * No budget file -> measurement report only (never fails).
 *
 * Auth-gated routes: pass a cookie via PERF_COOKIE env
 *   (e.g. PERF_COOKIE="sb-access-token=...").
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/check-perf.mjs <base-url> [--samples N]');
  process.exit(2);
}
const si = process.argv.indexOf('--samples');
const SAMPLES = si > -1 ? parseInt(process.argv[si + 1], 10) : 3;

const budgetPath = join(process.cwd(), '.perf-budgets.json');
const budgets = existsSync(budgetPath)
  ? JSON.parse(readFileSync(budgetPath, 'utf8'))
  : null;
const routes = budgets?.routes?.length ? budgets.routes : ['/'];
const headers = process.env.PERF_COOKIE
  ? { cookie: process.env.PERF_COOKIE }
  : {};

async function probe(url) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers, redirect: 'follow' });
    const ttfb = performance.now() - t0;
    const buf = await res.arrayBuffer();
    const total = performance.now() - t0;
    return { status: res.status, ttfb, total, bytes: buf.byteLength };
  } catch (e) {
    return { error: String(e?.message ?? e) };
  }
}

let fail = 0;
for (const route of routes) {
  const url = new URL(route, base).toString();
  const runs = [];
  for (let i = 0; i < SAMPLES; i++) runs.push(await probe(url));
  const errs = runs.filter((r) => r.error || r.status >= 400);
  const ok = runs.filter((r) => !r.error && r.status < 400);
  const p95 = (arr) => arr.sort((a, b) => a - b)[Math.max(0, Math.ceil(arr.length * 0.95) - 1)] ?? 0;

  const line = `perf ${route}: status=${ok[0]?.status ?? 'ERR'} ttfb_p95=${Math.round(p95(ok.map((r) => r.ttfb)))}ms total_p95=${Math.round(p95(ok.map((r) => r.total)))}ms bytes=${ok[0]?.bytes ?? 0}` +
    (errs.length ? ` errors=${errs.length}` : '');
  const violations = [];
  if (errs.length) violations.push(`${errs.length}/${SAMPLES} requests errored (status>=400 or network)`);
  if (budgets) {
    if (budgets.ttfb_ms && p95(ok.map((r) => r.ttfb)) > budgets.ttfb_ms)
      violations.push(`ttfb_p95 > ${budgets.ttfb_ms}ms`);
    if (budgets.response_ms && p95(ok.map((r) => r.total)) > budgets.response_ms)
      violations.push(`response_p95 > ${budgets.response_ms}ms`);
    if (budgets.max_bytes && ok[0]?.bytes > budgets.max_bytes)
      violations.push(`bytes > ${budgets.max_bytes}`);
  }
  if (violations.length) {
    console.log(`FAIL  ${line}  [${violations.join('; ')}]`);
    fail = 1;
  } else {
    console.log(`ok    ${line}`);
  }
}
if (!budgets) console.log('(no .perf-budgets.json - report only, nothing enforced)');
process.exit(fail);
