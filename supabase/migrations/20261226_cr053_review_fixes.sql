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
  return new;
end
$$;

drop trigger if exists trg_yed_submit_guard on public.year_end_decisions;
create trigger trg_yed_submit_guard
before insert or update on public.year_end_decisions
for each row execute function public.scn_yed_submit_guard();
