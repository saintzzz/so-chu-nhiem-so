#!/usr/bin/env node
// Replay tung migration tu supabase_migrations.statements (cloud) vao vn-db.
// - Rewrite an toan: drop policy/constraint/trigger/column -> if exists
// - Statement hong san tren cloud -> tach bang parser $$-aware, replay tung phan
// - Loi "khong ton tai" -> inject def tu drift/tables/cols export roi retry (de quy)
// - Sau replay: reconcile - dong bo func/table/col/constraint/view/trigger/policy/
//   extension/sequence cuoi cung tu cloud -> end-state = cloud end-state
// Chay: node deploy/vn-selfhost/scripts/replay.mjs [--fresh]
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const MIGS = JSON.parse(fs.readFileSync("/tmp/mig.json", "utf8"));
const DRIFT = JSON.parse(fs.readFileSync("/tmp/drift.json", "utf8"));
const TABLES = JSON.parse(fs.readFileSync("/tmp/tables.json", "utf8"));
const COLS = JSON.parse(fs.readFileSync("/tmp/cols.json", "utf8"));
const POLICIES = JSON.parse(fs.readFileSync("/tmp/policies.json", "utf8"));
const EXTS = JSON.parse(fs.readFileSync("/tmp/exts.json", "utf8"));
const SEQS = JSON.parse(fs.readFileSync("/tmp/seqs.json", "utf8"));
const PG = fs.readFileSync("/tmp/vn-pgpass", "utf8").trim();
const STATE = "deploy/vn-selfhost/snapshot/replay-state.json";

