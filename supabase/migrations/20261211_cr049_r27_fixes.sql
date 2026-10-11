-- CR-049 r27: dong cac lop con ho sau sweep r26.
-- r27 review: guard chi chay BEFORE UPDATE nen INSERT vong duoc; doi
-- class_id tren activity da announce pha invariant bang con; write
-- policy ngoai sweep r26 con nhanh khong bind truong; CAS incident
-- tuy chon; notification client-side chen duoc link ngoai.
-- Fix: guard ca INSERT, khoa class_id sau marker/attendance,
-- daily_reports chi viet qua RPC, bind truong moi nhanh write,
-- incident bat CAS cho transition, notification chi link noi bo +
-- PH/HS chi type nguoi-dung-tao.

-- ============================================================
-- 1) activities: guard chay ca INSERT. Truoc day gvcn INSERT thang
--    status='approved' (act_ins khong gioi han status, trigger chi
--    BEFORE UPDATE) roi announce duoc nhu binh thuong.
--    + Khoa class_id khi da co attendance/marker - doi lop sau
--    announce khien attendance cu vi pham scn_attendance_pair_ok va
--    snapshot email/announcement sai lop.
-- ============================================================
create or replace function public.scn_activity_transition_guard()
returns trigger language plpgsql security definer
set search_path = 'public' as
$$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'approved'
       and not (
         'bgh' = any(public.my_roles())
         or 'pht' = any(public.my_roles())
         or 'admin' = any(public.my_roles())
       ) then
      raise exception 'approve requires bgh/pht' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status
     and new.status = 'approved'
     and not (
       'bgh' = any(public.my_roles())
       or 'pht' = any(public.my_roles())
       or 'admin' = any(public.my_roles())
     ) then
    raise exception 'approve requires bgh/pht' using errcode = '42501';
  end if;
  if new.class_id is distinct from old.class_id
     and (
       exists (select 1 from public.activity_attendance aa
                where aa.activity_id = old.id)
       or exists (select 1 from public.activity_announcements m
                   where m.activity_id = old.id)
     ) then
    raise exception 'activity class locked after announce/attendance'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists trg_activity_transition on public.activities;
create trigger trg_activity_transition
  before insert or update on public.activities
  for each row execute function public.scn_activity_transition_guard();

-- ============================================================
-- 2) daily_reports: thu quyen ghi truc tiep - UPDATE giu status
--    submitted nhung sua noi dung, hay DELETE roi INSERT draft deu
--    di qua policy cu ma trigger khong chan duoc het. Moi mutation
--    bat buoc qua scn_save_daily_report (SECURITY DEFINER + authz
--    + stale-write), select doc binh thuong.
--    RPC authz cung bind truong + role: gvcn phai la chu nhiem lop
--    O TRUONG HIEN TAI (scn_is_my_homeroom_class), khong con
--    c.gvcn_id = actor khong kiem truong (GV chuyen truong van ghi
--    duoc bao cao lop cu).
-- ============================================================
drop policy if exists dr_ins on public.daily_reports;
drop policy if exists dr_upd on public.daily_reports;
drop policy if exists dr_del on public.daily_reports;

create or replace function public.scn_save_daily_report(
  p_class uuid, p_date date, p_absent integer, p_late integer,
  p_violation integer, p_commend integer, p_content text, p_submit boolean
) returns text language plpgsql security definer
set search_path = 'public' as
$$
declare
  v_actor uuid := auth.uid();
  v_n integer;
