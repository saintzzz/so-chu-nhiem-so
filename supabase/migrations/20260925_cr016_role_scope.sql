-- CR-016: Role-scoped write policies theo Dieu le truong (TT 32/2020) + ROLE-MATRIX.
-- Truoc: nhieu bang dung "is_school_staff() AND in_school" = bat ky staff nao
-- (ke ca ke_toan, gvbm khong lien quan) deu ghi duoc -> leo thang quyen.
-- Sau: moi bang scope theo dung vai tro nghiep vu.

-- Helper: tiet hoc do toi day (timetable_entry.teacher_id = toi)
create or replace function public.scn_is_my_ttentry(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from timetable_entries t where t.id = tid and t.teacher_id = auth.uid())
$$;

-- Helper: HS thuoc lop toi day (bat ky tiet nao)
create or replace function public.scn_student_in_my_teaching(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from students s
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid and t.teacher_id = auth.uid())
$$;

-- Helper: toi la to truong cua department nay
create or replace function public.scn_is_dept_head(did uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from profiles p
    where p.id = auth.uid() and p.department_id = did and p.role = 'to_truong')
$$;

-- ============================================================
-- CRITICAL: classes - chi BGH/admin quan ly lop + phan cong CN.
-- Truoc: gvcn school-wide write -> tu gan gvcn_id = minh.
-- ============================================================
drop policy if exists classes_write_ins on classes;
drop policy if exists classes_write_upd on classes;
drop policy if exists classes_write_del on classes;
create policy classes_write_ins on classes for insert
  with check (my_role() in ('bgh','admin'));
create policy classes_write_upd on classes for update
  using (my_role() in ('bgh','admin') and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('bgh','admin') and (my_role()='admin' or school_id = my_school_id()));
create policy classes_write_del on classes for delete
  using (my_role() in ('bgh','admin') and (my_role()='admin' or school_id = my_school_id()));

-- ============================================================
-- CRITICAL: register_signoffs - GVCN chi "nop" (pending/rejected
-- -> submitted) lop minh; BGH ky/tu choi. Khong ai tu ky duoc.
-- ============================================================
drop policy if exists signoff_update on register_signoffs;
drop policy if exists signoff_insert on register_signoffs;
-- Insert: BGH/admin tao dot ky; GVCN chi insert status='pending' cho lop CN minh
create policy signoff_insert on register_signoffs for insert
  with check (
    (my_role() in ('bgh','admin'))
    or (my_role() = 'gvcn'
        and status = 'pending'
        and exists (
          select 1 from classes c
          where c.id = register_signoffs.class_id
            and c.gvcn_id = auth.uid())));
-- GVCN: chi chuyen sang 'submitted', chi lop CN cua minh, chi tu pending/rejected
create policy signoff_gvcn_submit on register_signoffs for update
  using (my_role() = 'gvcn'
         and scn_is_my_homeroom_class(class_id)
         and status in ('pending','rejected'))
  with check (my_role() = 'gvcn'
         and scn_is_my_homeroom_class(class_id)
         and status = 'submitted');
-- BGH/admin: ky duyet / tu choi / mo lai trong pham vi truong
create policy signoff_bgh_update on register_signoffs for update
  using (my_role() in ('bgh','admin')
         and (my_role()='admin' or scn_class_in_school(class_id)))
  with check (my_role() in ('bgh','admin')
         and (my_role()='admin' or scn_class_in_school(class_id)));

-- ============================================================
-- HIGH: period_logs - chi GV day tiet do ghi so dau bai.
-- ============================================================
drop policy if exists pl_staff_ins on period_logs;
drop policy if exists pl_staff_upd on period_logs;
drop policy if exists pl_staff_del on period_logs;
create policy pl_owner_ins on period_logs for insert
  with check (scn_is_my_ttentry(timetable_entry_id) and logged_by = auth.uid());
create policy pl_owner_upd on period_logs for update
  using (scn_is_my_ttentry(timetable_entry_id) or my_role() in ('bgh','admin'))
  with check (scn_is_my_ttentry(timetable_entry_id) or my_role() in ('bgh','admin'));
create policy pl_owner_del on period_logs for delete
  using (scn_is_my_ttentry(timetable_entry_id) or my_role() in ('bgh','admin'));

