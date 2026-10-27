-- CR-065: lms-lite - giao bai + HS lam bai trac nghiem truc tuyen.
-- tvc_exam_sessions/submissions la VIEW tren schema tvc (TVC360 dung
-- chung) -> KHONG dung; lms_* rieng trong public, snapshot de vao
-- lms_sessions.questions luc giao (de da giao immutable, khong FK
-- cross-schema, audit-sound).

-- ===== 0) Module flag helper =====
create or replace function public.lms_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.school_features sf
    where sf.school_id = p_school and sf.module = 'lms_lite' and sf.enabled = false
  );
$$;

-- ===== 1) Bang =====
create table if not exists public.lms_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  exam_id uuid not null, -- tham chieu tvc.exams (khong FK cross-schema)
  title text not null,
  class_id uuid not null references public.classes(id),
  owner_id uuid not null,
  duration_minutes int not null default 45,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'open',
  questions jsonb not null default '[]'::jsonb, -- snapshot de: {id,stem,context,qtype,points,correct,media}
  created_at timestamptz not null default now()
);

create table if not exists public.lms_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lms_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id),
  school_id uuid not null references public.schools(id),
  student_name text,
  class_name text,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress',
  auto_score numeric,
  max_auto_score numeric,
  essay_pending boolean not null default false,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- ===== 2) RLS =====
alter table public.lms_sessions enable row level security;
alter table public.lms_submissions enable row level security;

-- Session: staff cung truong doc het; HS chi doc session lop minh.
create policy lms_sessions_read on public.lms_sessions for select
  using (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[])
    or (class_id = (select st.class_id from public.students st where st.profile_id = auth.uid() limit 1))
  );
create policy lms_sessions_write on public.lms_sessions for all
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin']::text[]
    and (select public.lms_module_enabled(school_id)))
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin']::text[]
    and (select public.lms_module_enabled(school_id)));

-- Submission: HS chi doc bai cua minh; staff cung truong doc het.
create policy lms_subs_read on public.lms_submissions for select
  using (
    (student_id = (select st.id from public.students st where st.profile_id = auth.uid() limit 1))
    or (school_id = (select my_school_id())
      and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[])
  );
create policy lms_subs_write on public.lms_submissions for all
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin']::text[]
    and (select public.lms_module_enabled(school_id)))
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin']::text[]
    and (select public.lms_module_enabled(school_id)));

-- ===== 3) Helper cham diem: chuan hoa y Dung/Sai cua TF4 =====
create or replace function public.lms_tf_norm(p text)
returns text language sql immutable as $$
  select case when lower(left(trim(coalesce(p,'')),1)) in ('d','đ','t') then 'dung' else 'sai' end;
$$;

-- ===== 4) RPC =====

-- 4a) GV giao de: snapshot cau hoi + dap an vao session (immutable).
create or replace function public.lms_assign(
  p_exam uuid, p_class uuid, p_opens timestamptz, p_closes timestamptz,
  p_duration int, p_title text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e record; c record; v_id uuid; v_q jsonb;
begin
  if not ((select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  select * into e from public.tvc_exams where id = p_exam;
  if not found then raise exception 'exam_not_found'; end if;
  -- De thuoc ngan hang chung cua truong: chu de, nguoi cung truong, bgh/admin.
  if e.owner_id <> auth.uid()
     and not ((select my_roles()) && array['bgh','admin']::text[])
     and not exists (select 1 from public.profiles p
                     where p.id = e.owner_id
                       and p.school_id = (select my_school_id())) then
    raise exception 'not_exam_owner';
  end if;
  select * into c from public.classes where id = p_class;
  if not found then raise exception 'class_not_found'; end if;
  if c.school_id <> (select my_school_id()) then raise exception 'school_mismatch'; end if;
  if not (select public.lms_module_enabled(c.school_id)) then raise exception 'module_disabled'; end if;
  if p_closes is null or p_opens is null or p_closes <= p_opens then
    raise exception 'invalid_window';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'stem', q.stem, 'context', q.context, 'qtype', q.qtype,
    'points', eq.points, 'correct', q.answer ->> 'correct', 'media', q.media
  ) order by eq.position), '[]'::jsonb) into v_q
  from public.tvc_exam_questions eq
  join public.tvc_questions q on q.id = eq.question_id
  where eq.exam_id = p_exam;
  if jsonb_array_length(v_q) = 0 then raise exception 'exam_empty'; end if;

  insert into public.lms_sessions
    (school_id, exam_id, title, class_id, owner_id, duration_minutes,
     opens_at, closes_at, questions)
  values (c.school_id, p_exam, coalesce(nullif(p_title,''), e.title), p_class,
          auth.uid(), greatest(5, least(coalesce(p_duration,45), 180)),
          p_opens, p_closes, v_q)
  returning id into v_id;
  return jsonb_build_object('session_id', v_id, 'question_count', jsonb_array_length(v_q));
