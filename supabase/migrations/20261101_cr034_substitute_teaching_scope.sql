-- CR-034: GV day thay (substitute_requests approved) phai co quyen ghi nhu
-- GV chinh thuc trong cua so 60 ngay ke tu ngay day thay. Truoc day
-- scn_i_teach_student_subject / scn_student_in_my_teaching chi check
-- timetable_entries.teacher_id nen GV day thay bi chan nhap diem / diem danh theo tiet.
-- Da apply tren prod qua migration cr034_substitute_teaching_scope.

create or replace function public.scn_i_teach_student_subject(sid uuid, subid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from students s
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid
      and t.teacher_id = auth.uid()
      and t.subject_id = subid
  ) or exists (
    select 1 from students s
    join substitute_requests r on r.class_id = s.class_id
    where s.id = sid
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.subject_id = subid
      and r.date >= current_date - 60
  )
$function$;

create or replace function public.scn_student_in_my_teaching(sid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(
    select 1 from students s
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid and t.teacher_id = auth.uid()
  ) or exists(
    select 1 from students s
    join substitute_requests r on r.class_id = s.class_id
    where s.id = sid
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.date >= current_date - 60
  )
$function$;
