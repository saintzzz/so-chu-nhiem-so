-- CR-065 r2: chot lo ro dap an.
-- lms_sessions.questions chua 'correct'; RLS cho HS select row session lop
-- minh -> HS query thang PostgREST lay dap an. Revoke table-level grant,
-- cap lai select theo cot (TRU questions). Insert/delete chi qua RPC.
revoke all on public.lms_sessions from authenticated, anon;
grant select (id, school_id, exam_id, title, class_id, owner_id,
  duration_minutes, opens_at, closes_at, status, created_at)
  on public.lms_sessions to authenticated;
-- CAS dong bai qua action (RLS lms_sessions_write van chan role/truong/module).
grant update (status) on public.lms_sessions to authenticated;

-- Submissions: HS chi doc (RLS scope bai cua minh); moi ghi qua RPC.
revoke insert, update, delete on public.lms_submissions from authenticated, anon;

-- HS van thay bai da lam/da nop sau khi GV dong session.
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
        when t.status <> 'open' then 'closed'
        when now() < t.opens_at then 'upcoming'
        when now() > t.closes_at then 'closed'
        else 'open' end,
      'score', sub.auto_score, 'max_score', sub.max_auto_score,
      'essay_pending', coalesce(sub.essay_pending,false)
    ) order by t.opens_at desc)
    from public.lms_sessions t
    left join public.lms_submissions sub
      on sub.session_id = t.id and sub.student_id = stu.id
    where t.class_id = stu.class_id
      and (t.status = 'open' or sub.id is not null)
  ), '[]'::jsonb);
end; $$;
