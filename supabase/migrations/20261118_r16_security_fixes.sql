-- ===========================================================================
-- R16 - Remediation sau External Review Codex Cloud (round moi, HEAD 7b5d969)
-- Raw report: docs/reviews/codex-cloud-report-r16-raw.txt
-- Triage + mapping: docs/reviews/EXTERNAL-REVIEW-r16.md
--
-- R16-01 [CRITICAL] profiles_no_priv_escalation: bgh/so_gd co the tu doi
--   role/school_id/concurrent_roles tren row cua chinh minh qua
--   profiles_self_update -> tu phong len admin. Gio chi 'admin' trong role set
--   cua actor duoc doi cac cot nay qua non-service call. Service role giu
--   nguyen (toan bo user-management app di qua admin client).
-- R16-02 [HIGH] Storage lesson-plans: SELECT/INSERT chi check prefix truong ->
--   PH/HS co school_id doc duoc file giao an. Them staff-role check.
-- R16-03 [HIGH] is_staff() chua ke_toan -> ke toan doc ho so hanh kiem/nang
--   luc/vang tiet cua HS. Them scn_is_edu_staff() (staff tru ke_toan/pht-le?
--   giu pht - PHT la lanh dao) va swap tren 6 policy doc record nhay cam.
-- R16-04 [HIGH] period_absences insert/update khong bind student vao lop cua
--   log -> ghi vang cho HS tuy y. Them exists() student.class = entry.class.
-- R16-05 [HIGH] tvc.questions owner doi duoc school_id (inject bank truong
--   khac) va review_state (tu duyet). Trigger: owner_id/school_id immutable;
--   review_state chi reviewer-role doi; sua noi dung -> review_state ve
--   'unreviewed' (invalidate approval cu).
-- R16-06 [HIGH] tvc.materials owner update status tuy y (set 'published' bo
--   qua review) + sua noi dung da duyet. Trigger: status/review_note chi doi
--   qua review RPC (set_config flag); content/title sua khi dang duyet/da
--   xuat ban -> demote ve 'personal' (restart approval); school_id/author_id
--   immutable.
-- R16-07 [HIGH] tvc.review_material: NULL-school fail-open, khong lock ->
--   race 2 nguoi duyet ghi de, BGH publish bo qua totruong_ok, khong check
--   feature/ACL. Rewrite: FOR UPDATE + CAS + IS DISTINCT FROM +
--   scn_has_feature('studio.review') + scn_item_denied.
-- R16-08 [MED] Commit sync_tvc_profile dang chay tren prod (truoc day ap qua
--   MCP, repo thieu SQL - finding "not reviewable/reproducible") + xu ly
--   demotion: mat het staff role -> tvc.profiles.role='former' (giu FK,
--   mat het quyen TVC). Trigger chi ban khi cot lien quan doi.
-- R16-09 [HIGH] scn_sync_period_attendance SECURITY INVOKER nen phai mo
--   branch source='period_log' trong att policies -> GVBM forge/xoa derived
--   attendance + khong validate student thuoc lop. Chuyen SECURITY DEFINER +
--   authz ben trong (GVCN lop / GV day lop do ngay do / day thay / BGH+) +
--   student_ids giao voi HS cua lop. Bo branch period_log khoi att_ins/upd.
--   Sync khong duoc dong vao row source='manual' (manual confirm thang).
-- R16-10 [MED] scn_save_attendance manual confirm giu source='period_log' ->
--   sync sau ghi de gia tri da xac nhan. Set source='manual' khi upsert.
-- R16-11 [MED] scn_save_grades tin entered_by tu payload -> mao danh nguoi
--   cham. Lay auth.uid() server-side.
-- R16-12 [MED] KHBD default non-atomic -> unique partial index + RPC
--   scn_khbd_set_default atomic (clear + set trong 1 tx).
-- R16-13 [MED] digest_deliveries khong unique (parent, week) -> dup send.
--   Unique index + dedupe data cu.
-- R16-14 [HIGH] period-log save = 4 request client (insert log, delete
--   absences, insert, sync) -> loi giua chung mat du lieu. RPC
--   scn_save_period_log 1 transaction: upsert log theo (entry,date) +
--   delete+insert absences + sync.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- R16-01: chan tu phong quyen tren profiles
-- ---------------------------------------------------------------------------
create or replace function public.profiles_no_priv_escalation() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_actor text[];
  v_jwt_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  if v_jwt_role = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.school_id is distinct from old.school_id
     or new.concurrent_roles is distinct from old.concurrent_roles
     or new.campus_id is distinct from old.campus_id
     or new.department_id is distinct from old.department_id
     or new.org_unit_id is distinct from old.org_unit_id then
    select array[p.role]::text[] || coalesce(p.concurrent_roles, '{}'::text[])
      into v_actor from public.profiles p where p.id = auth.uid();
    -- Chi global admin duoc doi vai tro/truong/co so/phong ban/to chuc.
    -- bgh/so_gd/pht khong con trong allowlist: toan bo gan quyen hop le di
    -- qua service-role actions; direct PostgREST chi la duong exploit.
    if not (coalesce(v_actor, '{}'::text[]) && array['admin'::text]) then
      raise exception 'Khong the thay doi vai tro, truong hoac to chuc';
    end if;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- R16-02: lesson-plans storage - chi staff duoc doc/ghi
