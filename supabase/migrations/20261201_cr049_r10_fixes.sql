-- CR-049 r10: Codex external review round 10 remediation (commit 9d58945).
-- H1: leaf authz helpers khong bind truong HIEN TAI cua caller - GV chuyen
--     truong van ghi duoc diem lop cu (gvcn_id/timetable khong doi).
-- H2+H3: direct INSERT/UPDATE/DELETE tren grades (RLS policies) bypass tenant
--     checks + race CAS cua RPC -> khoa write path, RPC la boundary duy nhat.
-- H4: trigger chi invalidate scope NEW khi UPDATE doi student/subject/year -
--     scope cu khong bump -> snapshot cu ghi de len row da chuyen.
--
-- H1: bind leaf helpers vao my_school_id() (truong hien tai cua caller).
-- Admin van qua nhanh admin trong scn_can_write_grade; cac nhanh GVCN/GVBM/
-- BGH/substitute deu phai nam trong truong caller dang thuoc.
create or replace function public.scn_student_in_my_homeroom(sid uuid)
returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from students s
    join classes c on c.id = s.class_id
    where s.id = sid and c.gvcn_id = auth.uid()
      -- r10 H1: homeroom cua toi = lop o TRUONG HIEN TAI; GV chuyen
      -- truong khong con quyen tren lop cu du gvcn_id chua doi.
      and c.school_id = (select my_school_id())
  )
$function$;

create or replace function public.scn_i_teach_student_subject(sid uuid, subid uuid)
returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from students s
    join classes c on c.id = s.class_id
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid
      and t.teacher_id = auth.uid()
      and t.subject_id = subid
      -- r10 H1: phan cong giang day chi con hieu luc trong truong hien tai.
      and c.school_id = (select my_school_id())
  ) or exists (
    select 1 from students s
    join classes c on c.id = s.class_id
    join substitute_requests r on r.class_id = s.class_id
    where s.id = sid
      and r.school_id = c.school_id
      and c.school_id = (select my_school_id())
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.subject_id = subid
      and r.date >= current_date - 60
      and r.date <= current_date
  )
$function$;

-- H4: UPDATE doi student/subject/term/academic_year -> scope cu khong bump.
-- Invalidate CA old lan new scope (deterministic order tranh deadlock).
create or replace function public.scn_grades_touch_state()
returns trigger language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_old_scope text;
  v_new_scope text;
  v_class uuid;
  v_year uuid;
begin
  -- NEW scope (hoac OLD cho DELETE)
  r := coalesce(new, old);
  select s.class_id, c.academic_year_id into v_class, v_year
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = r.student_id;
  v_new_scope := r.subject_id::text || '|' || r.term || '|'
             || coalesce(coalesce(r.academic_year_id, v_year)::text, '')
             || '|' || coalesce(v_class::text, '');
  -- r10 H4: UPDATE doi khoa scope (student/subject/term/year) -> phai
  -- bump ca scope CU, neu khong snapshot cu ghi de row da chuyen di.
  if tg_op = 'UPDATE'
     and (old.student_id is distinct from new.student_id
          or old.subject_id is distinct from new.subject_id
          or old.term is distinct from new.term
          or old.academic_year_id is distinct from new.academic_year_id) then
    select s.class_id, c.academic_year_id into v_class, v_year
      from public.students s
      join public.classes c on c.id = s.class_id
     where s.id = old.student_id;
    v_old_scope := old.subject_id::text || '|' || old.term || '|'
               || coalesce(coalesce(old.academic_year_id, v_year)::text, '')
               || '|' || coalesce(v_class::text, '');
    if v_old_scope is distinct from v_new_scope then
      -- deterministic order: scope nho truoc - 2 UPDATE cheo nhau
      -- (A->B va B->A) khong deadlock tren grade_book_state.
      if v_old_scope < v_new_scope then
        insert into public.grade_book_state (scope_key, last_saved_at)
        values (v_old_scope, clock_timestamp())
        on conflict (scope_key) do update set last_saved_at = clock_timestamp();
        insert into public.grade_book_state (scope_key, last_saved_at)
        values (v_new_scope, clock_timestamp())
        on conflict (scope_key) do update set last_saved_at = clock_timestamp();
      else
        insert into public.grade_book_state (scope_key, last_saved_at)
        values (v_new_scope, clock_timestamp())
        on conflict (scope_key) do update set last_saved_at = clock_timestamp();
        insert into public.grade_book_state (scope_key, last_saved_at)
        values (v_old_scope, clock_timestamp())
        on conflict (scope_key) do update set last_saved_at = clock_timestamp();
      end if;
      return r;
    end if;
  end if;
  insert into public.grade_book_state (scope_key, last_saved_at)
  values (v_new_scope, clock_timestamp())
  on conflict (scope_key) do update set last_saved_at = clock_timestamp();
  return r;
