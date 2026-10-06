# CR-032 - Ho so giao vien day du + mon phu trach + to chuyen mon

## Bai toan (PO)

GVBM phai biet day mon gi + thuoc to nao (Tu nhien/Xa hoi). He thong
truoc chi co role + campus + department - khong the kiem tra hop le
(GV Toan ngoi to Xa hoi), khong loc review theo mon, studio khong
pre-select mon cua GV.

## DB (migration 20261007_cr032)

- `departments.subject_ids uuid[]` - mon hoc cua to chuyen mon.
- `profiles`: `staff_code` (unique per school), `employment_type`
  (bien_che/hop_dong/thinh_giang), `qualification`, `concurrent_roles`.
- Giai quyet luon 2 mon he thong: `subjects` (SCN, per-school, ten) va
  `tvc.subjects` (code) qua `subjectNameToCode` mapping.

## Admin page /school/users (bgh/admin)

- Form tao tai khoan: + Ma can bo, Loai hop dong, Trinh do/chuyen mon.
- Bang: cot "Mon phu trach" (chips mon); chip canh bao vang + badge
  "!khac to" khi GV day mon ngoai danh muc mon cua to.
- Panel "Chi tiet" moi GV: Ho so (staff_code, loai hop dong, trinh do,
  kiem nhiem) + Mon phu trach (toggle multi-select -> teacher_subjects)
  + Quyen rieng (cu).
- Khoi "To chuyen mon - mon hoc": admin gán mon cho tung to bang chips
  (toggle -> updateDepartmentSubjects).

## Studio tich hop

- `/studio/[code]`: tool auto-preselect mon = mon phu trach dau tien
  cua GV (teacher_subjects -> subjectNameToCode). Verify: gv001 (to
  truong TN, mon Toan) vao DC-01 thay subject='toan' san.
- `/studio/questions`: filter scope moi "Mon cua to toi" - to truong
  mac dinh loc theo mon to minh (khong chan cung, van xem duoc Ca
  truong). Verify: gv001 thay 100 cau deu Toan.

## Actions moi (bgh/admin; setTeacherSubjects them to_truong)

- `updateStaffProfile` - ho so + role/campus/dept (scope school, audit).
- `setTeacherSubjects` - ghi de teacher_subjects cung truong (audit).
- `updateDepartmentSubjects` - ghi dept.subject_ids cung truong (audit).

## Verify

- Seed thuc: 2 to x 3 truong gan mon (THCS ND: TN=Toan, XH=5 mon;
  TH CVA; TH KD +12 mon moi do truoc thieu subjects).
- Playwright local: dept editor + cot mon + chips hien; gv001 filter
  "Mon cua to toi" -> chi cau Toan; DC-01 preselect toan.
- typecheck xanh.

## Con lai

- Library review: loc hoc lieu cho duyet theo mon to (materials.subject).
- Bao cao nhan su tong hop (ds GV theo loai hop dong/trinh do) - school
  dashboard.
- Concurrent_roles hien la text[] don gian - chua gan quyen vao role
  matrix (can CR rieng neu muon kiem nhiem -> them quyen).
