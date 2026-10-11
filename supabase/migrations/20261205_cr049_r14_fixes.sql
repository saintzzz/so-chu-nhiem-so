-- CR-049 r14 (codex r14): dept_meetings BGH global + scn_is_dept_head
-- thieu bind truong hien tai + grade_book_state read qua rong.

-- 1) scn_is_dept_head: department phai o TRUONG HIEN TAI cua caller.
-- Truoc day chi check p.department_id = did - profile chuyen truong nhung
-- con FK department cu van duoc cap quyen to truong truong cu.
create or replace function public.scn_is_dept_head(did uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists(
    select 1 from profiles p
    where p.id = auth.uid() and p.department_id = did
      and (p.role = 'to_truong' or 'to_truong' = any(p.concurrent_roles)))
    and scn_dept_in_school(did)
$$;

-- 2) dept_meetings: tach admin global; BGH phai cung truong voi
-- department; nhanh to_truong da bind qua helper (1).
drop policy if exists dm_ins on dept_meetings;
create policy dm_ins on dept_meetings for insert
with check (
  scn_is_dept_head(department_id)
  or (select my_roles()) @> array['admin']
  or ((select my_roles()) @> array['bgh'] and scn_dept_in_school(department_id)));

drop policy if exists dm_upd on dept_meetings;
create policy dm_upd on dept_meetings for update
using (
  scn_is_dept_head(department_id)
  or (select my_roles()) @> array['admin']
  or ((select my_roles()) @> array['bgh'] and scn_dept_in_school(department_id)))
with check (
  scn_is_dept_head(department_id)
  or (select my_roles()) @> array['admin']
  or ((select my_roles()) @> array['bgh'] and scn_dept_in_school(department_id)));

drop policy if exists dm_del on dept_meetings;
create policy dm_del on dept_meetings for delete
using (
  scn_is_dept_head(department_id)
  or (select my_roles()) @> array['admin']
  or ((select my_roles()) @> array['bgh'] and scn_dept_in_school(department_id)));

-- 3) grade_book_state_read: is_staff() global -> staff chi doc revision
-- cua lop thuoc truong minh. scope_key = subject|term|year|class (seg 4).
drop policy if exists grade_book_state_read on grade_book_state;
create policy grade_book_state_read on grade_book_state for select
using (
  (select my_roles()) @> array['admin']
  or (is_staff() and scn_class_in_school((split_part(scope_key, '|', 4))::uuid)));