end
$function$;

-- H2+H3: khoa direct write tren grades - scn_save_grades (SECURITY DEFINER,
-- co tenant check + CAS + advisory lock) la mutation boundary duy nhat cho
-- authenticated. Service role (cron/seed) bypass RLS, khong anh huong.
drop policy if exists grades_staff_ins on public.grades;
drop policy if exists grades_staff_upd on public.grades;
drop policy if exists grades_staff_del on public.grades;
revoke insert, update, delete on public.grades from authenticated;

-- M15: retry tuong minh (?retry=<run_id>) chi duoc drain cac row cua PH
-- nam trong retry set - truoc day claim khong loc parent nen retry
-- "keo" ca queue khong lien quan trong cung send-phase.
drop function if exists public.scn_digest_outbox_claim(int);
create or replace function public.scn_digest_outbox_claim(
  p_limit int,
  p_parent_ids uuid[] default null
) returns setof public.digest_outbox
 language plpgsql security definer
 set search_path to 'public'
as $$
begin
  return query
    update public.digest_outbox o
       set status = 'sending',
           attempts = attempts + 1,
           updated_at = now()
     where o.id in (
       select id from public.digest_outbox
        where status = 'queued'
          and scheduled_at <= now()
          and (p_parent_ids is null or parent_id = any(p_parent_ids))
        order by scheduled_at, id
        limit p_limit
        for update skip locked
     )
     returning o.*;
end;
$$;
revoke all on function public.scn_digest_outbox_claim(int, uuid[]) from public, anon, authenticated;
grant execute on function public.scn_digest_outbox_claim(int, uuid[]) to service_role;

-- H5 (tiep): expected-year phai khop TUYET DOI voi year hien tai cua lop
-- ke ca NULL <-> non-NULL - guard cu "p_academic_year_id is not null and
-- distinct" cho phep caller NULL truot qua khi lop vua duoc gan nam.
create or replace function public.scn_save_grades(
  p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb,
  p_expected_max timestamptz default null, p_academic_year_id uuid default null
) returns void language plpgsql security definer
 set search_path to 'public'
as $function$
declare
  v_max timestamptz;
  v_state timestamptz;
  v_year uuid;
  v_class uuid;
  v_school uuid;
  v_scope text;
begin
  if auth.uid() is null
     or p_student_ids is null
     or cardinality(p_student_ids) = 0
     or array_position(p_student_ids, null) is not null
     or exists (select 1 from unnest(p_student_ids) u(sid)
                where public.scn_can_write_grade(u.sid, p_subject_id)
                      is not true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r
             where (r->>'student_id')::uuid = any(p_student_ids)
                   is not true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_expected_max is null then
    raise exception 'expected_revision_required' using errcode = 'P0001';
  end if;
  select c.academic_year_id, c.id, c.school_id
    into v_year, v_class, v_school
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = p_student_ids[1];
  if v_school is not null and not exists (
    select 1 from public.subjects sub
     where sub.id = p_subject_id and sub.school_id = v_school
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_academic_year_id is distinct from v_year then
    raise exception 'year_scope_mismatch' using errcode = 'P0001';
  end if;
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
