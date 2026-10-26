-- CR-060: feature flags theo truong - module hoa de ban theo nhu cau,
-- tranh rac menu khi truong khong mua module. Mac dinh moi module BAT;
-- admin/so_gd ghi override vao day.
create table if not exists public.school_features (
  school_id uuid not null references public.schools(id) on delete cascade,
  module text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (school_id, module)
);

alter table public.school_features enable row level security;

-- doc: moi user cua truong (can cho nav) + admin/so_gd doc toan bo
create policy sf_read on public.school_features for select to authenticated
  using (
    school_id = (select my_school_id())
    or (select my_roles()) @> array['admin','so_gd']::text[]
  );

-- ghi: chi admin/so_gd (truong khong tu bat module chua mua)
create policy sf_write on public.school_features for all to authenticated
  using ((select my_roles()) @> array['admin','so_gd']::text[])
  with check ((select my_roles()) @> array['admin','so_gd']::text[]);

revoke all on public.school_features from anon;
