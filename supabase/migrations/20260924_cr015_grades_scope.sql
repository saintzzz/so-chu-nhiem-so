-- CR-015: siết quyền ghi điểm theo phân công giảng dạy + helper scope.
-- Truoc: bat ky staff nao trong truong cung ghi/xoa diem cua moi HS.
-- Sau:
--   admin        -> moi HS
--   bgh          -> HS trong truong
--   gvcn         -> HS lop minh chu nhiem
--   gvbm/to_truong -> HS thuoc lop minh day VA mon minh day (timetable_entries)

-- HS co thuoc lop CN cua toi khong (SECURITY DEFINER - tranh RLS recursion)
create or replace function public.scn_student_in_my_homeroom(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    join classes c on c.id = s.class_id
    where s.id = sid and c.gvcn_id = auth.uid()
  )
$$;

-- Toi co day mon subid cho lop cua HS sid khong (qua timetable_entries)
create or replace function public.scn_i_teach_student_subject(sid uuid, subid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid
      and t.teacher_id = auth.uid()
      and t.subject_id = subid
  )
$$;

create or replace function public.scn_can_write_grade(sid uuid, subid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_student_in_school(sid))
    -- gvcn: lop chu nhiem (moi mon) HOAC lop minh day dung mon
    or (my_role() = 'gvcn' and (
      scn_student_in_my_homeroom(sid) or scn_i_teach_student_subject(sid, subid)
    ))
    or (my_role() in ('gvbm', 'to_truong') and scn_i_teach_student_subject(sid, subid))
  )
$$;

drop policy if exists grades_staff_ins on grades;
drop policy if exists grades_staff_upd on grades;
drop policy if exists grades_staff_del on grades;

create policy grades_staff_ins on grades for insert with check (
  scn_can_write_grade(student_id, subject_id)
);
create policy grades_staff_upd on grades for update using (
  scn_can_write_grade(student_id, subject_id)
) with check (
  scn_can_write_grade(student_id, subject_id)
);
create policy grades_staff_del on grades for delete using (
  scn_can_write_grade(student_id, subject_id)
);
