-- CR-049 P3a: org-scoped department RLS.
-- Dept roles (so_gd, ubnd) bound to their org_units subtree instead of
-- global school visibility. School-level staff unchanged (school scope);
-- PHT campus filter preserved via scn_pht_allows_campus().
-- Verified prod 2026-10-11 via authenticated PostgREST: so_gd sees 3
-- schools, ubnd sees only the 2 schools under its ward org unit.
-- NOTE: quals generated from live pg_policies - nested SELECT wrappers
-- kept verbatim to match deployed state.

-- ============ scope helpers ============

create or replace function public.scn_my_scope_school_ids()
 returns setof uuid language sql stable security definer
 set search_path to 'public'
as $function$
  select s.id from public.schools s
   where case
     when (select my_role()) = 'admin' then true
     when (select my_role()) = any(array['so_gd','ubnd']) then
       s.org_unit_id in (
         with recursive t as (
           select id from public.org_units
            where id = (select p.org_unit_id from public.profiles p
                         where p.id = auth.uid())
           union all
           select o.id from public.org_units o
            join t on o.parent_id = t.id
         )
         select id from t
       )
       or (s.org_unit_id is null and exists(
         select 1 from public.org_units r
          where r.id = (select p2.org_unit_id from public.profiles p2
                         where p2.id = auth.uid())
            and r.parent_id is null))
     else s.id = (select my_school_id())
   end
$function$;

create or replace function public.scn_my_scope_class_ids()
 returns setof uuid language sql stable security definer
 set search_path to 'public'
as $function$
  select id from public.classes
   where school_id in (select scn_my_scope_school_ids())
     and scn_pht_allows_campus(campus_id)
$function$;

create or replace function public.scn_my_scope_student_ids()
 returns setof uuid language sql stable security definer
 set search_path to 'public'
as $function$
  select s.id from public.students s
   join public.classes c on c.id = s.class_id
   where c.school_id in (select scn_my_scope_school_ids())
     and scn_pht_allows_campus(c.campus_id)
$function$;

create or replace function public.scn_my_scope_parent_ids()
 returns setof uuid language sql stable security definer
 set search_path to 'public'
as $function$
  select ps.parent_id from public.parent_students ps
   join public.students s on s.id = ps.student_id
   join public.classes c on c.id = s.class_id
   where c.school_id in (select scn_my_scope_school_ids())
     and scn_pht_allows_campus(c.campus_id)
$function$;

create or replace function public.scn_my_scope_profile_ids()
 returns setof uuid language sql stable security definer
 set search_path to 'public'
as $function$
  select id from public.profiles
   where school_id in (select scn_my_scope_school_ids())
$function$;

create or replace function public.scn_my_scope_dept_ids()
 returns setof uuid language sql stable security definer
 set search_path to 'public'
as $function$
  select id from public.departments
   where school_id in (select scn_my_scope_school_ids())
$function$;

create or replace function public.scn_my_scope_ttentry_ids()
 returns setof uuid language sql stable security definer
 set search_path to 'public'
as $function$
  select t.id from public.timetable_entries t
   join public.classes c on c.id = t.class_id
   where c.school_id in (select scn_my_scope_school_ids())
     and scn_pht_allows_campus(c.campus_id)
$function$;

create or replace function public.scn_org_in_scope(oid uuid)
 returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select oid in (
    with recursive t as (
      select id from public.org_units
       where id = (select p.org_unit_id from public.profiles p
                    where p.id = auth.uid())
      union all
      select o.id from public.org_units o join t on o.parent_id = t.id
    )
    select id from t
  ) or exists(
    select 1 from public.schools s
     where s.org_unit_id = oid
       and s.id in (select scn_my_scope_school_ids())
  )
$function$;

create or replace function public.scn_class_in_scope(cid uuid)
 returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from public.classes c
   where c.id = cid
     and c.school_id in (select scn_my_scope_school_ids())
     and scn_pht_allows_campus(c.campus_id))
$function$;

create or replace function public.scn_student_in_scope(sid uuid)
 returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from public.students s
   join public.classes c on c.id = s.class_id
   where s.id = sid
     and c.school_id in (select scn_my_scope_school_ids())
     and scn_pht_allows_campus(c.campus_id))
$function$;

