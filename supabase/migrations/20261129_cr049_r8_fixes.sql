-- CR-049 r8: Codex external review round 8 remediation (commit c76e4d0).
-- H1: NULL/empty/null-element p_student_ids bypass authz trong
--     scn_save_grades (unnest(NULL) -> 0 rows -> exists() vacuously false;
--     NULL-membership check trong p_rows cung di qua vi 3-valued logic).
--     Fix: reject ro rang + authz IS TRUE + payload membership IS TRUE.
-- M9: scn_digest_pending_parents van nhan email ''/khoang trang - parent
--     do bi skip o route nhung chiem slot scan 20k, bo doi PH sau.
-- Da apply len prod 2026-11-29 va verify (null_ids_denied=t).

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
  -- authz tuong minh - caller phai ghi diem duoc cho MOI HS + mon.
  -- r8 H1: NULL/rong/null-element phai reject ro rang - unnest(NULL)
  -- cho 0 rows -> exists(...) vacuously false -> bypass authz.
  if auth.uid() is null
     or p_student_ids is null
     or cardinality(p_student_ids) = 0
     or array_position(p_student_ids, null) is not null
     or exists (select 1 from unnest(p_student_ids) u(sid)
                where public.scn_can_write_grade(u.sid, p_subject_id)
                      is not true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- definer bypass RLS: p_rows phai nam trong p_student_ids da authz
  -- (IS TRUE - NULL membership khong duoc di qua).
  if exists (select 1 from jsonb_array_elements(p_rows) r
             where (r->>'student_id')::uuid = any(p_student_ids)
                   is not true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select c.academic_year_id, c.id into v_year, v_class
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = p_student_ids[1];
  v_year := coalesce(p_academic_year_id, v_year);
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

create or replace function public.scn_digest_pending_parents(
  p_week date, p_after uuid, p_limit int, p_max_attempts int
) returns table(id uuid, full_name text, email text)
 language sql stable security definer
 set search_path to 'public'
as $function$
  select p.id, p.full_name, p.email
    from public.parents p
   where p.email is not null
     -- r8 M9: ''/khoang trang khong-enqueueable duoc ma van chiem slot.
     and nullif(btrim(p.email), '') is not null
     and p.email not ilike '%.scn'
     and p.id > p_after
     and exists (select 1 from public.parent_students ps
                  where ps.parent_id = p.id)
     and not exists (
       select 1 from public.digest_outbox o
        where o.week_start = p_week and o.parent_id = p.id)
     and not exists (
       select 1 from public.digest_deliveries d
        where d.week_start = p_week and d.parent_id = p.id
          and d.status = 'sent')
     and not exists (
       select 1 from public.digest_deliveries d
        where d.week_start = p_week and d.parent_id = p.id
          and d.attempts >= p_max_attempts)
   order by p.id
   limit p_limit
$function$;
