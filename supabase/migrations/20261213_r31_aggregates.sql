-- r31: aggregate RPCs thay fetchAllRows cho so lieu thong ke.
-- /school/dashboard crash tren prod: fetchAllRows OFFSET-page ~10k+
-- attendance_records + join students!inner -> statement timeout.
-- /records/report broken ngam: .in(student_id, ~360 uuid) lam URL
-- >8KB -> PostgREST fail -> trang hien banner thieu du lieu.
-- /dept/reports cung pattern (risk tiep theo).
--
-- Tat ca function SECURITY INVOKER: RLS ap dung y het query thuong,
-- khong can role-check rieng va fail-closed mac dinh.

-- Tong hop chuyen can theo LOP trong cua so ngay: /dept/reports +
-- /records/report. Loc date o server de index (student_id,date) dung.
create or replace function public.scn_attendance_by_class_window(
  p_class_ids uuid[],
  p_from date default '0001-01-01'
)
returns table(class_id uuid, total bigint, present bigint, absent bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.class_id,
         count(*)::bigint,
         count(*) filter (where ar.status in ('present','late'))::bigint,
         count(*) filter (where ar.status in ('excused','unexcused'))::bigint
  from public.attendance_records ar
  join public.students s on s.id = ar.student_id
  where s.class_id = any(p_class_ids)
    and ar.date >= p_from
  group by s.class_id;
$$;

-- So vi pham theo LOP: /records/report.
create or replace function public.scn_class_conduct_counts(p_class_ids uuid[])
returns table(class_id uuid, violations bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.class_id, count(*)::bigint
  from public.conduct_records cr
  join public.students s on s.id = cr.student_id
  where cr.type = 'vi_pham'
    and s.class_id = any(p_class_ids)
  group by s.class_id;
$$;

-- Tong hop chuyen can theo HOC SINH trong cua so ngay: /records/students
-- (1 lop -> ids nho, nhung rows khong gioi han -> aggregate server-side).
create or replace function public.scn_attendance_by_student_window(
  p_student_ids uuid[],
  p_from date default '0001-01-01'
)
returns table(student_id uuid, total bigint, attended bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select ar.student_id,
         count(*)::bigint,
         count(*) filter (where ar.status in ('present','late'))::bigint
  from public.attendance_records ar
  where ar.student_id = any(p_student_ids)
    and ar.date >= p_from
  group by ar.student_id;
$$;

-- Chan anon goi truc tiep (authenticated qua RLS van bi scope dung).
revoke execute on function public.scn_attendance_by_class_window(uuid[], date) from anon, public;
revoke execute on function public.scn_class_conduct_counts(uuid[]) from anon, public;
revoke execute on function public.scn_attendance_by_student_window(uuid[], date) from anon, public;
grant execute on function public.scn_attendance_by_class_window(uuid[], date) to authenticated;
grant execute on function public.scn_class_conduct_counts(uuid[]) to authenticated;
grant execute on function public.scn_attendance_by_student_window(uuid[], date) to authenticated;
