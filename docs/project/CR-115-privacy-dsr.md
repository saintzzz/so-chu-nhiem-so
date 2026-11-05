# CR-115: privacy_dsr - so ghi dong thuan + yeu cau quyen chu the

- Ngay: 2026-11-05. Nguon: audit phap ly `docs/legal/AUDIT-PHAP-LY-2026-11-05.md` muc 4 + 7.
- Bo phan: PM -> BA -> TL -> Dev -> Tester -> Deployer -> External Review.

## Muc tieu

Luat 91/2025 bat buoc: (1) ghi nhan dong thuan PHHS cho du lieu tre em dac biet khi nhay cam, (2) co quy trinh tiep nhan + xu ly yeu cau quyen chu the (truy cap, chinh sua, xoa, han che, phan doi, khieu nai) kem thoi han. Hien chua co bang/ghi nhan nao trong he thong.

## Pham vi

- Bang `consent_records`: ghi nhan dong thuan theo HS + muc dich (hoc tap, suc khoe, sinh trac, AI, hinh anh) + kenh + cho phep thu hoi.
- Bang `data_requests`: so tiep nhan yeu cau quyen chu the, han 30 ngay, trang thai xu ly.
- Route `/school/privacy` (bgh|admin, core - khong gate module vi day la ha tang tuan thu).
- RPC-only write (pr_*), tenant guard, revoke DML, RLS bgh|admin.

## Khong thuoc pham vi

- Flow tu phuc vu cho PHHS (portal) - backlog, can xac thuc PHHS truoc.
- Camera consent (theo rieng khi pilot).
- Ke khai DPO chinh thuc (giu o DPIA-v2).

## Nghiem thu

- bgh|admin ghi dong thuan, thu hoi, tao + cap nhat yeu cau; han qua han hien do.
- gvcn/gvbm bi tu choi (RLS + page guard); tenant khac khong doc duoc.
