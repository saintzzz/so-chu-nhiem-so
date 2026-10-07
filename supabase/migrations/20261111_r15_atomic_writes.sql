-- ===========================================================================
-- R15 (External Review round 15): 2 cho ghi khong nguyen tu.
--
-- R15-01 [HIGH] - daily-roster.tsx::confirm(): upsert attendance_records; tren
-- BAT KY loi nao (mang, RLS...) chay fallback pha hoai: DELETE manual rows roi
-- lap UPDATE/INSERT tung HS voi moi loi bi NUOT (delete error bo qua, update
-- loop khong check, cuoi cung error=null -> bao thanh cong gia). Prod da co
-- unique(student_id,date) nen fallback chi chay khi loi that - va khi do no
-- xoa du lieu roi nuot loi.
-- Fix: scn_save_attendance lam het trong 1 statement INSERT ... ON CONFLICT
-- (student_id,date) DO UPDATE. DO UPDATE KHONG cham cot source - giu nguyen
-- source='period_log' cho rows do so dau bai ghi (day la ly do fallback cu
-- ton tai). p_rows chi chua {student_id,status,note}; source luon 'manual'.
--
-- R15-02 [MED] - scoring-grid.tsx::save(): Promise.all cua nhieu
-- DELETE/UPDATE/INSERT doc lap tren emulation_scores; 1 op loi de lai trang
-- thai nua voc (mot so o luu, mot so khong) trong khi cac op khac da commit.
-- Fix: scn_save_emulation gom moi op do client gui (chi o THAY DOI) vao 1
-- transaction: delete cac o score=null roi upsert phan con lai ON CONFLICT
-- (class_id,criterion_id,period) DO UPDATE - khop unique constraint prod.
--
-- SECURITY INVOKER (mac dinh, khong khai bao DEFINER): RLS tren
-- attendance_records/emulation_scores van enforce authz ben trong function -
-- cung mo hinh scn_save_nlpc/scn_save_seating/scn_set_class_role. Caller khong
-- du quyen: INSERT vi pham WITH CHECK / UPDATE-DELETE bi loc -> exception hoac
-- postcondition check raise -> toan bo rollback, client nhan loi va khong bao
-- thanh cong gia.
-- ===========================================================================

-- Luu chuyen can ngay p_date cho danh sach HS nguyen tu. Moi row trong
-- p_rows la {student_id uuid, status text, note text|null}; source luon
-- 'manual' o insert path, conflict path chi cap nhat status/note - tuyet doi
-- khong ghi de source (bao ton 'period_log' tu so dau bai).
-- Postcondition: moi row trong p_rows phai ton tai dung status/note - UPDATE
-- bi RLS loc ve 0 row (silent) se bi bat tai day thay vi bao thanh cong gia.
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
    set status = excluded.status, note = excluded.note;

  if exists (
    select 1
      from jsonb_array_elements(p_rows) r
     where not exists (
       select 1 from attendance_records a
        where a.student_id = (r->>'student_id')::uuid
          and a.date = p_date
          and a.status = r->>'status'
          and a.note is not distinct from r->>'note'))
  then
    raise exception 'attendance_save_denied';
  end if;
end;
$function$;

-- Luu diem thi dua ky p_period nguyen tu. p_ops la danh sach o THAY DOI:
-- {class_id uuid, criterion_id uuid, score numeric|null} - score null = xoa
-- o da cham. Delete chay truoc trong cung transaction; upsert loi (RLS,
-- constraint, mang) rollback ca delete - khong con trang thai nua voc.
-- Postcondition: moi op phai dung trang thai cuoi (o xoa khong con, o ghi
-- dung score) - delete/update bi RLS loc ve 0 row (silent) bi bat tai day.
create or replace function public.scn_save_emulation(p_period text, p_ops jsonb)
 returns void language plpgsql set search_path to 'public' as $function$
begin
  if p_period is null or btrim(p_period) = '' then
    raise exception 'emulation_save_invalid';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'emulation_save_invalid';
  end if;

  delete from emulation_scores es
   using jsonb_array_elements(p_ops) r
   where es.class_id = (r->>'class_id')::uuid
     and es.criterion_id = (r->>'criterion_id')::uuid
     and es.period = p_period
     and (r->>'score') is null;

  insert into emulation_scores (class_id, criterion_id, period, score)
  select (r->>'class_id')::uuid, (r->>'criterion_id')::uuid, p_period,
         (r->>'score')::numeric
    from jsonb_array_elements(p_ops) r
   where (r->>'score') is not null
  on conflict (class_id, criterion_id, period) do update
    set score = excluded.score;

  if exists (
    select 1
      from jsonb_array_elements(p_ops) r
     where ((r->>'score') is null and exists (
              select 1 from emulation_scores es
               where es.class_id = (r->>'class_id')::uuid
                 and es.criterion_id = (r->>'criterion_id')::uuid
                 and es.period = p_period))
        or ((r->>'score') is not null and not exists (
              select 1 from emulation_scores es
               where es.class_id = (r->>'class_id')::uuid
                 and es.criterion_id = (r->>'criterion_id')::uuid
                 and es.period = p_period
                 and es.score = (r->>'score')::numeric)))
  then
    raise exception 'emulation_save_denied';
  end if;
end;
$function$;

-- Grant execute cho authenticated (pattern cr029/cr030/r8/r11/r12) -
-- postgREST expose public functions nhung grant ro rang la audit trail.
grant execute on function public.scn_save_attendance(date, jsonb) to authenticated;
grant execute on function public.scn_save_emulation(text, jsonb) to authenticated;
