-- CR-049 round-7 (Codex r7, commit 8526448) fixes.
-- H1  revision CAS bat doi xung: editor chi gui max(grades.updated_at)
--     trong khi state dung clock_timestamp() -> reload la stale vinh vien.
--     Fix: client doc state + RPC tra revision; giu clock_timestamp
--     (client khong con suy ra revision tu grades).
-- M2  scope_key thieu lop: 2 lop cung mon/nam share revision.
-- H3  state bi staff ghi truc tiep -> chi select qua RLS; ghi chi qua
--     scn_save_grades (chuyen security definer + authz ro rang).
-- M7  pending-parents RPC van starvation: PH khong con / attempts qua han
--     khong co outbox row -> quet lai mai. Them dieu kien loai.
-- M8  ?retry=<run> khong revive duoc outbox failed -> RPC retry ro rang.

-- ===== H3: state chi doc cho staff, ghi chi qua RPC definer ==========
drop policy if exists grade_book_state_staff on public.grade_book_state;
create policy grade_book_state_read on public.grade_book_state
  for select to authenticated
  using ((select is_staff()));
revoke insert, update, delete on public.grade_book_state from authenticated;
grant select on public.grade_book_state to authenticated;

-- ===== H1+M2+H3: scn_save_grades security definer + class scope ======
-- Chuyen definer vi state khong con grant ghi cho authenticated; buoc
-- phai co authz tuong minh thay cho RLS (scn_can_write_grade tung HS).
create or replace function public.scn_save_grades(
  p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb,
  p_expected_max timestamptz default null,
  p_academic_year_id uuid default null
) returns void language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_max timestamptz;
  v_state timestamptz;
  v_year uuid;
  v_class uuid;
  v_scope text;
begin
  -- M2/H3: authz tuong minh - caller phai ghi diem duoc cho MOI HS + mon.
  if auth.uid() is null
     or exists (select 1 from unnest(p_student_ids) u(sid)
                where not public.scn_can_write_grade(u.sid, p_subject_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- definer bypass RLS: p_rows cung phai nam trong p_student_ids da
  -- duoc authz (caller khong the chen row cho HS khac qua payload).
  if exists (select 1 from jsonb_array_elements(p_rows) r
             where not (r->>'student_id')::uuid = any(p_student_ids)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select c.academic_year_id, c.id into v_year, v_class
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = p_student_ids[1];
  v_year := coalesce(p_academic_year_id, v_year);
  -- M2: gradebook identity = 1 lop - save pha tron lop la loi caller.
  if exists (select 1 from public.students s
             where s.id = any(p_student_ids)
               and s.class_id is distinct from v_class) then
    raise exception 'mixed_class_scope' using errcode = 'P0001';
  end if;
  v_scope := p_subject_id::text || '|' || p_term || '|'
             || coalesce(v_year::text, '') || '|'
             || coalesce(v_class::text, '');
  perform pg_advisory_xact_lock(hashtextextended(v_scope, 0));
  select max(g.updated_at) into v_max
    from public.grades g
   where g.student_id = any(p_student_ids)
     and g.subject_id = p_subject_id
     and g.term = p_term
     and (g.academic_year_id is null or g.academic_year_id = v_year);
  select s.last_saved_at into v_state
    from public.grade_book_state s where s.scope_key = v_scope;
  if p_expected_max is not null
     and greatest(coalesce(v_max, '-infinity'::timestamptz),
                  coalesce(v_state, '-infinity'::timestamptz))
         > p_expected_max then
    raise exception 'stale_write' using errcode = 'P0001';
  end if;
  delete from public.grades g
   where g.student_id = any(p_student_ids)
     and g.subject_id = p_subject_id
     and g.term = p_term
     and (g.academic_year_id is null or g.academic_year_id = v_year);
  insert into public.grades (
    student_id, subject_id, term, entered_by, subtype,
    assessment_type, seq, level, score, comment, result, updated_at,
    academic_year_id
  )
  select (r->>'student_id')::uuid, p_subject_id, p_term, auth.uid(),
         coalesce(r->>'subtype', ''), r->>'assessment_type',
         (r->>'seq')::smallint, r->>'level', (r->>'score')::numeric,
         r->>'comment', r->>'result', now(),
         coalesce(p_academic_year_id, v_year)
    from jsonb_array_elements(p_rows) as r;
  insert into public.grade_book_state (scope_key, last_saved_at)
  values (v_scope, clock_timestamp())
  on conflict (scope_key) do update set last_saved_at = clock_timestamp();
end
$function$;

-- ===== M7: pending-parents loai PH khong-con + attempts qua han ======
drop function if exists public.scn_digest_pending_parents(date, uuid, int);
create or replace function public.scn_digest_pending_parents(
  p_week date, p_after uuid, p_limit int, p_max_attempts int
) returns table(id uuid, full_name text, email text)
 language sql stable security definer
 set search_path to 'public'
as $function$
  select p.id, p.full_name, p.email
    from public.parents p
   where p.email is not null
     and p.email not ilike '%.scn'
     and p.id > p_after
     -- M7: PH khong co con lien ket khong bao gio enqueue duoc ->
     -- khong duoc chiem slot scan.
     and exists (select 1 from public.parent_students ps
                  where ps.parent_id = p.id)
     and not exists (
       select 1 from public.digest_outbox o
        where o.week_start = p_week and o.parent_id = p.id)
     and not exists (
       select 1 from public.digest_deliveries d
        where d.week_start = p_week and d.parent_id = p.id
          and d.status = 'sent')
     -- M7: PH da het han attempts cung khong bao gio enqueue lai.
     and not exists (
       select 1 from public.digest_deliveries d
        where d.week_start = p_week and d.parent_id = p.id
          and d.attempts >= p_max_attempts)
   order by p.id
   limit p_limit
$function$;

revoke all on function public.scn_digest_pending_parents(date, uuid, int, int)
  from public, anon, authenticated;
grant execute on function public.scn_digest_pending_parents(date, uuid, int, int)
  to service_role;

-- ===== M8: retry ro rang cho outbox failed/skipped ===================
-- ?retry=<run> truoc day khong revive duoc row failed (RPC pending
-- loai moi row co outbox). Flip failed/skipped -> queued cho run sau.
create or replace function public.scn_digest_retry_failed(
  p_week date, p_parent_ids uuid[]
) returns int
 language plpgsql security definer
 set search_path to 'public'
as $function$
declare
  v_n int;
begin
  update public.digest_outbox
     set status = 'queued', updated_at = now()
   where week_start = p_week
     and parent_id = any(p_parent_ids)
     and status in ('failed', 'skipped')
     -- sent protection: deliveries da 'sent' tuan nay khong revive
     and not exists (
       select 1 from public.digest_deliveries d
        where d.week_start = p_week
          and d.parent_id = digest_outbox.parent_id
          and d.status = 'sent');
  get diagnostics v_n = row_count;
  return v_n;
end
$function$;

revoke all on function public.scn_digest_retry_failed(date, uuid[])
  from public, anon, authenticated;
grant execute on function public.scn_digest_retry_failed(date, uuid[])
  to service_role;
