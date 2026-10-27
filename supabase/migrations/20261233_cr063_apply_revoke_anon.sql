-- CR-063 r3: external review vong 2.
-- 1) revoke execute khoi anon/authenticated - RPC apply chi goi qua
--    API route bang service role. Neu khong, attacker goi RPC truc
--    tiep voi p_ip_hash=null -> bo rate limit + Turnstile + honeypot.
-- 2) unique_violation phai phan biet constraint: chi retry khi trung
--    adm_app_tracking, cac unique khac (id_number, exam_number...) re-raise.

revoke execute on function public.admission_apply_public(
  uuid, text, date, text, text, text, text, text, text, int, text
) from public, anon, authenticated;
grant execute on function public.admission_apply_public(
  uuid, text, date, text, text, text, text, text, text, int, text
) to service_role;

create or replace function public.admission_apply_public(
  p_campaign uuid,
  p_full_name text,
  p_dob date default null,
  p_gender text default null,
  p_id_number text default null,
  p_address text default null,
  p_source_school text default null,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_priority int default 1,
  p_ip_hash text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_code text;
  v_gender text;
  v_tries int := 0;
  v_recent int;
  v_constraint text;
begin
  select * into c from public.admission_campaigns where id = p_campaign;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if c.status <> 'open' then
    raise exception 'campaign_not_open';
  end if;
  if exists (select 1 from public.school_features f
             where f.school_id = c.school_id
               and f.module = 'tuyen_sinh' and f.enabled = false) then
    raise exception 'module_disabled';
  end if;
  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'missing_name';
  end if;

  -- rate limit bat buoc: ip_hash la cot duy nhat dinh danh nguoi nop.
  if p_ip_hash is null then
    raise exception 'missing_ip';
  end if;
  select count(*) into v_recent
  from public.admission_apply_attempts
  where ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'rate_limited';
  end if;
  insert into public.admission_apply_attempts (ip_hash) values (p_ip_hash);

  v_gender := case lower(btrim(coalesce(p_gender, '')))
    when 'nam' then 'nam'
    when 'nu' then 'nu'
    when 'khac' then 'khac'
    else null end;

  <<gen>>
  loop
    v_code := 'TS' || (select string_agg(
        substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ',
               floor(random() * 32)::int + 1, 1), '')
      from generate_series(1, 10));
    begin
      insert into public.admission_applications (
        campaign_id, school_id, full_name, dob, gender, id_number,
        address, source_school, parent_name, parent_phone,
        priority_order, status, tracking_code
      ) values (
        p_campaign, c.school_id, btrim(p_full_name), p_dob, v_gender,
        nullif(btrim(coalesce(p_id_number, '')), ''),
        nullif(btrim(coalesce(p_address, '')), ''),
        nullif(btrim(coalesce(p_source_school, '')), ''),
        nullif(btrim(coalesce(p_parent_name, '')), ''),
        nullif(btrim(coalesce(p_parent_phone, '')), ''),
        greatest(1, least(coalesce(p_priority, 1), 5)),
        'submitted', v_code
      );
      exit gen;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      -- chi retry khi trung tracking_code; unique khac (id_number,
      -- exam_number, tuong lai) deu nem loi ra ngoai.
      if v_constraint = 'adm_app_tracking' then
        v_tries := v_tries + 1;
        if v_tries >= 5 then
          raise;
        end if;
      else
        raise;
      end if;
    end;
  end loop gen;

  return jsonb_build_object('tracking_code', v_code);
end;
$$;
