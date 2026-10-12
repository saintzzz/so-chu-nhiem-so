-- CR-049 r28: bypass link noi bo bang backslash + derived-column writable.
-- r28 review: '/\evil.example/login' qua ca policy ^/+!^// lan client
-- startsWith("/") vi URL parser chuan hoa \ -> / thanh //host (external).
-- students.positive_points la cot dan xuat tu conduct_records nhung
-- authenticated van UPDATE truc tiep duoc -> pha tong diem.

-- ============================================================
-- 1) notif_ins: whitelist ky tu link thay vi blacklist dau.
--    Chi ASCII route chars - backslash, whitespace, control, ky tu
--    khac deu bi tu choi. PH/HS van chi appointment/message.
-- ============================================================
drop policy if exists notif_ins on public.notifications;
create policy notif_ins on public.notifications for insert
  with check (
    public.scn_profile_in_school(profile_id)
    and (
      link is null
      or (
        link ~ '^/[a-zA-Z0-9_/?=&%#.~:+-]*$'
        and link !~ '^//'
      )
    )
    and (
      is_school_staff()
      or (
        my_role() in ('phu_huynh','hoc_sinh')
        and type in ('appointment','message')
      )
    )
  );

-- ============================================================
-- 2) students.positive_points la cot DAN XUAT (trg_sync_positive_
--    points cong/tru tu conduct_records). Column-grant KHONG hoat
--    dong vi authenticated co table-level UPDATE (Postgres OR ca
--    hai quyen) -> dung trigger guard: chan thay doi truc tiep o
--    depth 1, cho phep cap nhat tu trigger sync (depth 2), va
--    cho phep service_role/postgres bao tri (backfill).
-- ============================================================
create or replace function public.scn_guard_derived_student_points()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_role in ('service_role','postgres','supabase_admin')
     or pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.positive_points is distinct from old.positive_points then
    raise exception 'positive_points la cot dan xuat - chi cap nhat qua conduct_records';
  end if;
  if tg_op = 'INSERT' and new.positive_points <> 0 then
    raise exception 'positive_points la cot dan xuat - khong duoc set khi insert';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_student_positive_points on public.students;
create trigger trg_guard_student_positive_points
before insert or update on public.students
for each row execute function public.scn_guard_derived_student_points();