-- period_absences: ghi qua so dau bai cua tiet minh day
drop policy if exists pa_staff_ins on period_absences;
drop policy if exists pa_staff_upd on period_absences;
drop policy if exists pa_staff_del on period_absences;
create policy pa_owner_ins on period_absences for insert
  with check (exists(
    select 1 from period_logs pl
    where pl.id = period_absences.period_log_id
      and scn_is_my_ttentry(pl.timetable_entry_id)));
create policy pa_owner_upd on period_absences for update
  using (exists(
    select 1 from period_logs pl
    where pl.id = period_absences.period_log_id
      and (scn_is_my_ttentry(pl.timetable_entry_id) or my_role() in ('bgh','admin'))));
create policy pa_owner_del on period_absences for delete
  using (exists(
    select 1 from period_logs pl
    where pl.id = period_absences.period_log_id
      and (scn_is_my_ttentry(pl.timetable_entry_id) or my_role() in ('bgh','admin'))));

-- ============================================================
-- attendance_records: GVCN lop CN + BGH + GV ghi qua so dau bai
-- (source='period_log' cho HS lop minh day).
-- ============================================================
drop policy if exists att_staff_ins on attendance_records;
drop policy if exists att_staff_upd on attendance_records;
drop policy if exists att_staff_del on attendance_records;
create policy att_ins on attendance_records for insert
  with check (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (source = 'period_log' and scn_student_in_my_teaching(student_id)));
create policy att_upd on attendance_records for update
  using (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (source = 'period_log' and scn_student_in_my_teaching(student_id)))
  with check (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (source = 'period_log' and scn_student_in_my_teaching(student_id)));
create policy att_del on attendance_records for delete
  using (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (source = 'period_log' and scn_student_in_my_teaching(student_id)));

-- ============================================================
-- conduct_records: GVCN lop CN + BGH + GV cong/tru diem trong
-- tiet minh day (recorded_by = toi, HS lop minh day).
-- ============================================================
drop policy if exists cr_staff_ins on conduct_records;
drop policy if exists cr_staff_upd on conduct_records;
drop policy if exists cr_staff_del on conduct_records;
create policy cr_ins on conduct_records for insert
  with check (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (my_role() in ('gvbm','to_truong') and recorded_by = auth.uid()
        and scn_student_in_my_teaching(student_id)));
create policy cr_upd on conduct_records for update
  using (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (my_role() in ('gvbm','to_truong') and recorded_by = auth.uid()))
  with check (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (my_role() in ('gvbm','to_truong') and recorded_by = auth.uid()));
create policy cr_del on conduct_records for delete
  using (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
    or (my_role() in ('gvbm','to_truong') and recorded_by = auth.uid()));

-- conduct_evaluations (xep loai HK): chi GVCN lop CN + BGH
drop policy if exists ce_staff_ins on conduct_evaluations;
drop policy if exists ce_staff_upd on conduct_evaluations;
drop policy if exists ce_staff_del on conduct_evaluations;
create policy ce_ins on conduct_evaluations for insert
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy ce_upd on conduct_evaluations for update
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy ce_del on conduct_evaluations for delete
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');

-- ============================================================
-- counseling_cases + support_plans + early_warnings: nhay cam -
-- GVCN lop CN + BGH only.
-- ============================================================
drop policy if exists cc_staff_ins on counseling_cases;
drop policy if exists cc_staff_upd on counseling_cases;
drop policy if exists cc_staff_del on counseling_cases;
create policy cc_ins on counseling_cases for insert
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy cc_upd on counseling_cases for update
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy cc_del on counseling_cases for delete
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');

drop policy if exists sp_staff_ins on support_plans;
drop policy if exists sp_staff_upd on support_plans;
drop policy if exists sp_staff_del on support_plans;
create policy sp_ins on support_plans for insert
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy sp_upd on support_plans for update
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy sp_del on support_plans for delete
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');

