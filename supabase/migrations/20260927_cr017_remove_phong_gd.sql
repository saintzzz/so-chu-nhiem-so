-- CR-017: Xoa vai tro phong_gd theo mo hinh chinh quyen dia phuong 2 cap
-- (NQ 60, ND 142/2025, TT 13&15/2025/TT-BGDDT): bo cap huyen/Phong GD&DT;
-- nhiem vu chuyen mon -> So GD&DT (cap tinh), hanh chinh/dia ban -> UBND cap xa.

-- 1. Xoa du lieu phong_gd truoc (tranh vi pham CHECK moi).
delete from notifications where profile_id in (select id from profiles where role='phong_gd');
delete from profiles where role='phong_gd';

-- 2. Reparent UBND cap xa -> So (bo tang cap huyen), xoa don vi Phong GD&DT.
update org_units
set parent_id = (select id from org_units where type='so' limit 1)
where type='ubnd' and parent_id in (select id from org_units where type='phong');
delete from org_units where type='phong';

-- 3. profiles.role CHECK: bo 'phong_gd'.
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role = any(array[
    'gvcn','gvbm','to_truong','bgh','pht','ke_toan',
    'so_gd','ubnd','phu_huynh','hoc_sinh','admin'
  ]));

-- 4. scn_is_dept: bo 'phong_gd'.
create or replace function public.scn_is_dept()
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select my_role()) = any(array['so_gd','ubnd','admin']), false) $$;
