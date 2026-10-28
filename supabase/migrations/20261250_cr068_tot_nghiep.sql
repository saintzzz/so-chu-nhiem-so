-- CR-068: xet_tot_nghiep - dot xet tot nghiep cuoi cap (khoi 9/12).
-- Snapshot kqht/kqrl tu year_end_decisions approved/locked; diem xet TN
-- nhap tay; finalize -> students.status='graduated' + history + notify.

create or replace function public.tn_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select f.enabled from public.school_features f
  where f.school_id = p_school and f.module = 'xet_tot_nghiep'), true) $$;
revoke all on function public.tn_module_enabled(uuid) from public;
grant execute on function public.tn_module_enabled(uuid) to authenticated, anon;

create table public.tn_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  academic_year_id uuid not null references public.academic_years(id),
  level text not null check (level in ('thcs','thpt')),
  name text not null,
  pass_score numeric(4,2) not null default 5.0
    check (pass_score >= 0 and pass_score <= 10),
  require_exam boolean not null default true,
  status text not null default 'open' check (status in ('open','finalized')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  unique (school_id, academic_year_id, level)
);
alter table public.tn_campaigns enable row level security;
create index tn_camp_school on public.tn_campaigns(school_id, academic_year_id);

create table public.tn_decisions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.tn_campaigns(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id),
  kqht text check (kqht in ('tot','kha','dat','chua_dat')),
  kqrl text check (kqrl in ('tot','kha','dat','chua_dat')),
  exam_score numeric(4,2) check (exam_score >= 0 and exam_score <= 10),
  eligible boolean not null default false,
  decision text not null default 'pending'
    check (decision in ('pending','approved','rejected')),
  note text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, student_id)
);
alter table public.tn_decisions enable row level security;
create index tn_dec_campaign on public.tn_decisions(campaign_id);
create index tn_dec_school on public.tn_decisions(school_id);
create index tn_dec_student on public.tn_decisions(student_id);

-- tenant guard: decision school phai trung campaign school
create or replace function public.tn_tenant_guard() returns trigger
language plpgsql as $$
begin
  if (select c.school_id from public.tn_campaigns c
      where c.id = new.campaign_id) is distinct from new.school_id then
    raise exception 'cross_school_campaign';
  end if;
  return new;
end $$;
create trigger tn_dec_tenant before insert or update on public.tn_decisions
  for each row execute function public.tn_tenant_guard();

-- RLS read: bgh|admin|so_gd scope + gvcn lop chu nhiem; module gate trong read
create policy tn_camp_read on public.tn_campaigns for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin','so_gd','gvcn']::text[]
    and (select public.tn_module_enabled(school_id)));
create policy tn_dec_read on public.tn_decisions for select
  using (school_id = (select my_school_id())
    and (select public.tn_module_enabled(school_id))
    and ((select my_roles()) && array['bgh','admin','so_gd']::text[]
         or ((select my_roles()) @> array['gvcn']::text[]
             and public.scn_student_in_my_homeroom(student_id))));
grant select on public.tn_campaigns, public.tn_decisions to authenticated;
revoke insert, update, delete on public.tn_campaigns, public.tn_decisions
  from authenticated, anon;