create or replace function public.scn_profile_in_scope(pid uuid)
 returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  -- Profile trong truong thuoc scope; profile thuoc org subtree
  -- (dept/dia phuong) cung thuoc scope cua actor org.
  select exists(select 1 from public.profiles p
   where p.id = pid
     and (p.school_id in (select scn_my_scope_school_ids())
          or p.org_unit_id in (
            with recursive t as (
              select id from public.org_units
               where id = (select pa.org_unit_id from public.profiles pa
                            where pa.id = auth.uid())
              union all
              select o.id from public.org_units o join t on o.parent_id = t.id
            ) select id from t)))
$function$;

create or replace function public.scn_ann_in_scope(aid uuid)
 returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from public.announcements a
   where a.id = aid and (
     case when a.class_id is not null
          then exists(select 1 from public.classes c
            where c.id = a.class_id
              and c.school_id in (select scn_my_scope_school_ids()))
          when a.student_id is not null
          then exists(select 1 from public.students s
            join public.classes c on c.id = s.class_id
            where s.id = a.student_id
              and c.school_id in (select scn_my_scope_school_ids()))
          else exists(select 1 from public.profiles p
            where p.id = a.sender_id
              and p.school_id in (select scn_my_scope_school_ids()))
     end))
$function$;

-- ============ policy sweep (55 SELECT policies) ============
drop policy if exists years_read_staff on public.academic_years;

create policy years_read_staff on public.academic_years for select
  using (((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) OR (school_id = ( SELECT ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id) AS my_school_id))) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists act_staff_read on public.activities;

create policy act_staff_read on public.activities for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and class_id in (select scn_my_scope_class_ids())) AS scn_is_dept) AS scn_is_dept) OR (class_id IN ( SELECT my_school_class_ids() AS my_school_class_ids)))));

drop policy if exists aa_staff_read on public.activity_attendance;

create policy aa_staff_read on public.activity_attendance for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids)))));

drop policy if exists ai_jobs_staff_read on public.ai_jobs;

create policy ai_jobs_staff_read on public.ai_jobs for select
  using (((created_by = ( SELECT auth.uid() AS uid)) OR ( SELECT ( SELECT (scn_is_dept() and created_by in (select scn_my_scope_profile_ids())) AS scn_is_dept) AS scn_is_dept) OR ((( SELECT my_roles() AS my_roles) && ARRAY['bgh'::text, 'admin'::text]) AND (created_by IN ( SELECT ( SELECT my_school_profile_ids() AS my_school_profile_ids) AS my_school_profile_ids)))));

drop policy if exists ar_staff on public.announcement_reads;

create policy ar_staff on public.announcement_reads for select
  using ((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_ann_in_scope(announcement_id)) AS scn_is_dept) AS scn_is_dept) OR scn_ann_in_school(announcement_id))));

drop policy if exists ann_staff_read on public.announcements;

create policy ann_staff_read on public.announcements for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and (case when class_id is not null then scn_class_in_scope(class_id) when student_id is not null then scn_student_in_scope(student_id) else scn_profile_in_scope(sender_id) end)) AS scn_is_dept) AS scn_is_dept) OR
CASE
    WHEN (class_id IS NOT NULL) THEN scn_class_in_school(class_id)
    WHEN (student_id IS NOT NULL) THEN scn_student_in_school(student_id)
    ELSE scn_profile_in_school(sender_id)
END)));

drop policy if exists appt_staff_read on public.appointments;

create policy appt_staff_read on public.appointments for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and parent_id in (select scn_my_scope_parent_ids())) AS scn_is_dept) AS scn_is_dept) OR (parent_id IN ( SELECT my_school_parent_ids() AS my_school_parent_ids)))));

drop policy if exists ae_read on public.assessment_evidence;

create policy ae_read on public.assessment_evidence for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and exists(select 1 from teacher_assessments ta where ta.id = assessment_evidence.assessment_id and scn_profile_in_scope(ta.teacher_id))) AS scn_is_dept) AS scn_is_dept) OR (EXISTS ( SELECT 1
   FROM teacher_assessments ta
  WHERE ((ta.id = assessment_evidence.assessment_id) AND scn_profile_in_school(ta.teacher_id)))))));

drop policy if exists att_staff_read on public.attendance_records;

create policy att_staff_read on public.attendance_records for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids))) AND (( SELECT my_roles() AS my_roles) && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text, 'so_gd'::text, 'ubnd'::text])));

drop policy if exists audit_staff_read on public.audit_logs;