-- ---------------------------------------------------------------------------
drop policy if exists lesson_plans_files_select on storage.objects;
create policy lesson_plans_files_select on storage.objects for select
  using (
    bucket_id = 'lesson-plans'
    and split_part(name, '/', 1) = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role in ('gvcn','gvbm','to_truong','bgh','pht','admin')
             or p.concurrent_roles && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[]))
  );

drop policy if exists lp_files_read_same_school on storage.objects;
create policy lp_files_read_same_school on storage.objects for select
  using (
    bucket_id = 'lesson-plans'
    and (storage.foldername(name))[1] = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role in ('gvcn','gvbm','to_truong','bgh','pht','admin')
             or p.concurrent_roles && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[]))
  );

drop policy if exists lp_files_insert_same_school on storage.objects;
create policy lp_files_insert_same_school on storage.objects for insert
  with check (
    bucket_id = 'lesson-plans'
    and (storage.foldername(name))[1] = (select p.school_id::text from public.profiles p where p.id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role in ('gvcn','gvbm','to_truong','bgh','pht','admin')
             or p.concurrent_roles && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[]))
  );

drop policy if exists lesson_plans_files_insert on storage.objects;
create policy lesson_plans_files_insert on storage.objects for insert
  with check (
    bucket_id = 'lesson-plans'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role in ('gvcn','gvbm','to_truong','bgh','pht','admin')
             or p.concurrent_roles && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[])
        and split_part(objects.name, '/', 1) = (p.school_id)::text)
  );

-- ---------------------------------------------------------------------------
-- R16-03: ke_toan khong doc ho so hanh kiem/nang luc/vang tiet/lich su HS
-- ---------------------------------------------------------------------------
create or replace function public.scn_is_edu_staff() returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from profiles p where p.id = auth.uid()
     and (p.role in ('gvcn','gvbm','to_truong','bgh','pht','admin')
          or p.concurrent_roles && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[])) $$;

drop policy if exists cr_staff_read on public.conduct_records;
create policy cr_staff_read on public.conduct_records for select
  using ((select scn_is_edu_staff())
         and ((select scn_is_dept()) or (student_id in (select my_school_student_ids()))));

drop policy if exists pa_staff_read on public.period_absences;
create policy pa_staff_read on public.period_absences for select
  using ((select scn_is_edu_staff())
         and ((select scn_is_dept()) or (student_id in (select my_school_student_ids()))));

drop policy if exists nlpc_staff_read on public.competency_evaluations;
create policy nlpc_staff_read on public.competency_evaluations for select
  using ((select scn_is_edu_staff())
         and ((select scn_is_dept()) or (student_id in (select my_school_student_ids()))));

drop policy if exists nlpc_cmt_staff_read on public.nlpc_comments;
create policy nlpc_cmt_staff_read on public.nlpc_comments for select
  using ((select scn_is_edu_staff())
         and ((select scn_is_dept()) or scn_student_in_school(student_id)));

drop policy if exists ce_staff_read on public.conduct_evaluations;
create policy ce_staff_read on public.conduct_evaluations for select
  using ((select scn_is_edu_staff())
         and ((select scn_is_dept()) or (student_id in (select my_school_student_ids()))));

