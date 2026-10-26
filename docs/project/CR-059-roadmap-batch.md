# CR-059: Dot yeu cau nghiep vu moi - register + impact assessment

Ngay: 27/10/2026 · Trang thai: **CHO DUYET UU TIEN** (khong code truoc khi chot)

Batch logic tu PO. Muc nay phan tich tung item, danh gia ton tai/trang nguyen, uoc tinh tac dong.
Moi sub-item duoc chon se tro thanh CR con chay SDLC day du (BA -> ... -> External Review).

## T + 0. Ton tai / trang nguyen hien co

| Yeu cau | Trang thai | Ghi chu |
|---|---|---|
| Ngan hang cau hoi 2 tang (he thong + truong) | DA CO | `questions.school_id IS NULL` = bank he thong (CR-028). Thieu: GV chon ti le khi rut de |
| Nhan muc do (biet/hieu/van dung/VD cao) + YCCĐ | DA CO | DC-02/03 + ngan hang deu gan nhan |
| Dieu dong day thay | DA CO | `/school/substitutes` - nhung do la day thay, khong phai xep TKB |
| Menu theo vai tro | DA CO | check-nav-access.mjs 158 hrefs, default-deny |
| Feature flag theo truong (module hoa) | CHUA CO | Chi filter theo role, khong theo goi module truong mua |
| DPIA / Luat 91 | DA CO | docs + RLS; can mo rong khi co biometric |

## A. Tuyen sinh dau cap (MOI - module lon)

- TH -> lop 6: HS dang ky -> truong duyet -> nhap hoc.
- THCS -> THPT: dang ky -> dang ky du thi -> dau -> nhap truong -> **ma dinh danh** -> phan cong giang day.
- Impact: bang moi (applicants, applications, exam_sessions, admission_results), role moi (can bo tuyen sinh?), portal cong khai (ung vien chua co account), workflow states, ma dinh danh = national student ID (da co cot `students.national_id` - kiem tra format).
- SDLC scope: BA + design + 2-3 sprint dev. Rui ro: cong khai = attack surface moi.

## B. Hoc ba so = XML + ky so GVCN -> BGH (MOI)

- Hien hoc ba da workflow so (trinh -> duyet -> khoa, audit trail DB).
- Them: xuat XML theo chuan nganh (can xac dinh schema - XSD co tu Bo/So khong?), ky so (chung thu so ca nhan - USB token / HSM / remote signing).
- Thuc te VN: ky so can CA (Viettel-CA, VNPT-CA, BKAV...) - ky tren XML/PDF dang PKCS#7/XMLDSig. Co the trien khai "ky so he thong" (chu ky may chu, tamper-evident) truoc, CA thuong mai sau.
- Impact: export XML, bang signatures, verify flow. Tuy thuoc vao co chuan XML nganh - **can hoi PO**.

## C. Dieu dong nhan su = xep TKB (DIEU CHINH khai niem)

- User logic: dieu dong nhan su thuc chat la xep lai TKB. Hien co `/school/substitutes` (day thay ngan han) + `/school/assignments` (phan cong nam).
- Can: luong dieu dong gan vao TKB - khi dieu dong GV, TKB tu cap nhat phan cong + kiem tra xung dot. Do vay: nang cap substitutes -> lien ket vao timetable slots, khong phai form roi.
- Impact: trung binh. Chinh lai model substitute -> gan period_id.

## D. Dang nhap VNeID (MOI - phu thuoc ben ngoai)

- VNeID KHONG co OAuth public cho app tu nhan. Muon xac thuc VNeID phai qua:
  a) Hop tac Bộ CA / nen tang dinh danh quoc gia, hoac
  b) Nha cung cap trung gian (Viettel, VNPT eKYC...) - tra phi theo lan xac thuc.
- Kha thi MVP: them auth method phu (Supabase custom provider / webhook xac thuc) + luu `vneid_subject_id`; **khong** thay the login email.
- Impact: trung binh về code, CAO ve giay to/phap ly/phi. **Can hoi PO**: da co contact vendor chua, hay chi la yeu cau ky thuat?

## E. Diem danh bang camera (MOI - rui ro phap ly LON)

- Canh bao phap ly: du lieu sinh trac hoc (khuon mat) cua TRE EM = du lieu nhay cam theo Luat 91/2025 + Nghi dinh 13/2023. Yeu cau: DPIA rieng, dong y CMHS, luu tru va xu ly nghiem ngat, nguyen tac toi thieu.
- Ky thuat: can camera IP + edge device chay nhan dien, dong bo len app. Khong nen stream video len cloud (privacy + IO).
- Khuyen nghi: phase sau cung, pilot 1 lop, co the bat dau bang "cham cong bang the/QR" truoc, camera sau.
- Impact: RAT LON (hardware + CV pipeline + compliance). **Can hoi PO** muc do uu tien.

## F. Module hoa tinh nang (MOI - nen tang ban hang)

- Y tuong: truong mua goi module nao menu/chuc nang do moi mo. Vua la chien luoc ban hang, vua la UX (bot rac).
- Trien khai: bang `school_features(school_id, module_key, enabled)` + menu filter + route guard + check-nav-access mo rong. Menu hien co da role-filter, chi can them tang feature filter.
- Impact: nho-trung binh. NEN LAM SOM vi cac module moi o tren (tuyen sinh, camera...) deu dung feature flag nay.

