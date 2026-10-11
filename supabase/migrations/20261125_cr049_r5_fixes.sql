-- CR-049 round-5 (Codex r5) fixes - triage tu docs/reviews/codex-cloud-report-cr049-raw.txt.
-- F1  outbox body privacy (cross-school sibling leak)
-- F3  quota RPC client-consumable -> service-only + p_actor
-- F4  grade CAS advisory lock (atomic)
-- F5  grades year-scoped CAS+delete
-- F6/11/12 outbox requeue: reconcile sent + skipped + all-weeks
-- F8  quota budget_block audit khong rollback counter
-- F9  record_usage anonymous inserts
-- F10 admin scope short-circuit
-- F18 ai_jobs.pii_map cho Devin fallback deanonymize

-- ===== F1: bo staff SELECT tren body - metadata qua deliveries =====
-- body chua ca bao cao cua cac con (ke ca con truong khac); staff chi
-- can trang thai gui - digest_deliveries da cung cap.
drop policy if exists digest_outbox_staff_read on public.digest_outbox;
revoke select on public.digest_outbox from authenticated;

-- ===== F10: admin khong bi scope helpers chan =====
create or replace function public.scn_profile_in_scope(pid uuid)
 returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select (select my_role()) = 'admin' or exists(
    select 1 from public.profiles p
     where p.id = pid
       and (p.school_id in (select scn_my_scope_school_ids())
            or p.org_unit_id in (
              with recursive t as (
                select id from public.org_units
                 where id = (select pa.org_unit_id from public.profiles pa
                              where pa.id = auth.uid())
                union all
                select o.id from public.org_units o join t on o.parent_id = t.id
              ) select id from t)))
$function$;

create or replace function public.scn_org_in_scope(oid uuid)
 returns boolean language sql stable security definer
 set search_path to 'public'
as $function$
  select (select my_role()) = 'admin' or oid in (
    with recursive t as (
      select id from public.org_units
       where id = (select p.org_unit_id from public.profiles p
                    where p.id = auth.uid())
      union all
      select o.id from public.org_units o join t on o.parent_id = t.id
    )
    select id from t
  ) or exists(
    select 1 from public.schools s
     where s.org_unit_id = oid
       and s.id in (select scn_my_scope_school_ids())
  )
$function$;

-- ===== F4+F5: grade CAS atomic (advisory lock) + year-scoped =====
-- Drop overloads cu (4-param pre-CAS, 5-param CAS-khong-lock) - editor
-- gui 5 named params se bind vao overload thieu lock/scope neu con.
drop function if exists public.scn_save_grades(uuid[],uuid,text,jsonb);
drop function if exists public.scn_save_grades(uuid[],uuid,text,jsonb,timestamptz);
create or replace function public.scn_save_grades(
  p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb,
  p_expected_max timestamptz default null,
  p_academic_year_id uuid default null
) returns void language plpgsql
 set search_path to 'public'
as $function$
declare
  v_max timestamptz;
  v_year uuid;
begin
  -- F5: resolve nam hoc tu lop cua HS khi caller khong truyen - UI
  -- gradebook khong co year selector, lop la source of truth.
  select coalesce(p_academic_year_id, c.academic_year_id) into v_year
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = p_student_ids[1];
  -- F4: serialize writers per (subject,term,year) - check+delete+insert
  -- nguyen tu, khong con lost-update khi 2 GV luu cung luc.
  perform pg_advisory_xact_lock(
    hashtextextended(p_subject_id::text || '|' || p_term || '|'
      || coalesce(v_year::text, ''), 0));
  -- F5: CAS + delete scope theo nam hoc da resolve. NULL van bi bat
  -- (legacy upgrade path - du lieu cu ghi truoc khi co cot year); rows
  -- nam hoc KHAC khong bao gio bi xoa/relabel.
  select max(g.updated_at) into v_max
    from public.grades g
   where g.student_id = any(p_student_ids)
     and g.subject_id = p_subject_id
     and g.term = p_term
     and (g.academic_year_id is null or g.academic_year_id = v_year);
  if p_expected_max is not null
     and coalesce(v_max, '-infinity'::timestamptz) > p_expected_max then
    raise exception 'stale_write' using errcode = 'P0001';
  end if;
  delete from public.grades g
   where g.student_id = any(p_student_ids)
     and g.subject_id = p_subject_id
     and g.term = p_term
     and (g.academic_year_id is null or g.academic_year_id = v_year);
  insert into public.grades (
    student_id, subject_id, term, entered_by, subtype,
    assessment_type, seq, level, score, comment, result, updated_at,
    academic_year_id
  )
  select (r->>'student_id')::uuid, p_subject_id, p_term, auth.uid(),
         coalesce(r->>'subtype', ''), r->>'assessment_type',
         (r->>'seq')::smallint, r->>'level', (r->>'score')::numeric,
         r->>'comment', r->>'result', now(),
         coalesce(p_academic_year_id, c.academic_year_id)
    from jsonb_array_elements(p_rows) as r
    left join public.students st on st.id = (r->>'student_id')::uuid
    left join public.classes c on c.id = st.class_id;
