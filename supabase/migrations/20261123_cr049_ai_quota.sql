-- CR-049 P3c: AI quota/budget infrastructure.
-- Muc tieu: chan dot quota/chi phi AI - budget ngay theo scope
-- (global/school/user/kind), counter atomic, usage log audit.
-- Caller (respondWithAi + cac route goi truc tiep) scn_ai_quota_take()
-- TRUOC khi goi provider; scn_ai_record_usage() sau khi co ket qua.

create table if not exists public.ai_budgets (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global','school','user','kind')),
  -- global dung '*'; school/user = uuid::text; kind = ten route (vd 'comments')
  scope_id text not null default '*',
  max_calls int not null check (max_calls > 0),
  enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, scope_id)
);
comment on table public.ai_budgets is
  'CR-049: ngan sach AI theo ngay. scope=global(*) ap cho moi request; school/user/kind ap rieng.';

create table if not exists public.ai_usage_counters (
  scope text not null check (scope in ('global','school','user','kind')),
  -- Concrete id: global='*', school=<school uuid>, user=<uid>, kind=<route>
  scope_id text not null,
  day date not null,
  calls int not null default 0,
  primary key (scope, scope_id, day)
);

-- Log chi tiet tung call - audit + phan tich chi phi theo provider/kind.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  kind text not null,
  provider text,
  outcome text not null check (outcome in ('ok','quota','error','no_key','budget_block'))
);
create index if not exists ai_usage_day_idx on public.ai_usage (created_at);
create index if not exists ai_usage_school_idx on public.ai_usage (school_id, created_at);

alter table public.ai_budgets enable row level security;
alter table public.ai_usage_counters enable row level security;
alter table public.ai_usage enable row level security;

-- Budgets: chi admin doc/sua (service role bypass RLS cho RPC definer).
create policy ai_budgets_admin_read on public.ai_budgets for select
  using ((select my_role()) = 'admin');
create policy ai_budgets_admin_write on public.ai_budgets for all
  using ((select my_role()) = 'admin')
  with check ((select my_role()) = 'admin');

-- Counters: khong doc truc tiep - chi qua RPC (definer).
-- Usage: staff doc usage truong minh (bao gom dept scope); user doc cua minh.
create policy ai_usage_self_read on public.ai_usage for select
  using (created_by = (select auth.uid()));
create policy ai_usage_staff_read on public.ai_usage for select
  using ((select is_staff()) and (
    scn_is_dept() and school_id in (select scn_my_scope_school_ids())
    or school_id = (select my_school_id())
  ));

-- Atomic quota: increment counter cho TUNG budget ap dung, tra false neu
-- bat ky scope nao vuot cap. Over-count theo chieu an toan (chat che hon).
create or replace function public.scn_ai_quota_take(p_kind text)
 returns boolean language plpgsql security definer
 set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
  v_b record;
  v_calls int;
begin
  if v_uid is null then
    return false;
  end if;
  select school_id into v_school from public.profiles where id = v_uid;
  -- Tang counter 1 lan moi scope-key (concrete id), cap = min cua cac
  -- budget match (wildcard '*' lan concrete). Vuot -> block + ghi audit.
  for v_b in
    select scope,
      case scope
        when 'global' then '*'
        when 'school' then coalesce(v_school::text, 'none')
        when 'user' then v_uid::text
        when 'kind' then p_kind
      end as cid,
      min(max_calls) as cap
    from public.ai_budgets
     where enabled
       and (
         (scope = 'global' and scope_id = '*')
         or (scope = 'school' and (scope_id = '*' or scope_id = v_school::text))
         or (scope = 'user' and (scope_id = '*' or scope_id = v_uid::text))
         or (scope = 'kind' and (scope_id = '*' or scope_id = p_kind))
       )
     group by scope
  loop
    insert into public.ai_usage_counters (scope, scope_id, day, calls)
    values (v_b.scope, v_b.cid, current_date, 1)
    on conflict (scope, scope_id, day)
    do update set calls = public.ai_usage_counters.calls + 1
    returning calls into v_calls;
    if v_calls > v_b.cap then
      insert into public.ai_usage (created_by, school_id, kind, provider, outcome)
      values (v_uid, v_school, p_kind, null, 'budget_block');
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.scn_ai_record_usage(
  p_kind text, p_provider text, p_outcome text
) returns void language plpgsql security definer
 set search_path to 'public'
as $$
declare
  v_school uuid;
begin
  select school_id into v_school from public.profiles where id = auth.uid();
  insert into public.ai_usage (created_by, school_id, kind, provider, outcome)
  values (auth.uid(), v_school, p_kind, p_provider, p_outcome);
end;
$$;

revoke all on public.ai_usage_counters from anon, authenticated;
grant execute on function public.scn_ai_quota_take(text) to authenticated;
grant execute on function public.scn_ai_record_usage(text, text, text) to authenticated;

-- Budget mac dinh: tran toan he thong + per-school + per-user + kind dat.
insert into public.ai_budgets (scope, scope_id, max_calls, note) values
  ('global', '*', 2000, 'Tran ngay toan he thong'),
  ('school', '*', 300, 'Ap cho moi truong (scope_id * = wildcard)')
on conflict (scope, scope_id) do nothing;
