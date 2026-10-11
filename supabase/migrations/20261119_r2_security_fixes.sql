-- ============================================================================
-- Codex External Review ROUND 2 remediation (2026-10-11, HEAD 7e36fdf)
-- 7 High + 5 Medium cua round 2. Chi patch nhung gi can DDL/policies/RPC;
-- phan app-code (ai.ts deadline+endpoint, ai-json validate, SSR ordering,
-- KHBD is_default, exam per-cell) di kem commit source.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- R2-01 [HIGH] NULL-authz fail-open trong 2 ham attendance
-- my_roles() tra NULL khi caller khong co profile -> bieu thuc OR ra NULL ->
-- `if not NULL` khong raise -> tiep tuc DELETE/INSERT dac quyen.
-- Fix: check auth.uid() truoc + `is distinct from true`.
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
  if auth.uid() is null then
    raise exception 'period_attendance_sync_denied';
  end if;
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
  if v_allowed is distinct from true then
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

create or replace function public.scn_save_period_log(p_entry uuid, p_date date, p_log jsonb, p_absences jsonb)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  v_log uuid;
  v_class uuid;
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'period_log_save_denied';
  end if;
  if p_entry is null or p_date is null then
    raise exception 'period_log_save_invalid';
  end if;
  select class_id into v_class from timetable_entries where id = p_entry;
  if v_class is null then
    raise exception 'period_log_save_invalid';
  end if;
  if (scn_is_my_ttentry(p_entry)
      or scn_is_sub_ttentry_date(p_entry, p_date)
      or ((select my_roles()) && array['bgh','admin']::text[])) is not true then
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

-- Definer/entry RPC chi goi boi user da login - dong duong anon o DB level
-- (PostgREST van expose function cho moi role duoc grant).
revoke execute on function public.scn_sync_period_attendance(date, uuid, uuid[]) from public, anon;
revoke execute on function public.scn_save_period_log(uuid, date, jsonb, jsonb) from public, anon;
grant execute on function public.scn_sync_period_attendance(date, uuid, uuid[]) to authenticated;
grant execute on function public.scn_save_period_log(uuid, date, jsonb, jsonb) to authenticated;
revoke execute on function tvc.review_material(uuid, text, text) from public, anon;
revoke execute on function tvc.submit_material_review(uuid) from public, anon;
grant execute on function tvc.review_material(uuid, text, text) to authenticated;
grant execute on function tvc.submit_material_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- R2-02 [HIGH] Question guard: INSERT bypass + invalidation thieu truong
-- - INSERT: review_state bat buoc 'unreviewed' + owner=auth.uid() (tru
--   service_role / review_rpc flag cho import dac quyen).
-- - UPDATE: giu immutable + reviewer-only review_state; bo sung context,
--   media, standard_ids, subject_code, grade, variant_params vao danh sach
--   truong sua thi mat phe duyet (de sinh tu bank dung het cac truong nay).
-- ---------------------------------------------------------------------------
create or replace function tvc.guard_question_update() returns trigger
language plpgsql security definer set search_path = 'public', 'tvc'
as $$
declare
  v_jwt text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
  v_rpc text := coalesce(current_setting('tvc.review_rpc', true), '');
begin
  if v_jwt = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if v_rpc <> 'on' then
      new.review_state := 'unreviewed';
      new.owner_id := auth.uid();
      if new.school_id is not null
         and new.school_id is distinct from (select public.my_school_id()) then
        raise exception 'Cau hoi khong thuoc truong cua ban';
      end if;
    end if;
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
  if (new.stem is distinct from old.stem
      or new.answer is distinct from old.answer
      or new.solution is distinct from old.solution
      or new.qtype is distinct from old.qtype
      or new.level is distinct from old.level
      or new.points is distinct from old.points
      or new.context is distinct from old.context
      or new.media is distinct from old.media
      or new.standard_ids is distinct from old.standard_ids
      or new.subject_code is distinct from old.subject_code
      or new.grade is distinct from old.grade
      or new.variant_params is distinct from old.variant_params)
     and old.review_state = 'approved' then
    new.review_state := 'unreviewed';
  end if;
  return new;
end
$$;