-- ===== tn_open_campaign =====
create or replace function public.tn_open_campaign(
  p_level text, p_name text, p_pass_score numeric, p_require_exam boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_year uuid;
  v_grade int;
  v_camp uuid;
  v_count int;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.tn_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_level not in ('thcs','thpt') then raise exception 'invalid_level'; end if;
  if nullif(btrim(coalesce(p_name,'')), '') is null then raise exception 'invalid_name'; end if;
  if p_pass_score is not null and (p_pass_score < 0 or p_pass_score > 10) then
    raise exception 'invalid_pass_score';
  end if;
  v_grade := case p_level when 'thcs' then 9 else 12 end;

  select y.id into v_year from public.academic_years y
  where y.school_id = v_school and y.is_current limit 1;
  if v_year is null then raise exception 'no_current_year'; end if;

  insert into public.tn_campaigns
    (school_id, academic_year_id, level, name, pass_score, require_exam, created_by)
  values (v_school, v_year, p_level, btrim(p_name),
          coalesce(p_pass_score, 5.0), coalesce(p_require_exam, true), auth.uid())
  returning id into v_camp;

  -- Seed: HS active thuoc lop khoi cuoi cap cua truong trong nam hoc.
  -- Snapshot kqht/kqrl tu quyet dinh nam approved/locked, uu tien stage moi nhat.
  insert into public.tn_decisions
    (campaign_id, school_id, student_id, kqht, kqrl, eligible)
  select v_camp, v_school, s.id, yed.kqht, yed.kqrl,
         (yed.kqht is not null and yed.kqht <> 'chua_dat'
          and yed.kqrl is not null and yed.kqrl <> 'chua_dat'
          and not coalesce(p_require_exam, true))
    from public.students s
    join public.classes c on c.id = s.class_id
    left join lateral (
      select d.kqht, d.kqrl from public.year_end_decisions d
      where d.student_id = s.id and d.academic_year_id = v_year
        and d.status in ('approved','locked')
      order by case d.stage
        when 'after_summer' then 3 when 'after_retest' then 2 else 1 end desc
      limit 1
    ) yed on true
    where c.school_id = v_school and c.academic_year_id = v_year
      and c.grade = v_grade and s.status = 'active';
  get diagnostics v_count = row_count;

  return jsonb_build_object('campaign_id', v_camp, 'students', v_count);
end $$;

-- ===== tn_set_exam: nhap diem xet TN =====
create or replace function public.tn_set_exam(p_decision uuid, p_score numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_dec record; v_camp record;
begin
  select d.*, c.status as camp_status, c.pass_score, c.require_exam
    into v_dec
    from public.tn_decisions d join public.tn_campaigns c on c.id = d.campaign_id
    where d.id = p_decision and d.school_id = v_school;
  if not found then raise exception 'decision_not_found'; end if;

  if not ((select my_roles()) && array['bgh','admin']::text[]
          or ((select my_roles()) @> array['gvcn']::text[]
              and public.scn_student_in_my_homeroom(v_dec.student_id))) then
    raise exception 'forbidden';
  end if;
  if not (select public.tn_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if v_dec.camp_status <> 'open' then raise exception 'campaign_closed'; end if;
  if p_score is not null and (p_score < 0 or p_score > 10) then
    raise exception 'invalid_score';
  end if;

  update public.tn_decisions d
  set exam_score = p_score,
      eligible = (d.kqht is not null and d.kqht <> 'chua_dat'
                  and d.kqrl is not null and d.kqrl <> 'chua_dat'
                  and (not v_dec.require_exam
                       or (p_score is not null and p_score >= v_dec.pass_score)))
  where d.id = p_decision;
  return jsonb_build_object('ok', true);
end $$;

-- ===== tn_set_decision: override tung HS (bgh|admin) =====
create or replace function public.tn_set_decision(
  p_id uuid, p_value text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_camp_status text;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.tn_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_value not in ('approved','rejected','pending') then
    raise exception 'invalid_decision';
  end if;
  select c.status into v_camp_status from public.tn_decisions d
    join public.tn_campaigns c on c.id = d.campaign_id
    where d.id = p_id and d.school_id = v_school;
  if not found then raise exception 'decision_not_found'; end if;
  if v_camp_status <> 'open' then raise exception 'campaign_closed'; end if;

  update public.tn_decisions
  set decision = p_value, note = nullif(btrim(coalesce(p_note,'')), ''),
      decided_by = auth.uid(), decided_at = now()
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ===== tn_finalize: chot dot -> graduated =====
create or replace function public.tn_finalize(p_campaign uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_camp record; v_grad int := 0; v_rej int := 0;
  v_stu record;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.tn_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  select * into v_camp from public.tn_campaigns c
    where c.id = p_campaign and c.school_id = v_school;
  if not found then raise exception 'campaign_not_found'; end if;
  if v_camp.status <> 'open' then raise exception 'campaign_closed'; end if;

  -- Pending -> theo eligible; override (da co decided_by) giu nguyen.
  update public.tn_decisions d
  set decision = case when d.eligible then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now()
  where d.campaign_id = p_campaign and d.decision = 'pending';

  -- approved -> status='graduated' + history + notify GVCN.
  for v_stu in
    select d.student_id, s.class_id, c.gvcn_id
      from public.tn_decisions d
      join public.students s on s.id = d.student_id
      join public.classes c on c.id = s.class_id
      where d.campaign_id = p_campaign and d.decision = 'approved'
        and s.status = 'active'
  loop
    update public.students set status = 'graduated'
    where id = v_stu.student_id;
    insert into public.student_record_history
      (student_id, changed_by, field, old_value, new_value, changed_at)
    values (v_stu.student_id, auth.uid(), 'status', 'active', 'graduated', now());
    if v_stu.gvcn_id is not null then
      insert into public.notifications
        (profile_id, type, title, body, link)
      values (v_stu.gvcn_id, 'tot_nghiep',
              'Học sinh tốt nghiệp',
              'Một học sinh lớp chủ nhiệm đã được công nhận tốt nghiệp: ' || v_camp.name,
              '/school/graduation');
    end if;
    v_grad := v_grad + 1;
  end loop;

  select count(*) into v_rej from public.tn_decisions
    where campaign_id = p_campaign and decision = 'rejected';

  update public.tn_campaigns
  set status = 'finalized', finalized_by = auth.uid(), finalized_at = now()
  where id = p_campaign;
  return jsonb_build_object('graduated', v_grad, 'rejected', v_rej);
end $$;

revoke all on function public.tn_open_campaign(text, text, numeric, boolean) from public, anon;
revoke all on function public.tn_set_exam(uuid, numeric) from public, anon;
revoke all on function public.tn_set_decision(uuid, text, text) from public, anon;

revoke all on function public.tn_finalize(uuid) from public, anon;
grant execute on function public.tn_open_campaign(text, text, numeric, boolean) to authenticated;
grant execute on function public.tn_set_exam(uuid, numeric) to authenticated;
grant execute on function public.tn_set_decision(uuid, text, text) to authenticated;
grant execute on function public.tn_finalize(uuid) to authenticated;
