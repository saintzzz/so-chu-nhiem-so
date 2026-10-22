// repo laws scanner - deterministic gates that lint/typecheck do not cover.
// Vendored from slideforge's battle-tested version (its r2/r3 external
// reviews each caught one of these laws missing). Laws enforced:
//   L-copy:    no em-dash/en-dash in user-facing strings under src/
//   L-keys:    privileged key references only inside allowed server/worker
//              modules (project-tunable via .repo-laws.json "keyAllowed")
//   L-mig:     SECURITY DEFINER functions pin search_path; tables enable RLS
//   L-log:     worker/api code must not log user content (segment text,
//              prompts, corrected content)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const files = (dir, exts) => {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (!/node_modules|\.next|\.git|\.venv|dist|build/.test(f)) walk(p);
      } else if (exts.some((e) => p.endsWith(e))) out.push(p);
    }
  };
  try { walk(dir); } catch { /* dir absent */ }
  return out;
};

// Optional per-project tuning: .repo-laws.json at repo root
//   { "keyAllowed": ["regex", ...], "keyPattern": "regex" }
const cfg = existsSync(join(root, '.repo-laws.json'))
  ? JSON.parse(readFileSync(join(root, '.repo-laws.json'), 'utf8'))
  : {};

let bad = 0;
const hit = (file, line, law, msg) => {
  console.log(`  ${law}  ${relative(root, file)}:${line}  ${msg}`);
  bad++;
};

// --- L-copy: em/en dash in UI strings -------------------------------------
for (const f of [...files('src', ['.tsx', '.ts'])]) {
  if (/\.(test|spec|selftest)\.(ts|tsx)$/.test(f)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const strs = l.match(/"([^"]*)"|'([^']*)'|`([^`]*)`|>([^<>{]+)</g) ?? [];
    for (const s of strs) {
      if (/[—–]/.test(s)) hit(f, i + 1, 'L-copy', `em/en dash in UI string: ${s.trim().slice(0, 60)}`);
    }
  });
}

// --- L-keys: privileged key material reaching client bundles ----------------
// Default mode flags key refs in client-bound files only ("use client"
// directive or client-ish paths) - server modules legitimately read env.
// Strict mode (.repo-laws.json {"keyMode":"strict"}) flags ANY file outside
// the allowlist, for projects enforcing a designated-secrets-module posture.
const isCommentLine = (l) => /^\s*(\/\/|\*|\/\*|#|'''|""")/.test(l);
const KEY_ALLOWED = [
  /src\/lib\/supabase\/(admin|server|worker-trigger)\.ts$/,
  /src\/lib\/(ai|devin|secrets|env)\.ts$/,
  /src\/app\/api\//,          // server route handlers
  /worker\//,
  /server\//,
  /scripts\//,
  /tests\//,
  /spike\//,
  /supabase\//,
  /docs\//,
  /\.env/,
  ...(cfg.keyAllowed ?? []).map((s) => new RegExp(s)),
];
const CLIENT_PATH = /\/(components|hooks|contexts?|providers?|pages)\//;
const KEY_PATTERN = new RegExp(
  cfg.keyPattern ??
    'SERVICE_ROLE_KEY|service_role|GEMINI_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|SUPABASE_SERVICE',
);
const strict = cfg.keyMode === 'strict';
for (const f of [...files('.', ['.ts', '.tsx', '.mjs', '.js', '.py'])]) {
  const rel = relative(root, f).replace(/\\/g, '/');
  const src = readFileSync(f, 'utf8');
  const isClient = /^\s*['"]use client['"]/m.test(src) || CLIENT_PATH.test(rel);
  if (strict ? KEY_ALLOWED.some((r) => r.test(rel)) : !isClient) continue;
  src.split('\n').forEach((l, i) => {
    if (KEY_PATTERN.test(l) && !/NEXT_PUBLIC/.test(l) && !isCommentLine(l))
      hit(f, i + 1, 'L-keys', `privileged key ref in client-bound file`);
  });
}

// --- L-mig: SECURITY DEFINER must pin search_path ---------------------------
for (const f of files('supabase/migrations', ['.sql'])) {
  const src = readFileSync(f, 'utf8');
  const fns = src.match(/create or replace function[\s\S]*?security definer[\s\S]*?;/gi) ?? [];
  for (const fn of fns) {
    if (!/set\s+search_path\s*(=|to)/i.test(fn)) {
      const name = fn.match(/function\s+([\w.]+)/i)?.[1] ?? '?';
      hit(f, 0, 'L-mig', `security definer fn ${name} lacks search_path pin`);
    }
  }
  if (/enable\s+row\s+level\s+security/i.test(src) === false && /create table/i.test(src))
    hit(f, 0, 'L-mig', 'creates table without any RLS enablement in same file');
}

// --- L-log: worker/api code must not log user content -----------------------
const LOG_SCAN_DIRS = cfg.logScanDirs ?? ['worker', 'server', 'src/app/api'];
const CONTENT_RE = new RegExp(
  cfg.logContentPattern ??
    '(seg|segment|narration|content)\\w*\\.(text|corrected_text|body)|corrected_text|\\bprompt\\b|user_content',
  'i',
);
for (const d of LOG_SCAN_DIRS) {
  for (const f of files(d, ['.mjs', '.ts', '.js', '.py'])) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (/console\.(log|warn|error|info)|print\(/.test(l) && CONTENT_RE.test(l))
        hit(f, i + 1, 'L-log', `log statement may print user content`);
    });
  }
}

console.log(`repo-laws: ${bad === 0 ? 'PASS' : `${bad} violation(s)`}`);
process.exit(bad ? 1 : 0);
