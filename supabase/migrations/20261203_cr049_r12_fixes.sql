-- CR-049 r12 (reviewer-claude HIGH-1 + sweep): bind tat ca check
-- self-attribution (gvcn_id/teacher_id/recorded_by/evaluated_by = auth.uid())
-- vao TRUONG HIEN TAI cua caller. GV chuyen truong khong con quyen ghi/doc
-- tren du lieu truong cu du FK con tro ve ho.

-- 1) scn_is_my_homeroom_class: helper dung chung cho ~10 write policies
-- (students, emulation_scores, signoff, early_warnings, incidents, dr,
-- seating, student_groups). Thieu bind truong = bo lo toan bo.
create or replace function scn_is_my_homeroom_class(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists(
    select 1 from classes c
    where c.id = cid and c.gvcn_id = auth.uid()
      -- r12: lop CN phai o truong hien tai cua caller.
      and c.school_id = (select my_school_id())
  )
$$;

-- 2) signoff_insert: inline exists chua bind truong (cr016:51).
drop policy if exists signoff_insert on register_signoffs;
create policy signoff_insert on register_signoffs for insert
  with check (
    ((select my_roles()) && array['bgh','admin']::text[])
    or ((select my_roles()) @> array['gvcn'::text]
        and status = 'pending'
        and exists (
          select 1 from classes c
          where c.id = register_signoffs.class_id
            and c.gvcn_id = auth.uid()
            and c.school_id = (select my_school_id()))));

-- 3) digest_deliveries_staff_read: nhanh gvcn doc duoc delivery cua truong cu.
drop policy if exists digest_deliveries_staff_read on public.digest_deliveries;
create policy digest_deliveries_staff_read on public.digest_deliveries for select using (
  (((select my_roles()) && array['bgh','pht','admin']::text[])
     and parent_id in (select my_school_parent_ids()))
  or (((select my_roles()) @> array['gvcn'::text])
     and exists (select 1 from parent_students ps
        join students s on s.id = ps.student_id
        join classes c on c.id = s.class_id
        where ps.parent_id = digest_deliveries.parent_id
          and c.gvcn_id = auth.uid()
          and c.school_id = (select my_school_id()))));

-- 4) conduct_records: nhanh recorded_by=self chua bind truong (USING).
-- with_check da co scn_student_in_school tu truoc.
drop policy if exists cr_upd on conduct_records;
create policy cr_upd on conduct_records for update
  using (
    (((select my_roles()) @> array['gvcn'::text]) and scn_student_in_my_homeroom(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text])
    or (((select my_roles()) && array['gvbm','to_truong']::text[])
        and recorded_by = auth.uid()
        and scn_student_in_school(student_id)))
  with check (
    scn_student_in_school(student_id)
    and (((select my_roles()) && array['bgh','admin']::text[])
         or (((select my_roles()) @> array['gvcn'::text]) and scn_student_in_my_homeroom(student_id))
         or (((select my_roles()) && array['gvbm','to_truong']::text[])
             and recorded_by = auth.uid()
             and scn_student_in_my_teaching(student_id))));

drop policy if exists cr_del on conduct_records;
create policy cr_del on conduct_records for delete
  using (
    (((select my_roles()) @> array['gvcn'::text]) and scn_student_in_my_homeroom(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text])
    or (((select my_roles()) && array['gvbm','to_truong']::text[])
        and recorded_by = auth.uid()
        and scn_student_in_school(student_id)));

-- 5) incidents: nhanh bgh/pht trong USING chua bind; nhanh recorded_by=self
-- chua bind. Neo truong theo class -> student -> nguoi ghi (giong
-- inc_staff_read). Admin giu global.
drop policy if exists inc_upd on incidents;
create policy inc_upd on incidents for update
  using (
    ((select my_roles()) @> array['admin'::text])
    or (((select my_roles()) && array['bgh','pht']::text[])
        and case
              when class_id is not null then scn_class_in_school(class_id)
              when student_id is not null then scn_student_in_school(student_id)
              else scn_profile_in_school(recorded_by)
            end)
    or (((select my_roles()) @> array['gvcn'::text]) and scn_is_my_homeroom_class(class_id)))
  with check (
    (class_id is null or scn_class_in_school(class_id))
    and (student_id is null or scn_student_in_school(student_id)));

drop policy if exists inc_del on incidents;
create policy inc_del on incidents for delete
  using (
    ((select my_roles()) @> array['admin'::text])
    or (((select my_roles()) @> array['bgh'::text])
        and case
              when class_id is not null then scn_class_in_school(class_id)
              when student_id is not null then scn_student_in_school(student_id)
              else scn_profile_in_school(recorded_by)
            end)
    or (recorded_by = auth.uid()
        and (class_id is null or scn_class_in_school(class_id))
        and (student_id is null or scn_student_in_school(student_id))));

-- 6) lesson_plans: lp_del chua bind truong (bang co school_id + class_id).
drop policy if exists lp_del on lesson_plans;
create policy lp_del on lesson_plans for delete
  using (
    ((teacher_id = auth.uid())
        and (school_id = my_school_id() or scn_class_in_school(class_id)))
    or (((select my_roles()) @> array['bgh'::text])
        and (school_id = my_school_id() or scn_class_in_school(class_id)))
    or ((select my_roles()) @> array['admin'::text]));

-- 7) appointments: nhanh gvcn teacher_id=self trong USING chua bind
-- (with_check da co scn_parent_in_school).
drop policy if exists appt_s_upd on appointments;
create policy appt_s_upd on appointments for update
  using (
    ((select my_roles()) @> array['admin'::text])
    or (((select my_roles()) @> array['bgh'::text]) and scn_parent_in_school(parent_id))
    or (((select my_roles()) @> array['gvcn'::text])
        and teacher_id = auth.uid()
        and scn_parent_in_school(parent_id)))
  with check (
    scn_parent_in_school(parent_id)
    and (((select my_roles()) && array['bgh','admin']::text[])
         or (teacher_id = auth.uid())));

drop policy if exists appt_s_del on appointments;
create policy appt_s_del on appointments for delete
  using (
    ((select my_roles()) @> array['admin'::text])
    or (((select my_roles()) @> array['bgh'::text]) and scn_parent_in_school(parent_id))
    or (((select my_roles()) @> array['gvcn'::text])
        and teacher_id = auth.uid()
        and scn_parent_in_school(parent_id)));

-- 8) nlpc_comments: nhanh evaluated_by=self + nhanh bgh chua bind truong.
drop policy if exists nlpc_cmt_upd on nlpc_comments;
create policy nlpc_cmt_upd on nlpc_comments for update
  using (
    ((evaluated_by = auth.uid()) and scn_student_in_school(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text]))
  with check (
    ((evaluated_by = auth.uid()) and scn_student_in_school(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text]));

drop policy if exists nlpc_cmt_del on nlpc_comments;
create policy nlpc_cmt_del on nlpc_comments for delete
  using (
    ((evaluated_by = auth.uid()) and scn_student_in_school(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text]));
