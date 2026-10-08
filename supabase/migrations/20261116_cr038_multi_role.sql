-- CR-038: multi-role (vai tro kiem nhiem) qua profiles.concurrent_roles.
-- my_roles() = role chinh || concurrent_roles; recreate moi policy dung
-- my_role() thanh so sanh mang tuong duong:
--   my_role() = 'x'      -> my_roles() @> ARRAY['x']
--   my_role() = ANY(arr) -> my_roles() && arr
-- Semantics chi NOI them quyen cho nguoi co concurrent_roles; user don role
-- khong doi. 'admin' khong bao gio la concurrent (check constraint) nen
-- cac policy ='admin' van chi khop primary.

create or replace function public.my_roles() returns text[]
language sql stable security definer set search_path = 'public'
as $$
  select array[p.role]::text[] || coalesce(p.concurrent_roles, '{}'::text[])
  from profiles p where p.id = auth.uid()
$$;

-- Chi role co the dung lop duoc kiem nhiem (xem CR-038), va chi nhan su
-- (primary role la staff) moi duoc gan concurrent_roles - chan escalation
-- kieu phu_huynh/hoc_sinh + gvcn.
alter table public.profiles
  add constraint profiles_concurrent_roles_eligible
  check (
    concurrent_roles <@ array['gvcn','gvbm','to_truong','bgh','pht']::text[]
    and (cardinality(coalesce(concurrent_roles,'{}'::text[])) = 0
        or role in ('gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin'))
  );

-- is_staff / is_school_staff: nguoi cam concurrent staff role cung la staff.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from profiles p where p.id = auth.uid()
     and (p.role in ('gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin')
          or p.concurrent_roles && array['gvcn','gvbm','to_truong','bgh','pht']::text[])) $$;

create or replace function public.is_school_staff() returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from profiles p where p.id = auth.uid()
     and (p.role in ('gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin')
          or p.concurrent_roles && array['gvcn','gvbm','to_truong','bgh','pht']::text[])) $$;

-- Trigger guard: BGH/so_gd/admin moi duoc phan cong GVCN - bgh co the la
-- concurrent role nen phai check role set.
create or replace function public.guard_gvcn_assignment() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
begin
  if new.gvcn_id is distinct from old.gvcn_id
     and not (select my_roles()) && array['bgh','so_gd','admin']::text[] then
    raise exception 'Chi BGH moi duoc phan cong giao vien chu nhiem';
  end if;
  return new;
end;
$$;

