-- CR-049 P3d: durable parent-digest outbox.
-- Truoc: cron scan tu dau + gui inline trong 300s - timeout mat queue
-- (chi idempotent qua digest_deliveries), PH cuoi bi starvation.
-- Sau: phase enqueue ghi body vao outbox (snapshot, idempotent qua
-- unique(week_start,parent_id)); phase send claim bang SKIP LOCKED
-- theo deadline - run timeout thi run sau tiep tuc, khong scan lai.

create table if not exists public.digest_outbox (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  parent_id uuid not null references public.parents(id) on delete cascade,
  email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued','sending','sent','failed','skipped','cancelled')),
  attempts int not null default 0,
  last_error text,
  provider_id text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_start, parent_id)
);
create index if not exists digest_outbox_claim_idx
  on public.digest_outbox (status, scheduled_at, id);
create index if not exists digest_outbox_week_idx
  on public.digest_outbox (week_start, status);

alter table public.digest_outbox enable row level security;

-- Staff cung truong doc trang thai gui (mirror digest_deliveries policy).
create policy digest_outbox_staff_read on public.digest_outbox
  for select to authenticated
  using (
    (select my_role()) = any (array['bgh','pht','gvcn','gvbm','totruong','ketoan','admin'])
    and (select scn_parent_in_school(parent_id))
  );

revoke all on public.digest_outbox from anon;
grant select on public.digest_outbox to authenticated;
grant all on public.digest_outbox to service_role;

-- Atomic claim: queued -> sending (+attempts), FOR UPDATE SKIP LOCKED
-- cho phep nhieu worker song song khong gianh nhau cung 1 row.
create or replace function public.scn_digest_outbox_claim(p_limit int)
 returns setof public.digest_outbox
 language plpgsql security definer
 set search_path to 'public'
as $$
begin
  return query
    update public.digest_outbox o
       set status = 'sending',
           attempts = attempts + 1,
           updated_at = now()
     where o.id in (
       select id from public.digest_outbox
        where status = 'queued'
          and scheduled_at <= now()
        order by scheduled_at, id
        limit p_limit
        for update skip locked
     )
     returning o.*;
end;
$$;

-- Requeue: 'sending' cu (worker chet giua chung) va 'failed' con han
-- retry -> queued lai. Goi dau moi send-phase.
create or replace function public.scn_digest_outbox_requeue(
  p_week_start date, p_max_attempts int default 3
) returns int language plpgsql security definer
 set search_path to 'public'
as $$
declare
  v int;
begin
  update public.digest_outbox
     set status = 'queued', updated_at = now()
   where week_start = p_week_start
     and (
       (status = 'sending' and updated_at < now() - interval '10 minutes')
       or (status = 'failed' and attempts < p_max_attempts)
     );
  get diagnostics v = row_count;
  return v;
end;
$$;

revoke all on function public.scn_digest_outbox_claim(int) from public, anon, authenticated;
revoke all on function public.scn_digest_outbox_requeue(date, int) from public, anon, authenticated;
grant execute on function public.scn_digest_outbox_claim(int) to service_role;
grant execute on function public.scn_digest_outbox_requeue(date, int) to service_role;
