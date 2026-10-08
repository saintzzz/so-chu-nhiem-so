-- Fixture: schema toi thieu mo phong production de chay
-- supabase/migrations/20261105_r2_security_fixes.sql +
-- 20261107_r7_substitute_role.sql + 20261108_r8_nlpc_atomic.sql +
-- 20261109_r11_atomic_writes.sql + 20261110_r12_seating_atomic.sql tren
-- Postgres thuong (khong co Supabase).
-- auth.uid() doc GUC app.uid; set role appuser de RLS co hieu luc
-- (owner/superuser bypass RLS).
create schema if not exists auth;
-- CR-038: tvc.review_material + scn_has_feature duoc migration tao lai.
create schema if not exists tvc;
create table tvc.materials(
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  author_id uuid,
  title text,
  status text,
  review_note text,
  updated_at timestamptz default now()
);
create table tvc.reviews(
  material_id uuid,
  reviewer_id uuid,
  layer int,
  status text,
  notes text
);
create table feature_grants(
  school_id uuid,
  user_id uuid,
  role text,
  feature text,
  effect text
);
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table profiles(
  id uuid primary key,
  role text not null,
  school_id uuid,
  campus_id uuid,
  department_id uuid,
  org_unit_id uuid,
  concurrent_roles text[] not null default '{}'
);
create table teacher_subjects(
  teacher_id uuid,
  subject_id uuid
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

-- R11: incidents (su co an toan) + class_roles (chuc danh ban can su lop).
-- Cot toi thieu can cho policies + test; unique key class_roles khop prod
-- (student_id, role) - mot HS mot chuc danh tai mot thoi diem qua RPC.
create table incidents(
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  class_id uuid references classes(id),
  type text,
  severity text,
  status text default 'new',
  description text,
  recorded_by uuid,
  reported_to_bgh boolean default false,
  occurred_at timestamptz,
  created_at timestamptz default now()
);
create table class_roles(
  student_id uuid references students(id),
  role text not null,
  unique (student_id, role)
);

-- R12-01: seating_charts (so do cho ngoi). month la cot date luu ngay dau
-- thang ("2026-10-01") - khop prod (QA-REPORT: query month=eq.2026-09 loi
-- 400 vi cot date). Cot toi thieu can cho RPC + policies.
create table seating_charts(
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id),
  month date,
  version int not null,
  layout jsonb,
  is_current boolean default false,
  created_at timestamptz default now(),
  -- Khop prod: unique (class_id, month, version) + toi da 1 current.
  unique (class_id, month, version)
);
create unique index seating_charts_one_current
  on seating_charts (class_id, month) where is_current;

-- R15: attendance_records (chuyen can ngay) + emulation_scores (diem thi dua).
-- Cot toi thieu can cho RPC + policies; unique (student_id, date) va
-- (class_id, criterion_id, period) khop constraint da verify tren prod.
create table attendance_records(
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  date date not null,
  status text,
  source text default 'manual',
  note text,
  created_at timestamptz default now(),
  unique (student_id, date)
);
create table emulation_criteria(
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  name text,
  max_score numeric,
  category text
);
create table emulation_scores(
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id),
  criterion_id uuid references emulation_criteria(id),
  period text,
  score numeric,
  created_at timestamptz default now(),
  unique (class_id, criterion_id, period)
);

-- Stub cac helper da co tren production (migration chi replace mot so).
create or replace function public.my_role() returns text
language sql stable security definer set search_path = 'public'
as $$ select role from profiles where id = auth.uid() $$;

-- CR-038: role chinh || concurrent_roles (stub giong prod).
create or replace function public.my_roles() returns text[]
language sql stable security definer set search_path = 'public'
as $$ select array[role]::text[] || coalesce(concurrent_roles, '{}'::text[])
     from profiles where id = auth.uid() $$;

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

-- Stub scope lop cho policies incidents/class_roles (prod defs:
-- 20260920_rls_school_tenant_scope.sql / 20260922_cr013_signoff_emulation.sql;
-- ban prod co them campus check qua scn_pht_allows_campus - migration R2
-- create or replace len ban day du, fixture giu ban don gian de create
-- policy duoc truoc khi migration chay).
create or replace function public.scn_class_in_school(cid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from classes c
     where c.id = cid and c.school_id = (select my_school_id())) $$;

create or replace function public.scn_is_my_homeroom_class(cid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from classes c
     where c.id = cid and c.gvcn_id = auth.uid()) $$;

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

-- Stub cho scn_can_write_grade (CR-038) - prod check theo teacher_subjects +
-- timetable; fixture gan theo timetable entry cua lop hoc sinh + mon.
create or replace function public.scn_i_teach_student_subject(sid uuid, subid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from students s
     join timetable_entries t on t.class_id = s.class_id
     where s.id = sid and t.teacher_id = auth.uid() and t.subject_id = subid) $$;

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

-- Stub cho es_staff_read (prod: 20261009) - migration R2 create or replace
-- len ban co campus check; policy giu binding vi OR REPLACE giu OID.
create or replace function public.my_school_class_ids() returns setof uuid
language sql stable security definer set search_path = 'public'
as $$ select id from classes where school_id = my_school_id() $$;

-- RLS on - appuser (non-owner) chiu policies; select policies giong prod.
alter table messages enable row level security;
alter table substitute_requests enable row level security;
alter table period_logs enable row level security;
alter table period_absences enable row level security;
alter table competency_evaluations enable row level security;
alter table nlpc_comments enable row level security;
alter table incidents enable row level security;
alter table class_roles enable row level security;
alter table seating_charts enable row level security;
alter table attendance_records enable row level security;
alter table emulation_scores enable row level security;

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