drop policy if exists ew_staff_ins on early_warnings;
drop policy if exists ew_staff_upd on early_warnings;
drop policy if exists ew_staff_del on early_warnings;
create policy ew_ins on early_warnings for insert
  with check ((my_role()='gvcn' and (scn_student_in_my_homeroom(student_id) or scn_is_my_homeroom_class(class_id)))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy ew_upd on early_warnings for update
  using ((my_role()='gvcn' and (scn_student_in_my_homeroom(student_id) or scn_is_my_homeroom_class(class_id)))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and (scn_student_in_my_homeroom(student_id) or scn_is_my_homeroom_class(class_id)))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy ew_del on early_warnings for delete
  using ((my_role()='gvcn' and (scn_student_in_my_homeroom(student_id) or scn_is_my_homeroom_class(class_id)))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');

-- ============================================================
-- dept_meetings: to truong cua to do + BGH.
-- ============================================================
drop policy if exists dm_staff_ins on dept_meetings;
drop policy if exists dm_staff_upd on dept_meetings;
drop policy if exists dm_staff_del on dept_meetings;
create policy dm_ins on dept_meetings for insert
  with check (scn_is_dept_head(department_id) or my_role() in ('bgh','admin'));
create policy dm_upd on dept_meetings for update
  using (scn_is_dept_head(department_id) or my_role() in ('bgh','admin'))
  with check (scn_is_dept_head(department_id) or my_role() in ('bgh','admin'));
create policy dm_del on dept_meetings for delete
  using (scn_is_dept_head(department_id) or my_role() in ('bgh','admin'));

-- ============================================================
-- lesson_plans: GV nop (teacher_id = toi, lop+m minh day hoac
-- lop CN); to_truong duyet tiet t cua to; BGH duyet cuoi.
-- ============================================================
drop policy if exists lp_staff_ins on lesson_plans;
drop policy if exists lp_staff_upd on lesson_plans;
drop policy if exists lp_staff_del on lesson_plans;
create policy lp_ins on lesson_plans for insert
  with check (my_role() in ('gvcn','gvbm','to_truong')
    and teacher_id = auth.uid()
    and scn_class_in_school(class_id));
create policy lp_upd on lesson_plans for update
  using (scn_class_in_school(class_id)
    and (teacher_id = auth.uid()
         or my_role() in ('to_truong','bgh','pht','admin')))
  with check (scn_class_in_school(class_id)
    and (teacher_id = auth.uid()
         or my_role() in ('to_truong','bgh','pht','admin')));
create policy lp_del on lesson_plans for delete
  using (teacher_id = auth.uid() or my_role() in ('bgh','admin'));

-- ============================================================
-- incidents: GV nao cung bao cao duoc su co trong gio day;
-- cap nhat/xu ly: GVCN lop CN + BGH/PHT.
-- ============================================================
drop policy if exists inc_staff_ins on incidents;
drop policy if exists inc_staff_upd on incidents;
drop policy if exists inc_staff_del on incidents;
create policy inc_ins on incidents for insert
  with check (my_role() in ('gvcn','gvbm','to_truong','bgh','pht')
    and recorded_by = auth.uid());
create policy inc_upd on incidents for update
  using (my_role() in ('bgh','pht','admin')
    or (my_role()='gvcn' and scn_class_in_school(class_id)
        and scn_is_my_homeroom_class(class_id)))
  with check (my_role() in ('bgh','pht','admin')
    or (my_role()='gvcn' and scn_is_my_homeroom_class(class_id)));
create policy inc_del on incidents for delete
  using (my_role() in ('bgh','admin') or recorded_by = auth.uid());

-- ============================================================
-- daily_reports: GVCN lop CN + BGH.
-- ============================================================
drop policy if exists dr_staff_ins on daily_reports;
drop policy if exists dr_staff_upd on daily_reports;
drop policy if exists dr_staff_del on daily_reports;
create policy dr_ins on daily_reports for insert
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy dr_upd on daily_reports for update
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy dr_del on daily_reports for delete
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');

-- ============================================================
-- activities + activity_attendance (staff side): GVCN + BGH.
-- ============================================================
drop policy if exists act_staff_ins on activities;
drop policy if exists act_staff_upd on activities;
drop policy if exists act_staff_del on activities;
create policy act_ins on activities for insert
  with check (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or scn_class_in_school(class_id)));
create policy act_upd on activities for update
  using (my_role() in ('gvcn','bgh','pht','admin')
    and (my_role()='admin' or scn_class_in_school(class_id)))
  with check (my_role() in ('gvcn','bgh','pht','admin')
    and (my_role()='admin' or scn_class_in_school(class_id)));
create policy act_del on activities for delete
  using (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or scn_class_in_school(class_id)));

