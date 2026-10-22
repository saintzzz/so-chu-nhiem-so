#!/usr/bin/env node
/* load-smoke.mjs - zero-dependency k6-lite capacity probe (CR-2026-07).
 *
 * Gives every project a committed load script (`npm run load:smoke --
 * <url>`) without pulling k6/autocannon as a dep - the CONVENTIONS
 * capacity-proof rule needs *some* executable everywhere, and this is it.
 * For real load work wire k6/autocannon; this stays the floor.
 *
 * Usage:
 *   node scripts/load-smoke.mjs <url> [--requests 50] [--concurrency 5] [--budget-p95 3000]
 *
 * Reports p50/p95/p99 latency, RPS, error rate. --budget-p95 fails nonzero
 * when exceeded. PERF_COOKIE env supplies a session cookie.
 */
const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/load-smoke.mjs <url> [--requests N] [--concurrency N] [--budget-p95 MS]');
  process.exit(2);
}
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};
const REQUESTS = arg('requests', 50);
const CONCURRENCY = Math.max(1, arg('concurrency', 5));
const BUDGET = arg('budget-p95', 0);
const headers = process.env.PERF_COOKIE ? { cookie: process.env.PERF_COOKIE } : {};

const lat = [];
let errors = 0;
const t0 = performance.now();
let next = 0;
async function worker() {
  while (next < REQUESTS) {
    next++;
    const s = performance.now();
    try {
      const res = await fetch(url, { headers, redirect: 'follow' });
      await res.arrayBuffer();
      if (res.status >= 400) errors++;
    } catch {
      errors++;
    }
    lat.push(performance.now() - s);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const wall = performance.now() - t0;

lat.sort((a, b) => a - b);
const pct = (p) => lat[Math.min(lat.length - 1, Math.ceil((p / 100) * lat.length) - 1)];
const errRate = ((errors / REQUESTS) * 100).toFixed(1);
console.log(
  `load ${url}: n=${REQUESTS} c=${CONCURRENCY} ` +
    `p50=${Math.round(pct(50))}ms p95=${Math.round(pct(95))}ms p99=${Math.round(pct(99))}ms ` +
    `rps=${(REQUESTS / (wall / 1000)).toFixed(1)} errors=${errors} (${errRate}%)`,
);
if (BUDGET && pct(95) > BUDGET) {
  console.error(`FAIL: p95 ${Math.round(pct(95))}ms > budget ${BUDGET}ms`);
  process.exit(1);
}
if (errors / REQUESTS > 0.01) {
  console.error(`FAIL: error rate ${errRate}% > 1%`);
  process.exit(1);
}
