-- CR-057: scalability hardening part 2 (applied 2026-10-25).
-- Part 1 (RLS auth.uid() wrap) lives in 20261025_cr057_rls_auth_uid_wrap.sql.
-- Rationale: docs/project/CR-057-scalability-hardening.md

-- Part 2: missing FK covering indexes (lint 0001)
create index if not exists idx_aa_announcement_id on public.activity_announcements(announcement_id);
create index if not exists idx_ai_usage_created_by on public.ai_usage(created_by);
create index if not exists idx_digest_outbox_parent_id on public.digest_outbox(parent_id);
create index if not exists idx_yed_academic_year on public.year_end_decisions(academic_year_id);
create index if not exists idx_yed_approved_by on public.year_end_decisions(approved_by);
create index if not exists idx_yed_decided_by on public.year_end_decisions(decided_by);
create index if not exists idx_p_arena_challenges_opponent on practice.arena_challenges(opponent_id);
create index if not exists idx_p_arena_room_players_player on practice.arena_room_players(player_id);
create index if not exists idx_p_arena_rooms_host on practice.arena_rooms(host_id);
create index if not exists idx_p_assignment_attempts_results on practice.assignment_attempts(results_id);
create index if not exists idx_p_assignments_form on practice.assignments(form_id);
create index if not exists idx_p_verify_send_log_account on practice.verify_send_log(account_id);
create index if not exists idx_sf_assets_lesson on sf.assets(lesson_id);
create index if not exists idx_sf_coursebooks_theme on sf.coursebooks(theme_key);
create index if not exists idx_sf_jobs_source_job on sf.jobs(source_job_id);
create index if not exists idx_sf_lessons_theme on sf.lessons(theme_key);
create index if not exists idx_sf_lessons_owner on sf.lessons(owner_id);
create index if not exists idx_sf_lessons_unit on sf.lessons(unit_id);
create index if not exists idx_sf_narrations_cache_hash on sf.narrations(cache_hash);
create index if not exists idx_sf_pages_lesson on sf.pages(lesson_id);
create index if not exists idx_sf_segments_image_asset on sf.segments(image_asset_id);
create index if not exists idx_sf_segments_page on sf.segments(page_id);
create index if not exists idx_sf_segments_question on sf.segments(question_id);
create index if not exists idx_sf_segments_lesson on sf.segments(lesson_id);

-- Part 3: pin search_path on practice helper functions (lint 0011)
alter function practice.strip_bank_row(jsonb) set search_path = '';
alter function practice.bank_norm(text) set search_path = '';
alter function practice.bank_norm_answer(text) set search_path = '';
alter function practice.leak_wm_tag(text, text, text, text, text) set search_path = '';

-- Part 4: revoke anon/PUBLIC EXECUTE on SECURITY DEFINER helpers (lint 0028);
-- re-grant to the roles the app actually runs as. sf_login_attempt and
-- sf_login_record are excluded (slideforge pre-auth login flow).
do $$
declare r record;
begin
  for r in
    select format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) as reg
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public','sf')
      and not (n.nspname = 'sf' and p.proname in ('sf_login_attempt','sf_login_record'))
      and has_function_privilege('anon', p.oid::regprocedure::text, 'EXECUTE')
  loop
    execute format('revoke execute on function %s from public, anon', r.reg);
    execute format('grant execute on function %s to authenticated, service_role', r.reg);
  end loop;
end $$;

-- Part 5: move pg_trgm out of public schema (lint 0014; pg_net does not
-- support SET SCHEMA and stays in public)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions')
     and exists (select 1 from pg_extension e join pg_namespace n
                 on n.oid = e.extnamespace
                 where e.extname = 'pg_trgm' and n.nspname = 'public') then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;
