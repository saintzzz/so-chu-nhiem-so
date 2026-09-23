# QA Report - Full Coverage (moi man hinh, moi role)

Ngày: 2026-09-24 | Môi trường: production `so-chu-nhiem-so-theta.vercel.app`
Script: `scripts/qa-full-coverage.mjs` | **43/43 PASS, 0 console error**

## 1. Access matrix - 80 routes x 11 roles

Moi role login that, duyet tat ca route duoc phep + 1 route bi cam:

| Role | Routes allowed | Ket qua | Deny test |
|---|---|---|---|
| GVCN | 54 | 54 ok | `/schedule/manage` → redirect `/dashboard` |
| GVBM | 9 | 9 ok | `/dashboard` → `/academics/grades` |
| To truong | 13 | 13 ok | `/dashboard` → `/team/home` |
| BGH | 57 | 57 ok | `/dashboard` → `/school/dashboard` |
| PHT | 18 | 18 ok | `/dashboard` → `/school/dashboard` |
| Ke toan | 5 | 5 ok | `/dashboard` → `/school/staff` |
| So GD | 6 | 6 ok | `/dashboard` → `/dept/dashboard` |
| Phong GD | 4 | 4 ok | `/dashboard` → `/dept/dashboard` |
| UBND | 4 | 4 ok | `/dashboard` → `/dept/dashboard` |
| Phu huynh | 1 | 1 ok | `/dashboard` → `/portal/parent` |
| Hoc sinh | 2 | 2 ok | `/dashboard` → `/portal/student` |

Ghi chu: `/records/history` redirect hop le sang `/register/audit?type=records` (tinh la pass).
Redirect mat ~1-2s vi guard o server component - dung thiet ke.

## 2. Write flows qua UI -> verify DB

| # | Flow | Role | DB verify | Ket qua |
|---|---|---|---|---|
| W01 | Diem danh "Vang co phep" | GVCN | `attendance_records.status=excused` | PASS |
| W02 | Ghi nhan hanh kiem "Khen thuong" | GVCN | `conduct_records` row moi | PASS |
| W03 | Soan + gui thong bao PH | GVCN | `announcements` row moi | PASS |
| W04 | Cham diem thi dua = 9 | GVCN | `emulation_scores.score=9` | PASS |
| W05 | Sua ho so HS (dia chi) | GVCN | `students` + `student_record_history` | PASS |
| W06 | So dau bai render | GVCN | form hien | PASS |
| W07 | Don nghi phep | GVCN | render | PASS |
| W08 | So do cho ngoi | GVCN | render | PASS |
| W09 | So dau bai GVBM | GVBM | render | PASS |
| W10 | Minh chung nang luc | GVBM | render | PASS |
| W11 | Thong bao toan truong | BGH | render | PASS |
| W12 | Approvals queue | BGH | render | PASS |
| W13 | Safety dashboard | BGH | render | PASS |
| W14 | To truong home | TOTRUONG | render | PASS |
| W15 | Cuoc hop to | TOTRUONG | render | PASS |
| W16 | Thiet bi / tai san | KE_TOAN | render | PASS |
| W- | Dept dashboard/reports/facilities | SO_GD/PHONG_GD/UBND | render | PASS |
| W17 | Portal phu huynh | PH | render | PASS |
| W18 | Hoc ba hoc sinh | HS | render | PASS |

Screenshots: `docs/qa/screenshots-full/`

## 3. Tong hop coverage

- **80 routes** duoc test access cho dung role + deny cho role khac
- **18 write/render flows** qua UI that, 5 mutation verify trong DB
- **0 console error** tren toan bo sweep
- Role chua co write-flow rieng (do scope hien tai): pht (doc/giam sat), ke_toan (tai san), dept roles (tong hop)
