-- CR-072: integration framework - connectors + outbox + inbox + worker drain.
-- Moi write qua RPC security definer; direct table write bi revoke.
-- secret_name luu TEN bien env chua secret - khong bao gio luu gia tri.

create or replace function public.int_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select f.enabled from public.school_features f
  where f.school_id = p_school and f.module = 'tich_hop'), true) $$;
revoke all on function public.int_module_enabled(uuid) from public;
grant execute on function public.int_module_enabled(uuid) to authenticated, anon;

-- ===== connectors =====
create table public.int_connectors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  type text not null check (type in
    ('webhook','custom','ministry_gd','vnpay','zalo_oa','google_classroom','ms_teams')),
  name text not null,
  endpoint_url text,
  auth_type text not null default 'none'
    check (auth_type in ('none','api_key','bearer','hmac_sha256','oauth2_client')),
  secret_name text,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.int_connectors enable row level security;
create index int_conn_school on public.int_connectors(school_id);

-- ===== outbox =====
create table public.int_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  connector_id uuid references public.int_connectors(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','dead')),
  attempts int not null default 0,
  next_retry_at timestamptz,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (school_id, idempotency_key)
);
alter table public.int_outbox enable row level security;
create index int_out_drain on public.int_outbox(status, next_retry_at)
  where status in ('pending','failed');
create index int_out_school on public.int_outbox(school_id, created_at desc);

-- ===== inbox =====
create table public.int_inbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  source text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  signature text,
  idem_key text,
  status text not null default 'received'
    check (status in ('received','processed','failed','ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, idem_key)
);
alter table public.int_inbox enable row level security;

-- tenant trigger: connector_id cung school
create or replace function public.int_tenant_guard() returns trigger
language plpgsql as $$
begin
  if new.connector_id is not null then
    if (select c.school_id from public.int_connectors c
        where c.id = new.connector_id) is distinct from new.school_id then
      raise exception 'cross_school_connector';
    end if;
  end if;
  return new;
end $$;
create trigger int_out_tenant before insert or update on public.int_outbox
  for each row execute function public.int_tenant_guard();

-- RLS read: bgh|admin|so_gd cung truong + module bat; write chi qua RPC
create policy int_conn_read on public.int_connectors for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin','so_gd']::text[]
    and (select public.int_module_enabled(school_id)));
create policy int_out_read on public.int_outbox for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin','so_gd']::text[]
    and (select public.int_module_enabled(school_id)));
create policy int_in_read on public.int_inbox for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin','so_gd']::text[]
    and (select public.int_module_enabled(school_id)));
grant select on public.int_connectors, public.int_outbox, public.int_inbox to authenticated;
revoke insert, update, delete on public.int_connectors, public.int_outbox, public.int_inbox
  from authenticated, anon;

