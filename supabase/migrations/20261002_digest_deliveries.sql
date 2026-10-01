-- CR-021: delivery log cho email digest phu huynh (CR-019).
-- Cron route ghi 1 row/parent/run; staff cung truong doc de bao cao + retry.

create table if not exists digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  parent_id uuid not null references parents(id) on delete cascade,
  email text not null,
  week_start date not null,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  attempts int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists digest_deliveries_run_idx on digest_deliveries (run_id);
create index if not exists digest_deliveries_status_idx on digest_deliveries (status);
create index if not exists digest_deliveries_created_idx on digest_deliveries (created_at desc);

alter table digest_deliveries enable row level security;

-- Staff cung truong doc; ghi chi qua service role (cron route dung admin client).
drop policy if exists digest_deliveries_staff_read on digest_deliveries;
create policy digest_deliveries_staff_read on digest_deliveries
  for select to authenticated
  using (
    (select my_role()) = any (array['bgh','pht','gvcn','gvbm','totruong','ketoan'])
    and (select scn_parent_in_school(parent_id))
  );

revoke all on digest_deliveries from anon;
grant select on digest_deliveries to authenticated;
grant all on digest_deliveries to service_role;
