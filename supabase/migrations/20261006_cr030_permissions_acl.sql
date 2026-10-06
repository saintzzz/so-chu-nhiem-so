-- CR-030: phan quyen theo chuc nang (role + user override) + data-level ACL
create table if not exists public.feature_grants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  role text,
  user_id uuid references public.profiles(id),
  feature text not null,
  effect text not null check (effect in ('allow','deny')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint feature_grants_scope check (
    (role is not null and user_id is null) or (role is null and user_id is not null)
  ),
  unique (school_id, role, feature),
  unique (school_id, user_id, feature)
);
alter table public.feature_grants enable row level security;
create policy fg_read on public.feature_grants for select
  using (school_id = my_school_id() and my_role() in ('gvcn','gvbm','to_truong','bgh','pht','admin'));
create policy fg_write on public.feature_grants for all
  using (school_id = my_school_id() and my_role() in ('bgh','admin'))
  with check (school_id = my_school_id() and my_role() in ('bgh','admin'));

create table if not exists public.item_acl (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  table_name text not null check (table_name in ('questions','materials','khbd_templates','curriculum_standards')),
  item_id uuid not null,
  user_id uuid not null references public.profiles(id),
  effect text not null default 'deny' check (effect in ('deny','allow')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (table_name, item_id, user_id)
);
alter table public.item_acl enable row level security;
create policy acl_read on public.item_acl for select
  using (school_id = my_school_id() and my_role() in ('to_truong','bgh','admin'));
create policy acl_write on public.item_acl for all
  using (school_id = my_school_id() and my_role() in ('bgh','admin'))
  with check (school_id = my_school_id() and my_role() in ('bgh','admin'));
create index if not exists item_acl_lookup on public.item_acl(table_name, item_id, user_id);

create or replace function public.scn_has_feature(f text)
returns boolean language plpgsql stable security definer set search_path = 'public' as $$
declare uid uuid := auth.uid(); r text; sid uuid; d boolean := null;
begin
  if uid is null then return false; end if;
  select role, school_id into r, sid from public.profiles where id = uid;
  select (effect='allow') into d from feature_grants
    where school_id=sid and user_id=uid and feature=f;
  if d is not null then return d; end if;
  select (effect='allow') into d from feature_grants
    where school_id=sid and role=r and feature=f;
  if d is not null then return d; end if;
  return case f
    when 'studio' then r in ('gvcn','gvbm','to_truong','bgh','admin')
    when 'studio.questions' then r in ('gvcn','gvbm','to_truong','bgh','admin')
    when 'studio.review' then r in ('to_truong','bgh','admin')
    when 'studio.export' then r in ('gvcn','gvbm','to_truong','bgh','admin')
    when 'studio.ai' then r in ('gvcn','gvbm','to_truong','bgh','admin')
    when 'school.users' then r in ('bgh','admin')
    else false
  end;
end $$;

create or replace function public.scn_item_denied(tbl text, item uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$ select exists(select 1 from public.item_acl a
     where a.table_name=tbl and a.item_id=item and a.user_id=auth.uid() and a.effect='deny') $$;

grant execute on function public.scn_has_feature(text) to authenticated;
grant execute on function public.scn_item_denied(text, uuid) to authenticated;

drop policy if exists tvc_q_read on tvc.questions;
create policy tvc_q_read on tvc.questions for select
  using (
    auth.uid() is not null
    and not public.scn_item_denied('questions', id)
    and (owner_id = auth.uid()
        or (school_id = my_school_id() and my_role() in ('gvcn','gvbm','to_truong','bgh','admin')))
  );

drop policy if exists tvc_mat_school_read on tvc.materials;
create policy tvc_mat_school_read on tvc.materials for select
  using (
    not public.scn_item_denied('materials', id)
    and school_id = my_school_id()
    and my_role() in ('gvcn','gvbm','to_truong','bgh','admin')
  );

notify pgrst, 'reload schema';
