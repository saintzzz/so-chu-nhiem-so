-- CR-049: P1c tvc.profiles role mirror + P2a grade stale-write CAS +
-- P2b grades.academic_year_id populate tu class.
-- State khop voi prod (da verify trigger mirror + smoke test CAS).

-- P2b: cot nam hoc tren grades, populate tu class cua student.
alter table public.grades
  add column if not exists academic_year_id uuid
    references public.academic_years(id);

create index if not exists grades_year_idx on public.grades (academic_year_id);

-- P1c: sync_tvc_profile mirror DUNG profiles.role + concurrent_roles
-- (single source of truth) - bo no-downgrade giu stale 'kiem_duyet'.
create or replace function public.sync_tvc_profile()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'tvc'
as $function$
declare
  roles text[] := array[new.role]::text[] || coalesce(new.concurrent_roles, '{}'::text[]);
  old_roles text[] := array[old.role]::text[] || coalesce(old.concurrent_roles, '{}'::text[]);
  trole text;
  staff text[] := array['gvcn','gvbm','to_truong','bgh','admin']::text[];
begin
  if roles && staff then
    trole := case
      when 'admin' = any(roles) then 'admin'
      when roles && array['to_truong','bgh']::text[] then 'kiem_duyet'
      else 'giao_vien'
    end;
    insert into tvc.profiles (id, role, full_name, email)
    values (new.id, trole, coalesce(new.full_name, ''), new.email)
    on conflict (id) do update
      set full_name = excluded.full_name,
          email = excluded.email,
          role = excluded.role;
  elsif tg_op = 'UPDATE' and old_roles && staff then
    update tvc.profiles set role = 'former' where id = new.id;
  end if;
  return new;
end
$function$;

-- P2a: compare-and-swap chong ghi de. expected = max(updated_at) client
-- doc luc load; co row moi hon -> 'stale_write'. Overload 5 tham so
-- giu backward compat (expected=null => khong check).
create or replace function public.scn_save_grades(
  p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb
) returns void language plpgsql
 set search_path to 'public'
as $function$
begin
  perform public.scn_save_grades(p_student_ids, p_subject_id, p_term, p_rows, null);
end
$function$;

create or replace function public.scn_save_grades(
  p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb,
  p_expected_max timestamptz default null
) returns void language plpgsql
 set search_path to 'public'
as $function$
declare v_max timestamptz;
begin
  select max(g.updated_at) into v_max
    from public.grades g
   where g.student_id = any(p_student_ids)
     and g.subject_id = p_subject_id
     and g.term = p_term;
  if p_expected_max is not null
     and coalesce(v_max, '-infinity'::timestamptz) > p_expected_max then
    raise exception 'stale_write' using errcode = 'P0001';
  end if;
  delete from public.grades
   where student_id = any(p_student_ids)
     and subject_id = p_subject_id
     and term = p_term;
  insert into public.grades (
    student_id, subject_id, term, entered_by, subtype,
    assessment_type, seq, level, score, comment, result, updated_at,
    academic_year_id
  )
  select (r->>'student_id')::uuid, p_subject_id, p_term, auth.uid(),
         coalesce(r->>'subtype', ''), r->>'assessment_type',
         (r->>'seq')::smallint, r->>'level', (r->>'score')::numeric,
         r->>'comment', r->>'result', now(), c.academic_year_id
    from jsonb_array_elements(p_rows) as r
    left join public.students st on st.id = (r->>'student_id')::uuid
    left join public.classes c on c.id = st.class_id;
end
$function$;
