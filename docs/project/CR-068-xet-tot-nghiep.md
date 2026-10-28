# CR-068 xet_tot_nghiep - Xet tot nghiep cuoi cap (khoi 9 / khoi 12)

## What / Why
Truong can dot xet cong nhan tot nghiep cuoi cap: danh sach HS khoi 9
(THCS) / khoi 12 (THPT), doi chieu KQHT+KQRL ca nam (da co trong
`year_end_decisions` approved/locked cua CR-053) + diem xet TN, BGH chot
danh sach -> students.status='graduated' + ghi student_record_history +
thong bao GVCN. Dong chu trinh vao-hoc -> ra-truong cung bien_dong_hs.

## Scope
- `tn_campaigns` (school, year, level thcs|thpt, pass_score, require_exam,
  open|finalized) - 1 dot/cap/nam hoc.
- `tn_decisions` (campaign, student, kqht/kqrl snapshot, exam_score,
  eligible, pending|approved|rejected, note).
- RPC:
  - `tn_open_campaign(p_level, p_name, p_pass_score, p_require_exam)` -
    bgh|admin; seed HS active lop grade 9/12 nam hien tai + snapshot
    kqht/kqrl tu year_end_decisions approved/locked (stage moi nhat).
  - `tn_set_exam(p_decision, p_score)` - bgh|admin hoac gvcn lop do;
    0-10, tinh lai eligible; chi khi campaign open.
  - `tn_set_decision(p_decision, p_decision, p_note)` - bgh|admin override
    tung HS (du hoc, mien...) khi campaign open.
  - `tn_finalize(p_campaign)` - bgh|admin; eligible -> approved, con lai
    -> rejected; approved -> students.status='graduated' + history +
    notification GVCN; khoa campaign.
- RLS read: bgh|admin|so_gd scope; gvcn chi HS lop minh. Write: RPC only.
- Module `xet_tot_nghiep` (school_features) + nav "Xet tot nghiep".

## Eligibility
kqht<>'chua_dat' AND kqrl<>'chua_dat' AND (NOT require_exam OR
exam_score >= pass_score). Thieu kqht/kqrl/diem -> khong eligible.

## Roles
- bgh|admin: mo dot, override, finalize.
- gvcn: nhap diem xet TN cho HS lop minh, xem quyet dinh lop minh.
- so_gd: giam sat read.

## Out of scope
- Xuat quyet dinh khen thuong/cong nhan ra PDF/so so (CR-069 hoc ba XML).
- Import diem thi THPT tu CSDL Bo (connector ministry_gd CR-072 + creds).