drop policy if exists aa_staff_ins on activity_attendance;
drop policy if exists aa_staff_upd on activity_attendance;
drop policy if exists aa_staff_del on activity_attendance;
create policy aa_ins on activity_attendance for insert
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy aa_upd on activity_attendance for update
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy aa_del on activity_attendance for delete
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');

-- ============================================================
-- announcements (staff side): GVCN + BGH + admin.
-- ============================================================
drop policy if exists ann_staff_ins on announcements;
drop policy if exists ann_staff_upd on announcements;
drop policy if exists ann_staff_del on announcements;
create policy ann_ins on announcements for insert
  with check (my_role() in ('gvcn','bgh','pht','admin') and sender_id = auth.uid()
    and (my_role()='admin' or school_id = my_school_id()));
create policy ann_upd on announcements for update
  using (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy ann_del on announcements for delete
  using (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));

-- ============================================================
-- appointments (staff side): GVCN duoc hen (teacher_id=toi) + BGH.
-- ============================================================
drop policy if exists appt_staff_ins on appointments;
drop policy if exists appt_staff_upd on appointments;
drop policy if exists appt_staff_del on appointments;
create policy appt_s_ins on appointments for insert
  with check (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or scn_parent_in_school(parent_id)));
create policy appt_s_upd on appointments for update
  using (my_role() in ('bgh','admin')
    or (my_role()='gvcn' and teacher_id = auth.uid()))
  with check (my_role() in ('bgh','admin')
    or (my_role()='gvcn' and teacher_id = auth.uid()));
create policy appt_s_del on appointments for delete
  using (my_role() in ('bgh','admin')
    or (my_role()='gvcn' and teacher_id = auth.uid()));

-- ============================================================
-- seating_charts / student_groups / class_roles / tasks / kpis /
-- school_year_events / student_record_history: GVCN lop CN + BGH.
-- ============================================================
drop policy if exists seat_staff_ins on seating_charts;
drop policy if exists seat_staff_upd on seating_charts;
drop policy if exists seat_staff_del on seating_charts;
create policy seat_ins on seating_charts for insert
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy seat_upd on seating_charts for update
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy seat_del on seating_charts for delete
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');

drop policy if exists sg_staff_ins on student_groups;
drop policy if exists sg_staff_upd on student_groups;
drop policy if exists sg_staff_del on student_groups;
create policy sg_ins on student_groups for insert
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy sg_upd on student_groups for update
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy sg_del on student_groups for delete
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');

drop policy if exists class_roles_staff_ins on class_roles;
drop policy if exists class_roles_staff_upd on class_roles;
drop policy if exists class_roles_staff_del on class_roles;
create policy cr2_ins on class_roles for insert
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy cr2_upd on class_roles for update
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy cr2_del on class_roles for delete
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');

drop policy if exists task_staff_ins on tasks;
drop policy if exists task_staff_upd on tasks;
drop policy if exists task_staff_del on tasks;
drop policy if exists tasks_staff_ins on tasks;
drop policy if exists tasks_staff_upd on tasks;
drop policy if exists tasks_staff_del on tasks;
create policy task_ins on tasks for insert
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy task_upd on tasks for update
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin'
    or created_by = auth.uid())
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin'
    or created_by = auth.uid());
create policy task_del on tasks for delete
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin'
    or created_by = auth.uid());

drop policy if exists kpi_staff_ins on kpis;
drop policy if exists kpi_staff_upd on kpis;
drop policy if exists kpi_staff_del on kpis;
create policy kpi_ins on kpis for insert
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy kpi_upd on kpis for update
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');
create policy kpi_del on kpis for delete
  using ((my_role()='gvcn' and scn_is_my_homeroom_class(class_id))
    or (my_role()='bgh' and scn_class_in_school(class_id)) or my_role()='admin');

drop policy if exists sye_staff_ins on school_year_events;
drop policy if exists sye_staff_upd on school_year_events;
drop policy if exists sye_staff_del on school_year_events;
create policy sye_ins on school_year_events for insert
  with check (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy sye_upd on school_year_events for update
  using (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy sye_del on school_year_events for delete
  using (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));

-- student_record_history: append-only. Chi insert qua server action
-- (gvcn CN / bgh / admin). History KHONG duoc update/xoa.
drop policy if exists srh_staff_ins on student_record_history;
drop policy if exists srh_staff_upd on student_record_history;
drop policy if exists srh_staff_del on student_record_history;
create policy srh_ins on student_record_history for insert
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');

-- parents + parent_students: GVCN (PH cua HS lop CN) + BGH.
drop policy if exists parents_staff_ins on parents;
drop policy if exists parents_staff_upd on parents;
drop policy if exists parents_staff_del on parents;
create policy par_ins on parents for insert
  with check (my_role() in ('gvcn','bgh','admin'));
create policy par_upd on parents for update
  using (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or scn_parent_in_school(id)))
  with check (my_role() in ('gvcn','bgh','admin')
    and (my_role()='admin' or scn_parent_in_school(id)));
