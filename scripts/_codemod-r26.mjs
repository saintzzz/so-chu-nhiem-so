// r26 codemod (one-shot): transforms flagged sites into fail-closed idioms.
//  NO-ERR-BIND   `await <builderVar/chain>` -> `await must(<expr>, "<tbl>")`
//  unbounded .in `must(<Q>)` / `await <Q>` -> fetchAllRowsIn((chunk,f,t)=>Q'.order("id").range(f,t), ids).then(r=>({data:mustRows(r).rows}))
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hits = readFileSync("/tmp/r26-residue.txt", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const m = l.match(/^(.+?):(\d+)\s+(.*)$/);
    return m && { file: m[1], line: +m[2], rest: m[3] };
  })
  .filter(Boolean);

const byFile = new Map();
for (const h of hits) {
  const key = `src/${h.file}`;
  if (!byFile.has(key)) byFile.set(key, []);
  byFile.get(key).push(h);
}

function matchParen(t, openIdx) {
  let d = 0;
  for (let i = openIdx; i < t.length; i++) {
    if (t[i] === "(") d++;
    else if (t[i] === ")") {
      d--;
      if (d === 0) return i;
    }
  }
  return -1;
}

function ensureImport(src, names, from) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${from.replace(/\//g, "\\/")}["']`);
  const m = re.exec(src);
  if (m) {
    const cur = new Set(m[1].split(",").map((s) => s.trim()).filter(Boolean));
    const missing = names.filter((n) => !cur.has(n));
    if (!missing.length) return src;
    return src.replace(m[0], `import { ${[...cur, ...missing].join(", ")} } from "${from}"`);
  }
  // insert after last import
  const im = [...src.matchAll(/^import .*$/gm)];
  const at = im.length ? im[im.length - 1].index + im[im.length - 1][0].length : 0;
  return src.slice(0, at) + `\nimport { ${names.join(", ")} } from "${from}";` + src.slice(at);
}

function tableOf(src, varName) {
  const re = new RegExp(`\\b${varName}\\s*=\\s*supabase\\.from\\(\\s*["']([\\w]+)["']`);
  const m = re.exec(src);
  return m ? m[1] : "query";
}

const report = [];
for (const [file, list] of byFile) {
  const path = resolve(ROOT, file);
  let src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  // process bottom-up so offsets stay valid
  const sorted = [...list].sort((a, b) => b.line - a.line);
  let changed = false;
  for (const h of sorted) {
    // re-find the statement containing the line (file may have shifted above)
    const cur = src.split("\n");
    let stmtStart = h.line - 1;
    while (stmtStart > 0 && !/^(?!\s)[^/]*|^\s*(const|let|return|if|for|await|\/\/)/.test(cur[stmtStart])) break;
    // find statement start: walk back to previous line ending with ; or { or beginning
    stmtStart = h.line - 1;
    while (stmtStart > 0 && !/[;{}]\s*$/.test(cur[stmtStart - 1])) stmtStart--;
    let stmtEnd = h.line - 1;
    while (stmtEnd < cur.length && !/;/.test(cur[stmtEnd])) stmtEnd++;
    const stmtText = cur.slice(stmtStart, stmtEnd + 1).join("\n");
    const stmtOff = cur.slice(0, stmtStart).join("\n").length + (stmtStart ? 1 : 0);

    if (/NO-ERR-BIND/.test(h.rest)) {
      const m = stmtText.match(/await\s+([\s\S]+?);?\s*$/);
      // wrap `await <expr>` where expr = identifier or ident.chain(...)
      const am = stmtText.match(/await\s+([A-Za-z_$][\w$]*(?:\s*\.\s*\w+\s*\([^;]*\))?)\s*;/);
      if (!am) { report.push(`SKIP ${file}:${h.line} no-await`); continue; }
      const expr = am[1];
      const root = expr.match(/^([A-Za-z_$][\w$]*)/)[1];
      const tbl = tableOf(src, root);
      const replaced = stmtText.replace(
        `await ${expr};`,
        `await must(${expr}, "${tbl}");`,
      );
      if (replaced === stmtText) { report.push(`SKIP ${file}:${h.line} repl`); continue; }
      src = src.slice(0, stmtOff) + replaced + src.slice(stmtOff + stmtText.length);
      src = ensureImport(src, ["must"], "@/lib/supabase/must");
      changed = true;
      report.push(`OK   ${file}:${h.line} must(${root})`);
      continue;
    }

    // unbounded .in
    if (/::/.test(h.rest)) {
      // find `.in("col", ids)` in stmtText
      const im = stmtText.match(/\.in\(\s*["']([\w.]+)["']\s*,\s*([^,)]+)\)/);
      if (!im) { report.push(`SKIP ${file}:${h.line} no-.in in stmt`); continue; }
      const [, , idsRaw] = im;
      const ids = idsRaw.trim();
      const isMust = stmtText.includes("must(");
      const isAwaitQuery = /await\s+supabase|await supabase|\.from\(/.test(stmtText) && !isMust;
      if (!isMust && !isAwaitQuery) { report.push(`SKIP ${file}:${h.line} shape`); continue; }

      let newText;
      if (isMust) {
        // locate must( ... , "label" ) with paren matching inside stmtText
        const mi = stmtText.indexOf("must(");
        const open = stmtText.indexOf("(", mi);
        const close = matchParen(stmtText, open);
        if (close < 0) { report.push(`SKIP ${file}:${h.line} paren`); continue; }
        let inner = stmtText.slice(open + 1, close);
        // strip trailing `, "label"` (top-level)
        inner = inner.replace(/,\s*["'][\w_ -]+["']\s*$/, "");
        const q2 = inner.replace(
          /\.in\(\s*(["'][\w.]+["'])\s*,\s*[^,)]+\)/,
          ".in($1, chunk)",
        );
        const orderTail = /\.order\s*\(/.test(q2) ? "" : '.order("id")';
        const rep = `fetchAllRowsIn((chunk, f, t) =>\n          ${q2.trim()}${orderTail}\n          .range(f, t),\n        ${ids}).then((r) => ({ data: mustRows(r).rows }))`;
        newText = stmtText.slice(0, mi) + rep + stmtText.slice(close + 1);
      } else {
        // raw await supabase...in(...)  -> fetchAllRowsIn(...).then mustRows
        const am = stmtText.match(/await\s+(supabase[\s\S]+?)\s*;?\s*$/);
        if (!am) { report.push(`SKIP ${file}:${h.line} raw-await`); continue; }
        const q = am[1].replace(/;\s*$/, "");
        const q2 = q.replace(
          /\.in\(\s*(["'][\w.]+["'])\s*,\s*[^,)]+\)/,
          ".in($1, chunk)",
        );
        const orderTail = /\.order\s*\(/.test(q2) ? "" : '.order("id")';
        const rep = `await fetchAllRowsIn((chunk, f, t) =>\n          ${q2.trim()}${orderTail}\n          .range(f, t),\n        ${ids}).then((r) => ({ data: mustRows(r).rows }));`;
        newText = stmtText.replace(am[0], rep);
        // binding may carry `, error: XErr` -> drop it (mustRows throws)
        newText = newText.replace(/,\s*error\s*:\s*\w+\s*\}/, " }");
      }
      if (newText === stmtText) { report.push(`SKIP ${file}:${h.line} repl2`); continue; }
      src = src.slice(0, stmtOff) + newText + src.slice(stmtOff + stmtText.length);
      src = ensureImport(src, ["fetchAllRowsIn"], "@/lib/supabase/fetch-all");
      src = ensureImport(src, ["mustRows"], "@/lib/supabase/must");
      changed = true;
      report.push(`OK   ${file}:${h.line} fetchAllRowsIn`);
    }
  }
  if (changed) writeFileSync(path, src);
}
console.log(report.join("\n"));
console.log(`\n${report.filter((r) => r.startsWith("OK")).length} transformed, ${report.filter((r) => r.startsWith("SKIP")).length} skipped`);
