-- CR-072 r1: external review fixes.
-- 1. int_dequeue ton trong module gate - truong tat tich_hop thi event khong duoc dispatch.
-- 2. int_enqueue chi bgh|admin - event nghiep vu do staff tao di qua wrapper
--    security definer rieng cua tung module (khong mo enqueue tuy y payload).
-- 3. validate endpoint khi luu connector: bat buoc https + chan localhost/private IP (SSRF).
-- 4. int_receive ghi inbound event vao int_inbox + dedup (source, idem_key).

-- ===== endpoint validator =====
create or replace function public.int_endpoint_ok(p_url text)
returns boolean language plpgsql immutable as $$
declare
  v_host text;
begin
  if nullif(btrim(coalesce(p_url, '')), '') is null then return true; end if;
  if p_url !~* '^https://[^/?#]+' then return false; end if;
  v_host := lower(substring(p_url from '^https://([^/:?#]+)'));
  if v_host is null or v_host = '' then return false; end if;
  if v_host in ('localhost', 'metadata.google.internal', 'ip6-localhost') then return false; end if;
  if v_host like '%.local' or v_host like '%.internal' then return false; end if;
  if v_host ~ '^\[' then return false; end if; -- ipv6 literal
  if v_host ~ '^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' then return false; end if;
  if v_host ~ '^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.' then return false; end if; -- cgnat
  return true;
end $$;
revoke all on function public.int_endpoint_ok(text) from public;

-- ===== int_upsert_connector + endpoint validation =====
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
  if not public.int_endpoint_ok(p_endpoint) then raise exception 'invalid_endpoint'; end if;
  if p_config ? 'endpoint' and not public.int_endpoint_ok(p_config->>'endpoint') then
    raise exception 'invalid_endpoint';
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

-- ===== int_enqueue - chi bgh|admin =====
create or replace function public.int_enqueue(
  p_connector uuid, p_event text, p_payload jsonb, p_idem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_conn record; v_id uuid;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
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

-- ===== int_dequeue - ton trong module gate =====
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
      and public.int_module_enabled(i.school_id)
    order by i.created_at
    limit greatest(1, least(coalesce(p_batch, 20), 100))
    for update skip locked
  )
  returning o.*;
end $$;

-- ===== int_receive - inbound event vao inbox + dedup =====
create or replace function public.int_receive(
  p_school uuid, p_source text, p_event text, p_payload jsonb,
  p_signature text, p_idem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  -- webhook route goi bang service_role; bgh|admin duoc nap tay cho truong minh
  if auth.role() <> 'service_role' then
    if not ((select my_roles()) && array['bgh','admin']::text[])
       or (select my_school_id()) is distinct from p_school then
      raise exception 'forbidden';
    end if;
  end if;
  if p_school is null then raise exception 'school_required'; end if;
  if not (select public.int_module_enabled(p_school)) then
    raise exception 'module_disabled';
  end if;
  if nullif(btrim(coalesce(p_source,'')), '') is null then raise exception 'invalid_source'; end if;

  insert into public.int_inbox (school_id, source, event_type, payload, signature, idem_key)
  values (p_school, btrim(p_source), nullif(btrim(coalesce(p_event,'')), ''),
          coalesce(p_payload,'{}'::jsonb), p_signature,
          nullif(btrim(coalesce(p_idem,'')), ''))
  on conflict (source, idem_key) do nothing
  returning id into v_id;
  return jsonb_build_object('inbox_id', v_id, 'deduplicated', v_id is null);
end $$;

revoke all on function public.int_receive(uuid, text, text, jsonb, text, text) from public, anon;
grant execute on function public.int_receive(uuid, text, text, jsonb, text, text) to authenticated, service_role;