-- ===== int_upsert_connector =====
create or replace function public.int_upsert_connector(
  p_id uuid, p_type text, p_name text, p_endpoint text,
  p_auth_type text, p_secret_name text, p_config jsonb, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_id uuid;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.int_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if nullif(btrim(coalesce(p_name,'')), '') is null then raise exception 'invalid_name'; end if;
  if p_type not in ('webhook','custom','ministry_gd','vnpay','zalo_oa','google_classroom','ms_teams') then
    raise exception 'invalid_type';
  end if;
  if p_auth_type not in ('none','api_key','bearer','hmac_sha256','oauth2_client') then
    raise exception 'invalid_auth';
  end if;
  if p_auth_type <> 'none' and nullif(btrim(coalesce(p_secret_name,'')), '') is null then
    raise exception 'secret_name_required';
  end if;
  if p_type in ('webhook','custom') and nullif(btrim(coalesce(p_endpoint,'')), '') is null then
    raise exception 'endpoint_required';
  end if;

  if p_id is null then
    insert into public.int_connectors
      (school_id, type, name, endpoint_url, auth_type, secret_name, config, enabled, created_by)
    values (v_school, p_type, btrim(p_name), nullif(btrim(coalesce(p_endpoint,'')), ''),
            p_auth_type, nullif(btrim(coalesce(p_secret_name,'')), ''),
            coalesce(p_config,'{}'::jsonb), coalesce(p_enabled, true), auth.uid())
    returning id into v_id;
  else
    update public.int_connectors
    set name = btrim(p_name), endpoint_url = nullif(btrim(coalesce(p_endpoint,'')), ''),
        auth_type = p_auth_type, secret_name = nullif(btrim(coalesce(p_secret_name,'')), ''),
        config = coalesce(p_config, config), enabled = coalesce(p_enabled, enabled)
    where id = p_id and school_id = v_school
    returning id into v_id;
    if not found then raise exception 'connector_not_found'; end if;
  end if;
  return jsonb_build_object('connector_id', v_id);
end $$;

create or replace function public.int_delete_connector(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_del uuid;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.int_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  delete from public.int_connectors where id = p_id and school_id = v_school
  returning id into v_del;
  if not found then raise exception 'connector_not_found'; end if;
  return jsonb_build_object('deleted', true);
end $$;

-- ===== int_enqueue =====
create or replace function public.int_enqueue(
  p_connector uuid, p_event text, p_payload jsonb, p_idem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_roles text[] := (select my_roles());
  v_conn record; v_id uuid;
begin
  if v_roles is null or not (v_roles && array['gvcn','gvbm','bgh','admin','ke_toan','to_truong']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.int_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  select * into v_conn from public.int_connectors c
  where c.id = p_connector and c.school_id = v_school;
  if not found then raise exception 'connector_not_found'; end if;
  if not v_conn.enabled then raise exception 'connector_disabled'; end if;
  if nullif(btrim(coalesce(p_event,'')), '') is null then raise exception 'invalid_event'; end if;

  insert into public.int_outbox (school_id, connector_id, event_type, payload, idempotency_key)
  values (v_school, p_connector, p_event, coalesce(p_payload,'{}'::jsonb),
          nullif(btrim(coalesce(p_idem,'')), ''))
  on conflict (school_id, idempotency_key) do nothing
  returning id into v_id;
  return jsonb_build_object('event_id', v_id, 'deduplicated', v_id is null);
end $$;

-- ===== int_dequeue (worker, service_role) =====
create or replace function public.int_dequeue(p_batch int)
returns setof public.int_outbox language plpgsql security definer
set search_path = public as $$
begin
  return query
  update public.int_outbox o
  set status = 'processing', attempts = o.attempts + 1
  where o.id in (
    select i.id from public.int_outbox i
    where i.status in ('pending','failed')
      and (i.next_retry_at is null or i.next_retry_at <= now())
    order by i.created_at
    limit greatest(1, least(coalesce(p_batch, 20), 100))
    for update skip locked
  )
  returning o.*;
end $$;

-- ===== int_mark (worker, service_role) =====
create or replace function public.int_mark(p_id uuid, p_ok boolean, p_error text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_attempts int;
begin
  if p_ok then
    update public.int_outbox set status = 'sent', sent_at = now(), last_error = null
    where id = p_id;
  else
    select o.attempts into v_attempts from public.int_outbox o where o.id = p_id;
    if v_attempts >= 6 then
      update public.int_outbox set status = 'dead', last_error = left(coalesce(p_error,''), 500)
      where id = p_id;
    else
      update public.int_outbox
      set status = 'failed', last_error = left(coalesce(p_error,''), 500),
          next_retry_at = now() + (power(v_attempts, 2) || ' minutes')::interval
      where id = p_id;
    end if;
  end if;
  if not found then raise exception 'event_not_found'; end if;
  return jsonb_build_object('ok', p_ok);
end $$;

-- ===== int_retry (bgh|admin dua failed/dead ve pending) =====
create or replace function public.int_retry(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_id uuid;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.int_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  update public.int_outbox set status = 'pending', attempts = 0,
    next_retry_at = null, last_error = null
  where id = p_id and school_id = v_school and status in ('failed','dead')
  returning id into v_id;
  if not found then raise exception 'event_not_found'; end if;
  return jsonb_build_object('event_id', v_id);
end $$;

revoke all on function public.int_upsert_connector(uuid, text, text, text, text, text, jsonb, boolean) from public, anon;
revoke all on function public.int_delete_connector(uuid) from public, anon;
revoke all on function public.int_enqueue(uuid, text, jsonb, text) from public, anon;
revoke all on function public.int_dequeue(int) from public, anon, authenticated;
revoke all on function public.int_mark(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.int_retry(uuid) from public, anon;
grant execute on function public.int_upsert_connector(uuid, text, text, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.int_delete_connector(uuid) to authenticated;
grant execute on function public.int_enqueue(uuid, text, jsonb, text) to authenticated;
grant execute on function public.int_dequeue(int) to service_role;
grant execute on function public.int_mark(uuid, boolean, text) to service_role;
grant execute on function public.int_retry(uuid) to authenticated;