drop trigger if exists trg_tvc_question_guard on tvc.questions;
create trigger trg_tvc_question_guard
  before insert or update on tvc.questions
  for each row execute function tvc.guard_question_update();

-- ---------------------------------------------------------------------------
-- R2-03 [HIGH] Material INSERT bypass quy trinh duyet
-- tvc_mat_owner chi check author_id -> insert truc tiep status='published',
-- review_note gia, school_id truong khac deu qua.
-- INSERT (non-service, non-RPC): buoc author=caller, status='personal',
-- review_note null, school_id phai dung truong cua caller.
-- ---------------------------------------------------------------------------
create or replace function tvc.guard_material_update() returns trigger
language plpgsql security definer set search_path = 'public', 'tvc'
as $$
declare
  v_jwt text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
  v_rpc text := coalesce(current_setting('tvc.review_rpc', true), '');
begin
  if v_jwt = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if v_rpc <> 'on' then
      new.author_id := auth.uid();
      new.status := 'personal';
      new.review_note := null;
      if new.school_id is null then
        new.school_id := (select public.my_school_id());
      elsif new.school_id is distinct from (select public.my_school_id()) then
        raise exception 'Hoc lieu khong thuoc truong cua ban';
      end if;
    end if;
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
  before insert or update on tvc.materials
  for each row execute function tvc.guard_material_update();

-- ---------------------------------------------------------------------------
-- R2-04 [HIGH] 'former' van giu quyen owner + submit duoc
-- - Owner clause cua question policies chi con hieu luc khi van la staff
--   (tru cau hoi ca nhan khong gan truong).
-- - submit_material_review bo sung auth/staff/tenant/deny checks.
-- - sync_tvc_profile: conflict update dong bo ca role (max-rank: khong ha
--   cap admin/kiem_duyet san co, 'former' tro lai thi cap role moi).
-- ---------------------------------------------------------------------------
drop policy if exists tvc_q_read on tvc.questions;
create policy tvc_q_read on tvc.questions for select using (
  not (id in (select public.scn_denied_item_ids('questions')))
  and (
    (owner_id = (select auth.uid())
      and (school_id is null or (select public.scn_is_edu_staff())))
    or (school_id = (select public.my_school_id())
        and (select my_roles()) && array['gvcn','gvbm','to_truong','bgh','admin']::text[])
  )
);

drop policy if exists tvc_q_update on tvc.questions;
create policy tvc_q_update on tvc.questions for update
  using (
    (owner_id = (select auth.uid())
      and (school_id is null or (select public.scn_is_edu_staff())))
    or (school_id = (select public.my_school_id())
        and (select my_roles()) && array['to_truong','bgh','admin']::text[])
  )
  with check (
    (owner_id = (select auth.uid())
      and (school_id is null or (select public.scn_is_edu_staff())))
    or (school_id = (select public.my_school_id())
        and (select my_roles()) && array['to_truong','bgh','admin']::text[])
  );

drop policy if exists tvc_q_delete on tvc.questions;
create policy tvc_q_delete on tvc.questions for delete using (
  (owner_id = (select auth.uid())
    and (school_id is null or (select public.scn_is_edu_staff())))
  or (school_id = (select public.my_school_id())
      and (select my_roles()) && array['to_truong','bgh','admin']::text[])
);

drop policy if exists tvc_mat_owner on tvc.materials;
create policy tvc_mat_owner on tvc.materials for all
  using (author_id = (select auth.uid()) and (select public.scn_is_edu_staff()))
  with check (author_id = (select auth.uid()) and (select public.scn_is_edu_staff()));

