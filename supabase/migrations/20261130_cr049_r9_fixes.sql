-- CR-049 r9: Codex external review round 9 remediation (commit 4438792).
-- M3: CAS bat buoc - p_expected_max NULL = bo qua stale detection co chu y.
-- H4: tenant binding - subject phai thuoc truong cua lop; p_academic_year_id
--     phai khop nam hoc cua lop (definer bypass FK consistency neu khong kiem).
-- M3b: direct UPDATE/DELETE tren grades cung phai bump grade_book_state -
--     trigger scn_grades_state_touch dam bao mutation ngoai RPC khong bo CAS.
-- H5: unique index -> unique constraint (parent_id, week_start) de PostgREST
--     upsert on_conflict khop dung.
-- Da apply len prod 2026-11-30 va verify (fresh_save=t stale_blocked=t).

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
  v_school uuid;
  v_scope text;
begin
  -- authz tuong minh - caller phai ghi diem duoc cho MOI HS + mon.
  -- NULL/rong/null-element phai reject ro rang - unnest(NULL) cho 0 rows
  -- -> exists(...) vacuously false -> bypass authz.
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
  -- r9 M3: CAS bat buoc - client luon gui revision (epoch sentinel khi
  -- scope trong); NULL = bo qua CAS = co chu y bypass stale detection.
  if p_expected_max is null then
    raise exception 'expected_revision_required' using errcode = 'P0001';
  end if;
  select c.academic_year_id, c.id, c.school_id
    into v_year, v_class, v_school
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = p_student_ids[1];
  -- r9 H4: tenant binding - mon phai thuoc truong cua lop; override
  -- academic_year ngoai pham vi lop bi reject (definer bypass FK
  -- consistency neu khong kiem).
  if v_school is not null and not exists (
    select 1 from public.subjects sub
     where sub.id = p_subject_id and sub.school_id = v_school
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_academic_year_id is not null
     and p_academic_year_id is distinct from v_year then
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
  if greatest(coalesce(v_max, '-infinity'::timestamptz),
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

-- r9 M3b: mutation truc tiep (khong qua RPC) cung phai bump revision -
-- neu khong, direct UPDATE/DELETE bo qua CAS va editor khong thay stale.
create or replace function public.scn_grades_touch_state()
returns trigger language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_class uuid;
  v_year uuid;
  v_scope text;
begin
  r := coalesce(new, old);
  select s.class_id, c.academic_year_id into v_class, v_year
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = r.student_id;
  v_scope := r.subject_id::text || '|' || r.term || '|'
             || coalesce(coalesce(r.academic_year_id, v_year)::text, '')
             || '|' || coalesce(v_class::text, '');
  insert into public.grade_book_state (scope_key, last_saved_at)
  values (v_scope, clock_timestamp())
  on conflict (scope_key) do update set last_saved_at = clock_timestamp();
  return coalesce(new, old);
end
$function$;

drop trigger if exists scn_grades_state_touch on public.grades;
create trigger scn_grades_state_touch
after insert or update or delete on public.grades
for each row execute function public.scn_grades_touch_state();

-- r9 H5: upsert (parent, week) cho retry - unique index -> unique
-- constraint de PostgREST on_conflict khop dung.
alter table public.digest_deliveries
  add constraint digest_deliveries_parent_week
  unique using index digest_deliveries_parent_week;
