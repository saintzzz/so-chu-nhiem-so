-- CR-062: tuyen sinh dau cap - campaign + ho so.
-- Lop 6 xet tuyen, lop 10 thi tuyen. Module key: tuyen_sinh.

create table if not exists public.admission_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  academic_year_id uuid references public.academic_years(id),
  level text not null check (level in ('khoi_6','khoi_10')),
  name text not null,
  quota int,
  benchmark numeric,
  exam_subjects text[] not null default '{toan,van,ngoai_ngu}',
  status text not null default 'draft'
    check (status in ('draft','open','closed')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admission_campaigns(id)
    on delete cascade,
  school_id uuid not null references public.schools(id),
  full_name text not null,
  dob date,
  gender text,
  id_number text,
  address text,
  source_school text,
  parent_name text,
  parent_phone text,
  priority_order int not null default 1,
  exam_number text,
  exam_scores jsonb,
  total_score numeric,
  status text not null default 'submitted' check (status in
    ('submitted','approved','rejected','exam_registered',
     'passed','failed','enrolled')),
  student_id uuid references public.students(id),
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, exam_number)
);

create index if not exists adm_app_campaign on public.admission_applications(campaign_id);
create index if not exists adm_app_school_status on public.admission_applications(school_id, status);
create index if not exists adm_campaign_school on public.admission_campaigns(school_id);

alter table public.admission_campaigns enable row level security;
alter table public.admission_applications enable row level security;

-- staff cung truong quan ly; admin/so_gd quan ly moi truong
drop policy if exists adm_campaign_select on public.admission_campaigns;
create policy adm_campaign_select on public.admission_campaigns
  for select using (
    school_id = (select my_school_id())
    or (select my_roles()) && array['admin','so_gd']::text[]
  );
drop policy if exists adm_campaign_write on public.admission_campaigns;
create policy adm_campaign_write on public.admission_campaigns
  for all using (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin','so_gd']::text[]
  ) with check (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin','so_gd']::text[]
  );

drop policy if exists adm_app_select on public.admission_applications;
create policy adm_app_select on public.admission_applications
  for select using (
    school_id = (select my_school_id())
    or (select my_roles()) && array['admin','so_gd']::text[]
  );
drop policy if exists adm_app_write on public.admission_applications;
create policy adm_app_write on public.admission_applications
  for all using (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin','so_gd']::text[]
  ) with check (
    (school_id = (select my_school_id())
      and (select my_roles()) && array['bgh','pht','admin']::text[])
    or (select my_roles()) && array['admin','so_gd']::text[]
  );

grant select on public.admission_campaigns to authenticated;
grant select on public.admission_applications to authenticated;
grant insert, update, delete on public.admission_campaigns to authenticated;
grant insert, update, delete on public.admission_applications to authenticated;
