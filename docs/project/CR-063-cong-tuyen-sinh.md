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
- AC-63.1: tracking_code + unique index + dedupe id_number.
- AC-63.2: apply RPC kiem open + module flag + definer.
- AC-63.3: track RPC chi lo status + campaign.
- AC-63.4: apply RPC revoke khoi anon - chi service_role.
- AC-63.5: proxy whitelist /apply + api.
- AC-63.6: API co honeypot + turnstile + err map.
- AC-63.7: page dung RPC info, form post API.
- AC-63.8: board co nut sao chep link khi open.
- AC-63.9: tracking code mo rong 10 ky tu base32 + retry.
- AC-63.10: rate limit theo ip_hash 10/gio.
- AC-63.11: turnstile fail-closed khi co secret thieu token.
- AC-63.12: campaign_info khong lo ten khi chua open + noindex.
- Campaign draft/closed -> form khong cho nop.
- Bot: honeypot tripped -> gia thanh cong khong ghi.
- Module flag tuyen_sinh OFF -> cong apply cung tat (check trong RPC).