create policy audit_staff_read on public.audit_logs for select
  using ((( SELECT (scn_is_dept() and scn_profile_in_scope(actor_id)) AS scn_is_dept) OR ((( SELECT my_roles() AS my_roles) && ARRAY['gvcn'::text, 'bgh'::text, 'pht'::text, 'admin'::text]) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = audit_logs.actor_id) AND (p.school_id = ( SELECT my_school_id() AS my_school_id))))))));

drop policy if exists campus_staff_read on public.campuses;

create policy campus_staff_read on public.campuses for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists class_roles_staff_read on public.class_roles;

create policy class_roles_staff_read on public.class_roles for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids)))));

drop policy if exists classes_staff on public.classes;

create policy classes_staff on public.classes for select
  using ((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists cmhs_staff_read on public.cmhs_members;

create policy cmhs_staff_read on public.cmhs_members for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and class_id in (select scn_my_scope_class_ids())) AS scn_is_dept) AS scn_is_dept) OR (class_id IN ( SELECT my_school_class_ids() AS my_school_class_ids)))));

drop policy if exists nlpc_staff_read on public.competency_evaluations;

create policy nlpc_staff_read on public.competency_evaluations for select
  using ((( SELECT scn_is_edu_staff() AS scn_is_edu_staff) AND (( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids)))));

drop policy if exists ce_staff_read on public.conduct_evaluations;

create policy ce_staff_read on public.conduct_evaluations for select
  using ((( SELECT scn_is_edu_staff() AS scn_is_edu_staff) AND (( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids)))));

drop policy if exists cr_staff_read on public.conduct_records;

create policy cr_staff_read on public.conduct_records for select
  using ((( SELECT scn_is_edu_staff() AS scn_is_edu_staff) AND (( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids)))));

drop policy if exists cc_staff_read on public.counseling_cases;

create policy cc_staff_read on public.counseling_cases for select
  using ((( SELECT (scn_is_dept() and scn_student_in_scope(student_id)) AS scn_is_dept) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_student_in_my_homeroom(student_id)) OR ((( SELECT my_roles() AS my_roles) && ARRAY['bgh'::text, 'pht'::text, 'admin'::text]) AND scn_student_in_school(student_id))));

drop policy if exists dr_staff_read on public.daily_reports;

create policy dr_staff_read on public.daily_reports for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and class_id in (select scn_my_scope_class_ids())) AS scn_is_dept) AS scn_is_dept) OR (class_id IN ( SELECT my_school_class_ids() AS my_school_class_ids)))));

drop policy if exists dept_read_staff on public.departments;

create policy dept_read_staff on public.departments for select
  using ((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists dm_staff_read on public.dept_meetings;

create policy dm_staff_read on public.dept_meetings for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and department_id in (select scn_my_scope_dept_ids())) AS scn_is_dept) AS scn_is_dept) OR (department_id IN ( SELECT my_school_dept_ids() AS my_school_dept_ids)))));

drop policy if exists ew_staff_read on public.early_warnings;

create policy ew_staff_read on public.early_warnings for select
  using ((( SELECT ( SELECT (scn_is_dept() and scn_student_in_scope(student_id)) AS scn_is_dept) AS scn_is_dept) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND (scn_student_in_my_homeroom(student_id) OR scn_is_my_homeroom_class(class_id))) OR ((( SELECT my_roles() AS my_roles) && ARRAY['bgh'::text, 'pht'::text, 'admin'::text]) AND (class_id IN ( SELECT my_school_class_ids() AS my_school_class_ids)))));

drop policy if exists ec_staff_read on public.emulation_criteria;

create policy ec_staff_read on public.emulation_criteria for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists es_staff_read on public.emulation_scores;

create policy es_staff_read on public.emulation_scores for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and class_id in (select scn_my_scope_class_ids())) AS scn_is_dept) AS scn_is_dept) OR (class_id IN ( SELECT my_school_class_ids() AS my_school_class_ids)))));

drop policy if exists equipment_staff_read on public.equipment;

create policy equipment_staff_read on public.equipment for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (( SELECT (scn_is_dept() and equipment.school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) OR (p.school_id = equipment.school_id)))))));

drop policy if exists exam_sessions_staff_read on public.exam_sessions;

create policy exam_sessions_staff_read on public.exam_sessions for select
  using ((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_class_in_scope(class_id)) AS scn_is_dept) AS scn_is_dept) OR scn_class_in_school(class_id))));

drop policy if exists exams_staff_read on public.exams;