-- Grade-write scope theo role set: GVCN (kiem GVBM) viet diem lop CN + mon
-- minh day; GVBM/to_truong viet diem mon minh day; BGH trong truong; admin.
create or replace function public.scn_can_write_grade(sid uuid, subid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$
  select is_school_staff() and (
    'admin' = any(my_roles())
    or ('bgh' = any(my_roles()) and scn_student_in_school(sid))
    or ('gvcn' = any(my_roles()) and (
      scn_student_in_my_homeroom(sid) or scn_i_teach_student_subject(sid, subid)
    ))
    or (my_roles() && array['gvbm','to_truong']::text[] and scn_i_teach_student_subject(sid, subid))
  )
$$;

-- SECURITY: profiles_self_update cho user update chinh row minh; them
-- concurrent_roles vao danh sach field duoc guard (truoc day chi chan
-- role/school_id/campus/dept/org -> staff tu gan concurrent_roles la leo
-- quyen). Actor check theo role set vi bgh co the la concurrent.
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
     or new.concurrent_roles is distinct from old.concurrent_roles then
    select array[p.role]::text[] || coalesce(p.concurrent_roles, '{}'::text[])
      into v_actor from public.profiles p where p.id = auth.uid();
    if not (coalesce(v_actor, '{}'::text[]) && array['admin','bgh','so_gd']::text[]) then
      raise exception 'Khong the thay doi vai tro hoac truong';
    end if;
  end if;
  if new.campus_id is distinct from old.campus_id
     or new.department_id is distinct from old.department_id
     or new.org_unit_id is distinct from old.org_unit_id then
    if v_actor is null then
      select array[p.role]::text[] || coalesce(p.concurrent_roles, '{}'::text[])
        into v_actor from public.profiles p where p.id = auth.uid();
    end if;
    if not (coalesce(v_actor, '{}'::text[]) && array['admin','bgh','pht','so_gd']::text[]) then
      raise exception 'Khong the thay doi co so hoac phong ban';
    end if;
  end if;
  return new;
end
$$;

-- Dam bao trigger escalation guard luon duoc gan (trigger ton tai tren
-- prod nhung khong nam trong migration nao - env thieu se khong duoc bao ve).
drop trigger if exists trg_profiles_no_priv_escalation on public.profiles;
create trigger trg_profiles_no_priv_escalation before update on public.profiles
  for each row execute function profiles_no_priv_escalation();

drop trigger if exists trg_guard_gvcn on public.classes;
create trigger trg_guard_gvcn before update on public.classes
  for each row execute function guard_gvcn_assignment();

-- Feature matrix + role-level grants theo tap role hieu luc: gvcn kiem
-- to_truong duoc studio.review, grant theo role ap cho ca concurrent.
create or replace function public.scn_has_feature(f text) returns boolean
language plpgsql stable security definer set search_path = 'public'
as $$
declare uid uuid := auth.uid(); rs text[]; sid uuid; d boolean := null;
begin
  if uid is null then return false; end if;
  select array[role]::text[] || coalesce(concurrent_roles,'{}'::text[]), school_id
    into rs, sid from public.profiles where id = uid;
  -- 1. user-level override
  select (effect='allow') into d from feature_grants
    where school_id=sid and user_id=uid and feature=f;
  if d is not null then return d; end if;
  -- 2. role-level override (ap cho moi role user dang giu; grant xung dot
  -- giua cac role -> deny thang, tranh lay quyen tu role thoang hon)
  select bool_and(effect='allow') into d from feature_grants
    where school_id=sid and role = any(rs) and feature=f;
  if d is not null then return d; end if;
  -- 3. default matrix
  return case f
    when 'studio' then rs && array['gvcn','gvbm','to_truong','bgh','admin']::text[]
    when 'studio.questions' then rs && array['gvcn','gvbm','to_truong','bgh','admin']::text[]
    when 'studio.review' then rs && array['to_truong','bgh','admin']::text[]
    when 'studio.export' then rs && array['gvcn','gvbm','to_truong','bgh','admin']::text[]
    when 'studio.ai' then rs && array['gvcn','gvbm','to_truong','bgh','admin']::text[]
    when 'school.users' then rs && array['bgh','admin']::text[]
    else false
  end;
end $$;

-- Truong to chuyen mon ke ca khi to_truong la concurrent role.
create or replace function public.scn_is_dept_head(did uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$
  select exists(
    select 1 from profiles p
    where p.id = auth.uid() and p.department_id = did
      and (p.role = 'to_truong' or 'to_truong' = any(p.concurrent_roles)))
$$;

-- scn_can_message: role check chuyen sang role set (me/peer) - GV kiem
-- nhiem van nhan tin dung, nguoi co concurrent wide-role (bgh/pht) duoc
-- nhan rong nhu role chinh. Peer check giong me de bat concurrent cua
-- nguoi nhan (vd ke_toan kiem gvcn la GVCN cua lop con phu huynh).
create or replace function public.scn_can_message(recipient uuid, sid uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$
  with me as (
    select id, array[role]::text[] || coalesce(concurrent_roles,'{}'::text[]) as roles, school_id
    from profiles where id = auth.uid()
  ),
  peer as (
    select id, array[role]::text[] || coalesce(concurrent_roles,'{}'::text[]) as roles, school_id
    from profiles where id = recipient
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
      (
        (select roles from me) && array['gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin']::text[]
        and (select roles from peer) && array['gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin']::text[]
        and (select school_id from me) is not null
        and (select school_id from me) = (select school_id from peer)
        and (sid is null
             or exists(select 1 from stu where stu.school_id = (select school_id from me)))
      )
      or
      (
        (select roles from me) && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[]
        and exists(select 1 from stu where stu.school_id = (select school_id from me))
        and (
          exists(select 1 from parent_students ps
                 join parents p on p.id = ps.parent_id
                 where ps.student_id = sid and p.profile_id = recipient)
          or exists(select 1 from stu where stu.profile_id = recipient)
        )
        and (
          (select roles from me) && array['bgh','pht','admin']::text[]
          or exists(select 1 from stu where stu.gvcn_id = auth.uid())
          or scn_student_in_my_teaching(sid)
        )
      )
      or
      (
        (select roles from me) @> array['phu_huynh']::text[]
        and exists(select 1 from parent_students ps
                   join parents p on p.id = ps.parent_id
                   where ps.student_id = sid and p.profile_id = auth.uid())
        and (select roles from peer) && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[]
        and exists(select 1 from stu where stu.school_id = (select school_id from peer))
      )
      or
      (
        (select roles from me) @> array['hoc_sinh']::text[]
        and (select roles from peer) && array['gvcn','gvbm','to_truong','bgh','pht','admin']::text[]
        and exists(select 1 from students s join classes c on c.id = s.class_id
                   where s.profile_id = auth.uid()
                     and c.school_id = (select school_id from peer))
        and (sid is null or exists(select 1 from stu where stu.profile_id = auth.uid()))
      )
    )
$$;

-- GV duoc phan day thay: ke_toan/bgh kiem gvbm van duoc tinh la GV.
create or replace function public.scn_subr_refs_in_school(school uuid, cid uuid, subid uuid, absent uuid, sub uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$ select exists(select 1 from classes c where c.id = cid and c.school_id = school and scn_pht_allows_campus(c.campus_id)) and (subid is null or exists(select 1 from subjects sj where sj.id = subid and sj.school_id = school)) and exists(select 1 from profiles p where p.id = absent and p.school_id = school) and (sub is null or exists(select 1 from profiles p where p.id = sub and p.school_id = school and (p.role = any(array['gvbm','gvcn','to_truong']) or p.concurrent_roles && array['gvbm','gvcn','to_truong']::text[]))) $$;

-- tvc.review_material: duyet theo role set (to_truong kiem nhiem van duoc
-- duyet tang 1; bgh/admin duyet tang 2). Thu tu uu tien: in_review + co
-- to_truong -> layer 1, ke ca khi user cung la bgh.
create or replace function tvc.review_material(mid uuid, decision text, note text default '') returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
declare m tvc.materials%rowtype; rs text[]; lay int;
begin
  select * into m from tvc.materials where id = mid;
  if not found then return jsonb_build_object('error','Không tìm thấy học liệu.'); end if;
  select array[p.role]::text[] || coalesce(p.concurrent_roles,'{}'::text[])
    into rs from public.profiles p where p.id = auth.uid();
  if not (m.school_id = my_school_id()) then
    return jsonb_build_object('error','Học liệu không thuộc trường của bạn.');
  end if;
  if 'to_truong' = any(rs) and m.status = 'in_review' then
    lay := 1;
    update tvc.materials
      set status = case when decision='approve' then 'totruong_ok' else 'rejected' end,
          review_note = note, updated_at = now()
      where id = mid;
  elsif rs && array['bgh','admin']::text[] then
    if m.status not in ('in_review','totruong_ok') then return jsonb_build_object('error','Học liệu không ở trạng thái chờ duyệt.'); end if;
    lay := 2;
    update tvc.materials
      set status = case when decision='approve' then 'published' else 'rejected' end,
          review_note = note, updated_at = now()
      where id = mid;
  else
    return jsonb_build_object('error','Không có quyền duyệt học liệu.');
  end if;
  insert into tvc.reviews (material_id, reviewer_id, layer, status, notes)
    values (mid, auth.uid(), lay, case when decision='approve' then 'approved' else 'rejected' end, note);
  return jsonb_build_object('ok', true);
end $$;

-- PHT bi gioi han campus: ap dung khi 'pht' o bat cu vai tro nao, tru khi
-- user cung la BGH/admin (xem toan truong).
create or replace function public.scn_pht_allows_campus(campus uuid) returns boolean
language sql stable security definer set search_path = 'public'
as $$
  select not (my_roles() @> array['pht']::text[]
              and not (my_roles() && array['bgh','admin']::text[]))
      or campus = (select p.campus_id from profiles p where p.id = auth.uid())
$$;

-- to_truong (ke ca kiem nhiem) chi sua phan mon GV cung to; bgh/admin sua het.
create or replace function public.scn_set_teacher_subjects(p_teacher uuid, p_subjects uuid[]) returns void
language plpgsql security definer set search_path = 'public'
as $$
DECLARE
  v_school uuid := public.my_school_id();
  v_roles text[] := public.my_roles();
  v_dept uuid;
  v_target_dept uuid;
BEGIN
  IF v_school IS NULL THEN RAISE EXCEPTION 'no school'; END IF;
  IF NOT (v_roles && array['bgh','admin','to_truong']::text[]) THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- teacher phai cung truong
  SELECT department_id INTO v_target_dept FROM public.profiles
   WHERE id = p_teacher AND school_id = v_school;
  IF NOT FOUND THEN RAISE EXCEPTION 'teacher not in school'; END IF;

  -- to_truong chi sua GV trong to minh (bgh/admin khong bi gioi han)
  IF 'to_truong' = any(v_roles) AND NOT (v_roles && array['bgh','admin']::text[]) THEN
    SELECT department_id INTO v_dept FROM public.profiles WHERE id = auth.uid();
    IF v_dept IS NULL OR v_target_dept IS DISTINCT FROM v_dept THEN
      RAISE EXCEPTION 'to_truong chi sua GV cung to';
    END IF;
  END IF;

  -- moi subject phai thuoc truong
  IF EXISTS (
    SELECT 1 FROM unnest(p_subjects) s(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.subjects su WHERE su.id = s.id AND su.school_id = v_school)
  ) THEN RAISE EXCEPTION 'subject not in school'; END IF;

  DELETE FROM public.teacher_subjects WHERE teacher_id = p_teacher;
  IF array_length(p_subjects,1) IS NOT NULL THEN
    INSERT INTO public.teacher_subjects (teacher_id, subject_id)
    SELECT p_teacher, s FROM unnest(p_subjects) s;
  END IF;
END;
$$;

-- substitute_requests update guard: field quyet dinh can role bgh/pht/admin
-- (pht co the la concurrent).
create or replace function public.scn_subr_update_guard() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.school_id is distinct from old.school_id
     or new.requested_by is distinct from old.requested_by
     or new.created_at is distinct from old.created_at then
    raise exception 'substitute_requests: id/school_id/requested_by are immutable';
  end if;

  if not ((select my_roles()) && array['bgh','pht','admin']::text[]) then
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

  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status in ('approved','rejected')) then
    raise exception 'substitute_requests: invalid status transition % -> %', old.status, new.status;
  end if;

  if new.status in ('approved','rejected')
     and (new.decided_by is distinct from auth.uid() or new.decided_at is null) then
    raise exception 'substitute_requests: decision requires decided_by=auth.uid() and decided_at';
  end if;

  return new;
end
$$;

-- Rewrite 1 bieu thuc policy: my_role() -> my_roles() va chuyen moi so sanh
-- scalar sang so sanh mang. Cover moi dang deparse Postgres:
--   ( SELECT my_role() AS my_role) = 'x'::text  -> (SELECT my_roles()) @> ARRAY['x']
--   ( SELECT my_role() AS my_role) = ANY (ARRAY[...]) -> (SELECT my_roles()) && ARRAY[...]
--   my_role() = 'x'::text                       -> my_roles() @> ARRAY['x']
--   my_role() = ANY (ARRAY[...])                -> my_roles() && ARRAY[...]
--   my_role() = ANY ('{...}'::text[])           -> my_roles() && '{...}'::text[]
create function pg_temp.cr038_rw(expr text) returns text
language plpgsql immutable
as $$
declare
  e text := expr;
begin
  -- Schema khac co my_role() rieng (tvc.my_role() doc tvc.profiles - bang
  -- rieng cua TVC360, khong co concurrent_roles): mask de khong bi rewrite.
  -- public.my_role() chuan hoa ve bare truoc.
  e := regexp_replace(e, 'public\.my_role\(\)', 'my_role()', 'g');
  e := regexp_replace(e, '([a-z_]+)\.my_role\(\)', '\1.__K38MR()', 'g');
  e := regexp_replace(e, 'my_role\(\)', 'my_roles()', 'g');
  -- Deparse co the goi nhieu lop SELECT khi call nam trong scalar subquery:
  --   ( SELECT ( SELECT my_roles() AS my_role) AS my_role) -> (SELECT my_roles())
  -- Lap cho toi khi het long nhau.
  while e ~ '\( *SELECT *\( *SELECT my_roles\(\)' loop
    e := regexp_replace(e,
      '\( *SELECT *\( *SELECT my_roles\(\)(?: *AS [a-z_]+)? *\)(?: *AS [a-z_]+)? *\)',
      '(SELECT my_roles())', 'g');
  end loop;
  -- SELECT-wrapped truoc (co chua my_roles() ben trong nen phan biet bang "AS ... ) =").
  e := regexp_replace(e,
    '\( *SELECT my_roles\(\)(?: *AS my_roles?)? *\) *= *ANY *\( *ARRAY\[([^\]]+)\] *\)',
    '(SELECT my_roles()) && ARRAY[\1]', 'g');
  e := regexp_replace(e,
    '\( *SELECT my_roles\(\)(?: *AS my_roles?)? *\) *= *ANY *\( *''(\{[^''\}]*\})''::text\[\] *\)',
    '(SELECT my_roles()) && ''\1''::text[]', 'g');
  e := regexp_replace(e,
    '\( *SELECT my_roles\(\)(?: *AS my_roles?)? *\) *= *''([a-z_]+)''::text',
    '(SELECT my_roles()) @> ARRAY[''\1''::text]', 'g');
  -- Bare call.
  e := regexp_replace(e,
    'my_roles\(\) *= *ANY *\( *ARRAY\[([^\]]+)\] *\)',
    'my_roles() && ARRAY[\1]', 'g');
  e := regexp_replace(e,
    'my_roles\(\) *= *ANY *\( *''(\{[^''\}]*\})''::text\[\] *\)',
    'my_roles() && ''\1''::text[]', 'g');
  e := regexp_replace(e,
    'my_roles\(\) *= *''([a-z_]+)''::text',
    'my_roles() @> ARRAY[''\1''::text]', 'g');
  -- Restore masked schema-qualified calls (tvc.my_role() nguyen trang).
  e := regexp_replace(e, '([a-z_]+)\.__K38MR\(\)', '\1.my_role()', 'g');
  return e;
end $$;

-- Recreate toan bo policy (public + tvc + storage) co dung my_role().
-- Chay trong 1 transaction: loi bat ky -> rollback toan bo.
do $$
declare
  p record;
  q text;
  c text;
  v_rest text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where (qual like '%my_role()%' or with_check like '%my_role()%')
    order by schemaname, tablename, policyname
  loop
    q := case when p.qual is null then null else pg_temp.cr038_rw(p.qual) end;
    c := case when p.with_check is null then null else pg_temp.cr038_rw(p.with_check) end;

    -- bao hiem fail-closed: sau rewrite, moi my_roles() con lai phai nam ngay
    -- truoc @> hoac && (dang mang); bat ky dang nao khac -> dung migration.
    v_rest := coalesce(q, '') || ' @|@ ' || coalesce(c, '');
    v_rest := regexp_replace(v_rest, '\( *SELECT my_roles\(\) *\) *(?:@>|&&)', '', 'g');
    v_rest := regexp_replace(v_rest, 'my_roles\(\) *(?:@>|&&)', '', 'g');
    -- tvc.my_role() (schema khac) giu nguyen -> cho phep dang "X.my_role()";
    -- bare my_role()/my_roles() con sot la rewrite miss.
    if v_rest ~ '(^|[^.a-z_])my_roles?\(\)' then
      raise exception 'CR-038: rewrite failed for %.%', p.tablename, p.policyname;
    end if;

    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I as %s for %s to %s%s%s',
      p.policyname, p.schemaname, p.tablename,
      lower(p.permissive), lower(p.cmd),
      case when p.roles = '{public}'::name[] then 'public'
           else (select string_agg(quote_ident(r::text), ',') from unnest(p.roles) r) end,
      case when q is null then '' else ' using (' || q || ')' end,
      case when c is null then '' else ' with check (' || c || ')' end);
  end loop;
end $$;
