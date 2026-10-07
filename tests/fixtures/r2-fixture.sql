-- Fixture: schema toi thieu mo phong production de chay
-- supabase/migrations/20261105_r2_security_fixes.sql +
-- 20261107_r7_substitute_role.sql + 20261108_r8_nlpc_atomic.sql tren
-- Postgres thuong (khong co Supabase). auth.uid() doc GUC app.uid;
-- set role appuser de RLS co hieu luc (owner/superuser bypass RLS).
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table profiles(
  id uuid primary key,
  role text not null,
  school_id uuid,
  campus_id uuid
);
create table classes(
  id uuid primary key,
  school_id uuid not null,
  campus_id uuid,
  gvcn_id uuid,
  name text
);
create table subjects(
  id uuid primary key,
  school_id uuid not null,
  name text
);
create table students(
  id uuid primary key,
  class_id uuid references classes(id),
  profile_id uuid,
  full_name text
);
create table parents(
  id uuid primary key,
  profile_id uuid
);
create table parent_students(
  parent_id uuid references parents(id),
  student_id uuid references students(id)
);
create table timetable_entries(
  id uuid primary key,
  class_id uuid references classes(id),
  subject_id uuid references subjects(id),
  teacher_id uuid,
  period int
);
create table substitute_requests(
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  class_id uuid references classes(id),
  subject_id uuid references subjects(id),
  period int,
  date date,
  absent_teacher_id uuid,
  substitute_teacher_id uuid,
  requested_by uuid,
  status text default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  reason text,
  note text,
  created_at timestamptz default now()
);
create table messages(
  id uuid primary key default gen_random_uuid(),
  sender_id uuid,
  recipient_id uuid,
  student_id uuid,
  content text,
  read_at timestamptz,
  created_at timestamptz default now()
);
create table period_logs(
  id uuid primary key default gen_random_uuid(),
  timetable_entry_id uuid references timetable_entries(id),
  date date,
  logged_by uuid
);
create table period_absences(
  id uuid primary key default gen_random_uuid(),
  period_log_id uuid references period_logs(id),
  student_id uuid,
  status text
);
-- R8-02: NLPC (danh gia nang luc/pham chat tieu hoc). competency_evaluations
-- co id; nlpc_comments khong co cot id nhu prod.
create table competency_evaluations(
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  term text,
  attribute_code text,
  level text,
  evaluated_by uuid,
  created_at timestamptz default now()
);
create table nlpc_comments(
  student_id uuid references students(id),
  term text,
  grp text,
  comment text,
  evaluated_by uuid,
  created_at timestamptz default now()
);

-- Stub cac helper da co tren production (migration chi replace mot so).
create or replace function public.my_role() returns text
language sql stable security definer set search_path = 'public'
as $$ select role from profiles where id = auth.uid() $$;

create or replace function public.my_school_id() returns uuid
language sql stable security definer set search_path = 'public'
as $$ select school_id from profiles where id = auth.uid() $$;

create or replace function public.is_school_staff() returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from profiles p where p.id = auth.uid()
     and p.role in ('gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin')) $$;

create or replace function public.scn_is_my_ttentry(tid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from timetable_entries t
     where t.id = tid and t.teacher_id = auth.uid()) $$;

-- Stub helper homeroom (prod def: 20260924_cr015_grades_scope.sql) - can cho
-- policies NLPC.
create or replace function public.scn_student_in_my_homeroom(sid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from students s join classes c on c.id = s.class_id
     where s.id = sid and c.gvcn_id = auth.uid()) $$;

-- Stub scope helpers can cho NLPC policies (prod defs: 20260920/20260924) -
-- migration R2 create or replace len ban co campus/substitute check.
create or replace function public.scn_student_in_school(sid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from students s join classes c on c.id = s.class_id
     where s.id = sid and c.school_id = (select my_school_id())) $$;

create or replace function public.scn_student_in_my_teaching(sid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from students s
     join timetable_entries t on t.class_id = s.class_id
     where s.id = sid and t.teacher_id = auth.uid()) $$;

-- Stub them cho SELECT policies giong prod (UPDATE/DELETE can row SELECT-
-- visible truoc khi USING duoc danh gia).
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from profiles p where p.id = auth.uid()
     and p.role in ('gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin')) $$;

create or replace function public.scn_is_dept() returns boolean
language sql stable security definer set search_path = 'public'
as $$ select (select role from profiles where id = auth.uid()) = 'admin' $$;

create or replace function public.my_student_ids() returns setof uuid
language sql stable security definer set search_path = 'public'
as $$ select s.id from students s
     join parent_students ps on ps.student_id = s.id
     join parents p on p.id = ps.parent_id
     where p.profile_id = auth.uid() $$;

-- Stub don gian (khong campus) - migration se create or replace len ban
-- co campus check; policy giu binding vi OR REPLACE giu OID.
create or replace function public.my_school_ttentry_ids() returns setof uuid
language sql stable security definer set search_path = 'public'
as $$ select t.id from timetable_entries t join classes c on c.id = t.class_id
     where c.school_id = my_school_id() $$;

create or replace function public.my_school_student_ids() returns setof uuid
language sql stable security definer set search_path = 'public'
as $$ select s.id from students s join classes c on c.id = s.class_id
     where c.school_id = my_school_id() $$;

-- RLS on - appuser (non-owner) chiu policies; select policies giong prod.
alter table messages enable row level security;
alter table substitute_requests enable row level security;
alter table period_logs enable row level security;
alter table period_absences enable row level security;
alter table competency_evaluations enable row level security;
alter table nlpc_comments enable row level security;

create policy msg_own on messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Prod: sub_staff_read
create policy sub_staff_read on substitute_requests for select
  using (is_staff() and (scn_is_dept() or school_id = my_school_id()));

