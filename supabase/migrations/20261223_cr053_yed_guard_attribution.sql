-- CR-053 r33-4: BGH path cua scn_yed_guard chan sua cac cot ket qua GVCN
-- nhung BO SOT decided_by/decided_at - mot update truc tiep co the
-- duyet/tra lai dong thoi thay nguoi + moc trinh, pha vet audit va huong
-- thong bao. Them 2 cot vao immutable list tren nhanh BGH.
create or replace function public.scn_yed_guard()
returns trigger language plpgsql security definer
set search_path = 'public' as
$$
declare
  is_gvcn boolean := (select public.my_roles()) @> array['gvcn']::text[];
  is_bgh boolean := (select public.my_roles()) @> array['bgh']::text[];
begin
  -- Trigger lock tu register_signoffs + service role duoc bypass.
  if pg_trigger_depth() > 1 or (select auth.jwt()->>'role') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Stage prerequisite: chi tao duoc stage sau khi stage truoc
    -- approved/locked voi promotion cho phep; moi stage toi da 1 lan.
    if new.stage = 'after_summer' then
      if not exists (
        select 1 from public.year_end_decisions d
         where d.student_id = new.student_id
           and d.academic_year_id = new.academic_year_id
           and d.stage = 'initial'
           and d.status in ('approved','locked')
           and d.promotion = 'ren_luyen_he'
      ) then
        raise exception 'after_summer requires approved initial with ren_luyen_he'
          using errcode = 'P0001';
      end if;
    elsif new.stage = 'after_retest' then
      if not exists (
        select 1 from public.year_end_decisions d
         where d.student_id = new.student_id
           and d.academic_year_id = new.academic_year_id
           and d.status in ('approved','locked')
           and d.promotion = 'kiem_tra_danh_gia_lai'
      ) then
        raise exception 'after_retest requires approved decision with kiem_tra_danh_gia_lai'
          using errcode = 'P0001';
      end if;
      if exists (
        select 1 from public.year_end_decisions d
         where d.student_id = new.student_id
           and d.academic_year_id = new.academic_year_id
           and d.stage = 'after_retest'
      ) then
        raise exception 'after_retest already exists' using errcode = 'P0001';
      end if;
    elsif new.stage <> 'initial' then
      raise exception 'invalid stage' using errcode = 'P0001';
    end if;

    -- Tenant: HS phai thuoc lop cung truong + cung nam hoc.
    if not exists (
      select 1 from public.students s
        join public.classes c on c.id = s.class_id
       where s.id = new.student_id
         and c.school_id = new.school_id
         and c.academic_year_id = new.academic_year_id
    ) then
      raise exception 'student/class/tenant mismatch' using errcode = 'P0001';
    end if;

    new.decided_by := auth.uid();
    new.decided_at := coalesce(new.decided_at, now());
    return new;
  end if;

  -- UPDATE: immutable keys
  if new.student_id is distinct from old.student_id
     or new.school_id is distinct from old.school_id
     or new.academic_year_id is distinct from old.academic_year_id
     or new.stage is distinct from old.stage then
    raise exception 'immutable decision keys' using errcode = 'P0001';
  end if;

  -- Transition matrix
  if not (
    (old.status = 'draft' and new.status in ('draft','submitted'))
    or (old.status = 'rejected' and new.status in ('rejected','submitted'))
    or (old.status = 'submitted' and new.status in ('approved','rejected'))
    -- approved->locked CHI qua trg_lock_yed (depth>1 da bypass o tren) -
    -- toi day tuc la BGH update truc tiep -> chan.
  ) then
    raise exception 'invalid status transition % -> %', old.status, new.status
      using errcode = 'P0001';
  end if;

  if old.status in ('draft','rejected') then
    -- Path GVCN: cam doi cot cua BGH; refresh decided_* theo actor.
    if new.giay_khen_note is distinct from old.giay_khen_note
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at then
      raise exception 'gvcn cannot touch approval fields' using errcode = 'P0001';
    end if;
    if not is_gvcn then
      raise exception 'draft/rejected edits require gvcn' using errcode = '42501';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
    if new.status = 'submitted' and old.status = 'rejected' then
      new.revision := old.revision + 1;
      new.reject_reason := null;
      new.approved_by := null;
      new.approved_at := null;
    end if;
    if new.status = 'submitted' and old.status = 'draft' then
      new.reject_reason := null;
    end if;
    return new;
  end if;

  -- Path BGH (old submitted|approved): BGH chi doi status + cot duyet,
  -- KHONG duoc sua ket qua GVCN da trinh - ke ca nguoi/moc trinh
  -- (r33-4: decided_* nam trong immutable list).
  if not is_bgh then
    raise exception 'approval path requires bgh' using errcode = '42501';
  end if;
  if new.kqht is distinct from old.kqht
     or new.kqrl is distinct from old.kqrl
     or new.danh_hieu is distinct from old.danh_hieu
     or new.promotion is distinct from old.promotion
     or new.override_legal_ground is distinct from old.override_legal_ground
     or new.override_note is distinct from old.override_note
     or new.exempt_subject_ids is distinct from old.exempt_subject_ids
     or new.computed_snapshot is distinct from old.computed_snapshot
     or new.revision is distinct from old.revision
     or new.decided_by is distinct from old.decided_by
     or new.decided_at is distinct from old.decided_at then
    raise exception 'bgh cannot modify gvcn decision fields' using errcode = 'P0001';
  end if;
  if new.status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.reject_reason := null;
  elsif new.status = 'rejected' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end
$$;