create policy exams_staff_read on public.exams for select
  using ((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists grades_staff_read on public.grades;

create policy grades_staff_read on public.grades for select
  using (((( SELECT ( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids))) AND (( SELECT my_roles() AS my_roles) && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'giam_thi'::text, 'admin'::text, 'so_gd'::text, 'ubnd'::text])));

drop policy if exists inc_staff_read on public.incidents;

create policy inc_staff_read on public.incidents for select
  using ((( SELECT (scn_is_dept() and (case when class_id is not null then scn_class_in_scope(class_id) when student_id is not null then scn_student_in_scope(student_id) else scn_profile_in_scope(recorded_by) end)) AS scn_is_dept) OR ((( SELECT my_roles() AS my_roles) && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'y_te'::text, 'admin'::text]) AND
CASE
    WHEN (class_id IS NOT NULL) THEN scn_class_in_school(class_id)
    WHEN (student_id IS NOT NULL) THEN scn_student_in_school(student_id)
    ELSE scn_profile_in_school(recorded_by)
END)));

drop policy if exists kpi_staff_read on public.kpis;

create policy kpi_staff_read on public.kpis for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_class_in_scope(class_id)) AS scn_is_dept) AS scn_is_dept) OR scn_class_in_school(class_id))));

drop policy if exists lp_staff_read on public.lesson_plans;

create policy lp_staff_read on public.lesson_plans for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists nlpc_cmt_staff_read on public.nlpc_comments;

create policy nlpc_cmt_staff_read on public.nlpc_comments for select
  using ((( SELECT scn_is_edu_staff() AS scn_is_edu_staff) AND (( SELECT (scn_is_dept() and scn_student_in_scope(student_id)) AS scn_is_dept) OR scn_student_in_school(student_id))));

drop policy if exists ou_staff_read on public.org_units;

create policy ou_staff_read on public.org_units for select
  using ((( SELECT ( SELECT (scn_is_dept() and scn_org_in_scope(id)) AS scn_is_dept) AS scn_is_dept) OR (id = ( SELECT profiles.org_unit_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

drop policy if exists ps_staff_read on public.parent_students;

create policy ps_staff_read on public.parent_students for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids)))));

drop policy if exists parents_staff_read on public.parents;

create policy parents_staff_read on public.parents for select
  using (((( SELECT ( SELECT (scn_is_dept() and id in (select scn_my_scope_parent_ids())) AS scn_is_dept) AS scn_is_dept) OR (id IN ( SELECT my_school_parent_ids() AS my_school_parent_ids))) AND (( SELECT my_roles() AS my_roles) && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'van_thu'::text, 'admin'::text, 'so_gd'::text, 'ubnd'::text])));

drop policy if exists pa_staff_read on public.period_absences;

create policy pa_staff_read on public.period_absences for select
  using ((( SELECT scn_is_edu_staff() AS scn_is_edu_staff) AND (( SELECT (scn_is_dept() and student_id in (select scn_my_scope_student_ids())) AS scn_is_dept) OR (student_id IN ( SELECT my_school_student_ids() AS my_school_student_ids)))));

drop policy if exists pl_staff_read on public.period_logs;

create policy pl_staff_read on public.period_logs for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and timetable_entry_id in (select scn_my_scope_ttentry_ids())) AS scn_is_dept) AS scn_is_dept) OR (timetable_entry_id IN ( SELECT my_school_ttentry_ids() AS my_school_ttentry_ids)))));

drop policy if exists profiles_read on public.profiles;

create policy profiles_read on public.profiles for select
  using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT (scn_is_dept() and scn_profile_in_scope(id)) AS scn_is_dept) OR (( SELECT is_staff() AS is_staff) AND (scn_profile_visible(id) OR
CASE
    WHEN (( SELECT my_role() AS my_role) = ANY (ARRAY['hoc_sinh'::text, 'phu_huynh'::text])) THEN (EXISTS ( SELECT 1
       FROM (students s
         JOIN classes c ON ((c.id = s.class_id)))
      WHERE (((s.profile_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
               FROM (parent_students ps
                 JOIN parents pa ON ((pa.id = ps.parent_id)))
              WHERE ((ps.student_id = s.id) AND (pa.profile_id = ( SELECT auth.uid() AS uid)))))) AND ((c.gvcn_id = profiles.id) OR (EXISTS ( SELECT 1
               FROM timetable_entries t
              WHERE ((t.class_id = c.id) AND (t.teacher_id = profiles.id))))))))
    ELSE false
END))));

