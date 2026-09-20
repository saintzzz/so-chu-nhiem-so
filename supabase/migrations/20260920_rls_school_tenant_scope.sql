-- ============================================================================
-- RLS hardening: school-scoped tenant isolation
-- Applied via Supabase MCP as migrations:
--   rls_initplan_perf_wrap          (wrap helper calls in (select ...) initplans)
--   dept_readonly_ops_rls           (split is_staff read / is_school_staff write)
--   rls_school_scope_pass1          (scn_* helper functions + scoped policies)
--   rls_school_scope_pass2          (remaining staff policies + missing tables)
--   rls_scope_remaining_policies    (schools/org_units/exams/subjects/ta fixes)
--
-- Problem: staff policies checked only role membership (is_school_staff())
-- without verifying that the row belongs to the staff member's school, allowing
-- cross-tenant read/write when a row id was known.
--
-- Fix: every staff policy is now additionally constrained so that the affected
-- row resolves to auth.uid()'s school (or a dept/admin role), via the
-- SECURITY DEFINER helpers below. Helper calls are wrapped in (select ...) so
-- PostgreSQL evaluates them once per query (initplan) instead of per row.
-- ============================================================================

create or replace function public.scn_class_in_school(cid uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from classes c where c.id = cid and c.school_id = (select my_school_id())) $$;

create or replace function public.scn_student_in_school(sid uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from students s join classes c on c.id = s.class_id
   where s.id = sid and c.school_id = (select my_school_id())) $$;

create or replace function public.scn_profile_in_school(pid uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from profiles p where p.id = pid and p.school_id = (select my_school_id())) $$;

create or replace function public.scn_parent_in_school(parid uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from parent_students ps
   join students s on s.id = ps.student_id
   join classes c on c.id = s.class_id
   where ps.parent_id = parid and c.school_id = (select my_school_id())) $$;

create or replace function public.scn_dept_in_school(did uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from departments d where d.id = did and d.school_id = (select my_school_id())) $$;

create or replace function public.scn_ttentry_in_school(tid uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from timetable_entries t join classes c on c.id = t.class_id
   where t.id = tid and c.school_id = (select my_school_id())) $$;

create or replace function public.scn_ann_in_school(aid uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from announcements a where a.id = aid and (
     case when a.class_id is not null
          then exists(select 1 from classes c where c.id = a.class_id and c.school_id = (select my_school_id()))
          when a.student_id is not null
          then exists(select 1 from students s join classes c on c.id = s.class_id
                      where s.id = a.student_id and c.school_id = (select my_school_id()))
          else exists(select 1 from profiles p where p.id = a.sender_id and p.school_id = (select my_school_id()))
     end)) $$;

create or replace function public.scn_is_dept()
returns boolean language sql stable security definer set search_path = 'public' as
$$ select coalesce((select my_role()) = any(array['so_gd','phong_gd','ubnd','admin']), false) $$;

create or replace function public.scn_my_school_ids()
returns setof uuid language sql stable security definer set search_path = 'public' as
$$ select school_id from profiles where id = auth.uid()
   union
   select c.school_id from parent_students ps
     join students s on s.id = ps.student_id
     join classes c on c.id = s.class_id
     where ps.parent_id = auth.uid()
        or ps.parent_id in (select p.id from parents p where p.profile_id = auth.uid()) $$;

create or replace function public.scn_profile_visible(pid uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from profiles p where p.id = pid and (
     p.school_id = (select my_school_id())
     or (p.role = 'phu_huynh' and exists(
          select 1 from parents pa
          join parent_students ps on ps.parent_id = pa.id
          join students s on s.id = ps.student_id
          join classes c on c.id = s.class_id
          where pa.profile_id = pid and c.school_id = (select my_school_id())))
     or (p.role = 'hoc_sinh' and exists(
          select 1 from students s join classes c on c.id = s.class_id
          where s.profile_id = pid and c.school_id = (select my_school_id()))))) $$;

-- Policy scope applied per table (SELECT gets dept exemption; writes get
-- admin exemption + row-school check):
--
--   school_id direct : academic_years, campuses, classes, departments,
--                      early_warnings, emulation_criteria, exams, lesson_plans,
--                      school_year_events, subjects, substitute_requests,
--                      support_staff, tt15_evaluations
--                    -> school_id = (select my_school_id())
--   via class_id     : activities, cmhs_members, daily_reports, emulation_scores,
--                      exam_sessions, kpis, register_signoffs, seating_charts,
--                      student_groups, students, tasks, timetable_entries
--                    -> scn_class_in_school(class_id)
--   via student_id   : attendance_records, class_roles, competency_evaluations,
--                      conduct_evaluations, conduct_records, counseling_cases,
--                      counseling_sessions, grade_components, grades,
--                      learning_achievements, parent_students, student_assessments,
--                      student_group_members, survey_responses, transcript_records,
--                      announcements, incidents (with class/sender fallback)
--                    -> scn_student_in_school(student_id)
--   via profile_id   : ai_jobs, ai_messages, audit_logs, announcement_reads,
--                      messages, notifications
--                    -> scn_profile_in_school(profile_id) / scn_profile_visible
--   parents          -> scn_parent_in_school(id)
--   appointments     -> scn_parent_in_school(parent_id)
--   assessment_evidence -> exists(teacher_assessments where teacher in school)
--   schools          -> dept/admin all; school staff own school only
--   org_units        -> dept all; others own org_unit_id only
--   exams family read-> published exams of scn_my_school_ids() only
--   subjects auth read-> subjects of scn_my_school_ids() only
--   teacher_assessments -> staff read scoped via scn_profile_in_school(teacher_id)
