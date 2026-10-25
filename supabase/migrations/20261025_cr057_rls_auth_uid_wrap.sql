-- CR-057 scalability hardening: wrap bare auth-uid calls as scalar subqueries
-- so Postgres evaluates it once per statement (InitPlan) instead of per row.
-- Generated from live pg_policies; snapshot + rollback:
-- docs/project/CR-057-pg_policies-snapshot.json
ALTER POLICY "ann_ins" ON public."announcements" WITH CHECK (((sender_id = (select auth.uid())) AND ((my_role() = 'admin'::text) OR ((my_role() = ANY (ARRAY['bgh'::text, 'pht'::text])) AND (school_id = ( SELECT my_school_id() AS my_school_id)) AND ((class_id IS NULL) OR scn_class_in_school(class_id)) AND ((student_id IS NULL) OR scn_student_in_school(student_id))) OR ((my_role() = 'gvcn'::text) AND (school_id = ( SELECT my_school_id() AS my_school_id)) AND (class_id IS NOT NULL) AND scn_is_my_homeroom_class(class_id) AND ((student_id IS NULL) OR scn_student_in_my_homeroom(student_id))))));

ALTER POLICY "appt_s_del" ON public."appointments" USING (((( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_parent_in_school(parent_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND (teacher_id = (select auth.uid())) AND scn_parent_in_school(parent_id))));

ALTER POLICY "appt_s_upd" ON public."appointments" USING (((( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_parent_in_school(parent_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND (teacher_id = (select auth.uid())) AND scn_parent_in_school(parent_id)))) WITH CHECK ((scn_parent_in_school(parent_id) AND ((( SELECT my_roles() AS my_roles) && ARRAY['bgh'::text, 'admin'::text]) OR (teacher_id = (select auth.uid())))));

ALTER POLICY "nlpc_del" ON public."competency_evaluations" USING ((((evaluated_by = (select auth.uid())) AND scn_student_in_school(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text])));

ALTER POLICY "nlpc_upd" ON public."competency_evaluations" USING ((((evaluated_by = (select auth.uid())) AND scn_student_in_school(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]))) WITH CHECK ((((evaluated_by = (select auth.uid())) AND scn_student_in_school(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text])));

ALTER POLICY "cr_del" ON public."conduct_records" USING ((((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_student_in_my_homeroom(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((( SELECT my_roles() AS my_roles) && ARRAY['gvbm'::text, 'to_truong'::text]) AND (recorded_by = (select auth.uid())) AND scn_student_in_school(student_id))));

ALTER POLICY "cr_upd" ON public."conduct_records" USING ((((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_student_in_my_homeroom(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((( SELECT my_roles() AS my_roles) && ARRAY['gvbm'::text, 'to_truong'::text]) AND (recorded_by = (select auth.uid())) AND scn_student_in_school(student_id)))) WITH CHECK ((scn_student_in_school(student_id) AND ((( SELECT my_roles() AS my_roles) && ARRAY['bgh'::text, 'admin'::text]) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_student_in_my_homeroom(student_id)) OR ((( SELECT my_roles() AS my_roles) && ARRAY['gvbm'::text, 'to_truong'::text]) AND (recorded_by = (select auth.uid())) AND scn_student_in_my_teaching(student_id)))));

ALTER POLICY "digest_deliveries_staff_read" ON public."digest_deliveries" USING ((((( SELECT my_roles() AS my_roles) && ARRAY['bgh'::text, 'pht'::text, 'admin'::text]) AND (parent_id IN ( SELECT my_school_parent_ids() AS my_school_parent_ids))) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND (EXISTS ( SELECT 1
   FROM ((parent_students ps
     JOIN students s ON ((s.id = ps.student_id)))
     JOIN classes c ON ((c.id = s.class_id)))
  WHERE ((ps.parent_id = digest_deliveries.parent_id) AND (c.gvcn_id = (select auth.uid())) AND (c.school_id = ( SELECT my_school_id() AS my_school_id))))))));

ALTER POLICY "inc_del" ON public."incidents" USING (((( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND
CASE
    WHEN (class_id IS NOT NULL) THEN scn_class_in_school(class_id)
    WHEN (student_id IS NOT NULL) THEN scn_student_in_school(student_id)
    ELSE scn_profile_in_school(recorded_by)
END) OR ((recorded_by = (select auth.uid())) AND ((class_id IS NULL) OR scn_class_in_school(class_id)) AND ((student_id IS NULL) OR scn_student_in_school(student_id)))));

ALTER POLICY "inc_ins" ON public."incidents" WITH CHECK (((( SELECT my_roles() AS my_roles) && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text]) AND (recorded_by = (select auth.uid())) AND ((class_id IS NULL) OR scn_class_in_school(class_id)) AND ((student_id IS NULL) OR scn_student_in_school(student_id)) AND ((class_id IS NULL) OR (student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = incidents.student_id) AND (s.class_id = incidents.class_id)))))));

ALTER POLICY "lp_del" ON public."lesson_plans" USING ((((teacher_id = (select auth.uid())) AND ((school_id = my_school_id()) OR scn_class_in_school(class_id))) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND ((school_id = my_school_id()) OR scn_class_in_school(class_id))) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text])));

ALTER POLICY "nlpc_cmt_del" ON public."nlpc_comments" USING ((((evaluated_by = (select auth.uid())) AND scn_student_in_school(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text])));

ALTER POLICY "nlpc_cmt_upd" ON public."nlpc_comments" USING ((((evaluated_by = (select auth.uid())) AND scn_student_in_school(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]))) WITH CHECK ((((evaluated_by = (select auth.uid())) AND scn_student_in_school(student_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_student_in_school(student_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text])));

ALTER POLICY "signoff_insert" ON public."register_signoffs" WITH CHECK (((( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_class_in_school(class_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND (status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM classes c
  WHERE ((c.id = register_signoffs.class_id) AND (c.gvcn_id = (select auth.uid())) AND (c.school_id = ( SELECT my_school_id() AS my_school_id))))))));

ALTER POLICY "task_del" ON public."tasks" USING ((((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_is_my_homeroom_class(class_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_class_in_school(class_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((created_by = (select auth.uid())) AND scn_class_in_school(class_id))));

ALTER POLICY "task_upd" ON public."tasks" USING ((((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_is_my_homeroom_class(class_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_class_in_school(class_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((created_by = (select auth.uid())) AND scn_class_in_school(class_id)))) WITH CHECK ((((( SELECT my_roles() AS my_roles) @> ARRAY['gvcn'::text]) AND scn_is_my_homeroom_class(class_id)) OR ((( SELECT my_roles() AS my_roles) @> ARRAY['bgh'::text]) AND scn_class_in_school(class_id)) OR (( SELECT my_roles() AS my_roles) @> ARRAY['admin'::text]) OR ((created_by = (select auth.uid())) AND scn_class_in_school(class_id))));

ALTER POLICY "assets_select" ON sf."assets" USING ((sf.is_active_member() AND ((EXISTS ( SELECT 1
   FROM sf.jobs j
  WHERE ((j.id = assets.job_id) AND ((j.owner_id = (select auth.uid())) OR sf.is_admin())))) OR (job_id = ( SELECT l.published_build_id
   FROM sf.lessons l
  WHERE ((l.id = assets.lesson_id) AND (l.status = 'ready'::text) AND (l.deleted_at IS NULL)))))));

ALTER POLICY "job_events_select" ON sf."job_events" USING ((sf.is_active_member() AND (EXISTS ( SELECT 1
   FROM sf.jobs j
  WHERE ((j.id = job_events.job_id) AND ((j.owner_id = (select auth.uid())) OR sf.is_admin()))))));

ALTER POLICY "jobs_select" ON sf."jobs" USING ((sf.is_active_member() AND ((owner_id = (select auth.uid())) OR sf.is_admin())));

ALTER POLICY "lessons_select" ON sf."lessons" USING ((sf.is_active_member() AND ((owner_id = (select auth.uid())) OR sf.is_admin() OR ((status = 'ready'::text) AND (deleted_at IS NULL)))));

ALTER POLICY "narrations_select" ON sf."narrations" USING ((sf.is_active_member() AND (EXISTS ( SELECT 1
   FROM sf.jobs j
  WHERE ((j.id = narrations.job_id) AND ((j.owner_id = (select auth.uid())) OR sf.is_admin()))))));

ALTER POLICY "pages_select" ON sf."pages" USING ((sf.is_active_member() AND ((EXISTS ( SELECT 1
   FROM sf.jobs j
  WHERE ((j.id = pages.job_id) AND ((j.owner_id = (select auth.uid())) OR sf.is_admin())))) OR (job_id = ( SELECT l.published_build_id
   FROM sf.lessons l
  WHERE ((l.id = pages.lesson_id) AND (l.status = 'ready'::text) AND (l.deleted_at IS NULL)))))));

ALTER POLICY "profiles_select" ON sf."profiles" USING ((sf.is_active_member() AND ((id = (select auth.uid())) OR sf.is_admin())));

ALTER POLICY "segments_select" ON sf."segments" USING ((sf.is_active_member() AND ((EXISTS ( SELECT 1
   FROM sf.jobs j
  WHERE ((j.id = segments.job_id) AND ((j.owner_id = (select auth.uid())) OR sf.is_admin())))) OR (job_id = ( SELECT l.published_build_id
   FROM sf.lessons l
  WHERE ((l.id = segments.lesson_id) AND (l.status = 'ready'::text) AND (l.deleted_at IS NULL)))))));

ALTER POLICY "lesson_plans_files_delete" ON storage."objects" USING (((bucket_id = 'lesson-plans'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['gvcn'::text, 'gvbm'::text, 'bgh'::text])) AND (split_part(objects.name, '/'::text, 1) = (p.school_id)::text))))));

ALTER POLICY "lesson_plans_files_insert" ON storage."objects" WITH CHECK (((bucket_id = 'lesson-plans'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])) OR (p.concurrent_roles && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])) AND (split_part(objects.name, '/'::text, 1) = (p.school_id)::text))))));

ALTER POLICY "lesson_plans_files_select" ON storage."objects" USING (((bucket_id = 'lesson-plans'::text) AND (split_part(name, '/'::text, 1) = ( SELECT (p.school_id)::text AS school_id
   FROM profiles p
  WHERE (p.id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])) OR (p.concurrent_roles && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])))))));

ALTER POLICY "lp_files_delete_same_school" ON storage."objects" USING (((bucket_id = 'lesson-plans'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.school_id)::text AS school_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))) AND (owner_id = ((select auth.uid()))::text) AND (NOT (EXISTS ( SELECT 1
   FROM lesson_plans lp
  WHERE (lp.file_path = objects.name))))));

ALTER POLICY "lp_files_insert_same_school" ON storage."objects" WITH CHECK (((bucket_id = 'lesson-plans'::text) AND ((storage.foldername(name))[1] = ( SELECT (p.school_id)::text AS school_id
   FROM profiles p
  WHERE (p.id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])) OR (p.concurrent_roles && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])))))));

ALTER POLICY "lp_files_read_same_school" ON storage."objects" USING (((bucket_id = 'lesson-plans'::text) AND ((storage.foldername(name))[1] = ( SELECT (p.school_id)::text AS school_id
   FROM profiles p
  WHERE (p.id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])) OR (p.concurrent_roles && ARRAY['gvcn'::text, 'gvbm'::text, 'to_truong'::text, 'bgh'::text, 'pht'::text, 'admin'::text])))))));