drop policy if exists srh_staff_read on public.student_record_history;
create policy srh_staff_read on public.student_record_history for select
  using ((select scn_is_edu_staff())
         and ((select scn_is_dept()) or scn_student_in_school(student_id)));

-- ---------------------------------------------------------------------------
-- R16-04: period_absences phai bind student vao lop cua period_log
-- ---------------------------------------------------------------------------
drop policy if exists pa_owner_ins on public.period_absences;
create policy pa_owner_ins on public.period_absences for insert
  with check (
    exists (
      select 1
        from period_logs pl
        join timetable_entries te on te.id = pl.timetable_entry_id
        join students s on s.id = period_absences.student_id
                      and s.class_id = te.class_id
       where pl.id = period_absences.period_log_id
         and (scn_is_my_ttentry(pl.timetable_entry_id)
              or scn_is_sub_ttentry_date(pl.timetable_entry_id, pl.date)
              or (select my_roles()) && array['bgh','admin']::text[]))
  );

drop policy if exists pa_owner_upd on public.period_absences;
create policy pa_owner_upd on public.period_absences for update
  using (
    exists (
      select 1 from period_logs pl
       where pl.id = period_absences.period_log_id
         and (scn_is_my_ttentry(pl.timetable_entry_id)
              or scn_is_sub_ttentry_date(pl.timetable_entry_id, pl.date)
              or (select my_roles()) && array['bgh','admin']::text[])))
  with check (
    exists (
      select 1
        from period_logs pl
        join timetable_entries te on te.id = pl.timetable_entry_id
        join students s on s.id = period_absences.student_id
                      and s.class_id = te.class_id
       where pl.id = period_absences.period_log_id
         and (scn_is_my_ttentry(pl.timetable_entry_id)
              or scn_is_sub_ttentry_date(pl.timetable_entry_id, pl.date)
              or (select my_roles()) && array['bgh','admin']::text[])));

-- ---------------------------------------------------------------------------
-- R16-05: tvc.questions - tenant/ownership immutable + review_state guard
-- ---------------------------------------------------------------------------
create or replace function tvc.guard_question_update() returns trigger
language plpgsql security definer set search_path = 'public','tvc'
as $$
declare
  v_jwt text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  if v_jwt = 'service_role' then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.school_id is distinct from old.school_id then
    raise exception 'Khong the thay doi chu so huu hoac truong cua cau hoi';
  end if;
  if new.review_state is distinct from old.review_state
     and not ((select my_roles()) && array['to_truong','bgh','admin']::text[]) then
    raise exception 'Chi to truong/BGH duoc thay doi trang thai duyet';
  end if;
  -- Sua noi dung da duyet -> invalidate approval (khong ap dung khi chi doi
  -- review_state/metadata).
  if (new.stem is distinct from old.stem
      or new.answer is distinct from old.answer
      or new.solution is distinct from old.solution
      or new.qtype is distinct from old.qtype
      or new.level is distinct from old.level
      or new.points is distinct from old.points)
     and old.review_state = 'approved' then
    new.review_state := 'unreviewed';
  end if;
  return new;
end
$$;

drop trigger if exists trg_tvc_question_guard on tvc.questions;
create trigger trg_tvc_question_guard
  before update on tvc.questions
  for each row execute function tvc.guard_question_update();

-- ---------------------------------------------------------------------------
-- R16-06: tvc.materials - status chi doi qua review RPC; content edit demote
-- ---------------------------------------------------------------------------
create or replace function tvc.guard_material_update() returns trigger
language plpgsql security definer set search_path = 'public','tvc'
as $$
declare
  v_jwt text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
  v_rpc text := coalesce(current_setting('tvc.review_rpc', true), '');
begin
  if v_jwt = 'service_role' then
    return new;
  end if;
  if new.author_id is distinct from old.author_id
     or new.school_id is distinct from old.school_id then
    raise exception 'Khong the thay doi tac gia hoac truong cua hoc lieu';
  end if;
  if (new.status is distinct from old.status
      or new.review_note is distinct from old.review_note)
     and v_rpc <> 'on' then
    raise exception 'Trang thai hoc lieu chi thay doi qua quy trinh duyet';
  end if;
  -- Sua noi dung/tieu de khi dang duyet hoac da xuat ban -> ve 'personal',
  -- approval phai bat dau lai tu dau.
  if (new.content is distinct from old.content
      or new.title is distinct from old.title)
     and old.status in ('in_review','totruong_ok','published') then
    new.status := 'personal';
    new.review_note := null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_tvc_material_guard on tvc.materials;
