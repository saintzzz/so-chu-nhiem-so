# AUDIT PHAP LY - VieSchool / So Chu Nhiem So (vieschool.com)

Ngay: 2026-11-05. Pham vi: compliance theo phap luat Viet Nam cho nen tang SaaS quan ly truong hoc.
Day la danh gia ky thuat - KHONG phai tu van phap ly; can luat su xac nhan truoc khi co ket luan chinh thuc.

Khung phap luat ap dung chinh:
- Luat 91/2025/QH15 ve Bao ve du lieu ca nhan (PDPL) + ND 13/2023/ND-CP + ND 356/2025 (chuyen du lieu ra nuoc ngoai)
- Luat An ninh mang 2018 + ND 53/2022
- ND 130/2018/ND-CP ve chu ky so va chung thuc chu ky so
- Luat Giao dich dien tu 2023
- Luat Giao duc 2019, TT 32/2020 (dieu le truong), TT 22/2021 (danh gia HS), QD 3016 (XML hoc ba)
- ND 52/2013 (thanh toan dien tu - khi bat billing cong thanh toan)

## Ket qua tong quat

| # | Hang muc | Muc do | Trang thai |
|---|----------|--------|-----------|
| 1 | Thieu trang Chinh sach bao mat + Dieu khoan su dung cong khai | CRITICAL | GAP |
| 2 | Ho so chuyen du lieu ra nuoc ngoai (Supabase/Vercel/Resend/AI providers) | HIGH | GAP |
| 3 | DPIA con la ban nhap noi bo, chua cap nhat y_te_bhyt/camera/billing | HIGH | PARTIAL |
| 4 | Chuoi dong thuan du lieu tre em (consent chain qua truong -> PHHS) | HIGH | PARTIAL |
| 5 | Du lieu suc khoe (y_te_bhyt) = DLCN nhay cam - can ke khai + consent ro | HIGH | PARTIAL |
| 6 | Ten goi "ky so" hoc ba - HMAC khong phai chu ky so ND 130 | MEDIUM | GAP |
| 7 | Quyen chu the du lieu (truy cap/chinh sua/xoa/keu nai) - chua co flow | MEDIUM | GAP |
| 8 | Thu tuc thong bao su co ro ri 72h | MEDIUM | GAP |
| 9 | Consent cookie/tracking tren landing | MEDIUM | REVIEW |
| 10 | Provenance ngan hang cau hoi (AI-generated - rui ro SGK thap) | LOW | OK-ish |
| 11 | Data localization theo Luat ANM + ND53 | LOW | MONITOR |
| 12 | Hoa don dien tu/VAT khi thu phi truong | MEDIUM | TODO |
| 13 | Chap nhan chu ky dien tu trong hop dong voi truong | LOW | TODO |

## Chi tiet

### 1. CRITICAL - Thieu van ban phap ly cong khai tren website

- `src/app/page.tsx`, `src/app/login/page.tsx` khong co link Chinh sach bao mat / Dieu khoan.
- Luat 91/2025 + ND13 yeu cau **thong bao xu ly DLCN** cho chu the truoc/khi thu thap: muc dich, loai du lieu, ben nhan, quyen chu the, thoi gian luu tru, thong tin lien he DPO/don vi kiem soat.
- Truong dang ky trial cung chua co ToS/DPA - hop dong SaaS thieu luon dieu khoan du lieu.
- **Fix**: tao `/legal/privacy` + `/legal/terms` (noi dung theo mau ND13), footer login + landing link toi; ToS kem dieu khoan "truong la ben kiem soat du lieu, chiu trach nhiem xin dong thuan PHHS".

### 2. HIGH - Chuyen du lieu ra nuoc ngoai

