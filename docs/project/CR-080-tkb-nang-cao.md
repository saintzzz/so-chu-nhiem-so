# CR-080: Thoi khoa bieu nang cao

## Nguon yeu cau
/schedule/manage da co editor tung o + conflict check. Gap "Trung" so
voi doi thu: copy TKB giua lop, xem lich theo GV, dem tiet/tuan,
export Excel.

## Quyet dinh nghiep vu
- copyTimetable(fromClassId, toClassIds[]): clone entries sang cac lop
  cung truong; o da co entry -> skip + bao cao; conflict GV/phong ->
  skip + liet ke.
- ?teacher=<id>: grid lich day cua 1 GV xuyen lop (doc-only).
- Dong dem: so tiet/tuan per mon trong lop dang xem (duoi grid).
- Export xlsx (ExcelJS co san) - 1 sheet TKB lop.

## Scope
- school/actions.ts: copyTimetable + getTeacherTimetable doc qua page.
- timetable-editor.tsx: them bar "Sao chep sang lop..." + dong dem +
  nut export.
- page manage them teacher param + grid readonly.

## Impact
- Khong doi schema; actions bgh/pht nhu hien tai.

## AC
- AC-80.1: copyTimetable tao entries cho lop dich, skip o da co +
  conflict, tra report {copied, skipped, conflicts}.
- AC-80.2: teacher view hien dung tat ca tiet GV do day (cross-class).
- AC-80.3: dong dem per mon hien so tiet/tuan dung DB.
- AC-80.4: export xlsx tai duoc, co header lop.
- AC-80.5: role bgh/pht nhu saveTimetableEntry; lop khac truong -> deny.

## Out of scope
- Auto-scheduling/GA solver, tiet doi, tuan le, keo-tha (giu click-edit).