create trigger trg_tvc_material_guard
  before update on tvc.materials
  for each row execute function tvc.guard_material_update();

-- ---------------------------------------------------------------------------
-- R16-07: tvc.review_material - lock + CAS + NULL-safe + feature/ACL
-- ---------------------------------------------------------------------------
create or replace function tvc.review_material(mid uuid, decision text, note text default '') returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
declare
  m tvc.materials%rowtype;
  rs text[];
  lay int;
  n int;
begin
  if auth.uid() is null then
    return jsonb_build_object('error','Chưa đăng nhập.');
  end if;
  if decision not in ('approve','reject') then
    return jsonb_build_object('error','Quyết định không hợp lệ.');
  end if;
  if not public.scn_has_feature('studio.review') then
    return jsonb_build_object('error','Tính năng duyệt học liệu đang tắt.');
  end if;
  select * into m from tvc.materials where id = mid for update;
  if not found then
    return jsonb_build_object('error','Không tìm thấy học liệu.');
  end if;
  if m.school_id is distinct from my_school_id() then
    return jsonb_build_object('error','Học liệu không thuộc trường của bạn.');
  end if;
  if public.scn_item_denied('materials', mid) then
    return jsonb_build_object('error','Bạn bị chặn thao tác học liệu này.');
  end if;
  select array[p.role]::text[] || coalesce(p.concurrent_roles,'{}'::text[])
    into rs from public.profiles p where p.id = auth.uid();
  -- Mo cua cho guard trigger: status/review_note chi doi trong pham vi RPC.
  perform set_config('tvc.review_rpc', 'on', true);

  if 'to_truong' = any(rs) and m.status = 'in_review' then
    lay := 1;
    update tvc.materials
      set status = case when decision='approve' then 'totruong_ok' else 'rejected' end,
          review_note = note, updated_at = now()
      where id = mid and status = 'in_review';
  elsif rs && array['bgh','admin']::text[] then
    if m.status = 'totruong_ok' then
      lay := 2;
      update tvc.materials
        set status = case when decision='approve' then 'published' else 'rejected' end,
            review_note = note, updated_at = now()
        where id = mid and status = 'totruong_ok';
    elsif m.status = 'in_review' then
      lay := 1;
      update tvc.materials
        set status = case when decision='approve' then 'totruong_ok' else 'rejected' end,
            review_note = note, updated_at = now()
        where id = mid and status = 'in_review';
    else
      return jsonb_build_object('error','Học liệu không ở trạng thái chờ duyệt.');
    end if;
  else
    return jsonb_build_object('error','Không có quyền duyệt học liệu.');
  end if;

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('error','Trạng thái học liệu vừa thay đổi - vui lòng tải lại.');
  end if;

  insert into tvc.reviews (material_id, reviewer_id, layer, status, notes)
    values (mid, auth.uid(), lay,
            case when decision='approve' then 'approved' else 'rejected' end,
            case when lay = 1 and rs && array['bgh','admin']::text[]
                      and not ('to_truong' = any(rs))
                 then '[duyệt thay tổ trưởng] ' || note else note end);
  return jsonb_build_object('ok', true);
end
$$;

-- Submit flow cung can flag de qua guard (RPC security definer, jwt van la
-- 'authenticated' khi user goi truc tiep).
create or replace function tvc.submit_material_review(mid uuid)
 returns jsonb
 language plpgsql security definer set search_path = 'tvc', 'public'
as $function$
declare m tvc.materials%rowtype;
begin
  select * into m from tvc.materials where id = mid for update;
  if not found then return jsonb_build_object('error','Không tìm thấy học liệu.'); end if;
  if m.author_id <> auth.uid() then return jsonb_build_object('error','Chỉ tác giả mới gửi duyệt.'); end if;
  if m.status not in ('personal','draft','rejected','withdrawn') then
    return jsonb_build_object('error','Trạng thái không hợp lệ để gửi duyệt.');
  end if;
  perform set_config('tvc.review_rpc', 'on', true);
  update tvc.materials set status='in_review', updated_at=now() where id=mid;
  insert into tvc.reviews (material_id, reviewer_id, layer, status, notes)
    values (mid, auth.uid(), 0, 'submitted', 'Gửi duyệt');
  return jsonb_build_object('ok', true);