create policy par_del on parents for delete
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or scn_parent_in_school(id)));

drop policy if exists ps_staff_ins on parent_students;
drop policy if exists ps_staff_upd on parent_students;
drop policy if exists ps_staff_del on parent_students;
create policy ps_ins on parent_students for insert
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy ps_upd on parent_students for update
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin')
  with check ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');
create policy ps_del on parent_students for delete
  using ((my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin');

-- ============================================================
-- subjects / campuses / emulation_criteria: cau hinh truong - BGH/admin.
-- ============================================================
drop policy if exists subjects_staff_ins on subjects;
drop policy if exists subjects_staff_upd on subjects;
drop policy if exists subjects_staff_del on subjects;
create policy subj_ins on subjects for insert
  with check (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy subj_upd on subjects for update
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy subj_del on subjects for delete
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));

drop policy if exists campus_staff_ins on campuses;
drop policy if exists campus_staff_upd on campuses;
drop policy if exists campus_staff_del on campuses;
create policy camp_ins on campuses for insert
  with check (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy camp_upd on campuses for update
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy camp_del on campuses for delete
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));

drop policy if exists ec_staff_ins on emulation_criteria;
drop policy if exists ec_staff_upd on emulation_criteria;
drop policy if exists ec_staff_del on emulation_criteria;
create policy ec_ins on emulation_criteria for insert
  with check (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy ec_upd on emulation_criteria for update
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));
create policy ec_del on emulation_criteria for delete
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));

