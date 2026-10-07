-- RLS perf: per-row scn_*_in_school() boolean helpers force a nested-loop
-- function call (~1ms) for EVERY scanned row -> /school/radar ~14s on 7k
-- grade rows. Replace with set-returning security-definer helpers that the
-- planner materializes once into a hash semi-join.
-- Applied via MCP 2026-10-09 (this file is the audit-trail copy).

create or replace function public.my_school_class_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from classes where school_id = (select my_school_id()) $$;

create or replace function public.my_school_student_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select s.id from students s join classes c on c.id = s.class_id
   where c.school_id = (select my_school_id()) $$;

create or replace function public.my_school_parent_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select ps.parent_id from parent_students ps
   join students s on s.id = ps.student_id
   join classes c on c.id = s.class_id
   where c.school_id = (select my_school_id()) $$;

create or replace function public.my_school_profile_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from profiles where school_id = (select my_school_id()) $$;

create or replace function public.my_school_ttentry_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select t.id from timetable_entries t join classes c on c.id = t.class_id
   where c.school_id = (select my_school_id()) $$;

create or replace function public.my_school_dept_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from departments where school_id = (select my_school_id()) $$;

-- students
drop policy if exists students_staff_read on public.students;
create policy students_staff_read on public.students for select using (
  (select is_staff()) and ((select scn_is_dept())
    or class_id in (select my_school_class_ids()))
);

-- grades
drop policy if exists grades_staff_read on public.grades;
create policy grades_staff_read on public.grades for select using (
  ((select scn_is_dept()) or student_id in (select my_school_student_ids()))
  and ((select my_role()) = any(array['gvcn','gvbm','to_truong','bgh','pht','giam_thi','admin','so_gd','ubnd']))
);

-- attendance_records: is_staff() + school scope + role list (ke_toan khong
-- duoc doc ho so chuyen can HS - ROLE-MATRIX: 'khong tiep can ho so hoc tap HS')
drop policy if exists att_staff_read on public.attendance_records;
create policy att_staff_read on public.attendance_records for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
  and ((select my_role()) = any(array['gvcn','gvbm','to_truong','bgh','pht','admin','so_gd','ubnd']))
);

-- conduct_records
drop policy if exists cr_staff_read on public.conduct_records;
create policy cr_staff_read on public.conduct_records for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);

-- period_absences
drop policy if exists pa_staff_read on public.period_absences;
create policy pa_staff_read on public.period_absences for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);

-- parent_students
drop policy if exists ps_staff_read on public.parent_students;
create policy ps_staff_read on public.parent_students for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);

-- class_roles
drop policy if exists class_roles_staff_read on public.class_roles;
create policy class_roles_staff_read on public.class_roles for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);

-- competency_evaluations
drop policy if exists nlpc_staff_read on public.competency_evaluations;
create policy nlpc_staff_read on public.competency_evaluations for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);

-- conduct_evaluations
drop policy if exists ce_staff_read on public.conduct_evaluations;
create policy ce_staff_read on public.conduct_evaluations for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);

-- activity_attendance
drop policy if exists aa_staff_read on public.activity_attendance;
create policy aa_staff_read on public.activity_attendance for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);

-- class-anchored tables
drop policy if exists es_staff_read on public.emulation_scores;
create policy es_staff_read on public.emulation_scores for select using (
  (select is_staff()) and ((select scn_is_dept())
    or class_id in (select my_school_class_ids()))
);

drop policy if exists tt_staff_read on public.timetable_entries;
create policy tt_staff_read on public.timetable_entries for select using (
  (select is_staff()) and ((select scn_is_dept())
    or class_id in (select my_school_class_ids()))
);

drop policy if exists dr_staff_read on public.daily_reports;
create policy dr_staff_read on public.daily_reports for select using (
  (select is_staff()) and ((select scn_is_dept())
    or class_id in (select my_school_class_ids()))
);

drop policy if exists cmhs_staff_read on public.cmhs_members;
create policy cmhs_staff_read on public.cmhs_members for select using (
  (select is_staff()) and ((select scn_is_dept())
    or class_id in (select my_school_class_ids()))
);

drop policy if exists act_staff_read on public.activities;
create policy act_staff_read on public.activities for select using (
  (select is_staff()) and ((select scn_is_dept())
    or class_id in (select my_school_class_ids()))
);

-- parents (via linked students)
drop policy if exists parents_staff_read on public.parents;
create policy parents_staff_read on public.parents for select using (
  ((select scn_is_dept()) or id in (select my_school_parent_ids()))
  and ((select my_role()) = any(array['gvcn','gvbm','to_truong','bgh','pht','van_thu','admin','so_gd','ubnd']))
);

-- digest_deliveries
drop policy if exists digest_deliveries_staff_read on public.digest_deliveries;
create policy digest_deliveries_staff_read on public.digest_deliveries for select using (
  (((select my_role()) = any(array['bgh','pht','admin']))
     and parent_id in (select my_school_parent_ids()))
  or (((select my_role()) = 'gvcn')
     and exists (select 1 from parent_students ps
        join students s on s.id = ps.student_id
        join classes c on c.id = s.class_id
        where ps.parent_id = digest_deliveries.parent_id and c.gvcn_id = auth.uid()))
);

-- appointments (staff read via parent)
drop policy if exists appt_staff_read on public.appointments;
create policy appt_staff_read on public.appointments for select using (
  (select is_staff()) and ((select scn_is_dept())
    or parent_id in (select my_school_parent_ids()))
);

-- period_logs (via timetable entry)
drop policy if exists pl_staff_read on public.period_logs;
create policy pl_staff_read on public.period_logs for select using (
  (select is_staff()) and ((select scn_is_dept())
    or timetable_entry_id in (select my_school_ttentry_ids()))
);

-- early_warnings
drop policy if exists ew_staff_read on public.early_warnings;
create policy ew_staff_read on public.early_warnings for select using (
  (select scn_is_dept())
  or ((select my_role()) = 'gvcn'
      and (scn_student_in_my_homeroom(student_id) or scn_is_my_homeroom_class(class_id)))
  or ((select my_role()) = any(array['bgh','pht','admin'])
      and class_id in (select my_school_class_ids()))
);

-- ai_jobs (creator profile in school)
drop policy if exists ai_jobs_staff_read on public.ai_jobs;
create policy ai_jobs_staff_read on public.ai_jobs for select using (
  (created_by = auth.uid()) or (select scn_is_dept())
  or (((select my_role()) = any(array['bgh','admin']))
      and created_by in (select my_school_profile_ids()))
);

-- dept_meetings
drop policy if exists dm_staff_read on public.dept_meetings;
create policy dm_staff_read on public.dept_meetings for select using (
  (select is_staff()) and ((select scn_is_dept())
    or department_id in (select my_school_dept_ids()))
);
