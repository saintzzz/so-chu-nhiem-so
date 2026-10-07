-- ===========================================================================
-- R12-01 (External Review round 12): so do cho ngoi luu/khoi phuc khong
-- nguyen tu.
--
-- seating-grid.tsx::save() chay 2 statement rieng: UPDATE is_current=false
-- (loi bi NUOT - ket qua khong check) roi INSERT phien ban moi. Insert loi
-- (RLS, constraint, mang) de lai thang khong con ban ghi current nao ->
-- trang seating fallback ve phien ban cao nhat, am tham doi sap xep cho
-- ngoi.
--
-- seating-history-client.tsx::restore() cung vay: UPDATE-all-false roi
-- UPDATE-one-true, UPDATE dau khong check loi -> cung mot cua so hong.
--
-- Fix: scn_save_seating / scn_restore_seating lam het trong 1 transaction
-- phia DB. SECURITY INVOKER (mac dinh, khong khai bao DEFINER): RLS tren
-- seating_charts (seat_ins/seat_upd/seat_del - GVCN lop CN, BGH trong
-- truong, admin) van enforce authz ben trong function - cung mo hinh
-- scn_save_nlpc/scn_set_class_role. Caller khong du quyen: UPDATE bi loc
-- ve 0 row / INSERT vi pham WITH CHECK -> raise exception -> toan bo
-- rollback, client nhan loi va khong doi local state.
-- ===========================================================================

-- Luu phien ban moi cua so do cho (class, month) nguyen tu: tat current
-- cua moi phien ban cu roi insert phien ban tiep theo la current. Version
-- duoc tinh phia DB (max+1) - khong tin so version client gui len.
-- p_month la chuoi ISO "YYYY-MM-01" (cot month la date). Tra ve version
-- vua luu de client cap nhat UI.
-- Postcondition: phai con DUNG 1 ban ghi current cho (class, month) - neu
-- RLS/constraint lam insert that bai thi exception rollback ca UPDATE.
-- Advisory lock theo (class, month) serialize save/restore - ke ca khi
-- chua co ban ghi nao (2 save song song khong tao 2 version-1 current).
create or replace function public.scn_save_seating(p_class uuid, p_month text, p_layout jsonb)
 returns integer language plpgsql set search_path to 'public' as $function$
declare
  v_month date := p_month::date;
  v_version integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_class::text || '|' || v_month::text));

  update seating_charts
     set is_current = false
   where class_id = p_class and month = v_month;

  select coalesce(max(version), 0) + 1 into v_version
    from seating_charts
   where class_id = p_class and month = v_month;

  insert into seating_charts (class_id, month, version, layout, is_current)
  values (p_class, v_month, v_version, p_layout, true);

  if (select count(*) from seating_charts
       where class_id = p_class and month = v_month and is_current) <> 1 then
    raise exception 'seating_save_denied';
  end if;

  return v_version;
end;
$function$;

-- Khoi phuc mot phien ban cu thanh current nguyen tu: tat current tren
-- (class_id, month) cua chinh ban ghi do roi bat lai ban ghi p_chart.
-- Chart khong ton tai hoac caller khong thay duoc (RLS) -> raise loi ro
-- rang, khong silent. Postcondition: dung 1 current cho (class, month).
create or replace function public.scn_restore_seating(p_chart uuid)
 returns void language plpgsql set search_path to 'public' as $function$
declare
  v_class uuid;
  v_month date;
begin
  select class_id, month into v_class, v_month
    from seating_charts
   where id = p_chart;
  if not found then
    raise exception 'seating_restore_denied';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_class::text || '|' || v_month::text));

  update seating_charts
     set is_current = false
   where class_id = v_class and month = v_month;

  update seating_charts
     set is_current = true
   where id = p_chart;
  if not found then
    raise exception 'seating_restore_denied';
  end if;

  if (select count(*) from seating_charts
       where class_id = v_class and month = v_month and is_current) <> 1 then
    raise exception 'seating_restore_denied';
  end if;
end;
$function$;

-- Grant execute cho authenticated (pattern cr029/cr030/r8/r11) - postgREST
-- expose public functions nhung grant ro rang la audit trail.
grant execute on function public.scn_save_seating(uuid, text, jsonb) to authenticated;
grant execute on function public.scn_restore_seating(uuid) to authenticated;

-- Integrity: toi da 1 ban ghi current moi (class, month) - advisory lock la
-- co che chinh, index nay la phong tuyen cuoi neu co duong ghi khac.
create unique index if not exists seating_charts_one_current
  on public.seating_charts (class_id, month) where is_current;