end
$function$;

-- ===== F3+F8: quota service-only + audit khong rollback counter =====
drop function if exists public.scn_ai_quota_take(text);
create or replace function public.scn_ai_quota_take(p_kind text, p_actor uuid)
 returns boolean language plpgsql security definer
 set search_path to 'public'
as $$
declare
  v_school uuid;
  v_b record;
  v_calls int;
begin
  -- Service-role RPC: actor truyen tu server (route da auth).
  if p_actor is null then
    return false;
  end if;
  select school_id into v_school from public.profiles where id = p_actor;
  for v_b in
    select scope,
      case scope
        when 'global' then '*'
        when 'school' then coalesce(v_school::text, 'none')
        when 'user' then p_actor::text
        when 'kind' then p_kind
      end as cid,
      min(max_calls) as cap
    from public.ai_budgets
     where enabled
       and (
         (scope = 'global' and scope_id = '*')
         or (scope = 'school' and (scope_id = '*' or scope_id = v_school::text))
         or (scope = 'user' and (scope_id = '*' or scope_id = p_actor::text))
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
      -- F8: audit fail khong duoc rollback counter increments (mat
      -- accounting + fail-open). Chan van return false.
      begin
        insert into public.ai_usage (created_by, school_id, kind, provider, outcome)
        values (p_actor, v_school, p_kind, null, 'budget_block');
      exception when others then null;
      end;
      return false;
    end if;
  end loop;
  return true;
end;
$$;

drop function if exists public.scn_ai_record_usage(text, text, text);
create or replace function public.scn_ai_record_usage(
  p_kind text, p_provider text, p_outcome text, p_actor uuid
) returns void language plpgsql security definer
 set search_path to 'public'
as $$
declare
  v_school uuid;
begin
  -- F9: anonymous insert bi chan - actor bat buoc.
  if p_actor is null then
    return;
  end if;
  select school_id into v_school from public.profiles where id = p_actor;
  insert into public.ai_usage (created_by, school_id, kind, provider, outcome)
  values (p_actor, v_school, p_kind, p_provider, p_outcome);
end;
$$;

-- Chi service_role (route goi qua admin client) - client khong tu dot
-- counter/audit duoc nua.
revoke all on function public.scn_ai_quota_take(text, uuid) from public, anon, authenticated;
revoke all on function public.scn_ai_record_usage(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.scn_ai_quota_take(text, uuid) to service_role;
grant execute on function public.scn_ai_record_usage(text, text, text, uuid) to service_role;

-- ===== F6+F11+F12: requeue reconcile + skipped + all-weeks =====
drop function if exists public.scn_digest_outbox_requeue(date, int);
create or replace function public.scn_digest_outbox_requeue(p_max_attempts int default 3)
 returns int language plpgsql security definer
 set search_path to 'public'
as $$
declare
  v_reconciled int;
  v int;
begin
  -- F6: 'sending' ma da co delivery 'sent' (update status that bai sau
  -- khi provider da nhan) -> mark sent, KHONG gui lai.
  update public.digest_outbox o
     set status = 'sent', updated_at = now()
    from public.digest_deliveries d
   where d.week_start = o.week_start
     and d.parent_id = o.parent_id
     and d.status = 'sent'
     and o.status in ('sending', 'queued')
     and o.updated_at < now() - interval '10 minutes';
  get diagnostics v_reconciled = row_count;

  -- F12: requeue TAT CA tuan con treo (khong chi week hien tai);
  -- F11: 'skipped' (thieu RESEND_API_KEY) con han retry cung quay lai.
  update public.digest_outbox
     set status = 'queued', updated_at = now()
   where (status = 'sending' and updated_at < now() - interval '10 minutes')
      or (status = 'failed' and attempts < p_max_attempts)
      or (status = 'skipped' and attempts < p_max_attempts);
  get diagnostics v = row_count;
  return v + v_reconciled;
end;
$$;

revoke all on function public.scn_digest_outbox_requeue(int) from public, anon, authenticated;
grant execute on function public.scn_digest_outbox_requeue(int) to service_role;

-- ===== F18: alias map cho Devin fallback deanonymize =====
alter table public.ai_jobs
  add column if not exists pii_map jsonb;
