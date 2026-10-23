-- CR-053: Hoc ba so - quyet dinh tong ket cuoi nam (xep loai KQHT/KQRL,
-- danh hieu, xet len lop) + luong GVCN trinh -> BGH duyet -> khoa so.
-- Spec: docs/project/CR-053-architecture.md (rev 3, Tech Lead approved).

-- ============================================================
-- 0) Backfill: lop legacy thieu academic_year_id gan ve nam hien tai
--    cua truong; truong chua co nam hoc nao thi tao nam hien tai.
-- ============================================================
insert into public.academic_years (school_id, name, start_date, end_date, is_current)
select s.id, '2026-2027', '2026-08-05', '2027-05-31', true
  from public.schools s
 where not exists (select 1 from public.academic_years y where y.school_id = s.id);

update public.classes c
   set academic_year_id = (
     select y.id from public.academic_years y
      where y.school_id = c.school_id and y.is_current limit 1)
 where c.academic_year_id is null;

-- ============================================================
-- 1) Table
-- ============================================================
create table public.year_end_decisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  stage text not null default 'initial'
    check (stage in ('initial','after_retest','after_summer')),
  kqht text check (kqht in ('tot','kha','dat','chua_dat')),
  kqrl text check (kqrl in ('tot','kha','dat','chua_dat')),
  danh_hieu text check (danh_hieu in ('xuat_sac','gioi')),
  giay_khen_note text,
  promotion text check (promotion in ('len_lop','kiem_tra_danh_gia_lai','ren_luyen_he','o_lai')),
  override_legal_ground text
    check (override_legal_ground in ('tt22_9_3','danh_gia_lai','hs_khuyet_tat','mien_mon')),
  override_note text,
  exempt_subject_ids uuid[] not null default '{}',
  computed_snapshot jsonb,
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','rejected','locked')),
  reject_reason text,
  revision int not null default 1,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id, stage),
  check (status <> 'rejected' or (reject_reason is not null and char_length(btrim(reject_reason)) >= 10)),
  check (override_legal_ground is null or (override_note is not null and btrim(override_note) <> ''))
);

create index year_end_decisions_school_idx on public.year_end_decisions (school_id, academic_year_id);
create index year_end_decisions_student_idx on public.year_end_decisions (student_id);

alter table public.year_end_decisions enable row level security;
revoke all on public.year_end_decisions from anon;
revoke delete on public.year_end_decisions from authenticated;

-- ============================================================
-- 2) RLS - explicit role-set qua my_roles() (concurrent roles),
--    KHONG is_staff() (gom gvbm/to_truong/ke_toan/admin -> leak).
-- ============================================================
create policy yed_gvcn_read on public.year_end_decisions for select
  using ((select public.my_roles()) @> array['gvcn']
         and public.scn_student_in_my_homeroom(student_id));

create policy yed_bgh_read on public.year_end_decisions for select
  using ((select public.my_roles()) @> array['bgh']
         and school_id = (select public.my_school_id()));

-- PHT campus-scoped qua scn_student_in_school (scn_pht_allows_campus) -
-- khop RLS cac bang bundle (students/grades/conduct/...), tranh leak
-- quyet dinh cua phan hieu khac.
create policy yed_pht_read on public.year_end_decisions for select
  using ((select public.my_roles()) @> array['pht']
         and public.scn_student_in_school(student_id));

-- Dept doc: role TUONG MINH (admin khong khop), UBND chi truong trong
-- xa/phuong minh qua org_units subtree.
create policy yed_dept_read on public.year_end_decisions for select
  using ((select public.my_roles()) && array['so_gd','ubnd']
         and school_id in (select public.scn_my_scope_school_ids()));

create policy yed_gvcn_ins on public.year_end_decisions for insert
  with check ((select public.my_roles()) @> array['gvcn']
    and public.scn_student_in_my_homeroom(student_id)
    and school_id = (select public.my_school_id())
    and status in ('draft','submitted')
    and approved_by is null and approved_at is null
    and reject_reason is null and giay_khen_note is null);

