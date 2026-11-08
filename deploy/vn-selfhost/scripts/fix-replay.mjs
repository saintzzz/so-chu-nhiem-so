#!/usr/bin/env node
// Replay schema-snapshot.sql vao vn-db; khi gap loi "X does not exist"
// thi inject dinh nghia tu drift.json (export tu cloud) ngay truoc dong loi.
// Lap toi da MAX_ITERS. Chay: node deploy/vn-selfhost/scripts/fix-replay.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const SNAP = "deploy/vn-selfhost/snapshot/schema-snapshot.sql";
const DRIFT = JSON.parse(fs.readFileSync("/tmp/drift.json", "utf8"));
const TABLES = JSON.parse(fs.readFileSync("/tmp/tables.json", "utf8"));
const COLS = JSON.parse(fs.readFileSync("/tmp/cols.json", "utf8"));
const injectedTables = new Set();
const PG = fs.readFileSync("/tmp/vn-pgpass", "utf8").trim();
const MAX_ITERS = 60;

const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

function findDef(kind, ident) {
  // ident vd: scn_is_my_homeroom_class(uuid) | "ten_bang" | ten_ham(uuid, text)
  const bare = ident.replace(/"/g, "");
  if (kind === "func") {
    const fname = bare.split("(")[0].split(".").pop();
    const exact = DRIFT.filter((d) => d.kind === "func" && norm(d.name) === norm(bare));
    const cands = exact.length ? exact : DRIFT.filter((d) => d.kind === "func" && d.name.split("(")[0] === fname);
    if (cands.length === 1) return cands[0].def;
    if (cands.length > 1) return cands[0].def; // overloads: thu cai dau
    return null;
  }
  if (kind === "view") {
    const tname = bare.split(".").pop();
    const c = DRIFT.find((d) => d.kind === "view" && d.name === tname);
    return c ? `create or replace view ${c.schema}.${c.name} as ${c.def}` : null;
  }
  return null;
}

// Pre-pass: rename cac create (or replace) function co return type
// khac voi def cuoi cung tren cloud (tranh 'cannot change return type').
{
  let sql0 = fs.readFileSync(SNAP, "utf8");
  const retOf = (def) => { const m = def.match(/\breturns\s+([\s\S]+?)\s+(language|as|stable|volatile|immutable|security|set|cost|rows)\b/i); return m ? norm(m[1]) : null; };
  const funcFinal = new Map();
  for (const d of DRIFT.filter((x) => x.kind === "func")) {
    const fname = d.name.split("(")[0];
    if (!funcFinal.has(fname)) funcFinal.set(fname, retOf(d.def));
  }
  const re = /create\s+(or\s+replace\s+)?function\s+([\w.]+)\s*\(([\s\S]*?)\)\s*returns\s+([\w\s.()\[\],]+?)(?=\s+(?:language|as|stable|volatile|immutable|security|set|cost|rows|parallel|leakproof|called|returns\s+null)\b|\$)/gim;
  let pre = 0;
  sql0 = sql0.replace(re, (m, orr, fname, args, rt) => {
    const bare = fname.split(".").pop();
    const want = funcFinal.get(bare);
    if (want && norm(rt) !== want) {
      pre++;
      return `create ${orr || ""}function ${fname}__pre${pre}(${args}) returns ${rt}`;
    }
    return m;
  });
  fs.writeFileSync(SNAP, sql0);
  console.log("pre-pass renames:", pre);
}

let injected = 0;
for (let i = 0; i < MAX_ITERS; i++) {
  const sql = fs.readFileSync(SNAP, "utf8");
  let res;
  try {
    execFileSync("docker", ["exec", "-i", "-e", `PGPASSWORD=${PG}`, "vn-db", "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], {
      input: sql, stdio: ["pipe", "ignore", "pipe"], maxBuffer: 64 * 1024 * 1024,
    });
    console.log(`REPLAY_OK after ${injected} injections`);
    process.exit(0);
  } catch (e) {
    res = e.stderr.toString();
  }
  const line = res.split("\n").find((l) => l.includes("ERROR:")) || res.split("\n")[0];
  const m = res.match(/psql:.*?:(\d+):/);
  const failLine = m ? parseInt(m[1], 10) : null;

  const insertBeforeStmt = (text) => {
    const lines = sql.split("\n");
    // parity[i] = dang o trong dollar block truoc dong i (tag-stack: chi cung tag moi dong block)
    const parity = [];
    const stack = [];
    for (let k = 0; k < lines.length; k++) {
      parity.push(stack.length > 0);
      const mm2 = lines[k].match(/\$[a-zA-Z_0-9]*\$/g);
      if (mm2) for (const tok of mm2) {
        if (stack.length && stack[stack.length - 1] === tok) stack.pop();
        else if (stack.length === 0) stack.push(tok);
        // tag khac trong block = literal, bo qua
      }
    }
    let at = Math.max(0, (failLine || 1) - 1);
    // Lui ve dau statement, dong thoi dam bao diem chen NGOAI moi dollar block
    while (at > 0 && !(lines[at - 1].trimEnd().endsWith(";") && parity[at] === false && parity[at - 1] === false)) at--;
    lines.splice(at, 0, text);
    fs.writeFileSync(SNAP, lines.join("\n"));
    injected++;
  };

  let kind = null, ident = null;
  let mm;
  if ((mm = line.match(/function ([\w.\[\]", ]+\([^)]*\)) does not exist/))) { kind = "func"; ident = mm[1].replace(/[\s]/g, ""); }
  else if ((mm = line.match(/relation "([\w.]+)" does not exist/))) {
    const rel = mm[1].replace(/"/g, "");
    const [rs, rt] = rel.includes(".") ? rel.split(".") : ["public", rel];
    const t = TABLES.find((x) => x.schema === rs && x.name === rt);
    if (t && failLine) {
      insertBeforeStmt(`\n-- [drift-fix table ${rel}]\n${t.tbl_def}\n${t.con_defs || ""}\n`);
      injectedTables.add(rel);
      console.log(`iter ${i + 1}: injected table ${rel} before line ${failLine}`);
      continue;
    }
    kind = "view"; ident = mm[1];
  }
  else if ((mm = line.match(/schema "([\w.]+)" does not exist/))) {
    insertBeforeStmt(`\n-- [drift-fix schema ${mm[1]}]\ncreate schema if not exists ${mm[1]};\n`);
    console.log(`iter ${i + 1}: injected schema ${mm[1]} before line ${failLine}`);
    continue;
  }
  else if ((mm = line.match(/type "([\w.]+)" does not exist/))) { console.error("MISSING TYPE:", mm[1]); break; }
  else if ((mm = line.match(/column "([\w]+)"( of relation "[\w.]+")? does not exist/)) || (mm = line.match(/column ([\w.]+) does not exist/))) {
    const colName = mm[1].replace(/"/g, "").split(".").pop();
    // Neu cloud co cot nay tren bang t -> alter t add c luon dung,
    // khong can doan bang tu statement.
    const targets = COLS.filter((c) => c.col === colName);
    if (targets.length && failLine) {
      const alters = targets.map((cd) =>
        `do $$ begin if exists (select 1 from information_schema.tables where table_schema='${cd.schema}' and table_name='${cd.table}') then alter table ${cd.schema}.${cd.table} add column if not exists ${colName} ${cd.col_type}${cd.col_default ? " default " + cd.col_default : ""}; end if; end $$;`).join("\n");
      insertBeforeStmt(`\n-- [drift-fix column ${colName} on ${targets.length} tables]\n${alters}\n`);
      console.log(`iter ${i + 1}: injected column ${colName} on ${targets.length} tables before line ${failLine}`);
      continue;
    }
    console.error("COLUMN NO DEF anywhere:", colName);
    break;
  }
  else if ((mm = line.match(/cannot change (return type|name of input parameter|data type)/))) {
    // Func da co ban def cuoi (drift-inject) - doi ten func trong create ke tiep
    // thanh ten rac de statement van chay ma khong xung dot.
    const lines = sql.split("\n");
    let hit = -1;
    for (let k = Math.max(0, (failLine || 1) - 1); k < Math.min((failLine || 1) + 400, lines.length); k++) {
      if (/create\s+(or\s+replace\s+)?function\s+([\w.]+)/i.test(lines[k])) { hit = k; break; }
    }
    if (hit < 0) { console.error("NO FUNC FOUND after", failLine); break; }
    lines[hit] = lines[hit].replace(/(function\s+)([\w.]+)/i, `$1$2__sk${i}`);
    fs.writeFileSync(SNAP, lines.join("\n"));
    injected++;
    console.log(`iter ${i + 1}: renamed func at line ${hit + 1} -> __sk${i}`);
    continue;
  }
  else if ((mm = line.match(/(column "[\w]+" of relation "[\w.]+"|relation "[\w.]+"|constraint "[\w]+"|policy "[\w]+" for relation "[\w.]+"|index "[\w]+"|type "[\w.]+") already exists/))) {
    // Statement don gian khong chua $$ body - skip bang moc ';' gan nhat
    const lines = sql.split("\n");
    let start = Math.max(0, (failLine || 1) - 1);
    while (start > 0 && !lines[start - 1].trimEnd().endsWith(";")) start--;
    let end = Math.max(0, (failLine || 1) - 1);
    while (end < lines.length && !lines[end].trimEnd().endsWith(";")) end++;
    const skipped = lines.slice(start, end + 1).join(" ").slice(0, 120);
    if (skipped.includes("$$")) { console.error("DOLLAR-STMT SKIP BLOCKED:", skipped.slice(0, 150)); break; }
    lines.splice(start, end - start + 1, `-- [skipped dup] ${skipped}`);
    fs.writeFileSync(SNAP, lines.join("\n"));
    injected++;
    console.log(`iter ${i + 1}: skipped dup at line ${failLine}: ${skipped.slice(0, 80)}`);
    continue;
  }
  else { console.error("UNHANDLED ERR:", line.slice(0, 300)); break; }

  const def = findDef(kind, ident);
  if (!def) { console.error(`NO DEF FOUND for ${kind} ${ident} (line ${failLine})`); break; }
  if (!failLine) { console.error("NO LINE NO:", line); break; }

  insertBeforeStmt(`\n-- [drift-fix ${ident}]\n${def.trimEnd()}${def.trimEnd().endsWith(";") ? "" : ";"}\n`);
  console.log(`iter ${i + 1}: injected ${kind} ${ident} before line ${failLine}`);
}
console.error("DID_NOT_CONVERGE");
process.exit(2);