-- ============================================================
-- competency_evaluations + nlpc_comments: danh gia nang luc HS
-- (student-scoped). GVCN lop CN + GV danh gia HS lop minh day + BGH.
-- ============================================================
drop policy if exists nlpc_staff_ins on competency_evaluations;
drop policy if exists nlpc_staff_upd on competency_evaluations;
drop policy if exists nlpc_staff_del on competency_evaluations;
create policy nlpc_ins on competency_evaluations for insert
  with check (evaluated_by = auth.uid() and (
    (my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() in ('gvbm','to_truong') and scn_student_in_my_teaching(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin'));
create policy nlpc_upd on competency_evaluations for update
  using (evaluated_by = auth.uid() or my_role() in ('bgh','admin'))
  with check (evaluated_by = auth.uid() or my_role() in ('bgh','admin'));
create policy nlpc_del on competency_evaluations for delete
  using (evaluated_by = auth.uid() or my_role() in ('bgh','admin'));

drop policy if exists ae_ins on assessment_evidence;
drop policy if exists ae_upd on assessment_evidence;
drop policy if exists ae_del on assessment_evidence;
create policy ae_ins2 on assessment_evidence for insert
  with check (exists(
    select 1 from teacher_assessments ta
    where ta.id = assessment_evidence.assessment_id
      and scn_profile_in_school(ta.teacher_id)
      and (ta.teacher_id = auth.uid() or my_role() in ('to_truong','bgh','admin'))));
create policy ae_upd2 on assessment_evidence for update
  using (exists(
    select 1 from teacher_assessments ta
    where ta.id = assessment_evidence.assessment_id
      and scn_profile_in_school(ta.teacher_id)
      and (ta.teacher_id = auth.uid() or my_role() in ('to_truong','bgh','admin'))))
  with check (exists(
    select 1 from teacher_assessments ta
    where ta.id = assessment_evidence.assessment_id
      and scn_profile_in_school(ta.teacher_id)
      and (ta.teacher_id = auth.uid() or my_role() in ('to_truong','bgh','admin'))));
create policy ae_del2 on assessment_evidence for delete
  using (exists(
    select 1 from teacher_assessments ta
    where ta.id = assessment_evidence.assessment_id
      and scn_profile_in_school(ta.teacher_id)
      and (ta.teacher_id = auth.uid() or my_role() in ('to_truong','bgh','admin'))));

drop policy if exists nlpc_cmt_staff_ins on nlpc_comments;
drop policy if exists nlpc_cmt_staff_upd on nlpc_comments;
drop policy if exists nlpc_cmt_staff_del on nlpc_comments;
create policy nlpc_cmt_ins on nlpc_comments for insert
  with check (evaluated_by = auth.uid() and (
    (my_role()='gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() in ('gvbm','to_truong') and scn_student_in_my_teaching(student_id))
    or (my_role()='bgh' and scn_student_in_school(student_id)) or my_role()='admin'));
create policy nlpc_cmt_upd on nlpc_comments for update
  using (evaluated_by = auth.uid() or my_role() in ('bgh','admin'))
  with check (evaluated_by = auth.uid() or my_role() in ('bgh','admin'));
create policy nlpc_cmt_del on nlpc_comments for delete
  using (evaluated_by = auth.uid() or my_role() in ('bgh','admin'));

-- ============================================================
-- substitute_requests: GV tao yeu cau cho minh; BGH/PHT duyet.
-- ============================================================
drop policy if exists sub_staff_ins on substitute_requests;
drop policy if exists sub_staff_upd on substitute_requests;
drop policy if exists sub_staff_del on substitute_requests;
create policy subr_ins on substitute_requests for insert
  with check (is_school_staff()
    and (my_role()='admin' or school_id = my_school_id())
    and (requested_by = auth.uid() or my_role() in ('bgh','pht','admin')));
create policy subr_upd on substitute_requests for update
  using (is_school_staff()
    and (my_role()='admin' or school_id = my_school_id())
    and (requested_by = auth.uid() or my_role() in ('bgh','pht','admin')))
  with check (is_school_staff()
    and (my_role()='admin' or school_id = my_school_id())
    and (requested_by = auth.uid() or my_role() in ('bgh','pht','admin')));
create policy subr_del on substitute_requests for delete
  using (my_role() in ('bgh','pht','admin')
    and (my_role()='admin' or school_id = my_school_id()));

-- ============================================================
-- ai_jobs: chi owner xem/sua job cua minh.
-- ============================================================
drop policy if exists ai_jobs_staff_ins on ai_jobs;
drop policy if exists ai_jobs_staff_upd on ai_jobs;
drop policy if exists ai_jobs_staff_del on ai_jobs;
create policy ai_ins on ai_jobs for insert
  with check (is_school_staff() and created_by = auth.uid());
create policy ai_upd on ai_jobs for update
  using (created_by = auth.uid() or my_role()='admin')
  with check (created_by = auth.uid() or my_role()='admin');
create policy ai_del on ai_jobs for delete
  using (created_by = auth.uid() or my_role()='admin');

-- ============================================================
-- exams + exam_sessions: quan ly thi cu la viec BGH/PHT, khong
-- phai GVCN tu y toan truong.
-- ============================================================
drop policy if exists exams_write on exams;
create policy exams_write on exams for all
  using (my_role() in ('bgh','pht','admin')
    and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('bgh','pht','admin')
    and (my_role()='admin' or school_id = my_school_id()));

drop policy if exists exam_sessions_write on exam_sessions;
create policy exam_sessions_write on exam_sessions for all
  using (my_role() in ('bgh','pht','admin')
    and (my_role()='admin' or scn_class_in_school(class_id)))
  with check (my_role() in ('bgh','pht','admin')
    and (my_role()='admin' or scn_class_in_school(class_id)));

-- school_kpis: BGH quan ly chi tieu truong
drop policy if exists skpi_staff_write on school_kpis;
create policy skpi_write on school_kpis for all
  using (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()))
  with check (my_role() in ('bgh','admin')
    and (my_role()='admin' or school_id = my_school_id()));

-- notifications insert: staff + PH/HS tao notif cho nguoi trong truong
-- (PH dat lich hen -> notify GVCN; staff -> staff).
drop policy if exists notif_insert_staff on notifications;
drop policy if exists notif_ins on notifications;
create policy notif_ins on notifications for insert
  with check (
    scn_profile_in_school(profile_id)
    and (is_school_staff() or my_role() in ('phu_huynh','hoc_sinh')));

-- F4: ly do tu choi so chu nhiem
alter table register_signoffs add column if not exists reject_reason text;
