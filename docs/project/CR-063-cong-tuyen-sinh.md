# CR-063 - Cong tuyen sinh truc tuyen (public apply + tra cuu)

## Nguon yeu cau
- User: "tao dot tuyen sinh xong thi hoc sinh phai vao apply duoc moi dung".
- Thuc te VN (research): TPHCM dang ky truc tuyen bang ma dinh danh HS
  tren cong tuyensinhdaucap; MISA EMIS: PH quet QR vao cong tuyen sinh
  cua truong, xem dot tuyen + nop ho so online (khong can account).
- SMAS: tiep nhan trong he thong / import Excel - app da co.

## Quyet dinh nghiep vu (PO)
- khoi_6: PH/HS nop ho so qua cong apply cong khai theo dot (link/QR),
  truong duyet -> nhap hoc (xet tuyen - dung luat: khong thi vao 6).
- khoi_10: cong lap thi do So to chuc (NV1/NV2 tren cong tinh - NGOAI
  scope truong). Truong nhan ho so qua cong apply (truong tu/ dac thu
  xet tuyen) hoac import danh sach; cap SBD -> nhap diem -> chuan ->
  nhap hoc (CR-062 da co). priority_order = thu tu nguyen vong cua HS
  doi voi truong nay; source_school = truong THCS nguon.
- Cong apply = trang public /apply/<campaign_id> khi campaign status=open.
- Tra cuu: applicant nhan tracking_code ngan sau khi nop; trang tra cuu
  nhap code -> chi thay status (khong lo du lieu).
- Bao ve: Turnstile + RPC security definer kiem campaign open +
  honeypot chong bot. KHONG cho anon insert truc tiep vao bang.

## Scope
- migration: admission_applications.tracking_code (unique, gen default),
  RPC admission_apply_public (definer, kiem open) + admission_track.
- /apply/[id]: xem thong tin dot + form nop (honeypot + turnstile).
- /apply/tra-cuu: tra cuu tracking code.
- API route /api/admissions/apply (POST) verify turnstile -> RPC.
- UI board: nut "Sao chep link nop ho so" cho campaign open.
- KHONG lam: upload giay to dinh kem (CR sau), cong tinh NV1/NV2 cap So.

## AC
1. Campaign open -> link /apply/<id> public form; nop -> row submitted
   + tracking_code hien thi cho nguoi nop.
2. Campaign draft/closed -> form khong cho nop.
3. Tra cuu bang tracking_code -> chi tra status + ten dot.
4. Bot: honeypot tripped -> gia thanh cong khong ghi; turnstile fail -> reject.
5. Module flag tuyen_sinh OFF -> cong apply cung tat (check trong RPC).