-- Prod: inc_* verbatim tu 20260925_cr016_role_scope.sql.
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
-- Prod co staff select policy tren incidents (khong co trong repo migrations)
-- - def nay mo phong mo hinh scope 20260920: staff cung truong qua class
-- hoac chinh nguoi ghi nhan; admin/dept xem tat. Can SELECT-visible thi
-- UPDATE/DELETE USING moi duoc danh gia tren row.
create policy inc_staff_read on incidents for select
  using (is_staff() and (scn_is_dept()
    or scn_class_in_school(class_id)
    or recorded_by = auth.uid()));

-- Prod: class_roles_staff_read verbatim tu 20261009_rls_setof_helpers_perf.sql
-- + cr2_* verbatim tu 20260925_cr016_role_scope.sql.
create policy class_roles_staff_read on public.class_roles for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
);
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

-- Prod: seat_staff_read mo phong mo hinh via-class cua 20260920
-- (scn_class_in_school - staff cung truong doc duoc; repo khong chua file
-- tao policy select nay, prod co san). seat_ins/upd/del verbatim tu
-- 20260925_cr016_role_scope.sql.
create policy seat_staff_read on seating_charts for select
  using (is_staff() and (scn_is_dept() or scn_class_in_school(class_id)));
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

-- Prod: att_staff_read verbatim tu 20261009_rls_setof_helpers_perf.sql +
-- att_ins/upd/del verbatim tu 20260925_cr016_role_scope.sql (GVCN lop CN +
-- BGH + GV ghi source='period_log' cho HS lop minh day).
create policy att_staff_read on attendance_records for select using (
  (select is_staff()) and ((select scn_is_dept())
    or student_id in (select my_school_student_ids()))
  and ((select my_role()) = any(array['gvcn','gvbm','to_truong','bgh','pht','admin','so_gd','ubnd']))
);
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

-- Prod: es_staff_read verbatim tu 20261009_rls_setof_helpers_perf.sql +
-- es_staff_ins/upd/del verbatim tu 20260922_cr013_signoff_emulation.sql
-- (GVCN chi lop CN, BGH moi lop trong truong, admin).
create policy es_staff_read on emulation_scores for select using (
  (select is_staff()) and ((select scn_is_dept())
    or class_id in (select my_school_class_ids()))
);
create policy es_staff_ins on emulation_scores for insert with check (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  )
);
create policy es_staff_upd on emulation_scores for update using (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  )
) with check (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  )
);
create policy es_staff_del on emulation_scores for delete using (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  )
);

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
-- R11: su co lop A do tA ghi nhan (test scn_incident_followup) + chuc danh
-- BCS ban dau cua HS A (test scn_set_class_role denied-rollback).
insert into incidents(id, class_id, student_id, type, severity, status, description, recorded_by, occurred_at) values
  ('b0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-00000000000a','60000000-0000-0000-0000-00000000000a','fighting','medium','new','Mo ta ban dau','20000000-0000-0000-0000-000000000001',now());
insert into class_roles(student_id, role) values
  ('60000000-0000-0000-0000-00000000000a','lop_truong');
-- R12: 2 phien ban so do lop A thang 2026-10 - v1 dang current (test save
-- tao v2 + restore lat lai); month la ngay dau thang nhu prod/seed.
insert into seating_charts(id, class_id, month, version, layout, is_current) values
  ('c0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-00000000000a','2026-10-01',1,'{"cols":8,"rows":5,"seats":[]}'::jsonb,true),
  ('c0000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-00000000000a','2026-10-01',2,'{"cols":8,"rows":5,"seats":[{"x":0,"y":0,"student_id":"60000000-0000-0000-0000-00000000000a"}]}'::jsonb,false);
-- R15: row period_log cho stuA ngay 2026-11-05 (test manual save giu source)
-- + tieu chi thi dua truong A (3) / truong B (1) + 2 diem ky 2026-T11
-- (critA=10 update, critA2=8 delete trong test mixed-ops).
insert into attendance_records(student_id, date, status, source, note) values
  ('60000000-0000-0000-0000-00000000000a','2026-11-05','unexcused','period_log','tu so dau bai');
insert into emulation_criteria(id, school_id, name, max_score, category) values
  ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','Chuyen can',30,'nep'),
  ('d0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000a','Hoc tap',30,'hoc_tap'),
  ('d0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-00000000000a','Ve sinh',20,'nep'),
  ('d0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-00000000000b','Chuyen can B',30,'nep');
insert into emulation_scores(class_id, criterion_id, period, score) values
  ('30000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-000000000001','2026-T11',10),
  ('30000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-000000000002','2026-T11',8);

-- CR-035: lesson_plans toi thieu (schema gan giong prod) de test cot
-- content_json jsonb duoc them boi migration 20261112.
create table lesson_plans(
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  teacher_id uuid,
  class_id uuid,
  subject_id uuid,
  week int,
  periods text,
  title text,
  content text,
  file_path text,
  file_name text,
  status text default 'submitted',
  review_note text,
  team_reviewed_by uuid,
  reviewed_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CR-038: probe policy viet dang scalar-subquery -> Postgres deparse ra
-- ( SELECT ( SELECT my_role() ...) ...) (double-wrap) de test rewrite loop.
create table if not exists public.cr038_wrap_probe (id int primary key, note text);
alter table public.cr038_wrap_probe enable row level security;
create policy wrap_probe_a on public.cr038_wrap_probe for select
  using ((select my_role()) = 'gvcn');
create policy wrap_probe_b on public.cr038_wrap_probe for select
  using ((select (select my_role())) in ('bgh','admin'));