end $function$;

-- ---------------------------------------------------------------------------
-- R16-08: commit sync_tvc_profile dang chay tren prod + xu ly demotion
-- ---------------------------------------------------------------------------
alter table tvc.profiles drop constraint if exists profiles_role_check;
alter table tvc.profiles add constraint profiles_role_check
  check (role in ('giao_vien','kiem_duyet','admin','former'));

create or replace function public.sync_tvc_profile() returns trigger
language plpgsql security definer set search_path = 'public', 'tvc'
as $$
declare
  roles text[] := array[new.role]::text[] || coalesce(new.concurrent_roles, '{}'::text[]);
  old_roles text[] := array[old.role]::text[] || coalesce(old.concurrent_roles, '{}'::text[]);
  trole text;
  staff text[] := array['gvcn','gvbm','to_truong','bgh','admin']::text[];
begin
  if roles && staff then
    trole := case
      when 'admin' = any(roles) then 'admin'
      when roles && array['to_truong','bgh']::text[] then 'kiem_duyet'
      else 'giao_vien'
    end;
    insert into tvc.profiles (id, role, full_name, email)
    values (new.id, trole, coalesce(new.full_name, ''), new.email)
    on conflict (id) do update
      set full_name = excluded.full_name,
          email = excluded.email;
  elsif tg_op = 'UPDATE' and old_roles && staff then
    -- Mat het staff role (demotion): ha quyen TVC ve 'former' - giu row de
    -- khong vo FK (materials.author_id, reviews.reviewer_id) nhung
    -- tvc.my_role() khong con cap quyen nao.
    update tvc.profiles set role = 'former' where id = new.id;
  end if;
  return new;
end
$$;

-- Trigger chi ban khi cot lien quan doi (tranh write spam vao tvc.profiles).
drop trigger if exists trg_sync_tvc_profile on public.profiles;
create trigger trg_sync_tvc_profile
  after insert or update of role, concurrent_roles, full_name, email
  on public.profiles
  for each row execute function public.sync_tvc_profile();