create policy yed_gvcn_upd on public.year_end_decisions for update
  using ((select public.my_roles()) @> array['gvcn']
    and public.scn_student_in_my_homeroom(student_id)
    and status in ('draft','rejected'))
  with check (status in ('draft','rejected','submitted'));

create policy yed_bgh_upd on public.year_end_decisions for update
  using ((select public.my_roles()) @> array['bgh']
    and school_id = (select public.my_school_id())
    and status in ('submitted','approved'))
  with check (status in ('approved','rejected','locked'));
-- DELETE: khong policy nao -> deny hoan toan.

-- ============================================================
-- 3) Trigger guard: state machine + field ownership + stage prereq
--    + tenant consistency + actor binding.
-- ============================================================
create or replace function public.scn_yed_guard()
returns trigger language plpgsql security definer
set search_path = 'public' as
$$
declare
  is_gvcn boolean := (select public.my_roles()) @> array['gvcn']::text[];
  is_bgh boolean := (select public.my_roles()) @> array['bgh']::text[];
begin
  -- Trigger lock tu register_signoffs + service role duoc bypass.
  if pg_trigger_depth() > 1 or (select auth.jwt()->>'role') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Stage prerequisite: chi tao duoc stage sau khi stage truoc
    -- approved/locked voi promotion cho phep; moi stage toi da 1 lan.
    if new.stage = 'after_summer' then
      if not exists (
        select 1 from public.year_end_decisions d
         where d.student_id = new.student_id
           and d.academic_year_id = new.academic_year_id
           and d.stage = 'initial'
           and d.status in ('approved','locked')
           and d.promotion = 'ren_luyen_he'
      ) then
        raise exception 'after_summer requires approved initial with ren_luyen_he'
          using errcode = 'P0001';
      end if;
    elsif new.stage = 'after_retest' then
      if not exists (
        select 1 from public.year_end_decisions d
         where d.student_id = new.student_id
           and d.academic_year_id = new.academic_year_id
           and d.status in ('approved','locked')
           and d.promotion = 'kiem_tra_danh_gia_lai'
      ) then
        raise exception 'after_retest requires approved decision with kiem_tra_danh_gia_lai'
          using errcode = 'P0001';
      end if;
      if exists (
        select 1 from public.year_end_decisions d
         where d.student_id = new.student_id
           and d.academic_year_id = new.academic_year_id
           and d.stage = 'after_retest'
      ) then
        raise exception 'after_retest already exists' using errcode = 'P0001';
      end if;
    elsif new.stage <> 'initial' then
      raise exception 'invalid stage' using errcode = 'P0001';
    end if;

    -- Tenant: HS phai thuoc lop cung truong + cung nam hoc.
    if not exists (
      select 1 from public.students s
        join public.classes c on c.id = s.class_id
       where s.id = new.student_id
         and c.school_id = new.school_id
         and c.academic_year_id = new.academic_year_id
    ) then
      raise exception 'student/class/tenant mismatch' using errcode = 'P0001';
    end if;

    new.decided_by := auth.uid();
    new.decided_at := coalesce(new.decided_at, now());
    return new;
  end if;

  -- UPDATE: immutable keys
  if new.student_id is distinct from old.student_id
     or new.school_id is distinct from old.school_id
     or new.academic_year_id is distinct from old.academic_year_id
     or new.stage is distinct from old.stage then
    raise exception 'immutable decision keys' using errcode = 'P0001';
  end if;

  -- Transition matrix
  if not (
    (old.status = 'draft' and new.status in ('draft','submitted'))
    or (old.status = 'rejected' and new.status in ('rejected','submitted'))
    or (old.status = 'submitted' and new.status in ('approved','rejected'))
    -- approved->locked CHI qua trg_lock_yed (depth>1 da bypass o tren) -
    -- toi day tuc la BGH update truc tiep -> chan.
  ) then
    raise exception 'invalid status transition % -> %', old.status, new.status
      using errcode = 'P0001';
  end if;

  if old.status in ('draft','rejected') then
    -- Path GVCN: cam doi cot cua BGH; refresh decided_* theo actor.
    if new.giay_khen_note is distinct from old.giay_khen_note
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at then
      raise exception 'gvcn cannot touch approval fields' using errcode = 'P0001';
    end if;
    if not is_gvcn then
      raise exception 'draft/rejected edits require gvcn' using errcode = '42501';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
    if new.status = 'submitted' and old.status = 'rejected' then
      new.revision := old.revision + 1;
      new.reject_reason := null;
      new.approved_by := null;
      new.approved_at := null;
    end if;
    if new.status = 'submitted' and old.status = 'draft' then
      new.reject_reason := null;
    end if;
    return new;
  end if;

  -- Path BGH (old submitted|approved): BGH chi doi status + cot duyet,
  -- KHONG duoc sua ket qua GVCN da trinh.
  if not is_bgh then
    raise exception 'approval path requires bgh' using errcode = '42501';
  end if;
  if new.kqht is distinct from old.kqht
     or new.kqrl is distinct from old.kqrl
     or new.danh_hieu is distinct from old.danh_hieu
     or new.promotion is distinct from old.promotion
     or new.override_legal_ground is distinct from old.override_legal_ground
     or new.override_note is distinct from old.override_note
     or new.exempt_subject_ids is distinct from old.exempt_subject_ids
     or new.computed_snapshot is distinct from old.computed_snapshot
     or new.revision is distinct from old.revision then
    raise exception 'bgh cannot modify gvcn decision fields' using errcode = 'P0001';
  end if;
  if new.status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.reject_reason := null;
  elsif new.status = 'rejected' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists trg_yed_guard on public.year_end_decisions;
