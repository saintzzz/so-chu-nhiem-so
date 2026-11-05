# CHINH SACH LUU TRU DU LIEU CA NHAN (Retention)

Ngay: 2026-11-05. Phap cu: Luat 91/2025 - chi luu giu trong thoi han can thiet
cho muc dich da thong bao; xoa/an danh hoa khi het muc dich.

| Nhom du lieu | Thoi han luu giu | Co so |
|---|---|---|
| Ho so tai khoan GV/BGH | Thoi han hop dong su dung + 12 thang sau cham dut | Phuc vu quan tri, bao hanh |
| Nghiep vu HS (diem, chuyen can, hanh kiem) | Nam hoc hien tai + toi da 2 nam hoc tiep theo, hoac khi truong yeu cau xoa | Bao cao, doi chieu; hoc ba dai han thuoc truong |
| Du lieu suc khoe (y_te_bhyt) | Cuoi nam hoc truong phai export ve + xoa khoi he thong trong 90 ngay (khuyen nghi) | Nhay cam - toi thieu hoa |
| consent_records | 5 nam ke tu thu hoi/cham dut | Chung cu dong thuan khi kiem tra |
| data_requests | 5 nam ke tu dong yeu cau | Chung cu tuan thu quyen chu the |
| Log ky thuat / audit | 12 thang | Dieu tra su co, RLS |
| Email log (Resend) | Theo chinh sach provider (30 ngay metadata) | Provider giu |
| Backup Supabase | Theo chu ky backup du an | Xoa cung du lieu goc |

## Nguyen tac van hanh

- Truong cham dung dich vu: export toan bo du lieu ve truong -> xoa tenant khoi
  he thong trong 60 ngay (ghi trong ToS Dieu 7).
- HS chuyen truong: du lieu di theo co che bien dong; truong cu khong giu ban sao
  ngoai he thong.
- Kiem ke dinh ky: truoc dau moi nam hoc, quan tri truong review du lieu nhay cam
  con can hay khong (nhac lich tren dashboard - backlog).
- Xoa = xoa that, khong chi an; ban ghi chung cu (consent/dsr) duoc giu theo han muc tren.
