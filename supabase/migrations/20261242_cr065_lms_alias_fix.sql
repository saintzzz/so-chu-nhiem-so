-- CR-065 r2b: alias 's' cua students de bien record 's' (session) ->
-- "column reference s.class_id is ambiguous". Doi alias students -> st.
create or replace function public.lms_start_attempt(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record; stu record; sub_id uuid; v_status text;
begin
  select * into s from public.lms_sessions where id = p_session;
  if not found then raise exception 'session_not_found'; end if;
  select st.id, st.class_id, st.full_name, c.school_id, c.name as class_name into stu
  from public.students st join public.classes c on c.id = st.class_id
  where st.profile_id = auth.uid() limit 1;
  if not found then raise exception 'not_student'; end if;
  if s.class_id <> stu.class_id then raise exception 'forbidden'; end if;
  if not (select public.lms_module_enabled(s.school_id)) then raise exception 'module_disabled'; end if;
  if s.status <> 'open' or now() < s.opens_at or now() > s.closes_at then
    raise exception 'not_open';
  end if;

  select id, status into sub_id, v_status from public.lms_submissions
  where session_id = p_session and student_id = stu.id limit 1;
  if sub_id is not null then
    if v_status = 'submitted' then raise exception 'already_submitted'; end if;
  else
    insert into public.lms_submissions
      (session_id, student_id, school_id, student_name, class_name, started_at)
    values (p_session, stu.id, s.school_id, stu.full_name, stu.class_name, now())
    returning id into sub_id;
  end if;

  return jsonb_build_object(
    'submission_id', sub_id,
    'duration_minutes', s.duration_minutes,
    'deadline', least(s.closes_at, now() + make_interval(mins => s.duration_minutes)),
    'questions', (
      select coalesce(jsonb_agg(x.j order by x.pos), '[]'::jsonb)
      from (
        select (el.ordinality - 1) as pos,
               (el.value - 'correct') as j
        from jsonb_array_elements(s.questions) with ordinality as el(value, ordinality)
      ) x
    )
  );
end; $$;

create or replace function public.lms_submit_attempt(p_session uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record; stu record; sub record; q record; part record;
  v_score numeric := 0; v_max numeric := 0; v_pending boolean := false;
  v_correct int; v_total int; v_stu jsonb;
begin
  select * into s from public.lms_sessions where id = p_session;
  if not found then raise exception 'session_not_found'; end if;
  select st.id, st.class_id, c.school_id into stu
  from public.students st join public.classes c on c.id = st.class_id
  where st.profile_id = auth.uid() limit 1;
  if not found then raise exception 'not_student'; end if;
  if s.class_id <> stu.class_id then raise exception 'forbidden'; end if;
  if not (select public.lms_module_enabled(s.school_id)) then raise exception 'module_disabled'; end if;

  select * into sub from public.lms_submissions
  where session_id = p_session and student_id = stu.id for update;
  if not found then raise exception 'not_started'; end if;
  if sub.status = 'submitted' then raise exception 'already_submitted'; end if;
  if now() > least(s.closes_at, coalesce(sub.started_at, now()) + make_interval(mins => s.duration_minutes)) + interval '60 seconds' then
    raise exception 'time_expired';
  end if;

  for q in
    select el.value as j, (el.ordinality - 1) as pos
    from jsonb_array_elements(s.questions) with ordinality as el(value, ordinality)
  loop
    v_max := v_max + coalesce((q.j ->> 'points')::numeric, 0);
    if q.j ->> 'qtype' = 'multiple_choice' then
      if upper(trim(coalesce(p_answers ->> (q.j ->> 'id'),''))) =
         upper(trim(coalesce(q.j ->> 'correct',''))) then
        v_score := v_score + coalesce((q.j ->> 'points')::numeric, 0);
      end if;
    elsif q.j ->> 'qtype' = 'short_answer' then
      if lower(regexp_replace(trim(coalesce(p_answers ->> (q.j ->> 'id'),'')), '\s+', ' ', 'g')) =
         lower(regexp_replace(trim(coalesce(q.j ->> 'correct','')), '\s+', ' ', 'g')) then
        v_score := v_score + coalesce((q.j ->> 'points')::numeric, 0);
      end if;
    elsif q.j ->> 'qtype' = 'true_false_4' then
      -- "a-Dung, b-Sai, ..." -> ty le CV7991: 1y=10%,2=25%,3=50%,4=100%.
      v_correct := 0; v_total := 0;
      v_stu := p_answers -> (q.j ->> 'id');
      for part in
        select lower(b[1]) as k, b[2] as v
        from regexp_split_to_table(coalesce(q.j ->> 'correct',''), ',') as m(p)
        cross join lateral regexp_match(m.p, '^\s*([a-dA-D])\s*-\s*(.+?)\s*$') as b
      loop
        v_total := v_total + 1;
        if public.lms_tf_norm(v_stu ->> part.k) = public.lms_tf_norm(part.v) then
          v_correct := v_correct + 1;
        end if;
      end loop;
      if v_total > 0 then
        v_score := v_score + coalesce((q.j ->> 'points')::numeric,0) *
          (case v_correct when 1 then 0.1 when 2 then 0.25 when 3 then 0.5 when 4 then 1 else 0 end);
      end if;
    elsif q.j ->> 'qtype' = 'essay' then
      v_pending := true;
    end if;
  end loop;

  update public.lms_submissions
  set answers = coalesce(p_answers, '{}'::jsonb), status = 'submitted',
      submitted_at = now(), auto_score = v_score, max_auto_score = v_max,
      essay_pending = v_pending
  where id = sub.id;

  return jsonb_build_object('auto_score', v_score, 'max_score', v_max, 'essay_pending', v_pending);
end; $$;
