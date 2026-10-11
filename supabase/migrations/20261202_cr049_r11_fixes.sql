-- CR-049 r11: cross-model review remediation (commit 02231f0).
-- H1: cac leaf helper CON LAI van thieu bind truong hien tai -
--     scn_is_my_ttentry / scn_is_sub_ttentry_date /
--     scn_student_in_my_teaching / nhanh homeroom cua
--     scn_sync_period_attendance -> GV chuyen truong van ghi duoc
--     attendance/conduct lop cu.
-- H2: post-save revision reconciliation race - editor doc
--     grade_book_state SAU khi RPC commit; neu GV khac save xen giua,
--     ref nhan revision R2 voi cells R1 -> CAS bypass. RPC tra ve
--     revision cua chinh transaction (clock_timestamp da ghi).

create or replace function public.scn_is_my_ttentry(tid uuid)
returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists(
    select 1 from timetable_entries t
    join classes c on c.id = t.class_id
    where t.id = tid and t.teacher_id = auth.uid()
      -- r11 H1: phan cong tiet day chi con hieu luc o truong hien tai.
      and c.school_id = (select my_school_id()))
$function$;

create or replace function public.scn_is_sub_ttentry_date(tid uuid, d date)
returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists(
    select 1 from timetable_entries t
    join classes c on c.id = t.class_id
    join substitute_requests r
      on r.class_id = t.class_id
     and r.period = t.period
     and r.subject_id = t.subject_id
     and r.school_id = c.school_id
    where t.id = tid
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.date = d
      and d between current_date - 60 and current_date
      -- r11 H1: day the cung chi trong truong hien tai.
      and c.school_id = (select my_school_id())
  )
$function$;

create or replace function public.scn_student_in_my_teaching(sid uuid)
returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select exists(
    select 1 from students s
    join classes c on c.id = s.class_id
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid and t.teacher_id = auth.uid()
      and c.school_id = (select my_school_id())
  ) or exists(
    select 1 from students s
    join classes c on c.id = s.class_id
    join substitute_requests r on r.class_id = s.class_id
    where s.id = sid
      and r.school_id = c.school_id
      and c.school_id = (select my_school_id())
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.date >= current_date - 60
      and r.date <= current_date
  )
$function$;

create or replace function public.scn_sync_period_attendance(
  p_date date, p_class_id uuid, p_student_ids uuid[]
) returns void language plpgsql security definer
 set search_path to 'public'
as $function$
declare
  v_allowed boolean;
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'period_attendance_sync_denied';
  end if;
  if p_date is null or p_class_id is null or p_student_ids is null then
    raise exception 'period_attendance_sync_invalid';
  end if;
  select (
    exists(select 1 from classes c where c.id = p_class_id
             and c.gvcn_id = auth.uid()
             -- r11 H1: homeroom branch cung bind truong hien tai.
             and c.school_id = (select my_school_id()))
    or exists(select 1 from timetable_entries te
               where te.class_id = p_class_id
                 and (scn_is_my_ttentry(te.id) or scn_is_sub_ttentry_date(te.id, p_date)))
    or ((select my_roles()) && array['bgh','admin']::text[]
        and exists(select 1 from classes c where c.id = p_class_id and c.school_id = my_school_id()))
  ) into v_allowed;
  if v_allowed is distinct from true then
    raise exception 'period_attendance_sync_denied';
  end if;
  select array_agg(s.id) into v_ids
    from students s
   where s.class_id = p_class_id and s.id = any(p_student_ids);
  perform pg_advisory_xact_lock(
    hashtextextended(p_class_id::text || ':' || p_date::text, 0));
  delete from attendance_records
   where student_id = any(coalesce(v_ids, '{}'::uuid[]))
     and date = p_date
     and source = 'period_log';
  with worst as (
    select distinct on (pa.student_id) pa.student_id, pa.status
      from period_absences pa
      join period_logs pl on pl.id = pa.period_log_id
      join timetable_entries te on te.id = pl.timetable_entry_id
     where pl.date = p_date
       and te.class_id = p_class_id
       and pa.student_id = any(coalesce(v_ids, '{}'::uuid[]))
     order by pa.student_id,
       case pa.status
         when 'unexcused' then 3
         when 'excused' then 2
         when 'late' then 1
         else 0
       end desc
  )
  insert into attendance_records (student_id, date, status, source)
  select w.student_id, p_date, w.status, 'period_log'
    from worst w
  on conflict (student_id, date) do update
    set status = excluded.status
    where attendance_records.source = 'period_log'
        and case excluded.status
              when 'unexcused' then 3
              when 'excused' then 2
              when 'late' then 1
              else 0
            end
          > case attendance_records.status
              when 'unexcused' then 3
              when 'excused' then 2
              when 'late' then 1
              else 0
            end;
end;
$function$;

-- H2: scn_save_grades tra ve revision da ghi (clock_timestamp trong cung
-- transaction, duoi advisory lock) de editor reconcile dung revision cua
-- chinh save - khong doc lai state sau commit (race: GV khac save xen
-- giua se dua ref toi R2 trong khi cells van R1).
drop function public.scn_save_grades(uuid[],uuid,text,jsonb,timestamptz,uuid);
create function public.scn_save_grades(
  p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb,
  p_expected_max timestamptz default null, p_academic_year_id uuid default null
) returns timestamptz language plpgsql security definer
 set search_path to 'public'
as $function$
declare
  v_max timestamptz;
  v_state timestamptz;
  v_year uuid;
  v_class uuid;
  v_school uuid;
  v_scope text;
  v_now timestamptz;
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
  v_now := clock_timestamp();
  insert into public.grade_book_state (scope_key, last_saved_at)
  values (v_scope, v_now)
  on conflict (scope_key) do update set last_saved_at = v_now;
  return v_now;
end
$function$;
revoke all on function public.scn_save_grades(uuid[],uuid,text,jsonb,timestamptz,uuid) from public, anon;
grant execute on function public.scn_save_grades(uuid[],uuid,text,jsonb,timestamptz,uuid) to authenticated, service_role;
