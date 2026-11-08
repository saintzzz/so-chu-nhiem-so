#!/usr/bin/env node
// So sanh so luong object cloud vs vn-db local -> bao cao parity.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const PG = fs.readFileSync("/tmp/vn-pgpass", "utf8").trim();
const local = execFileSync("docker", ["exec", "-e", `PGPASSWORD=${PG}`, "vn-db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tAc", `
select 'tables', count(*) from information_schema.tables where table_schema in ('public','practice','sf','tvc','gtm') and table_type='BASE TABLE'
union all select 'columns', count(*) from information_schema.columns where table_schema in ('public','practice','sf','tvc','gtm')
union all select 'functions', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','practice','sf','tvc','gtm')
union all select 'views', count(*) from information_schema.views where table_schema in ('public','practice','sf','tvc','gtm')
union all select 'triggers', count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','practice','sf','tvc','gtm')
union all select 'policies', count(*) from pg_policies where schemaname in ('public','practice','sf','tvc','gtm')
union all select 'rls_enabled', count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity
union all select 'buckets', count(*) from storage.buckets
union all select 'migrations', count(*) from supabase_migrations.schema_migrations order by 1`], { encoding: "utf8" }).trim().split("\n").map((l) => l.split("|"));

const TABLES = JSON.parse(fs.readFileSync("/tmp/tables.json", "utf8"));
const COLS = JSON.parse(fs.readFileSync("/tmp/cols.json", "utf8"));
const DRIFT = JSON.parse(fs.readFileSync("/tmp/drift.json", "utf8"));
const POLICIES = JSON.parse(fs.readFileSync("/tmp/policies.json", "utf8"));
const MIGS = JSON.parse(fs.readFileSync("/tmp/mig.json", "utf8"));
const TRIGS = fs.existsSync("/tmp/trigs.json") ? JSON.parse(fs.readFileSync("/tmp/trigs.json", "utf8")) : [];

const cloud = {
  tables: TABLES.length,
  columns: COLS.length,
  functions: DRIFT.filter((d) => d.kind === "func" && !["auth", "storage"].includes(d.schema)).length,
  views: DRIFT.filter((d) => d.kind === "view").length,
  triggers: TRIGS.filter((t) => !["auth", "storage"].includes(t.schema)).length,
  policies: POLICIES.filter((p) => !["cron", "pgmq"].includes(p.schema)).length,
  migrations: MIGS.length,
};

console.log("PARITY CHECK (5 schema app: public/practice/sf/tvc/gtm)");
console.log("object".padEnd(14), "cloud".padStart(8), "local".padStart(8));
const lm = Object.fromEntries(local);
for (const [k, cv] of Object.entries(cloud)) {
  const lv = lm[k] ?? "-";
  const mark = String(cv) === String(lv) ? "OK " : "DIFF";
  console.log(mark, k.padEnd(10), String(cv).padStart(8), String(lv).padStart(8));
}
for (const k of ["rls_enabled", "buckets"]) console.log("    ", k.padEnd(10), "       -", String(lm[k] ?? "-").padStart(8));
