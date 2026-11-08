#!/usr/bin/env node
// Fetch catalog tu cloud qua REST (cac _*_export view da tao bang
// export-cloud-catalog.sql) -> /tmp/{mig,drift,tables,cols,policies,exts,seqs,trigs}.json
// Can: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (trong app .env.local)
import fs from "node:fs";

const envFile = fs.existsSync(".env.local") ? ".env.local" : "../.env.local";
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Thieu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const VIEWS = [
  ["_mig_export", "mig", "version,name,statements&order=version"],
  ["_drift_export", "drift", "*"],
  ["_table_export", "tables", "schema,name,tbl_def,con_defs&order=schema,name"],
  ["_col_export", "cols", "*"],
  ["_pol_export", "policies", "*"],
  ["_ext_export", "exts", "*"],
  ["_seq_export", "seqs", "*"],
  ["_trig_export", "trigs", "*"],
];

for (const [view, out, sel] of VIEWS) {
  const all = [];
  let from = 0;
  for (;;) {
    const r = await fetch(`${URL}/rest/v1/${view}?select=${sel}&offset=${from}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Range-Unit": "items", Range: `${from}-${from + 999}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows)) { console.error(view, "FAIL", JSON.stringify(rows).slice(0, 200)); process.exit(1); }
    all.push(...rows);
    if (rows.length < 1000) break;
    from += 1000;
  }
  fs.writeFileSync(`/tmp/${out}.json`, JSON.stringify(all));
  console.log(view, "->", `/tmp/${out}.json`, all.length, "rows");
}
console.log("DONE - chay tiep: node scripts/replay.mjs --fresh");