begin
  -- SECURITY DEFINER bypass RLS: phai tu kiem quyen - gvcn cua lop
  -- O TRUONG HIEN TAI, hoac bgh/pht/admin cung truong.
  if not exists (
    select 1 from public.classes c
     where c.id = p_class
       and (
         (
           c.gvcn_id = v_actor
           and c.school_id = (select p.school_id
                               from public.profiles p
                               where p.id = v_actor)
           and exists (
             select 1 from public.profiles p
              where p.id = v_actor
                and (p.role = 'gvcn'
                     or 'gvcn' = any(p.concurrent_roles))
           )
         )
         or exists (
           select 1 from public.profiles p
            where p.id = v_actor
              and p.school_id = c.school_id
              and (p.role in ('bgh','pht','admin')
                   or p.concurrent_roles && array['bgh','pht']::text[])
         )
       )
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.daily_reports (
    class_id, date, gvcn_id, absent_count, late_count, violation_count,
    commendation_count, content, status, submitted_at
  ) values (
    p_class, p_date, v_actor, p_absent, p_late, p_violation,
    p_commend, p_content,
    case when p_submit then 'submitted' else 'draft' end,
    case when p_submit then now() else null end
  )
  on conflict (class_id, date) do update
    set gvcn_id = excluded.gvcn_id,
        absent_count = excluded.absent_count,
        late_count = excluded.late_count,
        violation_count = excluded.violation_count,
        commendation_count = excluded.commendation_count,
        content = excluded.content,
        status = case when p_submit then 'submitted' else public.daily_reports.status end,
        submitted_at = case when p_submit then now() else public.daily_reports.submitted_at end
    where public.daily_reports.status = 'draft';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    if exists(select 1 from public.daily_reports d
               where d.class_id = p_class and d.date = p_date) then
      return 'stale';
    end if;
    raise exception 'daily_report_save_failed';
  end if;
  return 'saved';
end
$$;

revoke all on function public.scn_save_daily_report(uuid, date, integer, integer, integer, integer, text, boolean) from public, anon;
grant execute on function public.scn_save_daily_report(uuid, date, integer, integer, integer, integer, text, boolean) to authenticated;

-- ============================================================
-- 3) period_logs: nhanh BGH cua pl_owner_upd/pl_owner_del khong
--    bind truong - BGH truong A UPDATE/DELETE duoc log truong B.
-- ============================================================
drop policy if exists pl_owner_upd on public.period_logs;
create policy pl_owner_upd on public.period_logs for update
using (
  scn_is_my_ttentry(timetable_entry_id)
  or scn_is_sub_ttentry_date(timetable_entry_id, date)
  or ((select my_role()) = 'bgh'
      and public.scn_ttentry_in_school(timetable_entry_id))
  or (select my_role()) = 'admin'
)
with check (
  scn_is_my_ttentry(timetable_entry_id)
  or scn_is_sub_ttentry_date(timetable_entry_id, date)
  or ((select my_role()) = 'bgh'
      and public.scn_ttentry_in_school(timetable_entry_id))
  or (select my_role()) = 'admin'
);

drop policy if exists pl_owner_del on public.period_logs;
create policy pl_owner_del on public.period_logs for delete
using (
  scn_is_my_ttentry(timetable_entry_id)
  or scn_is_sub_ttentry_date(timetable_entry_id, date)
  or ((select my_role()) = 'bgh'
      and public.scn_ttentry_in_school(timetable_entry_id))
  or (select my_role()) = 'admin'
);

-- ============================================================
-- 4) item_acl: BGH truong A tao duoc ACL school_id=A nhung user_id/
--    item_id thuoc truong B -> scn_item_denied khong loc truong nen
--    user B bi chan item cua minh. Bind user vao truong luc ghi va
--    bind a.school_id vao truong caller luc resolve deny.
-- ============================================================
drop policy if exists acl_write on public.item_acl;
create policy acl_write on public.item_acl for all
  using (
    school_id = my_school_id()
    and my_role() in ('bgh','admin')
    and public.scn_profile_in_school(user_id)
  )
  with check (
    school_id = my_school_id()
    and my_role() in ('bgh','admin')
    and public.scn_profile_in_school(user_id)
  );

create or replace function public.scn_item_denied(tbl text, item uuid)
returns boolean language sql stable security definer
set search_path = 'public' as
$$ select exists(select 1 from public.item_acl a
     where a.table_name = tbl and a.item_id = item
       and a.user_id = auth.uid() and a.effect = 'deny'
       and a.school_id = (select my_school_id())) $$;

-- ============================================================
-- 5) notifications: client co the INSERT type he thong + link ngoai
--    -> phishing trong inbox. Chi cho link noi bo (/... khong phai
--    //...), va PH/HS chi tao duoc type do nguoi dung tao
--    (appointment/message). Staff giu nguyen nhanh hien tai -
--    provenance day du (type he thong qua RPC) la deferred design.
-- ============================================================
drop policy if exists notif_ins on public.notifications;
create policy notif_ins on public.notifications for insert
  with check (
    public.scn_profile_in_school(profile_id)
    and (
      link is null
      or (link ~ '^/' and link !~ '^//')
    )
    and (
      is_school_staff()
      or (
        my_role() in ('phu_huynh','hoc_sinh')
        and type in ('appointment','message')
      )
    )
  );

-- ============================================================
-- 6) incident followup: p_expected con default null -> caller bo
--    qua CAS cho transition. Transition (p_status khac status hien
--    tai) bat buoc p_expected khop; note-only (status giu nguyen)
--    khong can CAS.
-- ============================================================
create or replace function public.scn_incident_followup(
  p_incident uuid, p_status text, p_note text, p_expected text default null
) returns void language plpgsql set search_path to 'public' as $function$
declare
  v_cur text;
begin
  select status into v_cur from incidents
    where id = p_incident for update;
  if not found then
    raise exception 'incident_followup_denied';
  end if;
  if p_status is distinct from v_cur
     and (p_expected is null or p_expected is distinct from v_cur) then
    raise exception 'incident_followup_denied';
  end if;
  update incidents
     set status = p_status,
         description = case
           when p_note is null or btrim(p_note) = '' then description
           else coalesce(description, '')
             || E'\n\n[Theo dõi '
             || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
             || '] ' || btrim(p_note)
         end
   where id = p_incident;
end;
$function$;

grant execute on function public.scn_incident_followup(uuid, text, text, text) to authenticated;
