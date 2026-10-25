-- CR-057 rollback part 2 - KHÔNG tự động chạy; chỉ dùng khi cần revert
-- phần hardening (indexes/search_path/EXECUTE/pg_trgm) về trạng thái
-- trước 2026-10-25. Trạng thái gốc: EXECUTE qua grant PUBLIC mặc định,
-- search_path unset, pg_trgm ở schema public, chưa có các index mới.
-- Sinh từ lint findings (62 funcs trừ sf_login_attempt/sf_login_record
-- vốn không bị revoke = không cần restore).

-- 1) Drop indexes đã thêm
drop index if exists public.idx_aa_announcement_id;
drop index if exists public.idx_ai_usage_created_by;
drop index if exists public.idx_digest_outbox_parent_id;
drop index if exists public.idx_yed_academic_year;
drop index if exists public.idx_yed_approved_by;
drop index if exists public.idx_yed_decided_by;
drop index if exists practice.idx_p_arena_challenges_opponent;
drop index if exists practice.idx_p_arena_room_players_player;
drop index if exists practice.idx_p_arena_rooms_host;
drop index if exists practice.idx_p_assignment_attempts_results;
drop index if exists practice.idx_p_assignments_form;
drop index if exists practice.idx_p_verify_send_log_account;
drop index if exists sf.idx_sf_assets_lesson;
drop index if exists sf.idx_sf_coursebooks_theme;
drop index if exists sf.idx_sf_jobs_source_job;
drop index if exists sf.idx_sf_lessons_theme;
drop index if exists sf.idx_sf_lessons_owner;
drop index if exists sf.idx_sf_lessons_unit;
drop index if exists sf.idx_sf_narrations_cache_hash;
drop index if exists sf.idx_sf_pages_lesson;
drop index if exists sf.idx_sf_segments_image_asset;
drop index if exists sf.idx_sf_segments_page;
drop index if exists sf.idx_sf_segments_question;
drop index if exists sf.idx_sf_segments_lesson;

-- 2) Khôi phục search_path mặc định (unset) cho 4 practice functions
alter function practice.strip_bank_row(jsonb) reset search_path;
alter function practice.bank_norm(text) reset search_path;
alter function practice.bank_norm_answer(text) reset search_path;
alter function practice.leak_wm_tag(text, text, text, text, text) reset search_path;

-- 3) Khôi phục grant PUBLIC mặc định (trạng thái trước revoke)
REVOKE EXECUTE ON FUNCTION public.create_parent_for_student(p_full_name text, p_phone text, p_email text, p_relationship text, p_student_id uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.create_parent_for_student(p_full_name text, p_phone text, p_email text, p_relationship text, p_student_id uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_school_staff() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.is_school_staff() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.is_staff() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_class_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_class_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_parent_id() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_parent_id() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_role() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_role() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_roles() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_roles() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_class_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_school_class_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_dept_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_school_dept_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_id() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_school_id() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_parent_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_school_parent_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_profile_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_school_profile_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_student_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_school_student_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_school_ttentry_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_school_ttentry_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_student_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.my_student_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_ann_in_school(aid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_ann_in_school(aid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_ann_in_scope(aid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_ann_in_scope(aid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_attendance_pair_ok(p_activity uuid, p_student uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_attendance_pair_ok(p_activity uuid, p_student uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_can_message(recipient uuid, sid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_can_message(recipient uuid, sid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_can_write_grade(sid uuid, subid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_can_write_grade(sid uuid, subid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_class_in_school(cid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_class_in_school(cid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_class_in_scope(cid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_class_in_scope(cid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_denied_item_ids(tname text) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_denied_item_ids(tname text) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_dept_dashboard(p_school_ids uuid[], p_window_start date, p_period text) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_dept_dashboard(p_school_ids uuid[], p_window_start date, p_period text) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_dept_in_school(did uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_dept_in_school(did uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_has_feature(f text) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_has_feature(f text) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_i_teach_student_subject(sid uuid, subid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_i_teach_student_subject(sid uuid, subid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_is_dept() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_is_dept() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_is_dept_head(did uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_is_dept_head(did uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_is_edu_staff() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_is_edu_staff() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_is_my_homeroom_class(cid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_is_my_homeroom_class(cid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_is_my_ttentry(tid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_is_my_ttentry(tid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_is_sub_ttentry_date(tid uuid, d date) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_is_sub_ttentry_date(tid uuid, d date) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_item_denied(tbl text, item uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_item_denied(tbl text, item uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_lock_year_end_decisions() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_lock_year_end_decisions() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_school_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_school_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_scope_class_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_scope_class_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_scope_dept_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_scope_dept_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_scope_parent_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_scope_parent_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_scope_profile_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_scope_profile_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_scope_school_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_scope_school_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_scope_student_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_scope_student_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_my_scope_ttentry_ids() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_my_scope_ttentry_ids() TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_org_in_scope(oid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_org_in_scope(oid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_parent_in_school(parid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_parent_in_school(parid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_parent_in_scope(pid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_parent_in_scope(pid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_pht_allows_campus(campus uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_pht_allows_campus(campus uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_profile_in_school(pid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_profile_in_school(pid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_profile_in_scope(pid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_profile_in_scope(pid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_profile_visible(pid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_profile_visible(pid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_review_material(mid uuid, decision text, note text) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_review_material(mid uuid, decision text, note text) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_set_teacher_subjects(p_teacher uuid, p_subjects uuid[]) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_set_teacher_subjects(p_teacher uuid, p_subjects uuid[]) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_student_in_my_homeroom(sid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_student_in_my_homeroom(sid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_student_in_my_teaching(sid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_student_in_my_teaching(sid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_student_in_school(sid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_student_in_school(sid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_student_in_scope(sid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_student_in_scope(sid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_submit_material_review(mid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_submit_material_review(mid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_subr_refs_in_school(school uuid, cid uuid, subid uuid, absent uuid, sub uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_subr_refs_in_school(school uuid, cid uuid, subid uuid, absent uuid, sub uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_ttentry_in_school(tid uuid) FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_ttentry_in_school(tid uuid) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scn_yed_guard() FROM authenticated, service_role; GRANT EXECUTE ON FUNCTION public.scn_yed_guard() TO PUBLIC;
-- 4) Đưa pg_trgm về public schema
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n
             on n.oid = e.extnamespace
             where e.extname = 'pg_trgm' and n.nspname = 'extensions') then
    alter extension pg_trgm set schema public;
  end if;
end $$;