-- ---------------------------------------------------------------------------
-- R16-09: scn_sync_period_attendance - definer + authz + class-bound
-- ---------------------------------------------------------------------------
create or replace function public.scn_sync_period_attendance(p_date date, p_class_id uuid, p_student_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_allowed boolean;
  v_ids uuid[];
begin
  if p_date is null or p_class_id is null or p_student_ids is null then
    raise exception 'period_attendance_sync_invalid';
  end if;

  -- Chi nguoi co quyen ghi tren lop/ngay do moi duoc dong bo:
  -- GVCN lop, GV day tiet cua lop (hoac day thay dung ngay), BGH/admin truong.
  select (
    exists(select 1 from classes c where c.id = p_class_id and c.gvcn_id = auth.uid())
    or exists(select 1 from timetable_entries te
               where te.class_id = p_class_id
                 and (scn_is_my_ttentry(te.id) or scn_is_sub_ttentry_date(te.id, p_date)))
    or ((select my_roles()) && array['bgh','admin']::text[]
        and exists(select 1 from classes c where c.id = p_class_id and c.school_id = my_school_id()))
  ) into v_allowed;
  if not v_allowed then
    raise exception 'period_attendance_sync_denied';
  end if;

  -- student_ids chi tinh trong lop - tham so ngoai khong the keo HS la vao.
  select array_agg(s.id) into v_ids
    from students s
   where s.class_id = p_class_id and s.id = any(p_student_ids);

  perform pg_advisory_xact_lock(
    hashtextextended(p_class_id::text || ':' || p_date::text, 0));

  delete from attendance_records
   where student_id = any(coalesce(v_ids, '{}'::uuid[]))
     and date = p_date
     and source = 'period_log';

  with worst as (
    select distinct on (pa.student_id) pa.student_id, pa.status
      from period_absences pa
      join period_logs pl on pl.id = pa.period_log_id
      join timetable_entries te on te.id = pl.timetable_entry_id
     where pl.date = p_date
       and te.class_id = p_class_id
       and pa.student_id = any(coalesce(v_ids, '{}'::uuid[]))
     order by pa.student_id,
       case pa.status
         when 'unexcused' then 3
         when 'excused' then 2
         when 'late' then 1
         else 0
       end desc
  )
  insert into attendance_records (student_id, date, status, source)
  select w.student_id, p_date, w.status, 'period_log'
    from worst w
  on conflict (student_id, date) do update
    set status = excluded.status
    where attendance_records.source = 'period_log'
        and case excluded.status
              when 'unexcused' then 3
              when 'excused' then 2
              when 'late' then 1
              else 0
            end
          > case attendance_records.status
              when 'unexcused' then 3
              when 'excused' then 2
              when 'late' then 1
              else 0
            end;
end;
$$;

-- Dong branch forge derived: source='period_log' chi ghi qua RPC definer.
drop policy if exists att_del on public.attendance_records;
create policy att_del on public.attendance_records for delete
  using (
    (((select my_roles()) @> array['gvcn'::text]) and scn_student_in_my_homeroom(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text]));

drop policy if exists att_ins on public.attendance_records;
create policy att_ins on public.attendance_records for insert
  with check (
    (((select my_roles()) @> array['gvcn'::text]) and scn_student_in_my_homeroom(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text]));

drop policy if exists att_upd on public.attendance_records;
create policy att_upd on public.attendance_records for update
  using (
    (((select my_roles()) @> array['gvcn'::text]) and scn_student_in_my_homeroom(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text]))
  with check (
    (((select my_roles()) @> array['gvcn'::text]) and scn_student_in_my_homeroom(student_id))
    or (((select my_roles()) @> array['bgh'::text]) and scn_student_in_school(student_id))
    or ((select my_roles()) @> array['admin'::text]));

-- ---------------------------------------------------------------------------
-- R16-10: manual confirm -> source='manual' (sync khong ghi de)
-- ---------------------------------------------------------------------------
create or replace function public.scn_save_attendance(p_date date, p_rows jsonb)
 returns void language plpgsql set search_path to 'public' as $function$
begin
  if p_date is null then
    raise exception 'attendance_save_invalid';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'attendance_save_invalid';
  end if;

  insert into attendance_records (student_id, date, status, note, source)
  select (r->>'student_id')::uuid, p_date, r->>'status', r->>'note', 'manual'
  from jsonb_array_elements(p_rows) r
  on conflict (student_id, date) do update
    set status = excluded.status, note = excluded.note, source = 'manual';

  if exists (
    select 1
      from jsonb_array_elements(p_rows) r
     where not exists (
       select 1 from attendance_records a
        where a.student_id = (r->>'student_id')::uuid
          and a.date = p_date
          and a.status = r->>'status'
          and a.note is not distinct from r->>'note'
          and a.source = 'manual'))
  then
    raise exception 'attendance_save_denied';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- R16-11: scn_save_grades - entered_by tu auth.uid(), khong tin payload
-- ---------------------------------------------------------------------------
create or replace function public.scn_save_grades(p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb)
 returns void language plpgsql set search_path to 'public' as $function$
begin
  delete from grades where student_id = any(p_student_ids) and subject_id = p_subject_id and term = p_term;
  insert into grades (student_id, subject_id, term, entered_by, subtype, assessment_type, seq, level, score, comment, result)
  select (r->>'student_id')::uuid, p_subject_id, p_term, auth.uid(), coalesce(r->>'subtype', ''), r->>'assessment_type', (r->>'seq')::smallint, r->>'level', (r->>'score')::numeric, r->>'comment', r->>'result'
  from jsonb_array_elements(p_rows) as r;
end;
$function$;

-- ---------------------------------------------------------------------------
-- R16-12: KHBD - 1 default moi truong (unique) + RPC atomic
-- ---------------------------------------------------------------------------
create unique index if not exists tvc_khbd_templates_one_default
  on tvc.khbd_templates (school_id) where is_default;

create or replace function public.scn_khbd_set_default(p_id uuid)
returns void
language plpgsql
security invoker
set search_path to 'public','tvc'
as $$
declare
  v_school uuid;
begin
  select school_id into v_school from tvc.khbd_templates where id = p_id;
  if v_school is null then
    raise exception 'khbd_template_not_found';
  end if;
  update tvc.khbd_templates set is_default = false
   where school_id = v_school and is_default and id <> p_id;
  update tvc.khbd_templates set is_default = true where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- R16-13: digest_deliveries - 1 delivery / (parent, week_start)
-- ---------------------------------------------------------------------------
delete from public.digest_deliveries a
 using public.digest_deliveries b
 where a.parent_id = b.parent_id
   and a.week_start = b.week_start
   and a.id < b.id;

create unique index if not exists digest_deliveries_parent_week
  on public.digest_deliveries (parent_id, week_start);

-- ---------------------------------------------------------------------------
-- R16-14: scn_save_period_log - log + absences + sync trong 1 transaction
-- ---------------------------------------------------------------------------
create or replace function public.scn_save_period_log(
  p_entry uuid, p_date date, p_log jsonb, p_absences jsonb
) returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_log uuid;
  v_class uuid;
  v_ids uuid[];
begin
  if p_entry is null or p_date is null then
    raise exception 'period_log_save_invalid';
  end if;
  select class_id into v_class from timetable_entries where id = p_entry;
  if v_class is null then
    raise exception 'period_log_save_invalid';
  end if;
  -- Quyen ghi: RLS tren period_logs/period_absences tu enforce; check som de
  -- tra loi ro rang thay vi silent 0-row.
  if not (scn_is_my_ttentry(p_entry)
          or scn_is_sub_ttentry_date(p_entry, p_date)
          or ((select my_roles()) && array['bgh','admin']::text[])) then
    raise exception 'period_log_save_denied';
  end if;

  insert into period_logs (timetable_entry_id, date, logged_by,
                           present_count, lesson_title, lesson_content,
                           teacher_comment, note)
  values (p_entry, p_date, auth.uid(),
          nullif(p_log->>'present_count','')::int,
          nullif(p_log->>'lesson_title',''),
          nullif(p_log->>'lesson_content',''),
          nullif(p_log->>'teacher_comment',''),
          nullif(p_log->>'teacher_comment',''))
  on conflict (timetable_entry_id, date) do update
    set present_count = excluded.present_count,
        lesson_title = excluded.lesson_title,
        lesson_content = excluded.lesson_content,
        teacher_comment = excluded.teacher_comment,
        note = excluded.note
  returning id into v_log;

  delete from period_absences where period_log_id = v_log;

  if p_absences is not null and jsonb_typeof(p_absences) = 'array' then
    insert into period_absences (period_log_id, student_id, status)
    select v_log, (a->>'student_id')::uuid, a->>'status'
      from jsonb_array_elements(p_absences) a
     where a->>'status' in ('unexcused','excused','late')
       and exists (select 1 from students s
                    where s.id = (a->>'student_id')::uuid
                      and s.class_id = v_class);
  end if;

  -- Sync nguyen lop: HS bi bo mark cung phai duoc recompute de xoa derived
  -- attendance cu (chi dung ids tu p_absences se bo sot ho).
  select array_agg(s.id) into v_ids from students s where s.class_id = v_class;
  if v_ids is not null then
    perform public.scn_sync_period_attendance(p_date, v_class, v_ids);
  end if;

  return v_log;
end;
$$;

-- ---------------------------------------------------------------------------
-- R16-15 [HIGH] dept-brief keo raw students+attendance ve app-memory de
-- aggregate (vuot cap 100k rows o quy mo 100k HS). Chuyen sang aggregate
-- trong SQL - chi tra per-school counts.
-- ---------------------------------------------------------------------------
create or replace function public.scn_dept_brief_stats(p_since date)
returns table(school_id uuid, school_name text, class_count bigint,
              student_count bigint, att_total bigint, att_absent bigint)
language sql stable security invoker set search_path = 'public'
as $$
  select s.id, s.name,
    (select count(*) from classes c where c.school_id = s.id and c.status = 'active'),
    (select count(*) from students st join classes c2 on c2.id = st.class_id
      where c2.school_id = s.id and st.status = 'active'),
    coalesce(a.total, 0), coalesce(a.absent, 0)
  from schools s
  left join lateral (
    select count(*) total, count(*) filter (where ar.status <> 'present') absent
      from attendance_records ar
      join students st2 on st2.id = ar.student_id
      join classes c3 on c3.id = st2.class_id
     where c3.school_id = s.id and ar.date >= p_since
  ) a on true
  order by s.name
$$;
