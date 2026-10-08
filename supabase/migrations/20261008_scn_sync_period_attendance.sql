-- ===========================================================================
-- scn_sync_period_attendance - dong bo so dau bai -> diem danh ngay nguyen tu
--
-- Truoc day client (period-log-board.tsx) chay 4+ statement roi rac:
--   select day_abs -> delete attendance_records source='period_log'
--   -> select existing -> insert / update tung row.
-- Crash giua chung = mat record ngay; hai GV luu dong thoi = race tren
-- cua so delete-recreate.
--
-- Fix: gom vao 1 function (RPC = 1 transaction implicit tren PostgREST) +
-- advisory lock theo (class_id, date) serialize cac lan luu dong thoi.
--
-- Semantics giu nguyen nhu logic client cu:
--   - Tinh lai status ngay = status NGHIEM NHAT tu TAT CA tiet cua lop trong
--     ngay (khong chi tiet GV dang luu) - neu khong GV A luu se xoa vang do
--     GV B ghi o tiet khac.
--   - Severity: unexcused=3 > excused=2 > late=1 > khac(present...)=0.
--   - Xoa record source='period_log' cu cua cac HS bi anh huong roi ghi lai.
--   - Record manual/parent (xac nhan GVCN) khong bi xoa; chi duoc NANG
--     severity khi vang theo tiet nghiem trong hon (bang chung thuc te),
--     khong bao gio ha severity. ON CONFLICT khong cham cot source.
--   - Chua nhat (weekday=null theo logic client) -> khong co tiet nao ->
--     worst rong -> chi don record period_log cu.
--
-- SECURITY INVOKER (mac dinh): RLS tren attendance_records van enforce authz
-- ben trong function - cung mo hinh scn_save_attendance/scn_save_grades.
-- ===========================================================================

create or replace function public.scn_sync_period_attendance(
  p_date date,
  p_class_id uuid,
  p_student_ids uuid[]
) returns void language plpgsql set search_path to 'public' as $function$
begin
  if p_date is null or p_class_id is null or p_student_ids is null then
    raise exception 'period_attendance_sync_invalid';
  end if;

  -- Serialize concurrent saves cung lop+ngay qua cua so delete-recreate.
  perform pg_advisory_xact_lock(
    hashtextextended(p_class_id::text || ':' || p_date::text, 0));

  -- 1) Don record do so dau bai ghi truoc do cho cac HS bi anh huong.
  delete from attendance_records
   where student_id = any(p_student_ids)
     and date = p_date
     and source = 'period_log';

  -- 2) Ghi lai tu status nghiem nhat trong ngay; co record san (manual/
  --    parent) thi chi nang severity, giu nguyen source.
  with worst as (
    select distinct on (pa.student_id) pa.student_id, pa.status
      from period_absences pa
      join period_logs pl on pl.id = pa.period_log_id
      join timetable_entries te on te.id = pl.timetable_entry_id
     where pl.date = p_date
       and te.class_id = p_class_id
       and te.weekday = case extract(isodow from p_date)::int
                          when 7 then null
                          else extract(isodow from p_date)::int + 1
                        end
       and pa.student_id = any(p_student_ids)
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
    where case excluded.status
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
$function$;