-- Prod: pl_staff_read / pa_staff_read (family read bo qua - khong can cho test)
create policy pl_staff_read on period_logs for select
  using (is_staff() and (scn_is_dept() or timetable_entry_id in (select my_school_ttentry_ids())));
create policy pa_staff_read on period_absences for select
  using (is_staff() and (scn_is_dept() or student_id in (select my_school_student_ids())));
create policy pl_family on period_logs for select
  using (timetable_entry_id in (select t.id from timetable_entries t
         where t.class_id in (select s.class_id from students s
           where s.id in (select my_student_ids()))));
create policy pa_family on period_absences for select
  using (student_id in (select my_student_ids()));

-- Prod: nlpc_staff_read (20261009) + baseline via student_id (20260920) cho
-- nlpc_comments; ins/upd/del theo 20260925_cr016_role_scope.sql.
create policy nlpc_staff_read on competency_evaluations for select
  using (is_staff() and (scn_is_dept()
    or student_id in (select my_school_student_ids())));
create policy nlpc_cmt_staff_read on nlpc_comments for select
  using (is_staff() and (scn_is_dept()
    or student_id in (select my_school_student_ids())));
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

create role appuser nologin;
-- Role authenticated ton tai tren Supabase prod - migration grant execute vao
-- role nay; fixture can no de chay migration verbatim.
create role authenticated nologin;
grant usage on schema public, auth to appuser;
grant select, insert, update, delete on all tables in schema public to appuser;

-- ===== SEED =====
-- school A: 1000...0a | school B: 1000...0b
insert into classes(id, school_id, campus_id, name) values
  ('30000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','6A'),
  ('30000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','50000000-0000-0000-0000-000000000002','6B');
insert into profiles(id, role, school_id, campus_id) values
  ('20000000-0000-0000-0000-000000000001','gvcn','10000000-0000-0000-0000-00000000000a',null),        -- tA: GVCN lop cA
  ('20000000-0000-0000-0000-000000000002','gvcn','10000000-0000-0000-0000-00000000000b',null),        -- tB: GVCN truong B
  ('20000000-0000-0000-0000-000000000003','bgh','10000000-0000-0000-0000-00000000000a',null),         -- bghA
  ('20000000-0000-0000-0000-000000000004','pht','10000000-0000-0000-0000-00000000000a',null),         -- pht0: campus NULL (fail-closed test)
  ('20000000-0000-0000-0000-000000000005','gvbm','10000000-0000-0000-0000-00000000000a',null),        -- subA: GV day thay
  ('20000000-0000-0000-0000-000000000006','phu_huynh',null,null),                                     -- phA
  ('20000000-0000-0000-0000-000000000007','to_truong','10000000-0000-0000-0000-00000000000a',null);   -- ttA: R10 to_truong -> gvbm deep-link
update classes set gvcn_id='20000000-0000-0000-0000-000000000001' where id='30000000-0000-0000-0000-00000000000a';
insert into subjects(id, school_id, name) values
  ('40000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','Toan A'),
  ('40000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','Toan B'),
  ('40000000-0000-0000-0000-00000000000c','10000000-0000-0000-0000-00000000000a','Ly A');
insert into students(id, class_id, full_name) values
  ('60000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','HS A'),
  ('60000000-0000-0000-0000-00000000000b','30000000-0000-0000-0000-00000000000b','HS B');
insert into parents(id, profile_id) values
  ('70000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000006');
insert into parent_students(parent_id, student_id) values
  ('70000000-0000-0000-0000-00000000000a','60000000-0000-0000-0000-00000000000a');
insert into timetable_entries(id, class_id, subject_id, teacher_id, period) values
  ('80000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001',1),
  -- ttA2/ttA3: entry tach biet cho test NULL-subject (khong bi shadow boi
  -- phan cong exact-subject khac) va positive control.
  ('80000000-0000-0000-0000-00000000000b','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',2),
  ('80000000-0000-0000-0000-00000000000c','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',3);
-- Tin nhan tA -> phA ve HS A
insert into messages(id, sender_id, recipient_id, student_id, content) values
  ('90000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','60000000-0000-0000-0000-00000000000a','xin chao');
-- Phan cong day thay hop le: subA day mon subjA lop cA tiet 1 hom nay
insert into substitute_requests(id, school_id, class_id, subject_id, period, date, absent_teacher_id, substitute_teacher_id, requested_by, status, decided_by, decided_at) values
  ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000a',1,current_date,'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','approved','20000000-0000-0000-0000-000000000003',now()),
  -- Ngay tuong lai (khong duoc cap quyen ghi log)
  ('a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000a',1,current_date + 5,'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','approved','20000000-0000-0000-0000-000000000003',now()),
  -- Khong chi dinh mon (khong duoc wildcard)
  ('a0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a',null,1,current_date,'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','approved','20000000-0000-0000-0000-000000000003',now()),
  -- NULL-subject request tren period rieng (ttA2) - scenario isolated:
  -- khong co request exact-subject nao khac cho ttA2 hom nay.
  ('a0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a',null,2,current_date,'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','approved','20000000-0000-0000-0000-000000000003',now()),
  -- Positive control: exact-subject request cho ttA3 cung lop, cung ngay.
  ('a0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000c',3,current_date,'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','approved','20000000-0000-0000-0000-000000000003',now()),
  -- Round-3: request da duyet nhung CHUA phan cong GV (duyet "phan cong sau")
  -- cho test assignSubstitute.
  ('a0000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000a',5,current_date,'20000000-0000-0000-0000-000000000001',null,'20000000-0000-0000-0000-000000000003','approved','20000000-0000-0000-0000-000000000003',now());
