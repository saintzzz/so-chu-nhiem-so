-- CR-063 r2: cung cong apply cong khai theo external review.
-- 1) tracking_code mo rong TS + 10 ky tu base32 (~1.1e15) chong brute force
-- 2) rate limit nop ho so theo ip_hash (10/gio) qua bang attempts
-- 3) retry khi tracking_code trung
-- 4) campaign_info chi tra name khi status='open' (khong lo draft)

-- Bang dem luot nop theo ip_hash - chi definer RPC cham, khong grant.
create table if not exists public.admission_apply_attempts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists adm_attempt_ip_time
  on public.admission_apply_attempts(ip_hash, created_at desc);
alter table public.admission_apply_attempts enable row level security;
revoke all on public.admission_apply_attempts from anon, authenticated;

-- alphabet khong ky tu gay nhap nham (bo 0/O, 1/I/L).
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

  -- rate limit: toi da 10 luot/gio/ip (ip_hash do API route hash truoc,
  -- DB khong luu ip tho). Bo qua khi ip_hash null (test/seed).
  if p_ip_hash is not null then
    select count(*) into v_recent
    from public.admission_apply_attempts
    where ip_hash = p_ip_hash
      and created_at > now() - interval '1 hour';
    if v_recent >= 10 then
      raise exception 'rate_limited';
    end if;
    insert into public.admission_apply_attempts (ip_hash) values (p_ip_hash);
  end if;

  v_gender := case lower(btrim(coalesce(p_gender, '')))
    when 'nam' then 'nam'
    when 'nu' then 'nu'
    when 'khac' then 'khac'
    else null end;

  -- TS + 10 ky tu base32 (32^10 ~ 1.1e15); retry khi trung code.
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
      -- trung tracking_code -> sinh lai; trung id_number -> nem loi ra ngoai
      if sqlerrm like '%adm_app_id_number%' then
        raise;
      end if;
      v_tries := v_tries + 1;
      if v_tries >= 5 then
        raise;
      end if;
    end;
  end loop gen;

  return jsonb_build_object('tracking_code', v_code);
end;
$$;

-- campaign_info: chi lo ten/dot khi dang mo; draft/closed tra status toi thieu.
create or replace function public.admission_campaign_info(p_campaign uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c record;
begin
  select camp.*, sc.name as school_name into c
  from public.admission_campaigns camp
  join public.schools sc on sc.id = camp.school_id
  where camp.id = p_campaign;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if exists (select 1 from public.school_features f
             where f.school_id = c.school_id
               and f.module = 'tuyen_sinh' and f.enabled = false) then
    raise exception 'module_disabled';
  end if;
  if c.status <> 'open' then
    return jsonb_build_object('status', c.status);
  end if;
  return jsonb_build_object(
    'name', c.name,
    'level', c.level,
    'school_name', c.school_name,
    'status', c.status,
    'exam_subjects', c.exam_subjects
  );
end;
$$;

grant execute on function public.admission_apply_public(
  uuid, text, date, text, text, text, text, text, text, int, text
) to anon, authenticated;
