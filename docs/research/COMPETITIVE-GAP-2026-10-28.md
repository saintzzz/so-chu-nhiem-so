# Gap analysis cap nhat - sau wave CR-060..067

Ngay: 28/10/2026. Ban truoc: COMPETITIVE-ANALYSIS.md (truoc wave).
Nguon bo sung: vnEdu 4.0 (VNPT, 2026), MISA EMIS bao gia/phan he 2026,
trang chinh thuc QLTH/EMIS, cong tuyen sinh cac tinh.

## 1. Da dong gap (wave CR-060..067 - xac nhan da ship)

| Gap cu | CR | Trang thai |
|---|---|---|
| Tuyen sinh dau cap + cong apply public | CR-062/063 | Da co (xet tuyen K6, thi tuyen K10, portal public) |
| Khoan thu / hoc phi | CR-064 | Co ban: fee items, periods, invoices, bien lai, reports |
| HS lam bai truc tuyen | CR-065 | lms-lite: trac nghiem + cham tu dong |
| Thu vien | CR-066 | Danh muc, DKCB, muon/tra |
| Bien dong HS | CR-067 | Chuyen den/di, bao luu, nhap hoc lai |
| Module flags (ban theo goi) | CR-060 | school_features + 14 module keys |

## 2. Con thieu - trong roadmap, KHONG can credential

| Module | CR | Doi thu co | Uu tien |
|---|---|---|---|
| Xet tot nghiep | CR-068 | MISA EMIS Hoc sinh | CAO - bat buoc THPT |
| Hoc ba XML QD3016 + ky so he thong | CR-069 | vnEdu da noi CSDL hoc ba Bo | CAO - yeu cau phap ly |
| Dieu dong gan period_id TKB | CR-070 | SMAS xep TKB | TB - sua dung domain |
| Dashboard quick-actions theo role | CR-071 | - | TB - UX |
| Integration framework (connectors+outbox) | CR-072 | vnEdu API ket noi Bo | CAO - nen tang |
| Y te / BHYT (ho so suc khoe, nhap tay) | roadmap | MISA/vnEdu deu co | TB - sellable |
| Van thu | roadmap | MISA co | Thap |
| Khoan thu nang cao: mien giam, cap bu, no phai thu, nop thua, that thu, dot thu nhieu thang | mo rong CR-064 | MISA 21 bao cao HP-BC | CAO - module ban duoc |
| Xep lop tu dong sau tuyen sinh | mo rong CR-062 | MISA tu dong xep lop | TB |
| Bao cao nganh cap So (EMIS-style) | mo rong dept | MISA PGD/SGD | TB |

## 3. Con thieu - CAN credential / doi tac (ghi BACKLOG-CREDENTIALS)

| Item | Can gi | Doi thu |
|---|---|---|
| Thanh toan online (VNPAY/MoMo/VNPT Pay) | merchant + API keys | MISA/vnEdu deu co - gap ban hang |
| Zalo OA thong bao PH | OA approval | MISA "thu tien hoc dich danh qua ZALO" |
| Ky so CA thuong mai (hoc ba, giay to) | VNPT-CA/Viettel-CA | vnEdu tich hop san |
| Connector CSDL hoc ba Bo (QD3016 API) | credentials + spec tu So/Bo | vnEdu da thong |
| VNeID login | ND69 dinh danh to chuc / vendor C06 | vnEdu dang noi |
| Hoa don dien tu ND123 | provider (MISA/Viettel...) | MISA tich hop san |
| Camera/SmartID diem danh ra vao | phan cung + DPIA | vnEdu SmartID |
| BHYT cong BHXH | cong tra cuu BHXH | MISA co |

## 4. Gap moi phat hien (chua trong roadmap)

| Item | Doi thu | Danh gia |
|---|---|---|
| Dinh duong / suat an ban tru | vnEdu phan he rieng, rat pho bien truong ban tru | Them vao roadmap - module sellable doc lap |
| Mam non (dinh duong, tre em) | MISA/vnEdu co dong mam non | Scope decision - neu ban cho mam non |
| Hoc nghe / mon hoc tu chon | MISA EMIS Hoc sinh | THPT co day nghe - TB |
| Mobile app PH (native/PWA) | vnEdu Connect, MISA SISAP | Ta web portal + email - PWA la buoc re nhat |
| Lop hoc ao / hop truc tuyen | K12Online/vnEdu LMS | Thap - dung Meet/Zoom nhu doi thu VN van lam |
| Ca nhan hoa lo trinh (giao bai theo nhom) | vnEdu LMS | TB - tan dung LMS-lite + ngan hang da co |
| Gamification / dau truong tri thuc | K12Online | Thap |

## 5. Ket luan - con gi de "hoan thien san pham"

**Ban duoc ngay (in-scope thi truong):** san pham da du khoang xung de ban
truong pho thong - loi the rieng: hoc ba TT22 + workflow duyet + audit,
module flags ban theo goi nhu MISA nhung gon hon.

**De "day du" theo doi thu, theo thu tu gia tri:**
1. CR-069 hoc ba XML QD3016 + ky so he thong (ap luc phap ly, vnEdu da noi)
2. Khoan thu nang cao (mien giam/no/phat - MISA 21 bao cao la chuan nganh)
3. CR-068 xet tot nghiep (bat buoc cho truong THPT)
4. CR-072 integration framework (nen tang cho moi connector)
5. Dinh duong/ban tru + y te nhap tay (2 module sellable doc lap)
6. PWA portal PH (re hon app native, gan nhat voi vnEdu Connect)
7. Credential-gated: thanh toan online, Zalo OA, ky so CA, connector Bo - chi khi nao co hop dong/vendor.

**Khong nen lam:** lop hoc ao rieng (Meet/Zoom du), app native som
(PWA truoc), hoc nghe (theo nhu cau khach).
