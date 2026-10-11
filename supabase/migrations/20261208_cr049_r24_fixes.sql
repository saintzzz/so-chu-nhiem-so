-- CR-049 r24: marker announce chuyen het coordination vao DB.
-- r23 lam claim/link/email-state bang read-quyet-dinh-write phia client qua
-- RLS FOR ALL is_staff() -> 4 lo: gvbm/ke_toan sua marker; email gui trung
-- khi concurrent; takeover claim >60s khong doc quyen; announcement "moi co"
-- link nham hoat dong khac cung ten. Giai phap: RLS chi con SELECT; moi ghi
-- di qua RPC security definer kiem quyen + atomic.

alter table public.activity_announcements
  add column if not exists claimed_by uuid,
  add column if not exists claim_at timestamptz,
  add column if not exists email_claim_by uuid,
  add column if not exists email_claim_at timestamptz,
  add column if not exists email_skipped boolean not null default false;

drop policy if exists aa_staff_all on public.activity_announcements;

-- Staff cung truong chi doc marker (trang thai hien thi) - khong ai ghi
-- truc tiep, ke ca claimer: moi thay doi di qua RPC ben duoi.
create policy aa_staff_select on public.activity_announcements
  for select to authenticated
  using (public.is_staff() and school_id = (select public.my_school_id()));

-- Quyen announce = gvcn cua lop do hoac bgh cung truong (khop
-- checkActionRole gvcn|bgh + scope lop cua trang announce).
create or replace function public.scn_can_announce_activity(p_activity_id uuid)
returns boolean language sql stable security definer set search_path = 'public' as
$$
  select exists(
    select 1
      from public.activities a
      join public.classes c on c.id = a.class_id
     where a.id = p_activity_id
       and c.school_id = (select public.my_school_id())
       and (
         'bgh' = any(public.my_roles())
         or ('gvcn' = any(public.my_roles()) and c.gvcn_id = auth.uid())
       )
  )
$$;

-- Claim marker nguyen tu. Tra marker + trang thai:
--   'claimed'     -> caller so huu claim, duoc fulfill announcement
--   'already'     -> announcement da link (chi con co the resume email)
--   'pending'     -> phien khac dang fulfill (claim <60s), khong duoc can thiep
--   'forbidden'/'not-approved'/'not-found'
-- Takeover claim bo do chi thang khi claim_at qua 60s va chua co
-- announcement - UPDATE co dieu kien la atomic nen chi 1 request thang.
create or replace function public.scn_announce_claim(p_activity_id uuid)
returns table(
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
  if not public.scn_can_announce_activity(p_activity_id) then
    return query select 'forbidden', null::uuid, false, 0, 0, null::text, false;
    return;
  end if;
  if v_act.status <> 'approved' then
    return query select 'not-approved', null::uuid, false, 0, 0, null::text, false;
    return;
  end if;

  insert into public.activity_announcements (activity_id, school_id, claimed_by, claim_at)
  values (p_activity_id, v_act.school_id, auth.uid(), now())
  on conflict (activity_id) do nothing
  returning * into v_marker;
  if found then
    return query select 'claimed', v_marker.announcement_id, v_marker.email_done,
      v_marker.emailed, v_marker.email_failed, v_marker.email_error,
      v_marker.email_skipped;
    return;
  end if;

  -- Re-claim: owner cu claim that bai duoc retry ngay; owner khac phai cho
  -- claim chet (>60s). UPDATE co dieu kien atomic nen chi 1 request thang.
  update public.activity_announcements m
     set claimed_by = auth.uid(), claim_at = now(), updated_at = now()
   where m.activity_id = p_activity_id
     and m.announcement_id is null
     and (m.claimed_by = auth.uid()
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

-- Tao announcement + link marker trong MOT transaction duoi row lock.
-- Khong con lookup orphan (sender,class,title) - retry chi qua marker nen
-- hoat dong khac cung ten khong bao gio dung chung announcement.
create or replace function public.scn_announce_fulfill(
  p_activity_id uuid, p_title text, p_content text
) returns uuid language plpgsql security definer set search_path = 'public' as
$$
declare
  v_marker public.activity_announcements%rowtype;
  v_class uuid;
  v_ann uuid;
begin
  if not public.scn_can_announce_activity(p_activity_id) then
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
  if v_marker.claimed_by is distinct from auth.uid() then
    raise exception 'not claim owner' using errcode = '42501';
  end if;
  select a.class_id into v_class
    from public.activities a where a.id = p_activity_id;
  insert into public.announcements (sender_id, school_id, class_id, student_id, title, content)
  values (auth.uid(), v_marker.school_id, v_class, null, p_title, p_content)
  returning id into v_ann;
  update public.activity_announcements m
     set announcement_id = v_ann, updated_at = now()
   where m.activity_id = p_activity_id
     and m.announcement_id is null
     and m.claimed_by = auth.uid();
  if not found then
    raise exception 'link lost' using errcode = 'P0001';
  end if;
  return v_ann;
end
$$;

-- Claim quyen gui email: chi 1 caller thang trong lease 5 phut - concurrent
-- khong the cung goi emailClassParents -> khong gui trung.
create or replace function public.scn_announce_email_claim(p_activity_id uuid)
returns boolean language plpgsql security definer set search_path = 'public' as
$$
begin
  if not public.scn_can_announce_activity(p_activity_id) then
    return false;
  end if;
  update public.activity_announcements m
     set email_claim_by = auth.uid(), email_claim_at = now(), updated_at = now()
   where m.activity_id = p_activity_id
     and m.announcement_id is not null
     and m.email_done = false
     and (m.email_claim_by = auth.uid()
          or m.email_claim_at is null
          or m.email_claim_at < now() - interval '5 minutes');
  return found;
end
$$;

-- Chi claim owner ghi ket qua delivery - request thua khong ghi de ket qua
-- cua request thang.
create or replace function public.scn_announce_email_complete(
  p_activity_id uuid, p_done boolean, p_emailed integer,
  p_failed integer, p_error text, p_skipped boolean
) returns boolean language plpgsql security definer set search_path = 'public' as
$$
begin
  update public.activity_announcements m
     set email_done = p_done,
         emailed = p_emailed,
         email_failed = p_failed,
         email_error = p_error,
         email_skipped = p_skipped,
         email_claim_by = null,
         email_claim_at = null,
         updated_at = now()
   where m.activity_id = p_activity_id
     and m.email_claim_by = auth.uid();
  return found;
end
$$;

revoke all on function public.scn_can_announce_activity(uuid) from public, anon;
revoke all on function public.scn_announce_claim(uuid) from public, anon;
revoke all on function public.scn_announce_fulfill(uuid, text, text) from public, anon;
revoke all on function public.scn_announce_email_claim(uuid) from public, anon;
revoke all on function public.scn_announce_email_complete(uuid, boolean, integer, integer, text, boolean) from public, anon;
grant execute on function public.scn_can_announce_activity(uuid) to authenticated;
grant execute on function public.scn_announce_claim(uuid) to authenticated;
grant execute on function public.scn_announce_fulfill(uuid, text, text) to authenticated;
grant execute on function public.scn_announce_email_claim(uuid) to authenticated;
grant execute on function public.scn_announce_email_complete(uuid, boolean, integer, integer, text, boolean) to authenticated;
