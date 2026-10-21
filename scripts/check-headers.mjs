#!/usr/bin/env node
/**
 * check-headers.mjs - post-deploy security-headers gate (WS-4 / CR-2026-01).
 *
 * Probes a live URL and verifies the baseline response-header floor. A
 * deployment report that claims "healthy" without this evidence is incomplete.
 *
 * Usage:
 *   node scripts/check-headers.mjs <url> [more urls...] [--report out.md]
 *
 * Checks (FAIL unless noted):
 *   - frame protection: content-security-policy frame-ancestors OR
 *     x-frame-options present
 *   - content-security-policy present (presence only - a permissive policy
 *     like `default-src *` still passes; directive-quality audit is out of
 *     scope, deferred per CR-2026-01 Option C)
 *   - strict-transport-security (https URLs only)
 *   - x-content-type-options: nosniff
 *   - set-cookie (if any): every cookie Secure; session-ish cookies
 *     (sess|token|auth|jwt) also HttpOnly + SameSite
 *   - referrer-policy present (warn only)
 *
 * Exit: 0 all-pass/warn-only, 1 any FAIL, 2 fetch error.
 */

const args = process.argv.slice(2);
const ri = args.indexOf('--report');
const reportPath = ri >= 0 ? args[ri + 1] : null;
const urls = args.filter((a, i) => !a.startsWith('--') && (ri < 0 || i !== ri + 1));

if (!urls.length) {
  console.error('usage: node check-headers.mjs <url> [more urls...] [--report out.md]');
  process.exit(2);
}

const rows = [];
let failed = false;

for (const url of urls) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (e) {
    console.error(`FAIL ${url}: fetch error ${e.message.split('\n')[0]}`);
    failed = true;
    continue;
  }
  const h = res.headers;
  const isHttps = res.url.startsWith('https://') || url.startsWith('https://');
  const csp = h.get('content-security-policy') ?? '';
  const xfo = h.get('x-frame-options') ?? '';
  const checks = [
    ['frame protection', /frame-ancestors/.test(csp) || !!xfo, 'FAIL'],
    ['content-security-policy', !!csp, 'FAIL'],
    ['strict-transport-security', !isHttps || !!h.get('strict-transport-security'), 'FAIL'],
    ['x-content-type-options: nosniff', /nosniff/i.test(h.get('x-content-type-options') ?? ''), 'FAIL'],
    ['referrer-policy', !!h.get('referrer-policy'), 'WARN'],
  ];

  // Cookie flags - session-ish cookies get the strictest bar.
  const cookies = h.getSetCookie?.() ?? [];
  for (const c of cookies) {
    const name = c.split('=')[0].trim();
    const sessionish = /sess|token|auth|jwt/i.test(name);
    checks.push([`cookie ${name}: Secure`, /;\s*secure\b/i.test(c), 'FAIL']);
    if (sessionish) {
      checks.push([`cookie ${name}: HttpOnly`, /;\s*httponly\b/i.test(c), 'FAIL']);
      checks.push([`cookie ${name}: SameSite`, /;\s*samesite=/i.test(c), 'FAIL']);
    }
  }

  for (const [name, ok, level] of checks) {
    const status = ok ? 'PASS' : level;
    if (status === 'FAIL') failed = true;
    rows.push({ url, name, status });
    console.log(`${status.padEnd(4)} ${url}  ${name}`);
  }
}

if (reportPath) {
  const { writeFileSync } = await import('node:fs');
  const md = [
    `# Security headers check - ${new Date().toISOString()}`,
    '',
    '| URL | Header check | Result |',
    '|-----|--------------|--------|',
    ...rows.map((r) => `| ${r.url} | ${r.name} | ${r.status} |`),
    '',
  ].join('\n');
  writeFileSync(reportPath, md);
  console.log(`report: ${reportPath}`);
}

process.exit(failed ? 1 : 0);
