-- CR-049 r26: dong lop RLS tenant-consistency + marker service-only.
-- r26 review: policy ghi chi kiem role + truong, khong kiem quan he
--   gvcn-lop / lop-truong / hoc-sinh-hoat-dong -> cross-tenant va
--   self-approve duoc. Marker RPC van goi truc tiep duoc boi authenticated
--   nen user hop le co the gia ket qua email. Fix: pham vi gvcn theo lop
--   chu nhiem, transition guard trigger, FK-consistency trong WITH CHECK,
--   marker RPC chuyen sang service-only voi p_actor + authz server-side.

-- ============================================================
-- 1) activities: gvcn chi duoc viet hoat dong lop minh chu nhiem.
--    Truoc day scn_class_in_school cho gvcn sua ca hoat dong lop khac.
-- ============================================================
drop policy if exists act_ins on public.activities;
create policy act_ins on public.activities for insert
  with check (
    my_role() = 'admin'
    or (my_role() in ('bgh','pht') and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  );

drop policy if exists act_upd on public.activities;
create policy act_upd on public.activities for update
  using (
    my_role() = 'admin'
    or (my_role() in ('bgh','pht') and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  )
  with check (
    my_role() = 'admin'
    or (my_role() in ('bgh','pht') and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  );

drop policy if exists act_del on public.activities;
create policy act_del on public.activities for delete
  using (
    my_role() = 'admin'
    or (my_role() in ('bgh','pht') and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and scn_is_my_homeroom_class(class_id))
  );

-- ============================================================
-- 2) Transition guard: RLS khong so sanh duoc OLD/NEW nen trigger dam
--    nhiem. Chi bgh/pht/admin duoc dua activity sang 'approved' - gvcn
--    khong the tu duyet roi announce vong qua BGH. service_role bypass
--    (migration/seed/admin RPC).
-- ============================================================
create or replace function public.scn_activity_transition_guard()
returns trigger language plpgsql security definer
set search_path = 'public' as
$$
begin
  if (select auth.role()) = 'service_role' then
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
  return new;
end
$$;

drop trigger if exists trg_activity_transition on public.activities;
create trigger trg_activity_transition
  before update on public.activities
  for each row execute function public.scn_activity_transition_guard();

-- ============================================================
-- 3) announcements: WITH CHECK phai xac thuc class_id/student_id thuoc
--    dung school_id cua row - truoc day tron duoc school A + class B.
--    gvcn chi duoc gui cho lop minh chu nhiem (khong gui school-wide).
-- ============================================================
drop policy if exists ann_ins on public.announcements;
create policy ann_ins on public.announcements for insert
  with check (
    sender_id = auth.uid()
    and (
      my_role() = 'admin'
      or (
        my_role() in ('bgh','pht')
        and school_id = (select public.my_school_id())
        and (class_id is null or scn_class_in_school(class_id))
        and (student_id is null or scn_student_in_school(student_id))
      )
      or (
        my_role() = 'gvcn'
        and school_id = (select public.my_school_id())
        and class_id is not null
        and scn_is_my_homeroom_class(class_id)
        and (student_id is null or scn_student_in_my_homeroom(student_id))
      )
    )
  );

drop policy if exists ann_upd on public.announcements;
create policy ann_upd on public.announcements for update
  using (
    my_role() = 'admin'
    or (my_role() in ('bgh','pht','gvcn')
        and school_id = (select public.my_school_id()))
  )
  with check (
    my_role() = 'admin'
    or (
      my_role() in ('bgh','pht')
      and school_id = (select public.my_school_id())
      and (class_id is null or scn_class_in_school(class_id))
      and (student_id is null or scn_student_in_school(student_id))
    )
    or (
      my_role() = 'gvcn'
      and school_id = (select public.my_school_id())
      and class_id is not null
      and scn_is_my_homeroom_class(class_id)
      and (student_id is null or scn_student_in_my_homeroom(student_id))
    )
  );

-- ============================================================
-- 4) activity_attendance: bat buoc student thuoc lop cua activity -
--    truoc day gvcn truyen duoc student lop minh + activity truong khac.
-- ============================================================
create or replace function public.scn_attendance_pair_ok(
  p_activity uuid, p_student uuid
) returns boolean language sql stable security definer
set search_path = 'public' as
$$
  select exists(
    select 1
      from public.activities a
      join public.students s on s.class_id = a.class_id
     where a.id = p_activity and s.id = p_student
  )