end; $$;

-- 4b) HS xem bai duoc giao cho lop minh.
create or replace function public.lms_my_assignments()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  stu record;
begin
  select s.id, s.class_id, c.school_id into stu
  from public.students s join public.classes c on c.id = s.class_id
  where s.profile_id = auth.uid() limit 1;
  if not found then raise exception 'not_student'; end if;
  if not (select public.lms_module_enabled(stu.school_id)) then raise exception 'module_disabled'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'session_id', t.id, 'title', t.title, 'duration_minutes', t.duration_minutes,
      'opens_at', t.opens_at, 'closes_at', t.closes_at,
      'question_count', jsonb_array_length(t.questions),
      'state', case
        when sub.status = 'submitted' then 'submitted'
        when sub.id is not null then 'in_progress'
        when now() < t.opens_at then 'upcoming'
        when now() > t.closes_at then 'closed'
        else 'open' end,
      'score', sub.auto_score, 'max_score', sub.max_auto_score,
      'essay_pending', coalesce(sub.essay_pending,false)
    ) order by t.opens_at)
    from public.lms_sessions t
    left join public.lms_submissions sub
      on sub.session_id = t.id and sub.student_id = stu.id
    where t.class_id = stu.class_id and t.status = 'open'
  ), '[]'::jsonb);
end; $$;

-- 4c) HS bat dau: tra de KHONG kem dap an + tao submission in_progress.
create or replace function public.lms_start_attempt(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record; stu record; sub_id uuid; v_status text;
begin
  select * into s from public.lms_sessions where id = p_session;
  if not found then raise exception 'session_not_found'; end if;
  select s.id, s.class_id, s.full_name, c.school_id, c.name as class_name into stu
  from public.students s join public.classes c on c.id = s.class_id
  where s.profile_id = auth.uid() limit 1;
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

-- 4d) HS nop: cham tu dong server-side + deadline.
create or replace function public.lms_submit_attempt(p_session uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record; stu record; sub record; q record; part record;
  v_score numeric := 0; v_max numeric := 0; v_pending boolean := false;
  v_correct int; v_total int; v_stu jsonb;
begin
  select * into s from public.lms_sessions where id = p_session;
  if not found then raise exception 'session_not_found'; end if;
  select s.id, s.class_id, c.school_id into stu
  from public.students s join public.classes c on c.id = s.class_id
  where s.profile_id = auth.uid() limit 1;
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

-- 4e) GV xem ket qua session: submissions + danh sach chua nop.
create or replace function public.lms_session_results(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  select * into s from public.lms_sessions where id = p_session;
  if not found then raise exception 'session_not_found'; end if;
  if s.school_id <> (select my_school_id()) then raise exception 'school_mismatch'; end if;
  if not ((select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','so_gd']::text[]) then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'title', s.title, 'closes_at', s.closes_at,
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', sub.student_id, 'student_name', sub.student_name,
        'status', sub.status, 'score', sub.auto_score, 'max_score', sub.max_auto_score,
        'essay_pending', sub.essay_pending, 'submitted_at', sub.submitted_at
      ) order by sub.student_name)
      from public.lms_submissions sub where sub.session_id = p_session
    ), '[]'::jsonb),
    'not_submitted', coalesce((
      select jsonb_agg(s2.full_name order by s2.full_name)
      from public.students s2
      where s2.class_id = s.class_id and s2.status = 'active'
        and not exists (select 1 from public.lms_submissions x
                        where x.session_id = p_session and x.student_id = s2.id
                          and x.status = 'submitted')
    ), '[]'::jsonb)
  );
end; $$;

grant execute on function public.lms_module_enabled(uuid) to authenticated;
grant execute on function public.lms_assign(uuid, uuid, timestamptz, timestamptz, int, text) to authenticated;
grant execute on function public.lms_my_assignments() to authenticated;
grant execute on function public.lms_start_attempt(uuid) to authenticated;
grant execute on function public.lms_submit_attempt(uuid, jsonb) to authenticated;
grant execute on function public.lms_session_results(uuid) to authenticated;
