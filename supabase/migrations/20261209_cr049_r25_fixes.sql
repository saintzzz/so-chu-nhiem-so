-- CR-049 r25: dong 3 lo coordination con lai trong marker RPCs.
-- 1) email_claim cho phep same-owner reclaim tuc thi -> 2 tab cung tai khoan
--    cung claim duoc -> gui email trung. Giai phap: token per-invocation -
--    claim tra token; resume chi khi mang dung token; complete bat buoc token.
-- 2) fulfill khong kiem tra lai activity.status trong transaction -> activity
--    chuyen draft sau claim van tao announcement. Giai phap: lock activity row
--    + bat buoc status='approved' ngay truoc INSERT.
-- 3) email_complete khong kiem tra quyen hien tai -> user bi thay khoi lop van
--    ghi ket qua. Giai phap: re-check scn_can_announce_activity + token.

alter table public.activity_announcements
  add column if not exists email_claim_token uuid;

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
  -- Kiem tra lai trang thai trong transaction: activity doi sang
  -- draft/pending sau khi claim thi khong duoc tao announcement.
  select a.class_id into v_class
    from public.activities a
   where a.id = p_activity_id
     and a.status = 'approved'
     for update;
  if not found then
    raise exception 'activity no longer approved' using errcode = 'P0001';
  end if;
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

-- Claim quyen gui email tra ve token thay vi boolean:
--   * tra uuid  -> caller so huu claim, phai mang token do vao complete
--   * tra null  -> claim dang bi giu boi phien khac (lease 5 phut)
-- Resume (retry sau khi complete that bai) chi khi truyen lai dung token
-- da nhan - hai tab moi cung tai khoan khong the cung claim vi tab sau
-- khong co token.
create or replace function public.scn_announce_email_claim(
  p_activity_id uuid, p_token uuid default null
) returns uuid language plpgsql security definer set search_path = 'public' as
$$
declare
  v_token uuid;
begin
  if not public.scn_can_announce_activity(p_activity_id) then
    return null;
  end if;

  -- Resume: cung owner + cung token -> gia han lease, tra lai token.
  if p_token is not null then
    update public.activity_announcements m
       set email_claim_at = now(), updated_at = now()
     where m.activity_id = p_activity_id
       and m.announcement_id is not null
       and m.email_done = false
       and m.email_claim_by = auth.uid()
       and m.email_claim_token = p_token;
    if found then
      return p_token;
    end if;
  end if;

  -- Claim moi: chi khi chua ai claim hoac lease da chet (>5 phut).
  v_token := gen_random_uuid();
  update public.activity_announcements m
     set email_claim_by = auth.uid(),
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

-- Complete bat buoc: quyen announce con hieu luc + dung token claim.
-- Owner bi thay khoi lop hoac request mang token cu/thieu deu bi tu choi.
create or replace function public.scn_announce_email_complete(
  p_activity_id uuid, p_token uuid, p_done boolean, p_emailed integer,
  p_failed integer, p_error text, p_skipped boolean
) returns boolean language plpgsql security definer set search_path = 'public' as
$$
begin
  if not public.scn_can_announce_activity(p_activity_id) then
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
     and m.email_claim_by = auth.uid()
     and m.email_claim_token = p_token;
  return found;
end
$$;

-- Bo signature cu - doi sang token-based, khong de overload song song.
drop function if exists public.scn_announce_email_claim(uuid);
drop function if exists public.scn_announce_email_complete(uuid, boolean, integer, integer, text, boolean);

revoke all on function public.scn_announce_fulfill(uuid, text, text) from public, anon;
revoke all on function public.scn_announce_email_claim(uuid, uuid) from public, anon;
revoke all on function public.scn_announce_email_complete(uuid, uuid, boolean, integer, integer, text, boolean) from public, anon;
grant execute on function public.scn_announce_fulfill(uuid, text, text) to authenticated;
grant execute on function public.scn_announce_email_claim(uuid, uuid) to authenticated;
grant execute on function public.scn_announce_email_complete(uuid, uuid, boolean, integer, integer, text, boolean) to authenticated;
