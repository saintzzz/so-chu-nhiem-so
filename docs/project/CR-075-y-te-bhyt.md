# CR-075: `y_te_bhyt` - So y te + the BHYT hoc sinh

## Pham vi
- `yt_health_records`: kham suc khoe dinh ky (ngay, chieu cao, can nang,
  thi luc 2 mat, rang, ket luan, ghi chu) - nhieu lan kham / HS / nam.
- `yt_bhyt_cards`: the BHYT (ma the, noi DK KCB ban dau, hieu luc tu-den,
  trang thai con han/het han/chua co) - 1 the moi nhat / HS
  (`unique(school_id, student_id)`, upsert).
- RLS read: cung truong + module bat + bgh|admin|pht|ke_toan|so_gd
  hoac gvcn cua lop HS do (du lieu y te nhay cam).
- Write chi qua RPC `yt_upsert_health` / `yt_upsert_bhyt` (bgh|admin +
  module bat + HS cung truong + check rang buoc ngay/chieu).
- Page `/school/health` (bgh|admin|pht): class chips -> bang HS cot
  kham gan nhat + the BHYT + form Ghi kham / Sua the (canWrite chi bgh|admin).
- Nav bgh + pht; module key `y_te_bhyt`; suite `quan_ly`.

## Khong lam
- Khong in/export ho so y te (privacy - can CR rieng co audit).
- Khong import BHYT tu cong BHXH (can credential - backlog).
- Khong vai tro "nhan vien y te" rieng - persona admin/bgh quan ly.

## Verify
- Live 10/10: write bgh, deny gvbm, deny cross-school, check constraint,
  bhyt upsert + conflict update, invalid status/date, module off read+rpc.
- UI: bang + 2 form thuc, vn-sort, empty state, no console errors.
