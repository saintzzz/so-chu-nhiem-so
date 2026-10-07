-- External Review round 2 (docs/reviews/EXTERNAL-REVIEW-r2.md) + vong re-review.
-- CHUA APPLY tren production - ap dung sau khi GPT-6 Sol duyet diff.
--
-- R2-02: messages.msg_send chi kiem sender_id -> them scn_can_message()
--        kiem quan he nguoi gui - nguoi nhan - HS cung truong.
--        msg_read_update truoc day chi USING recipient -> recipient UPDATE
--        duoc sender_id/student_id/content (spoof). Them trigger
--        trg_messages_immutable: moi truong bat bien tru read_at.
-- R2-03: substitute_requests approved o NGAY TUONG LAI cap quyen ngay
--        (predicate chi co bien duoi). Them r.date <= current_date va
--        rang buoc r.school_id = truong cua lop.
-- R2-04: GV day thay khong ghi duoc so dau bai. Them
--        scn_is_sub_ttentry_date(tid, d): DUNG ngay phan cong, DUNG mon
--        (khong wildcard subject null), school_id phai khop, va chi cho
--        ghi trong cua so [current_date - 60, current_date].
--        subr_ins/subr_upd cung duoc siết: class/subject/teachers phai
--        thuoc school_id cua request, INSERT chi tao status='pending',
--        UPDATE status chi qua trigger transition hop le + approver.
-- R2-10: PHT chua gan campus_id -> fail-open. scn_pht_allows_campus()
--        gan vao cac helper RLS: campus NULL => khong thay gi.

