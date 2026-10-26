-- External review r-hb1 (hoc ba): tighten year_end_decisions write boundary.
-- F1: yed_gvcn_ins allowed INSERT status='submitted' directly via PostgREST,
--     bypassing the app-level "deviation requires legal ground" check and
--     letting a forged computed_snapshot reach BGH as if system-computed.
-- F2: nothing stopped a submitted row carrying NULL kqht/kqrl/promotion.
-- Fix: insert path is draft-only; a DB trigger requires the four legal
-- fields on every submitted write (insert AND update) regardless of client.

drop policy if exists yed_gvcn_ins on public.year_end_decisions;
create policy yed_gvcn_ins on public.year_end_decisions for insert
with check (
  (select my_roles()) @> array['gvcn'::text]
  and scn_student_in_my_homeroom(student_id)
  and school_id = (select my_school_id())
  and status = 'draft'
  and approved_by is null
  and approved_at is null
  and reject_reason is null
  and giay_khen_note is null
);

create or replace function public.scn_yed_submit_guard()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if (select auth.jwt() ->> 'role') = 'service_role' then
    return new;
  end if;
  if new.status = 'submitted'
     and (new.kqht is null
          or new.kqrl is null
          or new.promotion is null
          or new.computed_snapshot is null) then
    raise exception 'submitted decision requires kqht, kqrl, promotion and computed_snapshot'
      using errcode = 'P0001';
  end if;
  -- Can cu phap ly khong co ghi chu la vo nghia - chan o moi write de
  -- direct PostgREST khong dat duoc override "im lang".
  if new.override_legal_ground is not null
     and (new.override_note is null or btrim(new.override_note) = '') then
    raise exception 'override requires a non-empty override_note'
      using errcode = 'P0001';
  end if;
  -- r-hb2 F1: quyet dinh submitted co mon mien luon phai kem can cu phap
  -- ly + ghi chu - chan ca lo trinh ghi truc tiep: insert draft mang
  -- exempt roi update status, hoac update exempt trong draft san co.
  if new.status = 'submitted'
     and coalesce(array_length(new.exempt_subject_ids, 1), 0) > 0
     and (new.override_legal_ground is null
          or new.override_note is null
          or btrim(new.override_note) = '') then
    raise exception 'submitted decision with exempt subjects requires legal ground and note'
      using errcode = 'P0001';
  end if;

  -- r-hb3: duyet truc tiep qua PostgREST bo qua recompute cua action.
  -- Tai tang DB, snapshot la "ket qua he thong tinh luc trinh" - row lech
  -- snapshot ma khong co can cu phap ly thi khong duoc approved, ke ca
  -- khi BGH update status truc tiep. Residual con lai: gia mao snapshot
  -- = fields (he thong khong the recompute trong DB) - duoc ghi nhan
  -- trong EXTERNAL-REVIEW-hocba.md, kem audit row ben duoi.
  if tg_op = 'UPDATE' and old.status = 'submitted' and new.status = 'approved' then
    if new.kqht is null or new.kqrl is null or new.promotion is null then
      raise exception 'approved decision requires complete results'
        using errcode = 'P0001';
    end if;
    if (new.override_legal_ground is null
        or new.override_note is null
        or btrim(new.override_note) = '')
       and (new.computed_snapshot is null
            or (new.computed_snapshot ->> 'kqht') is distinct from new.kqht
            or (new.computed_snapshot ->> 'kqrl') is distinct from new.kqrl
            or (new.computed_snapshot ->> 'promotion') is distinct from new.promotion
            or coalesce(array_length(new.exempt_subject_ids, 1), 0) > 0) then
      raise exception 'approved decision deviating from snapshot or exempting subjects requires legal ground and note'
        using errcode = 'P0001';
    end if;
    -- Audit ngay trong DB: bat ky approve nao (UI hay direct) deu de lai
    -- vet trang thai row tai thoi diem duyet.
    insert into public.audit_logs (actor_id, action, entity, entity_id, payload)
    values (
      auth.uid(), 'hoc_ba.approve', 'year_end_decisions', new.id::text,
      jsonb_build_object(
        'student_id', new.student_id,
        'stage', new.stage,
        'kqht', new.kqht, 'kqrl', new.kqrl,
        'promotion', new.promotion, 'danh_hieu', new.danh_hieu,
        'snapshot', new.computed_snapshot,
        'override_legal_ground', new.override_legal_ground
      )
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_yed_submit_guard on public.year_end_decisions;
create trigger trg_yed_submit_guard
before insert or update on public.year_end_decisions
for each row execute function public.scn_yed_submit_guard();
