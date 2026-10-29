-- CR-078: kenh phu huynh (Zalo OA/ZNS + SMS) qua comm_outbox trung lap.
-- Email giu nguyen qua parent-email/digest_outbox; zalo/sms chi chay khi
-- school_integrations + consent da cau hinh.

-- So dien thoai PH + consent per kenh (ZNS bat buoc opt-in).
alter table public.parents
  add column if not exists phone text;

create table if not exists public.parent_channel_consents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  parent_id uuid not null references public.parents(id) on delete cascade,
  channel text not null check (channel in ('zalo','sms','email')),
  consented boolean not null default false,
  source text,                    -- 'form','import','manual'
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_id, channel)
);
alter table public.parent_channel_consents enable row level security;
create policy pcc_rw on public.parent_channel_consents for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin','ke_toan']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin','ke_toan']::text[]);
create policy pcc_select_staff on public.parent_channel_consents for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','gvcn','gvbm','ke_toan','admin']::text[]);
grant select, insert, update on public.parent_channel_consents to authenticated;

-- Template per kenh - ZNS bat buoc template_id da duyet san tu Zalo.
create table if not exists public.comm_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  channel text not null check (channel in ('zalo','sms','email')),
  name text not null,             -- 'announcement','absence','fee_reminder'
  provider_template_id text,      -- ZNS: template_id da approved
  body text not null,
  required_params text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, channel, name)
);
alter table public.comm_templates enable row level security;
create policy ct_rw on public.comm_templates for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin']::text[]);
create policy ct_select on public.comm_templates for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','gvcn','gvbm','ke_toan','admin']::text[]);
grant select, insert, update, delete on public.comm_templates to authenticated;

-- Outbox: moi message 1 row, dedupe qua dedupe_key, retry backoff.
create table if not exists public.comm_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  parent_id uuid not null references public.parents(id) on delete cascade,
  channel text not null check (channel in ('zalo','sms','email')),
  template_name text not null,
  recipient_ref text not null,    -- phone (zalo/sms) hoac email
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','sending','sent','failed','blocked_no_config','dead','cancelled')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  provider_msg_id text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, dedupe_key)
);
create index if not exists comm_outbox_claim_idx
  on public.comm_outbox (status, next_attempt_at, id);
alter table public.comm_outbox enable row level security;
create policy co_select on public.comm_outbox for select to authenticated
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin']::text[]);
grant select on public.comm_outbox to authenticated;
grant all on public.comm_outbox to service_role;

-- Atomic claim (mirror scn_digest_outbox_claim).
create or replace function public.comm_outbox_claim(p_limit int)
returns setof public.comm_outbox
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.comm_outbox o
       set status = 'sending', attempts = attempts + 1, updated_at = now()
     where o.id in (
       select id from public.comm_outbox
        where status = 'queued' and next_attempt_at <= now()
        order by next_attempt_at, id
        limit p_limit
        for update skip locked)
     returning o.*;
end $$;

-- Requeue 'sending' treo (worker chet) -> queued.
create or replace function public.comm_outbox_requeue_stuck(
  p_older_than interval default '15 minutes'
) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.comm_outbox
     set status = 'queued', updated_at = now()
   where status = 'sending' and updated_at < now() - p_older_than;
  get diagnostics n = row_count;
  return n;
end $$;

-- Helper: phu huynh co consent + phone cho kenh? (server goi khi enqueue)
create or replace function public.scn_parent_channel_ok(
  p_parent uuid, p_channel text
) returns boolean language sql stable security definer
 set search_path = public as $$
  select exists (
    select 1 from public.parent_channel_consents c
      join public.parents p on p.id = c.parent_id
     where c.parent_id = p_parent and c.channel = p_channel
       and c.consented and c.revoked_at is null
       and p.phone is not null);
$$;

revoke all on function public.comm_outbox_claim(int) from public, anon;
revoke all on function public.comm_outbox_requeue_stuck(interval) from public, anon;
revoke all on function public.scn_parent_channel_ok(uuid, text) from public, anon;
grant execute on function public.comm_outbox_claim(int) to service_role;
grant execute on function public.comm_outbox_requeue_stuck(interval) to service_role;
grant execute on function public.scn_parent_channel_ok(uuid, text) to authenticated, service_role;
