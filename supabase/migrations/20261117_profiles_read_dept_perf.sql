-- QA perf finding: /dept/usage ~3s warm TTFB.
-- Nguyen nhan kep:
-- 1. profiles_family_read + nhanh family trong profiles_read danh gia
--    EXISTS correlated (students x classes x timetable) CHO MOI row
--    profiles voi moi caller, ke ca caller khong lien ket HS (so_gd...).
-- 2. Bug tien ton: is_staff() khong chua 'so_gd'/'ubnd' nen nhanh
--    `is_staff() AND scn_is_dept()` khong bao gio khop -> so_gd chi thay
--    chinh minh, /dept/usage dem 0 tai khoan moi truong.
-- Fix: dua scn_is_dept() ra nhanh uncorrelated rieng; family EXISTS
-- chi danh gia khi caller la hoc_sinh/phu_huynh (CASE gate).

drop policy if exists profiles_family_read on public.profiles;
create policy profiles_family_read on public.profiles for select using (
  case when (select public.my_role()) in ('hoc_sinh','phu_huynh') then
    exists (
      select 1
      from students s
      join classes c on c.id = s.class_id
      where (
        s.profile_id = (select auth.uid())
        or exists (
          select 1 from parent_students ps
          join parents pa on pa.id = ps.parent_id
          where ps.student_id = s.id and pa.profile_id = (select auth.uid())
        )
      )
      and (
        c.gvcn_id = profiles.id
        or exists (
          select 1 from timetable_entries t
          where t.class_id = c.id and t.teacher_id = profiles.id
        )
      )
    )
  else false end
);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = (select auth.uid())
  or (select public.scn_is_dept())
  or (
    (select public.is_staff())
    and (
      public.scn_profile_visible(id)
      or case when (select public.my_role()) in ('hoc_sinh','phu_huynh') then
        exists (
          select 1
          from students s
          join classes c on c.id = s.class_id
          where (
            s.profile_id = (select auth.uid())
            or exists (
              select 1 from parent_students ps
              join parents pa on pa.id = ps.parent_id
              where ps.student_id = s.id and pa.profile_id = (select auth.uid())
            )
          )
          and (
            c.gvcn_id = profiles.id
            or exists (
              select 1 from timetable_entries t
              where t.class_id = c.id and t.teacher_id = profiles.id
            )
          )
        )
      else false end
    )
  )
);