const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const esc = (s) => s.replace(/'/g, "''");

function psql(sql) {
  try {
    const out = execFileSync("docker", ["exec", "-i", "-e", `PGPASSWORD=${PG}`, "vn-db",
      "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
      { stdio: ["pipe", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 });
    return { ok: true, out: out.toString() };
  } catch (e) {
    return { ok: false, err: ((e.stderr || "") + (e.stdout || "")).toString() };
  }
}

// Parser SQL: tach theo ';' nam ngoai quote/comment/dollar-tag
function splitSql(sql) {
  const parts = [];
  let cur = "", i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i], c2 = sql[i + 1];
    if (c === "-" && c2 === "-") { const j = sql.indexOf("\n", i); i = j < 0 ? n : j; cur += sql.slice(cur.endsWith("\n") ? cur.length : cur.length, i); cur += "\n"; continue; }
    if (c === "/" && c2 === "*") { const j = sql.indexOf("*/", i + 2); cur += sql.slice(i, j < 0 ? n : j + 2); i = j < 0 ? n : j + 2; continue; }
    if (c === "'") { let j = i + 1; while (j < n) { if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue; } break; } j++; } cur += sql.slice(i, j + 1); i = j + 1; continue; }
    if (c === '"') { const j = sql.indexOf('"', i + 1); cur += sql.slice(i, j < 0 ? n : j + 1); i = j < 0 ? n : j + 1; continue; }
    if (c === "$") {
      const mt = sql.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (mt) {
        const tag = mt[0];
        const j = sql.indexOf(tag, i + tag.length);
        cur += sql.slice(i, j < 0 ? n : j + tag.length);
        i = j < 0 ? n : j + tag.length;
        continue;
      }
    }
    if (c === ";") { parts.push(cur); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Rewrite an toan - khong doi ngunghia, chi them "if exists"
function rewrite(stmt) {
  return stmt
    .replace(/\bdrop\s+policy\s+(?!if\s+exists)/gi, "drop policy if exists ")
    .replace(/\bdrop\s+constraint\s+(?!if\s+exists)/gi, "drop constraint if exists ")
    .replace(/\bdrop\s+trigger\s+(?!if\s+exists)/gi, "drop trigger if exists ")
    .replace(/\bdrop\s+column\s+(?!if\s+exists)/gi, "drop column if exists ")
    .replace(/\bdrop\s+function\s+(?!if\s+exists)/gi, "drop function if exists ")
    .replace(/\bdrop\s+type\s+(?!if\s+exists)/gi, "drop type if exists ");
}

function findFuncDef(sig) {
  const bare = sig.replace(/"/g, "");
  const fname = bare.split("(")[0].split(".").pop();
  const exact = DRIFT.filter((d) => d.kind === "func" && norm(d.name) === norm(bare));
  const cands = exact.length ? exact : DRIFT.filter((d) => d.kind === "func" && d.name.split("(")[0].split(".").pop() === fname);
  return cands[0]?.def || null;
}

function handleMissing(err, stmt) {
  let m;
  if ((m = err.match(/schema "([\w.]+)" does not exist/))) {
    return [`create schema if not exists ${m[1]};`];
  }
  if ((m = err.match(/relation "([\w.]+)" does not exist/))) {
    const rel = m[1].replace(/"/g, "");
    const [rs, rt] = rel.includes(".") ? rel.split(".") : ["public", rel];
    const t = TABLES.find((x) => x.schema === rs && x.name === rt);
    if (t) return [`create schema if not exists ${rs};`, t.tbl_def, t.con_defs].filter(Boolean);
    const v = DRIFT.find((d) => d.kind === "view" && d.name === rt && (d.schema === rs || rs === "public"));
    if (v) return [`create or replace view ${v.schema}."${v.name}" as ${v.def}`];
    return null;
  }
  if ((m = err.match(/function ([\w.\[\]", ]+\([^)]*\)) does not exist/))) {
    const def = findFuncDef(m[1].replace(/\s/g, ""));
    return def ? [def] : null;
  }
  if ((m = err.match(/type "([\w.]+)" does not exist/))) {
    const tn = m[1].replace(/"/g, "");
    const [ts, tt] = tn.includes(".") ? tn.split(".") : ["public", tn];
    const t = TABLES.find((x) => x.schema === ts && x.name === tt);
    if (t) return [`create schema if not exists ${ts};`, t.tbl_def, t.con_defs].filter(Boolean);
    return null;
  }
  if (/cannot change name of view column/.test(err)) {
    // create or replace view doi ten cot -> drop view roi tao lai
    const names = [...stmt.matchAll(/create\s+or\s+replace\s+view\s+([\w."_]+)/gi)].map((x) => x[1]).filter((v) => !v.includes("%"));
    if (names.length) return names.map((v) => `drop view if exists ${v} cascade;`);
    const pats = [...stmt.matchAll(/public\.(\w+_)%I/gi)].map((x) => x[1]);
    if (pats.length) return pats.map((p) => `do $$ declare r record; begin for r in select c.relname n from pg_class c join pg_namespace n2 on n2.oid=c.relnamespace where n2.nspname='public' and c.relkind='v' and c.relname like '${p.replace(/_/g, "\\_")}%' loop execute format('drop view public.%I cascade', r.n); end loop; end $$;`);
    return null;
  }
  if ((m = err.match(/column "([\w]+)"( of relation "[\w.]+")? does not exist/)) || (m = err.match(/column ([\w.]+) does not exist/))) {
    const col = m[1].replace(/"/g, "").split(".").pop();
    const targets = COLS.filter((c) => c.col === col);
    if (!targets.length) return null;
    return targets.map((cd) =>
      `do $$ begin if exists (select 1 from information_schema.tables where table_schema='${cd.schema}' and table_name='${cd.table}') then alter table ${cd.schema}.${cd.table} add column if not exists ${col} ${cd.col_type}${cd.col_default ? " default " + cd.col_default : ""}; end if; end $$;`);
  }
  return null;
}

const SKIP = /already exists|cannot change return type|cannot change name of input parameter|cannot change data type|cannot alter type|cannot drop column|must be owner of|cannot drop the last open|duplicate key value violates unique constraint "schema_migrations/;
// Statement hong ngay tren cloud (psql non-transactional bo qua phan loi) -> tach+replay tung phan
const BROKEN = new Set(["20261022103244", "20261029034107"]);
// Phu thuoc du lieu (can auth.users/seed co san tren cloud) -> ghi nhan, khong fail
const DATA_DEP = new Set(["20261023161014", "20261024090027"]);

if (process.argv.includes("--fresh")) fs.rmSync(STATE, { force: true });
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { m: 0, injected: [], skipped: [], errors: [], dataDep: [] };

let done = 0, retried = 0;
const errLine = (e) => (e || "").split("\n").find((l) => l.includes("ERROR"))?.slice(0, 200) || "(no ERROR line)";

for (let mi = state.m; mi < MIGS.length; mi++) {
  const mig = MIGS[mi];
  const stmts = mig.statements || [];
  for (let si = 0; si < stmts.length; si++) {
    const raw = stmts[si];
    if (!raw || !raw.trim()) continue;
    const stmt = rewrite(raw);
    const batch = BROKEN.has(mig.version) ? splitSql(stmt) : [stmt];
    for (const part of batch) {
      if (DATA_DEP.has(mig.version)) { state.dataDep.push(`${mig.version}:${mig.name}`); break; }
      let r = psql(part);
      for (let round = 0; round < 40 && !r.ok && !SKIP.test(r.err); round++) {
        const fixes = handleMissing(r.err, part);
        if (!fixes) break;
        let progress = false;
        for (const f of fixes) {
          let fr = psql(f);
          for (let d = 0; d < 4 && !fr.ok && !SKIP.test(fr.err); d++) {
            const sub = handleMissing(fr.err, part);
            if (!sub) break;
            for (const sf of sub) {
              const sr = psql(sf);
              if (!sr.ok && !SKIP.test(sr.err)) console.log("SUB-FAIL", mig.version, si, errLine(sr.err));
              else progress = true;
            }
            fr = psql(f);
          }
          if (!fr.ok && !SKIP.test(fr.err)) console.log("FIX-FAIL", mig.version, si, errLine(fr.err));
          else progress = true;
        }
        state.injected.push(`${mig.version}#${si}`);
        retried++;
        const before = r.err;
        r = psql(part);
        if (!r.ok && r.err === before && !progress) break;
      }
      if (!r.ok && !SKIP.test(r.err)) {
        if (BROKEN.has(mig.version)) state.skipped.push(`${mig.version}#${si}(broken-part)`);
        else {
          state.errors.push({ v: mig.version, n: mig.name, si, err: errLine(r.err) });
          console.log("ERR", mig.version, mig.name, `#${si}:`, errLine(r.err));
        }
      } else if (!r.ok) {
        state.skipped.push(`${mig.version}#${si}`);
      }
    }
    done++;
    if (done % 200 === 0) { state.m = mi; fs.writeFileSync(STATE, JSON.stringify(state)); console.log(`progress ${done} stmts, mig ${mi + 1}/${MIGS.length}`); }
  }
  state.m = mi + 1;
  fs.writeFileSync(STATE, JSON.stringify(state));
}

// Ghi nhan lich su migration (tao schema/table truoc - khong co san trong image)
psql(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key, name text, statements text[], inserted_at timestamptz default now());`);
for (const mig of MIGS) {
  const arr = (mig.statements || []).map((s) => `'${esc(s)}'`).join(",");
  psql(`insert into supabase_migrations.schema_migrations(version,name,statements) values ('${mig.version}','${esc(mig.name)}',ARRAY[${arr}]::text[]) on conflict (version) do nothing`);
}

// ================= RECONCILE: end-state = cloud end-state =================
console.log("RECONCILE: syncing final defs from cloud...");
let rec = { ext: 0, seq: 0, func: 0, table: 0, col: 0, con: 0, view: 0, trig: 0, pol: 0, fail: 0 };
const recRun = (sql) => {
  let r = psql(sql);
  for (let d = 0; d < 4 && !r.ok && !SKIP.test(r.err); d++) {
    const sub = handleMissing(r.err, sql);
    if (!sub) break;
    for (const sf of sub) psql(sf);
    r = psql(sql);
  }
  if (!r.ok && !SKIP.test(r.err)) { rec.fail++; console.log("REC-FAIL", errLine(r.err)); }
  return r.ok;
};
for (const s of ["gtm", "practice", "sf", "tvc"]) recRun(`create schema if not exists ${s};`);
for (const e of EXTS) { if (recRun(`create extension if not exists "${e.extname}" with schema ${e.schema};`)) rec.ext++; }
for (const s of SEQS) { if (recRun(`create sequence if not exists ${s.schema}."${s.name}";`)) rec.seq++; }
for (const t of TABLES) {
  if (!recRun(`create schema if not exists ${t.schema};`)) continue;
  if (recRun(t.tbl_def)) rec.table++;
  for (const c of t.con_defs ? t.con_defs.split(/;\s*\n/).filter(Boolean).map((x) => x.replace(/;?\s*$/, ";")) : []) {
    if (recRun(c)) rec.con++;
  }
}
for (const cd of COLS) {
  if (recRun(`do $$ begin if exists (select 1 from information_schema.tables where table_schema='${cd.schema}' and table_name='${cd.table}') then alter table ${cd.schema}."${cd.table}" add column if not exists "${cd.col}" ${cd.col_type}; end if; end $$;`)) rec.col++;
}
// auth.*/storage.* thuoc so huu image (gotrue/storage-api) - KHONG reconcile
// (version image khac cloud -> tao overload gay loi "function is not unique")
for (const d of DRIFT.filter((x) => x.kind === "func" && x.schema !== "auth" && x.schema !== "storage")) {
  // Func tren cloud co the duoc tao voi check_function_bodies=off (body chua parse)
  let okf = recRun(d.def);
  if (!okf) okf = recRun(`set check_function_bodies=off; ${d.def}`);
  if (okf) rec.func++;
}
for (const d of DRIFT.filter((x) => x.kind === "view" && x.schema !== "auth" && x.schema !== "storage")) { if (recRun(`create or replace view ${d.schema}."${d.name}" as ${d.def}`)) rec.view++; }
for (const d of DRIFT.filter((x) => x.kind === "trig")) {
  const tn = d.def.match(/create\s+(?:or\s+replace\s+)?trigger\s+(\w+)/i)?.[1];
  if (tn) psql(`do $$ declare r record; begin for r in select t.tgrelid::regclass::text tname from pg_trigger t where t.tgname='${esc(tn)}' loop execute format('drop trigger %I on %s', '${tn}', r.tname); end loop; end $$;`);
  if (recRun(d.def)) rec.trig++;
}
for (const p of POLICIES) {
  const sql = `drop policy if exists "${p.name}" on ${p.schema}."${p.tbl}"; create policy "${p.name}" on ${p.schema}."${p.tbl}" as ${p.permissive} for ${p.cmd} to ${p.roles}${p.qual ? ` using (${p.qual})` : ""}${p.with_check ? ` with check (${p.with_check})` : ""};`;
  if (recRun(sql)) rec.pol++;
}
// Drop policy local khong con tren cloud (migration tren cloud chay non-transactional
// -> drop thanh cong nhung create fail -> cloud khong co; local atomic nen giu lai)
const lp = psql(`select schemaname||'.'||tablename||'.'||policyname from pg_policies`);
if (lp.ok) {
  const cloudSet = new Set(POLICIES.map((p) => `${p.schema}.${p.tbl}.${p.name}`));
  for (const l of lp.out.trim().split("\n").filter(Boolean)) {
    if (!cloudSet.has(l)) {
      const [sch, tbl, pol] = l.split(".");
      if (!["cron", "pgmq"].includes(sch)) psql(`drop policy if exists "${pol}" on ${sch}."${tbl}";`);
    }
  }
}
// Buckets: dong bo theo cloud (public flag + limits)
const BK = [
  ["ea-audio", true, null, null], ["lesson-plans", false, null, null],
  ["sf-assets", false, 52428800, "{image/png,image/jpeg,image/webp}"],
  ["sf-lessons", false, 26214400, "{application/vnd.openxmlformats-officedocument.presentationml.presentation}"],
  ["sf-narrations", false, 10485760, "{audio/mpeg,audio/mp3}"],
  ["sf-sources", false, 104857600, "{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document}"],
  ["tvc-imports", false, null, null], ["tvc-media", true, null, null],
];
for (const [id, pub, lim, mime] of BK) {
  psql(`insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('${id}','${id}',${pub},${lim ?? "null"},${mime ? `'${mime}'::text[]` : "null"}) on conflict (id) do nothing;`);
}
// Grant mac dinh kieu supabase cho PostgREST
recRun(`grant usage on schema public to anon, authenticated, service_role;
grant select,insert,update,delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage,select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon;
grant execute on all functions in schema public to anon, authenticated, service_role;`);
// Bat RLS cho moi bang co policy (policy khong tac dung neu RLS off)
recRun(`do $$ declare r record; begin for r in select distinct p.schemaname s, p.tablename t from pg_policies p loop execute format('alter table %I.%I enable row level security', r.s, r.t); end loop; end $$;`);

console.log(`REPLAY_DONE stmts=${done} injected=${retried} skipped=${state.skipped.length} errors=${state.errors.length} dataDep=${state.dataDep.length}`);
console.log(`RECONCILE ${JSON.stringify(rec)}`);
fs.writeFileSync(STATE, JSON.stringify(state));
