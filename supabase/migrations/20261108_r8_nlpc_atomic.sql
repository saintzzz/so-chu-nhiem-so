-- ===========================================================================
-- R8-02 (External Review round 8): NLPC editor luu bang chuoi 4 statement
-- rieng le tren client (delete competency_evaluations -> delete nlpc_comments
-- -> insert evals -> insert comments). Loi giua chung lam mat du lieu da
-- xoa. Chuyen sang RPC scn_save_nlpc: delete+insert trong 1 transaction.
--
-- SECURITY INVOKER (mac dinh): RLS tren competency_evaluations/nlpc_comments
-- van enforce authz ben trong function - cung mo hinh voi scn_save_grades
-- dang chay tren prod. GVCN lop CN / GVBM+to_truong lop dang day / BGH trong
-- truong / admin ghi duoc; HS truong khac bi WITH CHECK chan va rollback
-- toan bo (ke ca delete).
--
-- DRIFT CAPTURE: scn_save_grades ton tai tren production (client goi qua rpc
-- trong src/components/academics/grades-editor.tsx) nhung chua co migration
-- file nao. Ghi lai def hien tai verbatim de repo khop prod - OR REPLACE
-- giu nguyen OID nen policy/grant binding khong doi.
-- ===========================================================================

create or replace function public.scn_save_grades(p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb)
 returns void language plpgsql set search_path to 'public' as $function$
begin
  delete from grades where student_id = any(p_student_ids) and subject_id = p_subject_id and term = p_term;
  insert into grades (student_id, subject_id, term, entered_by, subtype, assessment_type, seq, level, score, comment, result)
  select (r->>'student_id')::uuid, p_subject_id, p_term, (r->>'entered_by')::uuid, coalesce(r->>'subtype', ''), r->>'assessment_type', (r->>'seq')::smallint, r->>'level', (r->>'score')::numeric, r->>'comment', r->>'result'
  from jsonb_array_elements(p_rows) as r;
end;
$function$;

-- Xoa danh gia/nhan xet NLPC cua cac HS trong ky roi insert lai nguyen tu.
-- term lay tu p_term (khong tin term trong tung row) de khop menh de delete.
-- evaluated_by = auth.uid() - khong tin dinh danh nguoi danh gia tu client.
create or replace function public.scn_save_nlpc(p_student_ids uuid[], p_term text, p_evals jsonb, p_comments jsonb)
 returns void language plpgsql set search_path to 'public' as $function$
begin
  delete from competency_evaluations
   where student_id = any(p_student_ids) and term = p_term;
  delete from nlpc_comments
   where student_id = any(p_student_ids) and term = p_term;
  insert into competency_evaluations (student_id, term, attribute_code, level, evaluated_by)
  select (r->>'student_id')::uuid, p_term, r->>'attribute_code', r->>'level', auth.uid()
  from jsonb_array_elements(p_evals) as r;
  insert into nlpc_comments (student_id, term, grp, comment, evaluated_by)
  select (r->>'student_id')::uuid, p_term, r->>'grp', r->>'comment', auth.uid()
  from jsonb_array_elements(p_comments) as r;
end;
$function$;

-- Repo grant RPC tuong minh cho authenticated (pattern cr029/cr030) -
-- postgREST expose public functions nhung grant ro rang la audit trail.
grant execute on function public.scn_save_grades(uuid[], uuid, text, jsonb) to authenticated;
grant execute on function public.scn_save_nlpc(uuid[], text, jsonb, jsonb) to authenticated;