-- ===========================================================================
-- R2-10: ranh gioi campus cho PHT (fail-closed)
-- ===========================================================================
create or replace function public.scn_pht_allows_campus(campus uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- Chi rang buoc vai tro pht: lop phai thuoc campus duoc phan cong.
  -- campus_id cua PHT = null => ve phai null => false => fail-closed.
  select (select my_role()) is distinct from 'pht'
      or campus = (select p.campus_id from profiles p where p.id = auth.uid())
$function$;

create or replace function public.my_school_class_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select id from classes
   where school_id = (select my_school_id())
     and scn_pht_allows_campus(campus_id)
$function$;

create or replace function public.my_school_student_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select s.id from students s join classes c on c.id = s.class_id
   where c.school_id = (select my_school_id())
     and scn_pht_allows_campus(c.campus_id)
$function$;

create or replace function public.my_school_ttentry_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select t.id from timetable_entries t join classes c on c.id = t.class_id
   where c.school_id = (select my_school_id())
     and scn_pht_allows_campus(c.campus_id)
$function$;

create or replace function public.my_school_parent_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select ps.parent_id from parent_students ps
   join students s on s.id = ps.student_id
   join classes c on c.id = s.class_id
   where c.school_id = (select my_school_id())
     and scn_pht_allows_campus(c.campus_id)
$function$;

create or replace function public.scn_class_in_school(cid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from classes c
   where c.id = cid and c.school_id = (select my_school_id())
     and scn_pht_allows_campus(c.campus_id))
$function$;

create or replace function public.scn_student_in_school(sid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from students s join classes c on c.id = s.class_id
   where s.id = sid and c.school_id = (select my_school_id())
     and scn_pht_allows_campus(c.campus_id))
$function$;

create or replace function public.scn_ttentry_in_school(tid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from timetable_entries t join classes c on c.id = t.class_id
   where t.id = tid and c.school_id = (select my_school_id())
     and scn_pht_allows_campus(c.campus_id))
$function$;

create or replace function public.scn_parent_in_school(parid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from parent_students ps
   join students s on s.id = ps.student_id
   join classes c on c.id = s.class_id
   where ps.parent_id = parid and c.school_id = (select my_school_id())
     and scn_pht_allows_campus(c.campus_id))
$function$;

-- ===========================================================================
-- R2-03: phan cong day thay chi co hieu luc DEN NGAY duoc phan cong.
--        Giu cua so 60 ngay lui lai de GV day thay con nhap lieu sau buoi day.
--        Them r.school_id = truong lop de chan request co class_id gia mao
--        (phong du lieu da ghi truoc khi subr_ins duoc siết).
-- ===========================================================================
create or replace function public.scn_i_teach_student_subject(sid uuid, subid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from students s
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid
      and t.teacher_id = auth.uid()
      and t.subject_id = subid
  ) or exists (
    select 1 from students s
    join classes c on c.id = s.class_id
    join substitute_requests r on r.class_id = s.class_id
    where s.id = sid
      and r.school_id = c.school_id
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.subject_id = subid
      and r.date >= current_date - 60
      and r.date <= current_date
  )
$function$;

create or replace function public.scn_student_in_my_teaching(sid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(
    select 1 from students s
    join timetable_entries t on t.class_id = s.class_id
    where s.id = sid and t.teacher_id = auth.uid()
  ) or exists(
    select 1 from students s
    join classes c on c.id = s.class_id
    join substitute_requests r on r.class_id = s.class_id
    where s.id = sid
      and r.school_id = c.school_id
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.date >= current_date - 60
      and r.date <= current_date
  )
$function$;

-- ===========================================================================
-- R2-04: GV day thay duoc ghi so dau bai DUNG ngay/lop/mon/tiet phan cong.
-- ===========================================================================
create or replace function public.scn_is_sub_ttentry_date(tid uuid, d date)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(
    select 1 from timetable_entries t
    join classes c on c.id = t.class_id
    join substitute_requests r
      on r.class_id = t.class_id
     and r.period = t.period
     and r.subject_id = t.subject_id   -- dung mon, khong wildcard null
     and r.school_id = c.school_id     -- chong request gia mao lop khac truong
    where t.id = tid
      and r.substitute_teacher_id = auth.uid()
      and r.status = 'approved'
      and r.date = d
      and d between current_date - 60 and current_date  -- khong ghi log tuong lai
  )
$function$;

drop policy if exists pl_owner_ins on public.period_logs;
create policy pl_owner_ins on public.period_logs for insert
with check (
  logged_by = (select auth.uid())
  and (scn_is_my_ttentry(timetable_entry_id)
       or scn_is_sub_ttentry_date(timetable_entry_id, date))
);

drop policy if exists pl_owner_upd on public.period_logs;
create policy pl_owner_upd on public.period_logs for update
using (
  scn_is_my_ttentry(timetable_entry_id)
  or scn_is_sub_ttentry_date(timetable_entry_id, date)
  or (select my_role()) = any(array['bgh','admin'])
)
with check (
  scn_is_my_ttentry(timetable_entry_id)
  or scn_is_sub_ttentry_date(timetable_entry_id, date)
  or (select my_role()) = any(array['bgh','admin'])
);

drop policy if exists pl_owner_del on public.period_logs;
create policy pl_owner_del on public.period_logs for delete
using (
  scn_is_my_ttentry(timetable_entry_id)
  or scn_is_sub_ttentry_date(timetable_entry_id, date)
  or (select my_role()) = any(array['bgh','admin'])
);

drop policy if exists pa_owner_ins on public.period_absences;
create policy pa_owner_ins on public.period_absences for insert
with check (
  exists(select 1 from period_logs pl
   where pl.id = period_absences.period_log_id
     and (scn_is_my_ttentry(pl.timetable_entry_id)
          or scn_is_sub_ttentry_date(pl.timetable_entry_id, pl.date)))
);

drop policy if exists pa_owner_upd on public.period_absences;
create policy pa_owner_upd on public.period_absences for update
using (
  exists(select 1 from period_logs pl
   where pl.id = period_absences.period_log_id
     and (scn_is_my_ttentry(pl.timetable_entry_id)
          or scn_is_sub_ttentry_date(pl.timetable_entry_id, pl.date)
          or (select my_role()) = any(array['bgh','admin'])))
);

drop policy if exists pa_owner_del on public.period_absences;
create policy pa_owner_del on public.period_absences for delete
using (
  exists(select 1 from period_logs pl
   where pl.id = period_absences.period_log_id
     and (scn_is_my_ttentry(pl.timetable_entry_id)
          or scn_is_sub_ttentry_date(pl.timetable_entry_id, pl.date)
          or (select my_role()) = any(array['bgh','admin'])))
);

-- ===========================================================================
-- R2-02: subr_* - chan request gia mao: moi tham chieu phai thuoc
--        school_id cua request; INSERT chi tao pending; status chi doi
--        qua transition hop le boi approver (trigger).
-- ===========================================================================
create or replace function public.scn_subr_refs_in_school(school uuid, cid uuid, subid uuid, absent uuid, sub uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from classes c
                where c.id = cid and c.school_id = school
                  and scn_pht_allows_campus(c.campus_id))
     and (subid is null or exists(select 1 from subjects sj
                where sj.id = subid and sj.school_id = school))
     and exists(select 1 from profiles p
                where p.id = absent and p.school_id = school)
     and (sub is null or exists(select 1 from profiles p
                where p.id = sub and p.school_id = school))
$function$;

drop policy if exists subr_ins on public.substitute_requests;
create policy subr_ins on public.substitute_requests for insert
with check (
  is_school_staff()
  and ((select my_role()) = 'admin' or school_id = (select my_school_id()))
  and scn_subr_refs_in_school(school_id, class_id, subject_id, absent_teacher_id, substitute_teacher_id)
  and status = 'pending'   -- quyet dinh duyet/tu choi chi qua UPDATE
  and (requested_by = (select auth.uid())
       or (select my_role()) = any(array['bgh','pht','admin']))
);

drop policy if exists subr_upd on public.substitute_requests;
create policy subr_upd on public.substitute_requests for update
using (
  is_school_staff()
  and ((select my_role()) = 'admin' or school_id = (select my_school_id()))
  and (requested_by = (select auth.uid())
       or (select my_role()) = any(array['bgh','pht','admin']))
)
with check (
  is_school_staff()
  and ((select my_role()) = 'admin' or school_id = (select my_school_id()))
  and scn_subr_refs_in_school(school_id, class_id, subject_id, absent_teacher_id, substitute_teacher_id)
  and (
    -- staff thuong khong duoc dat trang thai quyet dinh
    status = 'pending'
    or (select my_role()) = any(array['bgh','pht','admin'])
  )
);

-- Trigger: chan doi truong phan cong/quyet dinh boi nguoi khong phai
-- approver, va rang buoc status transition pending -> approved|rejected.
create or replace function public.scn_subr_update_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- service_role (auth.uid() null) bypass RLS, giu nguyen de admin/seed
  -- scripts khong bi chan.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.school_id is distinct from old.school_id
     or new.requested_by is distinct from old.requested_by
     or new.created_at is distinct from old.created_at then
    raise exception 'substitute_requests: id/school_id/requested_by are immutable';
  end if;

  if (select my_role()) not in ('bgh','pht','admin') then
    -- Nguoi tao (requested_by) chi duoc sua reason/note, khong doi
    -- phan cong hay trang thai.
    if new.status is distinct from old.status
       or new.class_id is distinct from old.class_id
       or new.subject_id is distinct from old.subject_id
       or new.date is distinct from old.date
       or new.period is distinct from old.period
       or new.absent_teacher_id is distinct from old.absent_teacher_id
       or new.substitute_teacher_id is distinct from old.substitute_teacher_id
       or new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at then
      raise exception 'substitute_requests: decision/assignment fields require approver role';
    end if;
  end if;

  -- Transition hop le: pending -> approved|rejected; giu nguyen la OK.
  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status in ('approved','rejected')) then
    raise exception 'substitute_requests: invalid status transition % -> %', old.status, new.status;
  end if;

  -- Quyet dinh phai do nguoi duyet hien tai ky, co moc thoi gian.
  if new.status in ('approved','rejected')
     and (new.decided_by is distinct from auth.uid() or new.decided_at is null) then
    raise exception 'substitute_requests: decision requires decided_by=auth.uid() and decided_at';
  end if;

  return new;
end
$function$;

drop trigger if exists trg_subr_update_guard on public.substitute_requests;
create trigger trg_subr_update_guard before update on public.substitute_requests
for each row execute function public.scn_subr_update_guard();

-- ===========================================================================
-- R2-02: chi cho gui tin nhan theo quan he thuc:
--  - nhan vien <-> nhan vien cung truong
--  - nhan vien -> PH/HS cua mot HS thuoc pham vi day/chu nhiem (student_id bat buoc)
--  - PH -> nhan vien truong cua con (student_id bat buoc, phai la con minh)
--  - HS -> nhan vien truong minh (student_id rong hoac chinh minh)
-- ===========================================================================
create or replace function public.scn_can_message(recipient uuid, sid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with me as (
    select id, role, school_id from profiles where id = auth.uid()
  ),
  peer as (
    select id, role, school_id from profiles where id = recipient
  ),
  stu as (
    select s.id, s.profile_id, c.school_id, c.gvcn_id
    from students s join classes c on c.id = s.class_id
    where s.id = sid
  )
  select
    exists(select 1 from me)
    and exists(select 1 from peer)
    and recipient <> auth.uid()
    and (
      -- nhan vien cung truong trao doi noi bo; student_id neu co phai cung truong
      (
        (select role from me) = any(array['gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin'])
        and (select role from peer) = any(array['gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin'])
        and (select school_id from me) is not null
        and (select school_id from me) = (select school_id from peer)
        and (sid is null
             or exists(select 1 from stu where stu.school_id = (select school_id from me)))
      )
      or
      -- nhan vien -> PH/HS: student_id bat buoc, thuoc truong minh, trong pham
      -- vi chu nhiem/day (BGH/PHT/admin: toan truong); recipient la PH cua HS
      -- do hoac chinh HS do.
      (
        (select role from me) = any(array['gvcn','gvbm','to_truong','bgh','pht','admin'])
        and exists(select 1 from stu where stu.school_id = (select school_id from me))
        and (
          exists(select 1 from parent_students ps
                 join parents p on p.id = ps.parent_id
                 where ps.student_id = sid and p.profile_id = recipient)
          or exists(select 1 from stu where stu.profile_id = recipient)
        )
        and (
          (select role from me) = any(array['bgh','pht','admin'])
          or exists(select 1 from stu where stu.gvcn_id = auth.uid())
          or scn_student_in_my_teaching(sid)
        )
      )
      or
      -- PH -> nhan vien truong cua con: student_id bat buoc va phai la con minh
      (
        (select role from me) = 'phu_huynh'
        and exists(select 1 from parent_students ps
                   join parents p on p.id = ps.parent_id
                   where ps.student_id = sid and p.profile_id = auth.uid())
        and (select role from peer) = any(array['gvcn','gvbm','to_truong','bgh','pht','admin'])
        and exists(select 1 from stu where stu.school_id = (select school_id from peer))
      )
      or
      -- HS -> nhan vien truong minh: student_id rong hoac chinh minh
      (
        (select role from me) = 'hoc_sinh'
        and (select role from peer) = any(array['gvcn','gvbm','to_truong','bgh','pht','admin'])
        and exists(select 1 from students s join classes c on c.id = s.class_id
                   where s.profile_id = auth.uid()
                     and c.school_id = (select school_id from peer))
        and (sid is null or exists(select 1 from stu where stu.profile_id = auth.uid()))
      )
    )
$function$;

drop policy if exists msg_send on public.messages;
create policy msg_send on public.messages for insert
with check (
  sender_id = (select auth.uid())
  and scn_can_message(recipient_id, student_id)
);

-- WITH CHECK giu recipient la chinh minh; TRIGGER duoi chan moi truong
-- khac (sender_id/student_id/content) bi sua - UPDATE chi de danh dau da doc.
drop policy if exists msg_read_update on public.messages;
create policy msg_read_update on public.messages for update
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create or replace function public.scn_messages_immutable_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- Tin nhan bat bien sau khi gui; chi read_at duoc doi (mark read).
  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.student_id is distinct from old.student_id
     or new.content is distinct from old.content
     or new.created_at is distinct from old.created_at then
    raise exception 'messages rows are immutable except read_at';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_messages_immutable on public.messages;
create trigger trg_messages_immutable before update on public.messages
for each row execute function public.scn_messages_immutable_guard();
