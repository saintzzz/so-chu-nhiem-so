-- External Review Loop - Round 3 security fixes (da apply len prod).
-- R3-01 [HIGH] PHT duoc them vao nhanh quan ly nhan su o r2 -> co the
-- cap 'bgh' cho nguoi khac (ke ca khac campus) va demote admin. Thu hep:
-- chi BGH (admin toan cuc da qua o nhanh tren), target hien tai phai la
-- nhan su truong (khong cham admin/so_gd/ubnd), va cap lai policies cho khu.
create or replace function public.profiles_no_priv_escalation() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_actor text[];
  v_jwt_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  if v_jwt_role = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.school_id is distinct from old.school_id
     or new.concurrent_roles is distinct from old.concurrent_roles
     or new.campus_id is distinct from old.campus_id
     or new.department_id is distinct from old.department_id
     or new.org_unit_id is distinct from old.org_unit_id then
    select array[p.role]::text[] || coalesce(p.concurrent_roles, '{}'::text[])
      into v_actor from public.profiles p where p.id = auth.uid();
    if coalesce(v_actor, '{}'::text[]) && array['admin'::text] then
      return new;
    end if;
    -- Chi BGH quan ly nhan su trong truong minh. PHT khong nam trong
    -- danh sach: pht->bgh la leo thang, va pht co the cham ho so khac
    -- campus. Target hien tai phai la role nhan su truong - khong cho
    -- school-manager cham tai khoan admin/so_gd/ubnd.
    if not (
      coalesce(v_actor, '{}'::text[]) && array['bgh']::text[]
      and new.id is distinct from auth.uid()
      and old.role = any(array['gvcn','gvbm','to_truong','pht','ke_toan','bgh'])
      and old.school_id is not null
      and new.school_id is not distinct from old.school_id
      and old.school_id = (select p.school_id from public.profiles p where p.id = auth.uid())
      and new.org_unit_id is not distinct from old.org_unit_id
      and new.role = any(array['gvcn','gvbm','to_truong','pht','ke_toan','bgh'])
      and new.concurrent_roles <@ array['gvcn','gvbm','to_truong','pht','bgh']::text[]
      and (new.campus_id is null or exists(
            select 1 from public.campuses c
             where c.id = new.campus_id and c.school_id = old.school_id))
      and (new.department_id is null or exists(
            select 1 from public.departments d
             where d.id = new.department_id and d.school_id = old.school_id))
    ) then
      raise exception 'Khong the thay doi vai tro, truong hoac to chuc';
    end if;
  end if;
  return new;
end
$$;

drop policy if exists profiles_staff_mgmt_update on public.profiles;
create policy profiles_staff_mgmt_update on public.profiles for update
  using (
    school_id = (select public.my_school_id())
    and school_id is not null
    and ((select public.my_roles()) && array['bgh','admin']::text[])
  );

-- R3-02 [HIGH] GV chuyen truong van doc/sua/xoa duoc cau hoi + hoc lieu
-- cua truong cu qua owner clause. Rang buoc tenant: school-bound owner ops
-- yeu cau school_id = my_school_id(); ca nhan (school_id null) giu nguyen.
drop policy if exists tvc_q_read on tvc.questions;
create policy tvc_q_read on tvc.questions for select using (
  not (id in (select public.scn_denied_item_ids('questions')))
  and (
    (owner_id = (select auth.uid())
      and (school_id is null
           or (school_id = (select public.my_school_id())
               and (select public.scn_is_edu_staff()))))
    or (school_id = (select public.my_school_id())
        and (select my_roles()) && array['gvcn','gvbm','to_truong','bgh','admin']::text[])
  )
);

drop policy if exists tvc_q_update on tvc.questions;
create policy tvc_q_update on tvc.questions for update
  using (
    (owner_id = (select auth.uid())
      and (school_id is null
           or (school_id = (select public.my_school_id())
               and (select public.scn_is_edu_staff()))))
    or (school_id = (select public.my_school_id())
        and (select my_roles()) && array['to_truong','bgh','admin']::text[])
  )
  with check (
    (owner_id = (select auth.uid())
      and (school_id is null
           or (school_id = (select public.my_school_id())
               and (select public.scn_is_edu_staff()))))
    or (school_id = (select public.my_school_id())
        and (select my_roles()) && array['to_truong','bgh','admin']::text[])
  );

drop policy if exists tvc_q_delete on tvc.questions;
create policy tvc_q_delete on tvc.questions for delete using (
  (owner_id = (select auth.uid())
    and (school_id is null
         or (school_id = (select public.my_school_id())
             and (select public.scn_is_edu_staff()))))
  or (school_id = (select public.my_school_id())
      and (select my_roles()) && array['to_truong','bgh','admin']::text[])
);

drop policy if exists tvc_mat_owner on tvc.materials;
create policy tvc_mat_owner on tvc.materials for all
  using (
    author_id = (select auth.uid())
    and (select public.scn_is_edu_staff())
    and (school_id is null or school_id = (select public.my_school_id()))
  )
  with check (
    author_id = (select auth.uid())
    and (select public.scn_is_edu_staff())
    and (school_id is null or school_id = (select public.my_school_id()))
  );
