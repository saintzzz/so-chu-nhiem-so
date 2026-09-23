# QA Report - CR-013/CR-014 UI Test (toan bo qua giao dien web)

- Ngay: 2026-09-23
- Moi truong: production `https://so-chu-nhiem-so-theta.vercel.app`
- Harness: `scripts/qa-ui-cr014.mjs` - Playwright, moi thao tac qua UI that, mutation verify trong DB
- Ket qua: **17/17 PASS - 0 console error**
- Screenshots: `docs/qa/screenshots-cr014/`

## Tra loi nhanh: "Nop so o cho nao?"

Menu **So chu nhiem -> Nop & ky so chu nhiem** (`/register/signoff`):
- GVCN thay nut **"Nop so"** tren lop chu nhiem cua minh (status `pending`/`rejected`)
- BGH thay nut **"Ky duyet"** / **"Tu choi"** tren so da `submitted`

## Ket qua chi tiet

| # | Test | Ket qua | Bang chung | Screenshot |
|---|---|---|---|---|
| T01 | GVCN nav theo business flow | PASS | Thu tu: Chuyen can -> QL hoc sinh -> Giang day -> Phu huynh -> Tu van -> So chu nhiem -> Thi dua | `01-dashboard-gvcn-nav.png` |
| T02 | Roster co class chips | PASS | 9 chips (2 lop CN + 7 lop day) | `02-roster-chips.png` |
| T03 | Praise persist `?praise=1` + ly do duoi HS | PASS | "+1 diem - Tich cuc phat bieu xay dung bai" | `03-seating-praise.png` |
| T04 | Doi lop giu praise=1 | PASS | `seating?class=...&praise=1` | - |
| T05 | Nut "Sua ho so" hien thi | PASS | Trong panel expand hoso HS | `05-student-expand-edit-btn.png` |
| T06 | Edit HS qua modal -> persist DB | PASS | Nguyen Van An: dia chi moi trong `students` | `06-student-edit-modal.png` |
| T07 | `student_record_history` ghi old/new | PASS | "Phuong An Khanh..." -> "Xa Tan Hoa..." + editor | - |
| T08 | Trang Nop & ky so render | PASS | - | `07-signoff-gvcn.png` |
| T09 | **GVCN nop so qua UI -> `submitted`** | PASS | DB: status=submitted + submitted_by=GVCN | `08-signoff-pending.png`, `09-signoff-submitted.png` |
| T10 | Trao doi PH day du | PASS | 6A3=48 lien he, 8A2=50 lien he, 2 PH co TK co link chat | `11-parent-chat.png` |
| T11 | Emulation: GVCN chi sua lop CN | PASS | 8 input editable (lop CN), 33 o readonly | `13-emulation-scoring.png` |
| T12 | Nhat ky & lich su gop + filter | PASS | 2 tab + filter | `14-audit-merged.png` |
| T13 | Export xlsx | PASS | `so-chu-nhiem-6A3-2026-09.xlsx` | `15-export.png` |
| T14 | **BGH ky duyet qua UI -> `signed`** | PASS | DB: status=signed + signed_by=BGH | `16-signoff-bgh.png`, `17-signoff-signed.png` |
| T15 | BGH nav 4 nhom | PASS | Dieu hanh / Nhan su & to chuc / Hoc sinh & chat luong / Giam sat | `18-bgh-nav.png` |
| T16 | GVBM bi chan `/records/students` | PASS | Redirect `/academics/grades` | - |
| T17 | PH bi chan `/register/signoff` | PASS | Redirect `/portal/parent` | - |

## Flow nghiep vu chinh da verify E2E qua UI

### Signoff 2 buoc (T08 -> T09 -> T14)

1. Reset precondition: `register_signoffs` lop 8A2, `period='2026-09'`, `type='so_chu_nhiem'` ve `pending` (khong co UI de "bo ky" - day la precondition setup, khong phai bypass test)
2. GVCN vao `/register/signoff` -> thay nut "Nop so" -> click -> DB `status=submitted`, `submitted_by` = GVCN
3. BGH (context moi) vao cung trang -> thay nut "Ky duyet" -> click -> DB `status=signed`, `signed_by` = BGH
4. GVCN KHONG thay nut "Ky duyet" - dung phan quyen 2 buoc

### Sua ho so HS (T05 -> T07)

1. GVCN `/records/students` -> click dong HS -> nut "Sua ho so" -> modal
2. Doi dia chi -> "Luu thay doi" -> modal dong, khong loi
3. DB: `students.address` cap nhat + `student_record_history` co dong field=address old->new + changed_by=GVCN
4. Scope: GVCN chi thay lop `gvcn_id=self`; GVBM bi chan route; server action double-check

## Luu y

- `register_signoffs` dung cot `period` ('2026-09' / 'Thang 9/2026') + `type` ('so_chu_nhiem'/'so_hoc_ba'), khong phai `month`.
- Parent-chat: link `?to=` chi render cho PH co tai khoan - PH chua co TK hien mo + phone/email (dung thiet ke CR-012).
- Emulation readonly cells la `<span>` khong phai `input[readonly]`.