create or replace function tvc.submit_material_review(mid uuid) returns jsonb
language plpgsql security definer set search_path = 'tvc', 'public'
as $$
declare m tvc.materials%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('error','Chưa đăng nhập.');
  end if;
  -- R2-04: bi ha cap 'former' (khong con staff) khong duoc gui duyet nua.
  if not (select public.scn_is_edu_staff()) then
    return jsonb_build_object('error','Tài khoản không còn quyền soạn học liệu.');
  end if;
  if not public.scn_has_feature('studio') then
    return jsonb_build_object('error','Tính năng Studio đang tắt.');
  end if;
  select * into m from tvc.materials where id = mid for update;
  if not found then return jsonb_build_object('error','Không tìm thấy học liệu.'); end if;
  if m.author_id <> auth.uid() then return jsonb_build_object('error','Chỉ tác giả mới gửi duyệt.'); end if;
  if m.school_id is not null and m.school_id is distinct from public.my_school_id() then
    return jsonb_build_object('error','Học liệu không thuộc trường của bạn.');
  end if;
  if public.scn_item_denied('materials', mid) then
    return jsonb_build_object('error','Bạn bị chặn thao tác học liệu này.');
  end if;
  if m.status not in ('personal','draft','rejected','withdrawn') then
    return jsonb_build_object('error','Trạng thái không hợp lệ để gửi duyệt.');
  end if;
  perform set_config('tvc.review_rpc', 'on', true);
  update tvc.materials set status='in_review', updated_at=now() where id=mid;
  insert into tvc.reviews (material_id, reviewer_id, layer, status, notes)
    values (mid, auth.uid(), 0, 'submitted', 'Gửi duyệt');
  return jsonb_build_object('ok', true);
end $$;

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
          email = excluded.email,
          -- R2-04: dong bo ca role - 'former' quay lai thi cap role moi;
          -- khong ha cap admin/kiem_duyet da co san (cap tay hoac role cu).
          role = case
            when tvc.profiles.role = 'former' then excluded.role
            when excluded.role = 'admin' then 'admin'
            when tvc.profiles.role = 'admin' then 'admin'
            when excluded.role = 'kiem_duyet' then 'kiem_duyet'
            else tvc.profiles.role
          end;
  elsif tg_op = 'UPDATE' and old_roles && staff then
    update tvc.profiles set role = 'former' where id = new.id;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- R2-05 [HIGH] Guard profiles chan ca BGH quan ly nhan su hop le
-- Mo rong: ngoai 'admin' toan cuc, cho phep BGH/PHT sua nhan su TRONG TRUONG
-- minh voi cac rang buoc: khong doi truong/org, role dich nam trong nhom
-- nhan su truong, concurrent_roles nam trong CONCURRENT_ELIGIBLE, campus/
-- department phai thuoc truong do, khong tu sua chinh minh.
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
    if coalesce(v_actor, '{}'::text[]) && array['admin'::text] then
      return new;
    end if;
    -- BGH/PHT quan ly nhan su trong truong minh (updateStaffAccount /
    -- updateStaffProfile dung direct client sau role check o app layer).
    if not (
      coalesce(v_actor, '{}'::text[]) && array['bgh','pht']::text[]
      and new.id is distinct from auth.uid()
      and old.school_id is not null
      and new.school_id is not distinct from old.school_id
      and old.school_id = (select p.school_id from public.profiles p where p.id = auth.uid())
      and new.org_unit_id is not distinct from old.org_unit_id
      and new.role = any(array['gvcn','gvbm','to_truong','pht','ke_toan','bgh'])
      and new.concurrent_roles <@ array['gvcn','gvbm','to_truong','pht','bgh']::text[]
      and (new.campus_id is null or exists(
            select 1 from public.campuses c
             where c.id = new.campus_id and c.school_id = old.school_id))
      and (new.department_id is null or exists(
            select 1 from public.departments d
             where d.id = new.department_id and d.school_id = old.school_id))
    ) then
      raise exception 'Khong the thay doi vai tro, truong hoac to chuc';
    end if;
  end if;
  return new;
end
$$;

-- R2-05b: truoc day chi co profiles_self_update -> BGH/PHT khong UPDATE duoc
-- ho so nhan su nao (updateStaffAccount/Profile no-op tu lau). Policy row-
-- level mo UPDATE cung truong cho bgh/pht/admin; field-level rang buoc van
-- nam o trigger profiles_no_priv_escalation phia tren.
create policy profiles_staff_mgmt_update on public.profiles for update
  using (
    school_id = (select public.my_school_id())
    and school_id is not null
    and ((select public.my_roles()) && array['bgh','pht','admin']::text[])
  );

-- ---------------------------------------------------------------------------
-- R2-06 [HIGH-ish] review_material: decision=NULL lot allowlist roi chay
-- nhanh reject. not in(...) tra NULL -> `if NULL` bo qua -> tiep tuc.
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
  if decision is null or decision not in ('approve','reject') then
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
