-- CR-049 r13 (codex r13): cac nhanh role/self-attribution con thieu tenant
-- binding + chot drift file-vs-prod (inc_ins, classes_write_ins da bind tren
-- prod qua apply_migration nhung chua co file nao - replay lai se mo lo).

-- 1) signoff_insert: nhanh BGH con global -> admin global rieng, BGH bind
-- truong cua class_id; gvcn giu nhanh pending + lop CN truong hien tai.
drop policy if exists signoff_insert on register_signoffs;
create policy signoff_insert on register_signoffs for insert
with check (
  (select my_roles()) @> array['admin']
  or ((select my_roles()) @> array['bgh'] and scn_class_in_school(class_id))
  or ((select my_roles()) @> array['gvcn'] and status = 'pending' and exists(
    select 1 from classes c
    where c.id = register_signoffs.class_id
      and c.gvcn_id = auth.uid()
      and c.school_id = (select my_school_id()))));

-- 2) inc_ins: chot ban da bind tren prod + bo sung check student thuoc class
-- khi ca hai duoc cung cap (codex: doi tuong su co phai o truong caller).
drop policy if exists inc_ins on incidents;
create policy inc_ins on incidents for insert
with check (
  (select my_roles()) && array['gvcn','gvbm','to_truong','bgh','pht']
  and recorded_by = auth.uid()
  and (class_id is null or scn_class_in_school(class_id))
  and (student_id is null or scn_student_in_school(student_id))
  and (class_id is null or student_id is null or exists(
    select 1 from students s
    where s.id = incidents.student_id and s.class_id = incidents.class_id)));

-- 3) classes_write_ins: chot ban da bind tren prod (drift file-vs-prod).
drop policy if exists classes_write_ins on classes;
create policy classes_write_ins on classes for insert
with check (
  (select my_roles()) && array['bgh','admin']
  and ((select my_roles()) @> array['admin']
       or school_id = (select my_school_id())));

-- 4) nlpc_upd / nlpc_del tren competency_evaluations: nhanh evaluated_by va
-- BGH chua bind truong (cr016:577,580) - DELETE khong WHERE/RETURNING xoa
-- duoc danh gia truong khac.
drop policy if exists nlpc_upd on competency_evaluations;
create policy nlpc_upd on competency_evaluations for update
using (
  (evaluated_by = auth.uid() and scn_student_in_school(student_id))
  or ((select my_roles()) @> array['bgh'] and scn_student_in_school(student_id))
  or (select my_roles()) @> array['admin'])
with check (
  (evaluated_by = auth.uid() and scn_student_in_school(student_id))
  or ((select my_roles()) @> array['bgh'] and scn_student_in_school(student_id))
  or (select my_roles()) @> array['admin']);

drop policy if exists nlpc_del on competency_evaluations;
create policy nlpc_del on competency_evaluations for delete
using (
  (evaluated_by = auth.uid() and scn_student_in_school(student_id))
  or ((select my_roles()) @> array['bgh'] and scn_student_in_school(student_id))
  or (select my_roles()) @> array['admin']);

-- 5) task_upd / task_del: nhanh created_by chua bind truong (cr016:436,443).
drop policy if exists task_upd on tasks;
create policy task_upd on tasks for update
using (
  ((select my_roles()) @> array['gvcn'] and scn_is_my_homeroom_class(class_id))
  or ((select my_roles()) @> array['bgh'] and scn_class_in_school(class_id))
  or (select my_roles()) @> array['admin']
  or (created_by = auth.uid() and scn_class_in_school(class_id)))
with check (
  ((select my_roles()) @> array['gvcn'] and scn_is_my_homeroom_class(class_id))
  or ((select my_roles()) @> array['bgh'] and scn_class_in_school(class_id))
  or (select my_roles()) @> array['admin']
  or (created_by = auth.uid() and scn_class_in_school(class_id)));

drop policy if exists task_del on tasks;
create policy task_del on tasks for delete
using (
  ((select my_roles()) @> array['gvcn'] and scn_is_my_homeroom_class(class_id))
  or ((select my_roles()) @> array['bgh'] and scn_class_in_school(class_id))
  or (select my_roles()) @> array['admin']
  or (created_by = auth.uid() and scn_class_in_school(class_id)));
