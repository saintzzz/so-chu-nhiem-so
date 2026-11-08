-- Tao cac view phu tren CLOUD de export catalog phuc vu restore self-host.
-- Chay 1 lan bang service_role (SQL editor hoac MCP execute_sql).
-- Tat ca security_invoker=off -> doc duoc bang anon/service_role qua REST.

create or replace view public._mig_export with (security_invoker=off) as
select version, name, statements from supabase_migrations.schema_migrations order by version;
grant select on public._mig_export to service_role;

create or replace view public._drift_export with (security_invoker=off) as
select n.nspname as schema, p.proname as name, 'func' as kind,
  p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as sig,
  pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','practice','sf','tvc','gtm','auth','storage')
union all
select n.nspname, c.relname, 'view', c.relname, pg_get_viewdef(c.oid)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='v' and n.nspname in ('public','practice','sf','tvc','gtm')
union all
select n.nspname, c.relname, 'trig', t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','practice','sf','tvc','gtm');
grant select on public._drift_export to service_role;

create or replace view public._table_export with (security_invoker=off) as
select n.nspname as schema, c.relname as name,
'create table if not exists '||quote_ident(n.nspname)||'.'||quote_ident(c.relname)||E' (\n'||
string_agg('  '||quote_ident(a.attname)||' '||pg_catalog.format_type(a.atttypid,a.atttypmod)||
  coalesce(' default '||pg_get_expr(d.adbin,d.adrelid),'')||
  case when a.attnotnull then ' not null' else '' end, E',\n' order by a.attnum)||E'\n);' as tbl_def,
(select string_agg('alter table only '||quote_ident(n2.nspname)||'.'||quote_ident(c2.relname)||' add constraint '||quote_ident(con.conname)||' '||pg_get_constraintdef(con.oid)||';', E'\n')
 from pg_constraint con join pg_class c2 on c2.oid=con.conrelid join pg_namespace n2 on n2.oid=c2.relnamespace
 where con.conrelid=c.oid and con.contype in ('p','u','c','f')) as con_defs
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where c.relkind in ('r','p') and n.nspname in ('gtm','practice','sf','tvc','public')
group by n.nspname, c.relname, c.oid order by n.nspname, c.relname;
grant select on public._table_export to service_role;

create or replace view public._col_export with (security_invoker=off) as
select c.table_schema as schema, c.table_name as "table", c.column_name as col,
c.udt_name::regtype::text as col_type, c.column_default as col_default
from information_schema.columns c
where c.table_schema in ('public','practice','sf','tvc','gtm')
order by c.table_schema, c.table_name, c.ordinal_position;
grant select on public._col_export to service_role;

create or replace view public._pol_export with (security_invoker=off) as
select schemaname as schema, tablename as tbl, policyname as name, permissive,
array_to_string(roles,', ') as roles, cmd, qual, with_check from pg_policies;
grant select on public._pol_export to service_role;

create or replace view public._ext_export with (security_invoker=off) as
select e.extname, n.nspname as schema from pg_extension e
join pg_namespace n on n.oid=e.extnamespace where e.extname<>'plpgsql';
grant select on public._ext_export to service_role;

create or replace view public._seq_export with (security_invoker=off) as
select n.nspname as schema, c.relname as name from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where c.relkind='S' and n.nspname in ('public','practice','sf','tvc','gtm','auth','storage');
grant select on public._seq_export to service_role;

create or replace view public._trig_export with (security_invoker=off) as
select n.nspname as schema, c.relname as tbl, t.tgname as name, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','practice','sf','tvc','gtm','auth','storage');
grant select on public._trig_export to service_role;
