-- CR-062 pha 3 (external review r-adm2): cung co 3 RPC + policy students.
-- 1) admission_enroll: reset v_student moi vong, tinh ca 2 ma deterministic
--    (code + code_alt hau to) de retry sau suffix van tim lai dung HS.
-- 2) admission_assign_exam_numbers + admission_finalize: bat level='khoi_10'.
-- 3) admission_finalize: pass update co dieu kien total_score >= cutoff
--    (defense sau missing_scores guard).
-- 4) students_staff_ins them pht cung truong (PHT phu trach nhap hoc),
--    khop voi ROLES cua admissions actions.

-- ---------------------------------------------------------------
-- 1) Enroll v2: retry-safe ke ca khi code bi suffix.
-- ---------------------------------------------------------------
create or replace function public.admission_enroll(p_campaign uuid, p_class uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_camp_school uuid;
  v_class_school uuid;
  v_app record;
  v_code text;
  v_code_alt text;
  v_student uuid;
  v_count int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('adm_enr_' || p_campaign::text));

  select school_id into v_camp_school
    from public.admission_campaigns where id = p_campaign;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  select school_id into v_class_school
    from public.classes where id = p_class;
  if not found then
    raise exception 'class_not_found';
  end if;
  if v_camp_school is distinct from v_class_school then
    raise exception 'school_mismatch';
  end if;

  for v_app in
    select id, full_name, dob, gender, address, id_number
      from public.admission_applications
     where campaign_id = p_campaign
       and school_id = v_camp_school
       and status in ('approved', 'passed')
       and student_id is null
     order by full_name, id
  loop
    v_student := null;
    v_code := coalesce(v_app.id_number, 'TS' || upper(substr(v_app.id::text, 1, 8)));
    v_code_alt := left(v_code, 40) || '-' || upper(substr(v_app.id::text, 10, 4));

    -- retry/dedupe: tim theo ca code goc lan code da suffix cua chinh app
    select s.id into v_student
      from public.students s
      join public.classes c on c.id = s.class_id
     where c.school_id = v_class_school
       and s.code in (v_code, v_code_alt)
       and s.national_id is not distinct from v_app.id_number
     limit 1;

    if v_student is null then
      -- code bi HS khac chiem (code unique toan cuc) -> dung code_alt
      if exists (select 1 from public.students where code = v_code) then
        v_code := v_code_alt;
      end if;
      insert into public.students
        (class_id, code, full_name, dob, gender, address, national_id, status, positive_points)
      values
        (p_class, v_code, v_app.full_name, v_app.dob, v_app.gender,
         v_app.address, v_app.id_number, 'active', 0)
      returning id into v_student;
    end if;

    update public.admission_applications
       set status = 'enrolled', student_id = v_student
     where id = v_app.id
       and status in ('approved', 'passed')
       and student_id is null;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------
-- 2) Cap SBD v2: chi cho dot khoi_10.
-- ---------------------------------------------------------------
create or replace function public.admission_assign_exam_numbers(p_campaign uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_level text;
  v_base int;
  v_count int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('adm_sbd_' || p_campaign::text));

  select level into v_level
    from public.admission_campaigns where id = p_campaign;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if v_level <> 'khoi_10' then
    raise exception 'wrong_level';
  end if;

  select count(*) into v_base
    from public.admission_applications
   where campaign_id = p_campaign
     and exam_number is not null;

  update public.admission_applications a
     set exam_number = 'TS' || lpad((v_base + t.rn)::text, 4, '0'),
         status = 'exam_registered'
    from (
      select id, row_number() over (order by full_name, id) as rn
        from public.admission_applications
       where campaign_id = p_campaign
         and status = 'submitted'
    ) t
   where a.id = t.id
     and a.status = 'submitted';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------
-- 3) Finalize v2: chi khoi_10 + pass co dieu kien cutoff tuong minh.
-- ---------------------------------------------------------------
create or replace function public.admission_finalize(p_campaign uuid)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_level text;
  v_bench numeric;
  v_quota int;
  v_missing int;
  v_cutoff numeric;
  v_passed int := 0;
  v_failed int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('adm_fin_' || p_campaign::text));

  select level, benchmark, quota into v_level, v_bench, v_quota
    from public.admission_campaigns
   where id = p_campaign
   for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if v_level <> 'khoi_10' then
    raise exception 'wrong_level';
  end if;
  if v_bench is null then
    raise exception 'no_benchmark';
  end if;

  select count(*) into v_missing
    from public.admission_applications
   where campaign_id = p_campaign
     and status = 'exam_registered'
     and total_score is null;
  if v_missing > 0 then
    raise exception 'missing_scores:%', v_missing;
  end if;

  v_cutoff := v_bench;
  if v_quota is not null and v_quota > 0 then
    select t.total_score into v_cutoff
      from (
        select total_score
          from public.admission_applications
         where campaign_id = p_campaign
           and status = 'exam_registered'
           and total_score >= v_bench
         order by total_score desc, full_name, id
         offset greatest(v_quota - 1, 0)
         limit 1
      ) t;
    v_cutoff := greatest(coalesce(v_cutoff, v_bench), v_bench);
  end if;

  update public.admission_applications
     set status = 'failed', reviewed_at = now()
   where campaign_id = p_campaign
     and status = 'exam_registered'
     and (total_score is null or total_score < v_cutoff);
  get diagnostics v_failed = row_count;

  update public.admission_applications
     set status = 'passed', reviewed_at = now()
   where campaign_id = p_campaign
     and status = 'exam_registered'
     and total_score >= v_cutoff;
  get diagnostics v_passed = row_count;

  return json_build_object(
    'passed', v_passed,
    'failed', v_failed,
    'cutoff', v_cutoff
  );
end;
$$;

-- ---------------------------------------------------------------
-- 4) students_staff_ins: them pht cung truong (phu trach nhap hoc).
-- ---------------------------------------------------------------
drop policy if exists students_staff_ins on public.students;
create policy students_staff_ins on public.students
  for insert with check (
    is_school_staff()
    and (
      (select my_roles()) @> array['admin']
      or ((select my_roles()) && array['bgh','pht']::text[]
          and scn_class_in_school(class_id))
      or ((select my_roles()) @> array['gvcn']
          and scn_is_my_homeroom_class(class_id))
    )
  );