$$;

drop policy if exists aa_ins on public.activity_attendance;
create policy aa_ins on public.activity_attendance for insert
  with check (
    public.scn_attendance_pair_ok(activity_id, student_id)
    and (
      (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
      or (my_role() = 'bgh' and scn_student_in_school(student_id))
      or my_role() = 'admin'
    )
  );

drop policy if exists aa_upd on public.activity_attendance;
create policy aa_upd on public.activity_attendance for update
  using (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
  )
  with check (
    public.scn_attendance_pair_ok(activity_id, student_id)
    and (
      (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
      or (my_role() = 'bgh' and scn_student_in_school(student_id))
      or my_role() = 'admin'
    )
  );

drop policy if exists aa_del on public.activity_attendance;
create policy aa_del on public.activity_attendance for delete
  using (
    (my_role() = 'gvcn' and scn_student_in_my_homeroom(student_id))
    or (my_role() = 'bgh' and scn_student_in_school(student_id))
    or my_role() = 'admin'
  );

-- ============================================================
-- 5) Marker RPCs chuyen sang service-only: browser khong con goi truc
--    tiep duoc -> user hop le khong the tu gia trang thai email hay
--    link announcement. Server action truyen p_actor da xac thuc; RPC
--    kiem quyen lai phia DB qua scn_can_announce_activity_for.
-- ============================================================
create or replace function public.scn_roles_of(p_actor uuid)
returns text[] language sql stable security definer
set search_path = 'public' as
$$
  select array[p.role]::text[] || coalesce(p.concurrent_roles, '{}'::text[])
    from public.profiles p where p.id = p_actor
$$;

create or replace function public.scn_can_announce_activity_for(
  p_actor uuid, p_activity_id uuid
) returns boolean language sql stable security definer
set search_path = 'public' as
$$
  select exists(
    select 1
      from public.activities a
      join public.classes c on c.id = a.class_id
      join public.profiles p on p.id = p_actor
     where a.id = p_activity_id
       and c.school_id = p.school_id
       and (
         'bgh' = any(public.scn_roles_of(p_actor))
         or ('gvcn' = any(public.scn_roles_of(p_actor))
             and c.gvcn_id = p_actor)
       )
  )
$$;

create or replace function public.scn_announce_claim(
  p_activity_id uuid, p_actor uuid
) returns table(
  state text,
  announcement_id uuid,
  email_done boolean,
  emailed integer,
  email_failed integer,
  email_error text,
  email_skipped boolean
) language plpgsql security definer set search_path = 'public' as
$$
declare
  v_act record;
  v_marker public.activity_announcements%rowtype;
begin
  select a.id, a.status, c.school_id
    into v_act
    from public.activities a
    join public.classes c on c.id = a.class_id
   where a.id = p_activity_id;
  if not found then
    return query select 'not-found', null::uuid, false, 0, 0, null::text, false;
    return;
  end if;
  if not public.scn_can_announce_activity_for(p_actor, p_activity_id) then
    return query select 'forbidden', null::uuid, false, 0, 0, null::text, false;
    return;
  end if;
  if v_act.status <> 'approved' then
    return query select 'not-approved', null::uuid, false, 0, 0, null::text, false;
    return;
  end if;

  insert into public.activity_announcements (activity_id, school_id, claimed_by, claim_at)
  values (p_activity_id, v_act.school_id, p_actor, now())
  on conflict (activity_id) do nothing
  returning * into v_marker;
  if found then
    return query select 'claimed', v_marker.announcement_id, v_marker.email_done,
      v_marker.emailed, v_marker.email_failed, v_marker.email_error,
      v_marker.email_skipped;
    return;
  end if;

  update public.activity_announcements m
     set claimed_by = p_actor, claim_at = now(), updated_at = now()
   where m.activity_id = p_activity_id
     and m.announcement_id is null
     and (m.claimed_by = p_actor
          or m.claim_at is null
          or m.claim_at < now() - interval '60 seconds')
  returning * into v_marker;
  if found then
    return query select 'claimed', v_marker.announcement_id, v_marker.email_done,
      v_marker.emailed, v_marker.email_failed, v_marker.email_error,
      v_marker.email_skipped;
    return;
  end if;

  select * into v_marker
    from public.activity_announcements m where m.activity_id = p_activity_id;
  return query select
    case when v_marker.announcement_id is not null then 'already' else 'pending' end,
    v_marker.announcement_id, v_marker.email_done, v_marker.emailed,
    v_marker.email_failed, v_marker.email_error, v_marker.email_skipped;
end
$$;

create or replace function public.scn_announce_fulfill(
  p_activity_id uuid, p_actor uuid, p_title text, p_content text
) returns uuid language plpgsql security definer set search_path = 'public' as
$$
declare
  v_marker public.activity_announcements%rowtype;
  v_class uuid;
  v_ann uuid;
begin
  if not public.scn_can_announce_activity_for(p_actor, p_activity_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_marker
    from public.activity_announcements m
   where m.activity_id = p_activity_id
     for update;
  if not found then
    raise exception 'marker missing' using errcode = 'P0001';
  end if;
  if v_marker.announcement_id is not null then
    return v_marker.announcement_id;
  end if;
  if v_marker.claimed_by is distinct from p_actor then
    raise exception 'not claim owner' using errcode = '42501';
  end if;
  select a.class_id into v_class
    from public.activities a
   where a.id = p_activity_id
     and a.status = 'approved'
     for update;
  if not found then
    raise exception 'activity no longer approved' using errcode = 'P0001';
  end if;
  insert into public.announcements (sender_id, school_id, class_id, student_id, title, content)
  values (p_actor, v_marker.school_id, v_class, null, p_title, p_content)
  returning id into v_ann;
  update public.activity_announcements m
     set announcement_id = v_ann, updated_at = now()
   where m.activity_id = p_activity_id
     and m.announcement_id is null
     and m.claimed_by = p_actor;
  if not found then
    raise exception 'link lost' using errcode = 'P0001';
  end if;
  return v_ann;
end
$$;

create or replace function public.scn_announce_email_claim(
  p_activity_id uuid, p_actor uuid, p_token uuid default null
) returns uuid language plpgsql security definer set search_path = 'public' as
$$
declare
  v_token uuid;
begin
  if not public.scn_can_announce_activity_for(p_actor, p_activity_id) then
    return null;
  end if;

  if p_token is not null then
    update public.activity_announcements m
       set email_claim_at = now(), updated_at = now()
     where m.activity_id = p_activity_id
       and m.announcement_id is not null
       and m.email_done = false
       and m.email_claim_by = p_actor
       and m.email_claim_token = p_token;
    if found then
      return p_token;
    end if;
  end if;

  v_token := gen_random_uuid();
  update public.activity_announcements m
     set email_claim_by = p_actor,
         email_claim_token = v_token,
         email_claim_at = now(),
         updated_at = now()
   where m.activity_id = p_activity_id
     and m.announcement_id is not null
     and m.email_done = false
     and (m.email_claim_at is null
          or m.email_claim_at < now() - interval '5 minutes');
  if found then
    return v_token;
  end if;
  return null;
end
$$;

create or replace function public.scn_announce_email_complete(
  p_activity_id uuid, p_actor uuid, p_token uuid, p_done boolean,
  p_emailed integer, p_failed integer, p_error text, p_skipped boolean
) returns boolean language plpgsql security definer set search_path = 'public' as
$$
begin
  if not public.scn_can_announce_activity_for(p_actor, p_activity_id) then
    return false;
  end if;
  update public.activity_announcements m
     set email_done = p_done,
         emailed = p_emailed,
         email_failed = p_failed,
         email_error = p_error,
         email_skipped = p_skipped,
         email_claim_by = null,
         email_claim_at = null,
         email_claim_token = null,
         updated_at = now()
   where m.activity_id = p_activity_id
     and m.email_claim_by = p_actor
     and m.email_claim_token = p_token;
  return found;
end
$$;

-- Bo moi signature cu (authenticated-callable) - khong de overload song song.
drop function if exists public.scn_announce_claim(uuid);
drop function if exists public.scn_announce_fulfill(uuid, text, text);
drop function if exists public.scn_announce_email_claim(uuid, uuid);
drop function if exists public.scn_announce_email_complete(uuid, uuid, boolean, integer, integer, text, boolean);

revoke all on function public.scn_roles_of(uuid) from public, anon, authenticated;
revoke all on function public.scn_can_announce_activity_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scn_announce_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.scn_announce_fulfill(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.scn_announce_email_claim(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.scn_announce_email_complete(uuid, uuid, uuid, boolean, integer, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.scn_roles_of(uuid) to service_role;
grant execute on function public.scn_can_announce_activity_for(uuid, uuid) to service_role;
grant execute on function public.scn_announce_claim(uuid, uuid) to service_role;
grant execute on function public.scn_announce_fulfill(uuid, uuid, text, text) to service_role;
grant execute on function public.scn_announce_email_claim(uuid, uuid, uuid) to service_role;
grant execute on function public.scn_announce_email_complete(uuid, uuid, uuid, boolean, integer, integer, text, boolean) to service_role;

-- ============================================================
-- 6) incident followup: note-append khong duoc dua status ve gia tri cu.
--    p_expected = status client dang thay; stale tab gui 'following'
--    tren incident da 'resolved' -> 0 row -> raise.
-- ============================================================
create or replace function public.scn_incident_followup(
  p_incident uuid, p_status text, p_note text, p_expected text default null
) returns void language plpgsql set search_path to 'public' as $function$
begin
  update incidents
     set status = p_status,
         description = case
           when p_note is null or btrim(p_note) = '' then description
           else coalesce(description, '')
             || E'\n\n[Theo dõi '
             || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
             || '] ' || btrim(p_note)
         end
   where id = p_incident
     and (p_expected is null or status = p_expected);
  if not found then
    raise exception 'incident_followup_denied';
  end if;
end;
$function$;

-- Signature cu (khong CAS) van goi duoc boi authenticated neu de lai
-- overload - drop han de moi duong goi deu qua p_expected.
drop function if exists public.scn_incident_followup(uuid, text, text);
grant execute on function public.scn_incident_followup(uuid, text, text, text) to authenticated;

-- ============================================================
-- 7) daily_reports: submitted khong duoc quay ve draft + save nguyen
--    tu. Hai tab cung GVCN: tab nop xong, tab kia upsert draft tu du
--    lieu cu truoc day ghi de + xoa submitted_at. RPC serialize tren
--    (class_id,date): chi duoc update khi row hien tai con 'draft'.
-- ============================================================
create or replace function public.scn_daily_report_guard()
returns trigger language plpgsql security definer
set search_path = 'public' as
$$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;
  if old.status = 'submitted' and new.status = 'draft' then
    raise exception 'submitted report cannot revert to draft'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists trg_daily_report_guard on public.daily_reports;
create trigger trg_daily_report_guard
  before update on public.daily_reports
  for each row execute function public.scn_daily_report_guard();

-- Tra 'saved' hoac 'stale'. ON CONFLICT WHERE chi update khi row cu la
-- draft; khi row da submitted thi ca insert lan update deu khong cham -
-- row_count=0 + row ton tai = stale (bao client reload thay vi ghi de).
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
  -- hoac bgh/pht/admin cung truong moi duoc viet bao cao lop do.
  if not exists (
    select 1 from public.classes c
     where c.id = p_class
       and (
         c.gvcn_id = v_actor
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