- Du lieu di qua: Supabase (region ngoai VN), Vercel (US), Resend email (US), AI providers Gemini/OpenAI/Anthropic/OpenRouter (US) - bao gom ca du lieu PHHS (email cha me) va noi dung hoc sinh.
- PDPL/ND356/2025: chuyen DLCN ra nuoc ngoai can **ho so danh gia tac dong chuyen du lieu** (transfer impact dossier) - nop cho Bo Cong an / co quan chuyen trach trong 60 ngay ke tu ngay chuyen; hop dong co dieu khoan bao ve du lieu voi ben nhan nuoc ngoai.
- Giam thieu da co: `ai-privacy.ts` redactPiiText + pseudonymizeNames truoc khi goi AI (tot - nhung can ke khai lai trong ho so).
- **Fix**: lap ho so chuyen du lieu (data map + hop dong DPA voi tung provider + danh gia rui ro); cai thien tiep - bat buoc DPA voi Supabase/Google/OpenAI (cac provider deu co DPA san), ke khai trong privacy notice.

### 3. HIGH - DPIA chua hoan thien

- `docs/project/DPIA-v1-tvc-scn.md` ton tai, trich Luat 91/2025, nhung ghi "ban nhap noi bo - can phap che ra soat" va nhieu checkbox chua tick (bao cao su co 72h, chuyen du lieu nuoc ngoai).
- Pham vi DPIA hien chi cover SCN+TVC360; chua cover: `y_te_bhyt` (suc khoe = nhay cam), camera diem danh (sinh trac - nhay cam nhat), billing/PHHS portal.
- **Fix**: update DPIA v2 - them 3 module tren + ket luan "can danh gia them truoc pilot camera"; ky trach nhiem + luu ho so san sang xuat trinh.

### 4. HIGH - Consent chain du lieu tre em

- HS 6-18 tuoi = du lieu tre em: PDPL yeu cau dong thuan cua nguoi giam ho (duoi 16 tuoi bat buoc PHHS dong thuan, 7+ tuoi can dong y cua tre).
- Mo hinh hop ly: truong = ben kiem soat du lieu, platform = ben xu ly. Nhung hien **khong co van ban** gan trach nhiem nay cho truong, va app khong ghi lai consent PHHS da thu thap.
- **Fix**: (a) ToS/DPA truong khai ro nghia vu xin consent PHHS truoc khi nhap du lieu HS; (b) bang `consent_records` (student_id, nguoi dong thuan, hinh thuc, ngay, pham vi) - truong tick xac nhan khi import; (c) portal PHHS hien thi du lieu con minh dang duoc luu tru.

### 5. HIGH - Du lieu suc khoe (y_te_bhyt)

- Chieu cao/can nang/BHYT/tien su benh = **DLCN nhay cam** (muc bao ve cao nhat PDPL).
- Ky thuat: RLS campus-scoped + role-gated da co (CR-075 r3). Phap ly: can (a) muc dich xu ly cu the trong DPIA, (b) consent ro rieng cho nhom nhay cam, (c) gioi han nguoi truy cap (da co - chi can ke khai).
- **Fix**: dua vao DPIA v2 + muc "du lieu nhay cam" trong privacy notice; log truy cap ban ghi y te (audit trail - co san audit.ts, chi can bat scope).

### 6. MEDIUM - Ten goi "ky so" gay hieu nham phap ly

- `hbxml.ts`: chu ky = HMAC-SHA256 he thong (key derive tu secret), 2 cap gvcn->bgh. Day la **chung thuc noi bo**, KHONG phai "chu ky so" theo ND 130/2018 (phai co chung thu so CA duoc cap phep).
- Neu xuat XML cho So/Bo va goi la "da ky so" -> rui ro hieu nham gia tri phap ly; ho so that can CA duoc Bo GD cong nhan.
- **Fix**: doi nhan UI/tai lieu thanh "ky xac thuc he thong (2 cap)" hoac "chu ky dien tu noi bo"; khi co CA hop tac (BACKLOG-CREDENTIALS) moi dung thuat ngu "chu ky so" + truong ky XAdES/XML-DSig dung chuan.

### 7. MEDIUM - Quyen chu the du lieu

