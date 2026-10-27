-- CR-062 pha 2 (external review r-adm1): chuyen cap SBD, chot ket qua, nhap hoc
-- sang RPC transaction de dam bao atomic + retry-safe.
-- 1) admission_assign_exam_numbers: advisory lock theo campaign, cap SBD 1 UPDATE.
-- 2) admission_finalize: chan thi sinh thieu diem, cutoff co tinh quota.
-- 3) admission_enroll: lock + kiem cung truong + find-or-create + CAS link.
-- 4) RLS write bo so_gd (So chi giam sat/read; thao tac thuoc truong/admin).

-- ---------------------------------------------------------------
-- 1) Cap SBD: khoa campaign, base = so SBD hien co, gan 1 luot.
-- ---------------------------------------------------------------
create or replace function public.admission_assign_exam_numbers(p_campaign uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_base int;
  v_count int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('adm_sbd_' || p_campaign::text));

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
-- 2) Chot ket qua: block khi con thi sinh exam_registered thieu diem.
--    cutoff = max(benchmark, diem cua thi sinh thu quota) neu quota set -
--    dong diem o nguong deu do (khong xet tieu chi phu trong pham vi nay).
--    Tra ve json {passed, failed, cutoff}. Raise:
--      'no_benchmark' | 'missing_scores:<n>'
-- ---------------------------------------------------------------
create or replace function public.admission_finalize(p_campaign uuid)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bench numeric;
  v_quota int;
  v_missing int;
  v_cutoff numeric;
  v_passed int := 0;
  v_failed int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('adm_fin_' || p_campaign::text));

  select benchmark, quota into v_bench, v_quota
    from public.admission_campaigns
   where id = p_campaign
   for update;
  if not found then
    raise exception 'campaign_not_found';
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
     and total_score < v_cutoff;
  get diagnostics v_failed = row_count;

  update public.admission_applications
     set status = 'passed', reviewed_at = now()
   where campaign_id = p_campaign
     and status = 'exam_registered';
  get diagnostics v_passed = row_count;

  return json_build_object(
    'passed', v_passed,
    'failed', v_failed,
    'cutoff', v_cutoff
  );
end;
$$;

-- ---------------------------------------------------------------
-- 3) Nhap hoc: atomic + retry-safe.
--    - Kiem campaign va class cung truong ('school_mismatch').
--    - find-or-create students theo code (code unique TOAN CUC trong
--      students, khong phai theo truong): trung code + cung truong +
--      cung national_id -> tai dung de retry; trung code khac nguoi ->
--      hau to uuid de khong dung do.
--    - Link application bang CAS (status con approved|passed,
--      student_id con null) nen retry khong tao trung.
--    Raise: 'campaign_not_found' | 'class_not_found' | 'school_mismatch'
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
    v_code := coalesce(v_app.id_number, 'TS' || upper(substr(v_app.id::text, 1, 8)));

    -- retry da tao student truoc do (insert ok nhung link loi) -> tai dung
    select s.id into v_student
      from public.students s
      join public.classes c on c.id = s.class_id
     where s.code = v_code
       and c.school_id = v_class_school
       and s.national_id is not distinct from v_app.id_number
     limit 1;

    if v_student is null then
      -- code bi HS khac chiem (code unique toan cuc) -> hau to de khong dung
      if exists (select 1 from public.students where code = v_code) then
        v_code := left(v_code, 40) || '-' || upper(substr(v_app.id::text, 9, 4));
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

grant execute on function public.admission_assign_exam_numbers(uuid) to authenticated;
grant execute on function public.admission_finalize(uuid) to authenticated;
grant execute on function public.admission_enroll(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------
-- 4) Sieu RLS write: bo so_gd khoi write (chi con select de giam sat),
--    khop voi action guards bgh/pht/admin.
-- ---------------------------------------------------------------
drop policy if exists adm_campaign_write on public.admission_campaigns;
create policy adm_campaign_write on public.admission_campaigns
  for all using (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin']::text[]
  ) with check (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin']::text[]
  );

drop policy if exists adm_app_write on public.admission_applications;
create policy adm_app_write on public.admission_applications
  for all using (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin']::text[]
  ) with check (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin']::text[]
  );
