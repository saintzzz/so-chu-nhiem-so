-- CR-069 r1: external review findings.
-- 1. hb_store/hb_sign chuyen trang thai ATOMIC (predicate trong UPDATE/WHERE
--    cua upsert) - dong race: sign xen giua check va upsert, 2 sign song song.
-- 2. p_sig bat buoc hex HMAC 64 (tranh chu ky tuy y / XML malformed).

alter table public.hb_exports
  add constraint hb_sig_hex check (
    (gvcn_sig is null or gvcn_sig ~ '^[0-9a-f]{64}$')
    and (bgh_sig is null or bgh_sig ~ '^[0-9a-f]{64}$'));

create or replace function public.hb_store(
  p_student uuid, p_year uuid, p_xml text, p_sha text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_id uuid;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]
          or ((select my_roles()) @> array['gvcn']::text[]
              and public.scn_student_in_my_homeroom(p_student))) then
    raise exception 'forbidden';
  end if;
  if not (select public.hb_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_xml is null or length(p_xml) < 100 then raise exception 'invalid_xml'; end if;
  if p_sha is null or p_sha !~ '^[0-9a-f]{64}$' then raise exception 'invalid_sha'; end if;

  -- Upsert co dieu kien: khong ghi de ban da ky BGH (ke ca race vua ky).
  insert into public.hb_exports
    (school_id, student_id, academic_year_id, xml, sha256, status,
     gvcn_sig, gvcn_by, gvcn_at, bgh_sig, bgh_by, bgh_at, created_by)
  values (v_school, p_student, p_year, p_xml, p_sha, 'generated',
          null, null, null, null, null, null, auth.uid())
  on conflict (student_id, academic_year_id)
  do update set xml = excluded.xml, sha256 = excluded.sha256,
    status = 'generated',
    gvcn_sig = null, gvcn_by = null, gvcn_at = null,
    bgh_sig = null, bgh_by = null, bgh_at = null
  where public.hb_exports.status <> 'bgh_signed'
  returning id into v_id;

  if v_id is null then
    raise exception 'already_signed';
  end if;
  return jsonb_build_object('export_id', v_id);
end $$;

create or replace function public.hb_sign(
  p_id uuid, p_role text, p_sig text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_exp record;
begin
  select e.id, e.student_id into v_exp from public.hb_exports e
    where e.id = p_id and e.school_id = v_school;
  if not found then raise exception 'export_not_found'; end if;
  if not (select public.hb_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_sig is null or p_sig !~ '^[0-9a-f]{64}$' then raise exception 'invalid_sig'; end if;

  if p_role = 'gvcn' then
    if not ((select my_roles()) @> array['gvcn']::text[]
            and public.scn_student_in_my_homeroom(v_exp.student_id)) then
      raise exception 'forbidden';
    end if;
    -- Transition atomic: predicate status trong UPDATE -> 2 ky song song
    -- chi 1 cai thanh cong, cai sau not found -> invalid_state.
    update public.hb_exports
    set status = 'gvcn_signed', gvcn_sig = p_sig,
        gvcn_by = auth.uid(), gvcn_at = now()
    where id = p_id and status = 'generated';
    if not found then raise exception 'invalid_state'; end if;
  elsif p_role = 'bgh' then
    if not ((select my_roles()) && array['bgh','admin']::text[]) then
      raise exception 'forbidden';
    end if;
    update public.hb_exports
    set status = 'bgh_signed', bgh_sig = p_sig,
        bgh_by = auth.uid(), bgh_at = now()
    where id = p_id and status = 'gvcn_signed';
    if not found then raise exception 'invalid_state'; end if;
  else
    raise exception 'invalid_role';
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.hb_store(uuid, uuid, text, text) from public, anon;
revoke all on function public.hb_sign(uuid, text, text) from public, anon;
grant execute on function public.hb_store(uuid, uuid, text, text) to authenticated;
grant execute on function public.hb_sign(uuid, text, text) to authenticated;