create trigger trg_yed_guard
before insert or update on public.year_end_decisions
for each row execute function public.scn_yed_guard();

-- ============================================================
-- 4) Lock linkage: register_signoffs la PER-CLASS; khi BGH khoa
--    so_hoc_ba cua 1 lop -> khoa moi quyet dinh approved cua lop do
--    trong nam hoc cua lop (lock-records-client update truc tiep).
-- ============================================================
create or replace function public.scn_lock_year_end_decisions()
returns trigger language plpgsql security definer
set search_path = 'public' as
$$
begin
  if new.type = 'so_hoc_ba' and new.status = 'locked'
     and old.status is distinct from 'locked' then
    update public.year_end_decisions d
       set status = 'locked', updated_at = now()
     where d.status = 'approved'
       and d.student_id in (
         select s.id from public.students s where s.class_id = new.class_id)
       and d.academic_year_id = (
         select c.academic_year_id from public.classes c where c.id = new.class_id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_lock_yed on public.register_signoffs;
create trigger trg_lock_yed
after update of status on public.register_signoffs
for each row execute function public.scn_lock_year_end_decisions();

-- ============================================================
-- 5) Dept (so_gd/ubnd) read access cho bundle hoc ba.
--    is_staff()/scn_is_edu_staff() KHONG gom so_gd/ubnd -> cac
--    *_staff_read policy chan dept. Them policy rieng goc vao
--    my_roles() + scope helpers (org subtree qua scn_my_scope_*).
-- ============================================================
create policy classes_dept_read on public.classes for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and school_id in (select public.scn_my_scope_school_ids()));

create policy students_dept_read on public.students for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and class_id in (select public.scn_my_scope_class_ids()));

create policy years_dept_read on public.academic_years for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and school_id in (select public.scn_my_scope_school_ids()));

create policy subjects_dept_read on public.subjects for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and school_id in (select public.scn_my_scope_school_ids()));

create policy att_dept_read on public.attendance_records for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and student_id in (select public.scn_my_scope_student_ids()));

create policy ce_dept_read on public.conduct_evaluations for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and student_id in (select public.scn_my_scope_student_ids()));

create policy nlpc_dept_read on public.competency_evaluations for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and student_id in (select public.scn_my_scope_student_ids()));

create policy nlpc_cmt_dept_read on public.nlpc_comments for select
  using ((select public.my_roles()) && array['so_gd','ubnd']::text[]
         and public.scn_student_in_scope(student_id));
