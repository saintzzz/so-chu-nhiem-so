-- CR-049 r23: idempotent announce marker cho hoat dong.
-- Dedupe cu bang (sender_id, class_id, title) chan nham hoat dong khac
-- cung ten va khong theo doi duoc trang thai email -> retry gui lai
-- announcement/email hoac khong bao gio gui lai email that bai.
-- Marker theo activity_id (PK) = atomic claim; email_done tach trang thai
-- luu announcement khoi trang thai delivery de retry chi chay phan loi.

create table if not exists public.activity_announcements (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  announcement_id uuid references public.announcements(id),
  school_id uuid references public.schools(id),
  -- email_done = true khi: khong co nguoi nhan, emailSkipped (chua cau
  -- hinh) hoac da gui duoc it nhat 1 email. Chi retry khi CHUA gui duoc
  -- gi (lookup/provider loi) - resend toan batch khi da gui duoc mot phan
  -- se spam nguoi nhan thanh cong.
  email_done boolean not null default false,
  emailed integer not null default 0,
  email_failed integer not null default 0,
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activity_announcements enable row level security;

create policy aa_staff_all on public.activity_announcements
  for all to authenticated
  using (public.is_staff() and school_id = public.my_school_id())
  with check (public.is_staff() and school_id = public.my_school_id());
