# CR-015 - Sua lo hong bao mat & data-integrity (cross-review findings)

## Nguon goc
Cross-model review cua QA suite phat hien 4 lo hong trong code (khong phai loi test).

## Scope

### C4a - GVBM cham diem lop khong phan cong
- **Hien tai**: `/academics/grades` chi scope class picker cho `gvcn` (`classes.gvcn_id = self`). `gvbm`/`to_truong`/`bgh` thay toan bo lop, `grades-editor` xoa+insert grades cho bat ky lop/mon nao.
- **Fix**: GVBM chi thay lop trong `timetable_entries`/`teacher_subjects` phan cong cho minh. To truong theo to chuyen mon. BGH giu nguyen (xem toan truong, can quyet dinh: BGH co duoc GHI diem khong? - mac dinh: BGH chi doc).
- **Impact**: `grades/page.tsx` (class query), `grades-editor.tsx` (guard write), co the RLS `grades` policies.

### C4b - emulation_scores ownership chi o client
- **Hien tai**: `editableClassIds` la prop UI; RLS `is_school_staff()` cho phep moi staff insert diem cho moi lop.
- **Fix**: RLS policy tren `emulation_scores` INSERT/UPDATE - gvcn chi lop `gvcn_id=self` (dung `scn_is_my_homeroom_class`), bgh/admin theo truong.
- **Impact**: migration moi; UI da dung roi nen khong doi.

### C4c - NationalIdField bypass audit
- **Hien tai**: `students-explorer.tsx` update `students.national_id` truc tiep bang browser client - khong `student_record_history`, khong `audit_logs`, khong ownership check.
- **Fix**: goi `updateStudentRecord` server action (da co check role + ownership + history + audit).
- **Impact**: `students-explorer.tsx` chi doi save handler.

### C4d - attendance fallback xoa period_log rows
- **Hien tai**: fallback trong `daily-roster.tsx` `delete().eq("date").in("student_id")` khong filter `source` - xoa ca rows `source="period_log"` roi insert lai `source="manual"` => pha contract dong bo period-log <-> daily-attendance.
- **Fix**: fallback chi delete `.eq("source","manual")` (hoac giu row period_log, chi upsert manual).
- **Impact**: `daily-roster.tsx` fallback path.

## Test plan
- Deny-at-write tests: GVBM goi save diem lop khong phan cong -> bi chan (RLS hoac guard).
- emulation_scores: gvcn insert lop khac qua client -> RLS chan.
- NationalIdField: sua -> co `student_record_history` + `audit_logs`.
- Attendance fallback: pre-seed period_log row, chay fallback -> row con nguyen.
- Full deny matrix moi route x moi role.
