-- ===========================================================================
-- R11 (External Review round 11): 2 cho ghi khong nguyen tu.
--
-- R11-01 - followupIncident (src/app/(app)/safety/actions.ts): doc
-- description -> concat ghi chu -> update, 2 roundtrip rieng. Hai GV submit
-- theo doi dong thoi thi note cua nguoi sau ghi de note nguoi truoc (lost
-- update). Fix: scn_incident_followup lam het trong 1 UPDATE - append tren
-- gia tri description hien tai trong DB, khong qua doc phia JS. Stamp ngay
-- dung gio VN (Asia/Ho_Chi_Minh) giong format JS cu (DD/MM/YYYY).
--
-- R11-02 - assignRole (src/components/register/roster-client.tsx): doi chuc
-- danh BCS = delete + insert class_roles tren 2 statement rieng; loi giua
-- chung lam mat chuc danh cu, va loi bi nuot (local state van doi). Fix:
-- scn_set_class_role delete+insert trong 1 transaction; p_role='' = xoa.
--
-- SECURITY INVOKER (mac dinh, khong khai bao DEFINER): RLS tren
-- incidents/class_roles van enforce authz ben trong function - cung mo hinh
-- scn_save_grades/scn_save_nlpc. Caller khong du quyen: update/delete RLS
-- loc ve 0 row -> NOT FOUND / postcondition check raise exception ->
-- client nhan loi, khong bao thanh cong gia.
-- ===========================================================================

-- Cap nhat trang thai + append ghi chu theo doi vao description trong 1
-- UPDATE duy nhat. p_note null/rong thi chi doi status.
-- UPDATE khong cham row nao (id sai hoac RLS chan) -> raise, khong silent.
create or replace function public.scn_incident_followup(p_incident uuid, p_status text, p_note text)
 returns void language plpgsql set search_path to 'public' as $function$
begin
  update incidents
     set status = p_status,
         description = case
           when p_note is null or btrim(p_note) = '' then description
           else coalesce(description, '')
             || E'\n\n[Theo dõi '
             || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
             || '] ' || btrim(p_note)
         end
   where id = p_incident;
  if not found then
    raise exception 'incident_followup_denied';
  end if;
end;
$function$;

-- Thay chuc danh BCS cua HS nguyen tu: xoa moi role cu roi insert role moi.
-- p_role = '' (hoac null) = chi xoa (clear chuc danh).
-- Pre-check student cung school (chan loi am tham tren HS truong khac);
-- postcondition: khong con role khac p_role, va p_role da luu dung - neu
-- delete bi RLS loc hoac insert that bai thi raise, giu local state + audit
-- phia client khong ghi su kien gia.
create or replace function public.scn_set_class_role(p_student uuid, p_role text)
 returns void language plpgsql set search_path to 'public' as $function$
begin
  if not public.scn_student_in_school(p_student) then
    raise exception 'student_out_of_scope';
  end if;
  delete from class_roles where student_id = p_student;
  if p_role is not null and p_role <> '' then
    insert into class_roles (student_id, role) values (p_student, p_role);
  end if;
  if exists(select 1 from class_roles
             where student_id = p_student and role is distinct from p_role)
     or (p_role is not null and p_role <> '' and not exists(
           select 1 from class_roles
            where student_id = p_student and role = p_role))
  then
    raise exception 'class_role_update_denied';
  end if;
end;
$function$;

-- Grant execute cho authenticated (pattern cr029/cr030/r8) - postgREST expose
-- public functions nhung grant ro rang la audit trail.
grant execute on function public.scn_incident_followup(uuid, text, text) to authenticated;
grant execute on function public.scn_set_class_role(uuid, text) to authenticated;