- PDPL cho phep chu the: duoc biet, truy cap, chinh sua, xoa, han che, phan doi, keu nai, rút consent.
- Hien khong co flow tiep nhan/xu ly yeu cau (ke ca cho GV, PHHS, HS lon tuoi). Retention/deletion policy chua viet (du lieu HS ra khoi truong - chuyen truong/tot nghiep - xu ly the nao?).
- **Fix**: form/tiep nhan trong portal + quy trinh noi bo 72h; chinh sach luu tru viet ro (VD: hoc ba giu theo quy dinh ho so truong, du lieu trial xoa sau X ngay het han).

### 8. MEDIUM - Thong bao su co ro ri 72h

- PDPL: ro ri DLCN nhay cam phai thong bao co quan chuyen trach trong 72h + thong bao chu the khi anh huong.
- Chua co runbook incident-notification (DPIA checklist con trong).
- **Fix**: viet `docs/runbook/DATA-BREACH-72H.md`: nguoi phat hien -> chan -> danh gia pham vi -> mau thong bao -> lien he co quan (Cuc ANTT - Bo Cong an, dau moi hien tai).

### 9. MEDIUM - Cookie/tracking

- Can kiem tra landing co analytics/cookie khong. Neu co: banner consent theo ND13 + liet ke trong privacy notice. (Kiem tra nhanh khong thay script tracking trong src/app - xac nhan lai truoc release.)

### 10. LOW - Provenance ngan hang cau hoi

- `scripts/gen-bank/`: ngan hang sinh bang AI pipeline, KHONG scrape SGK/NXB - rui ro ban quyen thap.
- Van nen: (a) disclaimer "cau hoi AI-generated, GV chiu trach nhiem duyet" (workflow 2 lop duyet da co), (b) quy trinh gỡ noi dung khi co khieu nai ban quyen.

### 11. LOW - Data localization

- Luat ANM 2018 + ND53: luu tru trong nuoc ap dung hep (dich vu vien thong/Internet/gia tri gia tang co yeu cau tu co quan quan ly nha nuoc). Hien chua thuoc dien bat buoc; theo doi khi tich hop CSDL Bo - co the phat sinh yeu cau du lieu onshore cho bo phan du lieu nha nuoc.

### 12. MEDIUM - Hoa don/VAT khi thu phi

- Thu phi truong = doanh thu: can hoa don dien tu dung che do (ca nhan kinh doanh/doanh nghiep khi thanh lap phap nhan), ke khai VAT/PIT hoac CIT. Cong VNPAY/MoMo la trung gian thanh toan duoc phep (ND52) - chon merchant duoc cap phep la du, khong tu xu ly the.
- Lien quan hop dong dau tu: phan chia doanh thu ca nhan cung la su kien thue TNCN - da ghi chu trong hop dong.

### 13. LOW - Hop dong voi truong

- Them dieu khoan chap nhan ky dien tu/giao dich dien tu (Luat GDĐT 2023) trong ToS truong de hop dong ban online co gia tri.

## Uu tien thuc hien de xuat (khong tinh viec dang lam)

| Thu tu | Viec | Effort | Ghi |
|--------|------|--------|-----|
| 1 | Trang `/legal/privacy` + `/legal/terms` + footer link | 0.5d | CRITICAL - chan nhat khi khach/So vao xem |
| 2 | ToS/DPA truong: dieu khoan controller-processor + consent PHHS | 0.5d | Khoa cho consent chain |
| 3 | DPIA v2 (them y_te_bhyt, camera, billing) + ky + luu ho so | 0.5d | Tai lieu san co, chi cap nhat |
| 4 | Doi nhan "ky xac thuc he thong" thay "ky so" trong UI hoc ba | 0.2d | Tranh hieu nham phap ly |
| 5 | Ho so chuyen du lieu nuoc ngoai (map + DPA providers) | 1-2d | Can thu thap hop dong provider |
| 6 | Runbook breach 72h + muc quyen chu the trong privacy | 0.5d | |
| 7 | Bang consent_records + tick xac nhan khi import HS | 1-2d | CR rieng - co migration |

Ghi chu: muc 2,4 co the lam ngay trong codebase; muc 1,3,6 la tai lieu - lam truoc khi onboard truong tra phi dau tien; muc 5 can thong tin hop dong thuc te voi providers (kiem tra DPA Supabase/Google/OpenAI/Resend/Vercel).
