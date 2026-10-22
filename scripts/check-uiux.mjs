#!/usr/bin/env node
/**
 * check-uiux.mjs - deterministic UI/UX source lint (CR-2026-06).
 *
 * The grep-able subset of Vercel's web-interface-guidelines + anti-AI-slop
 * tells, so obvious violations fail BEFORE the visual review instead of
 * being rediscovered every review round. Skills advise; this enforces.
 *
 * Scans src/** (and app|pages|components|ui dirs) for tsx/jsx/ts/js/vue/
 * svelte/html/css files. Skips cleanly (exit 0) when no UI source exists.
 *
 *   FAIL  - <div>/<span>/<li> with onClick but no role/tabIndex
 *           (interactive element that isn't a control - Vercel a11y rule)
 *   FAIL  - <img> without an alt attribute (decorative needs alt="")
 *   FAIL  - file uses outline-none / outline:none/0 with NO focus-visible
 *           style anywhere in it (invisible keyboard focus)
 *   FAIL  - onPaste={...preventDefault} - paste blocking
 *   WARN  - transition-all class / `transition: all` (explicit props only)
 *   WARN  - purple-to-blue gradient utility pair (canonical AI-slop tell)
 *   `--strict` promotes WARN to FAIL. Exit 1 on any FAIL.
 *
 * Suppression: line containing `uiux-ignore` is skipped.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const EXT = /\.(tsx|jsx|ts|js|vue|svelte|html|css|scss)$/;
const SCAN_DIRS = ['src', 'app', 'pages', 'components', 'ui'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'out', 'coverage', '.vercel', 'storybook-static']);

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) { if (!SKIP_DIRS.has(e)) yield* walk(p); }
    else if (s.isFile() && EXT.test(e)) yield p;
  }
}

function findFiles() {
  const files = [];
  for (const d of SCAN_DIRS) files.push(...walk(join(ROOT, d)));
  if (!files.length) files.push(...walk(ROOT)); // flat repos: scan root shallowly
  return [...new Set(files)];
}

const files = findFiles();
if (!files.length) {
  console.log('check-uiux: no UI source files found - skip');
  process.exit(0);
}

const fails = [], warns = [];

function stripComments(text) {
  // Block comments first (can span lines), then // line comments. Good enough
  // for JSX/CSS source; template strings containing /* */ are rare in UI code.
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = stripComments(readFileSync(file, 'utf8'));
  // focus-within on a wrapper is a valid replacement for outline-none inputs
  // (the pill-search pattern); peer-focus and :focus CSS count too.
  const hasFocus = /focus-visible|focus-within|peer-focus|focus:ring|focus:border|focus:bg|:focus\b/i.test(text);

  // Multi-line JSX: <img ...> tags can span lines - match the whole tag.
  for (const m of text.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt\s*=/.test(m[0]) && !m[0].includes('uiux-ignore')) {
      const line = text.slice(0, m.index).split('\n').length;
      fails.push(`${rel}:${line}  <img> without alt attribute`);
    }
  }

  text.split('\n').forEach((line, i) => {
    if (line.includes('uiux-ignore')) return;
    const loc = `${rel}:${i + 1}`;

    // onClick that only stops propagation (backdrop-dismiss guard) is not an
    // interactive element - exempt it.
    const stopPropOnly = /onClick=\{\s*(?:\(\s*\w+\s*\)|\w+)\s*=>\s*\w+\.stopPropagation\(\s*\)\s*\}/.test(line);
    if (!stopPropOnly && /<(div|span|li|td|tr)\b[^>]*\bonClick=/.test(line) && !/role=|tabIndex/.test(line)) {
      fails.push(`${loc}  non-semantic interactive element: <div onClick> without role/tabIndex`);
    }
    if (/onPaste=\{[^}]*preventDefault/.test(line)) {
      fails.push(`${loc}  paste blocked via onPaste preventDefault`);
    }
    if (/\btransition-all\b|transition:\s*all\b/.test(line)) {
      warns.push(`${loc}  transition-all - list properties explicitly (transform/opacity only)`);
    }
    if (/from-(purple|violet|indigo)-\d+.*\bto-(blue|indigo|cyan|sky)-\d+/.test(line) ||
        /from-(blue|indigo|cyan|sky)-\d+.*\bto-(purple|violet|indigo)-\d+/.test(line)) {
      warns.push(`${loc}  purple/blue gradient pair - canonical AI-slop tell`);
    }
  });

  // File-level: killed outline with no focus replacement anywhere.
  // tabIndex={-1} targets are programmatic-focus only (error-heading
  // management) - never keyboard-tabbable, so removing their ring is correct.
  const textExclProgFocus = text.replace(/tabIndex=\{-1\}[^>]*outline-none|outline-none[^>]*tabIndex=\{-1\}/g, '');
  if (/(outline-none|outline:\s*(none|0)\b)/.test(textExclProgFocus) && !hasFocus) {
    fails.push(`${rel}  outline removed but no focus-visible style in file - invisible keyboard focus`);
  }
}

for (const w of warns) console.log(`WARN  ${w}`);
for (const f of fails) console.log(`FAIL  ${f}`);

console.log(`\ncheck-uiux: ${files.length} file(s), ${fails.length} fail, ${warns.length} warn${STRICT ? ' (strict)' : ''}`);
process.exit(fails.length || (STRICT && warns.length) ? 1 : 0);
