-- CR-063: cong tuyen sinh truc tuyen (public apply + tra cuu).
-- PH/HS nop ho so qua link /apply/<campaign_id> khi campaign 'open'
-- va module tuyen_sinh dang bat. Tra cuu bang tracking_code.
-- Bao mat: KHONG mo insert anon vao bang; moi ghi qua RPC security
-- definer co kiem campaign open + module flag + chuan hoa input.

-- tracking_code ngan, doc duoc qua dien thoai: TS + 6 ky tu hex.
alter table public.admission_applications
  add column if not exists tracking_code text;

create unique index if not exists adm_app_tracking
  on public.admission_applications(tracking_code)
  where tracking_code is not null;

-- chong trung lap: 1 CCCD/dinh danh chi nop 1 lan trong 1 dot
-- (gia dinh nhieu con van nop duoc vi id_number khac nhau).
create unique index if not exists adm_app_id_number
  on public.admission_applications(campaign_id, id_number)
  where id_number is not null;

-- 1) Thong tin dot tuyen cong khai toi thieu cho trang apply.
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
  return jsonb_build_object(
    'name', c.name,
    'level', c.level,
    'school_name', c.school_name,
    'status', c.status,
    'exam_subjects', c.exam_subjects
  );
end;
$$;

-- 2) Nop ho so cong khai. Chi chen khi dot dang 'open'.
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
  p_priority int default 1
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_code text;
  v_gender text;
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

  v_gender := case lower(btrim(coalesce(p_gender, '')))
    when 'nam' then 'nam'
    when 'nu' then 'nu'
    when 'khac' then 'khac'
    else null end;

  v_code := 'TS' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

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

  return jsonb_build_object('tracking_code', v_code);
end;
$$;

-- 3) Tra cuu trang thai bang tracking_code - chi lo thong tin toi thieu.
create or replace function public.admission_track(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
begin
  select a.status, c.name as campaign_name, c.level
  into r
  from public.admission_applications a
  join public.admission_campaigns c on c.id = a.campaign_id
  where a.tracking_code = upper(btrim(coalesce(p_code, '')));
  if not found then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'status', r.status,
    'campaign_name', r.campaign_name,
    'level', r.level
  );
end;
$$;

-- anon chi duoc goi 3 RPC nay, khong duoc cham bang truc tiep.
grant execute on function public.admission_campaign_info(uuid) to anon, authenticated;
grant execute on function public.admission_apply_public(
  uuid, text, date, text, text, text, text, text, text, int
) to anon, authenticated;
grant execute on function public.admission_track(text) to anon, authenticated;