## G. Microservice hay khong? (TU VAN - khong phai CR)

- Tra loi thang: **KHONG, chua den luc**. Ly do:
  - He thong 3 truong / vai chuc nghin user - monolith Next.js + Supabase RLS da xu ly duoc va re hon nhieu.
  - Microservice bay gio = team nho quan ly N deployment, distributed transaction, log phan tan - chi phi lon hon loi ich.
  - Diem noi duy nhat dang tach doc lap (da lam): worker sinh noi dung AI nang IO - da tach bang async job + fallback, khong can microservice.
- Khi nao xem lai: >50-100 truong hoac workload AI/tuyen sinh cong khai co traffic pattern khac biet ro rang - luc do tach theo TENANT (project Supabase rieng theo cum truong - nhu CR-058 da plan cho EA) thay vi tach theo service.

## H. Tich hop CSDL ben thu 3 (MOI - nen tang)

- Huong tich hop: **khong viet connector rieng tung ben** - lam lop adapter: `integration_connectors` (type: moh_sis / crm / insurance / ...; config per school; sync direction; mapping) + webhook in/out + sync log + retry.
- Bo GD: chuan du lieu nganh (XML hoc ba o muc B chinh la mot manh tich hop). Can tai lieu API tu Bo/So - **can hoi PO** da co spec chua.
- CRM/bao hiem truong: moi ben mot format -> adapter pattern + field-mapping luu JSONB.
- Impact: lon nhung chia nho duoc theo tung connector. Bat dau bang dinh nghia `integration_outbox` + 1 connector dau tien.

## Ruling cua PO (27/10/2026)

- **Thu tu: dung de xuat** - Dot 1 = module flags + ti le 2 ngan hang.
- **VNeID**: chua co vendor. Lam khung san + nghien cuu chuan Bo GD/best practice truoc khi implement that.
- **XML hoc ba**: chua co XSD. Nghien cuu chuan nganh; neu khong co thi tu thiet ke theo TT22 + hook upgrade.
- **Camera**: LAM LUON nhung privacy-by-design - chi luu template/embedding du de so sanh danh tinh, KHONG luu anh khuon mat; chi expose ket qua diem danh.
- Microservice: theo tu van - khong lam, giu modular monolith + tach tenant khi scale.

## Nghien cuu chuan nganh (27/10/2026)

- **Hoc ba XML**: QD 3016/QD-BGDDT 2025 + CV 1396/BGDDT-GDTH 2024 co chuan that:
  - Root `<HOC_BA>` -> `<DU_LIEU_HOC_BA>` (`<THONG_TIN_CHUNG>`, `<QUA_TRINH_HOC_TAP>`, `<TONG_KET>`) + `<DANH_SACH_THONG_TIN_KY>` (GVCN, GVBM o cap TH, hieu truong) + `<PHAT_HANH_HOC_BA>`/`<KY_PHAT_HANH>` (chung thu so CSGD).
  - The tag viet hoa khong dau, ngan bang `_`; encoding UTF-8 / TCVN 6909:2001; chu ky so theo TT 41/2017/TT-BTTTT (XMLDSig tren node rieng, khong nam trong vung du lieu).
  - **API ket noi CSDL hoc ba so cua Bo**: envelope XML, auth = token + user_name + SHA256(password), `ma_don_vi`, `cap_hoc`, `nam_hoc`, messageid, `type` (vd THU_HOI_HOC_BA_SO), `content` = XML CompressString. Day chinh la connector muc H dau tien.
- **VNeID**: khong co OAuth public cho app tu nhan. Cac huong thuc te:
  a) Truong dang ky "dinh danh to chuc" tren VNeID theo ND 69/2024 (tai khoan muc 2 cua HT, ma so thue, quyet dinh thanh lap);
  b) SSO VNeID qua LGSP tinh (mo hinh So GD Thủ Dầu Một) hoac vendor C06 (RAR/Gtel) - phu thuoc dia phuong trien khai;
  c) Khung ky thuat san: cot `vneid_subject_id` + auth hook de sau nay gan SSO/OIDC proxy.
- **Camera**: ruling PO = chi luu embedding/template du de nhan dien, khong luu anh; chi expose ket qua diem danh. Van can DPIA rieng truoc pilot.

## Uu tien de xuat (draft - cho PO chot)

| Dot | Noi dung | Ly do |
|---|---|---|
| 1 | F (module flags) + ti le 2 ngan hang (A-phan nho) | Nen tang cho moi module sau; effort nho |
| 2 | B phan XML + "ky so he thong" (khong CA) | Hoan thien hoc ba so theo dung logic nganh |
| 3 | C dieu dong gan TKB | Nho, sua lai dung domain |
| 4 | A tuyen sinh | Module lon, can mua tuyen sinh |
| 5 | H integration framework + connector Bo GD | Phu thuoc spec ngoai |
| 6 | D VNeID | Phu thuoc vendor/phap ly |
| 7 | E camera diem danh | Can DPIA + pilot rieng, rui ro cao nhat |