drop policy if exists signoff_read on public.register_signoffs;

create policy signoff_read on public.register_signoffs for select
  using ((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_class_in_scope(class_id)) AS scn_is_dept) AS scn_is_dept) OR scn_class_in_school(class_id))));

drop policy if exists skpi_staff_read on public.school_kpis;

create policy skpi_staff_read on public.school_kpis for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (( SELECT (scn_is_dept() and school_kpis.school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) OR (p.school_id = school_kpis.school_id)))))));

drop policy if exists sye_staff_read on public.school_year_events;

create policy sye_staff_read on public.school_year_events for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists org_read_staff on public.schools;

create policy org_read_staff on public.schools for select
  using ((( SELECT ( SELECT (scn_is_dept() and id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR (id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id))));

drop policy if exists seat_staff_read on public.seating_charts;

create policy seat_staff_read on public.seating_charts for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_class_in_scope(class_id)) AS scn_is_dept) AS scn_is_dept) OR scn_class_in_school(class_id))));

drop policy if exists sg_staff_read on public.student_groups;

create policy sg_staff_read on public.student_groups for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_class_in_scope(class_id)) AS scn_is_dept) AS scn_is_dept) OR scn_class_in_school(class_id))));

drop policy if exists srh_staff_read on public.student_record_history;

create policy srh_staff_read on public.student_record_history for select
  using ((( SELECT scn_is_edu_staff() AS scn_is_edu_staff) AND (( SELECT (scn_is_dept() and scn_student_in_scope(student_id)) AS scn_is_dept) OR scn_student_in_school(student_id))));

drop policy if exists students_staff_read on public.students;

create policy students_staff_read on public.students for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and class_id in (select scn_my_scope_class_ids())) AS scn_is_dept) AS scn_is_dept) OR (class_id IN ( SELECT my_school_class_ids() AS my_school_class_ids)))));

drop policy if exists subjects_staff_read on public.subjects;

create policy subjects_staff_read on public.subjects for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists sub_staff_read on public.substitute_requests;

create policy sub_staff_read on public.substitute_requests for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists sp_staff_read on public.support_plans;

create policy sp_staff_read on public.support_plans for select
  using ((( SELECT (scn_is_dept() and scn_student_in_scope(student_id)) AS scn_is_dept) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_student_in_my_homeroom(student_id)) OR ((( SELECT my_roles() AS my_roles) && ARRAY['bgh'::text, 'pht'::text, 'admin'::text]) AND scn_student_in_school(student_id))));

drop policy if exists ss_staff_read on public.support_staff;

create policy ss_staff_read on public.support_staff for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));

drop policy if exists tasks_staff_read on public.tasks;

create policy tasks_staff_read on public.tasks for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_class_in_scope(class_id)) AS scn_is_dept) AS scn_is_dept) OR scn_class_in_school(class_id))));

drop policy if exists ta_staff on public.teacher_assessments;

create policy ta_staff on public.teacher_assessments for select
  using (((( SELECT my_roles() AS my_roles) && ARRAY['to_truong'::text, 'bgh'::text, 'so_gd'::text, 'admin'::text]) AND (( SELECT ( SELECT (scn_is_dept() and scn_profile_in_scope(teacher_id)) AS scn_is_dept) AS scn_is_dept) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR scn_profile_in_school(teacher_id))));

drop policy if exists teacher_subjects_read on public.teacher_subjects;

create policy teacher_subjects_read on public.teacher_subjects for select
  using ((( SELECT ( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and scn_profile_in_scope(teacher_id)) AS scn_is_dept) AS scn_is_dept) OR scn_profile_in_school(teacher_id))));

drop policy if exists tt_staff_read on public.timetable_entries;

create policy tt_staff_read on public.timetable_entries for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and class_id in (select scn_my_scope_class_ids())) AS scn_is_dept) AS scn_is_dept) OR (class_id IN ( SELECT my_school_class_ids() AS my_school_class_ids)))));

drop policy if exists tt15_staff_read on public.tt15_evaluations;

create policy tt15_staff_read on public.tt15_evaluations for select
  using ((( SELECT ( SELECT is_staff() AS is_staff) AS is_staff) AND (( SELECT ( SELECT (scn_is_dept() and school_id in (select scn_my_scope_school_ids())) AS scn_is_dept) AS scn_is_dept) OR (school_id = ( SELECT ( SELECT my_school_id() AS my_school_id) AS my_school_id)))));