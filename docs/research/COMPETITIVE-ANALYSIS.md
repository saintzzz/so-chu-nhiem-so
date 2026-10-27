# Phan tich canh tranh - VN school software (research 2026)

Nguon: trang chinh thuc MISA EMIS/QLTH, Viettel SMAS + K12Online,
VNPT vnEdu/vnEdu LMS, cong tuyen sinh HN/HCM/Dak Lak/Thai Nguyen,
MISA SISAP.

## 1. Quan ly truong hoc (SMAS / vnEdu / MISA QLTH)

| Kha nang | Ho co | Ta co | Gap |
|---|---|---|---|
| Ho so HS, diem, TKB, SLDT | Day du | Day du (manh hon: hoc ba TT22 + audit) | - |
| Tuyen sinh dau cap | Cong truc tuyen + tiep nhan trong/ngoai he thong | Cong apply public + import + RPC workflow | - |
| **Khoan thu / hoc phi** | Phan he rieng rat lon: dang ky khoan thu, mien giam, dot thu, thu tien, hoa don dien tu ND123, doi soat, so phai thu, 20+ bao cao | Gan nhu trong - ke_toan chi co nhan su/CSVC | **LON - module ban duoc** |
| **Thu vien** | Phan he rieng: so dang ky tong quat/ca biet/SGK chuan Thu vien QG | Chua co | Module moi |
| Y te / BHYT | Co phan he y te hoc duong | Chua co | Module moi (uu tien thap) |
| Van thu | Co | Chua co | Thap |
| Bien dong HS (chuyen den/di) | Workflow rieng | Chi status tren students | Can workflow |
| Xet tot nghiep | Co | Chua co | CR sau |
| Phan he ban rieng | MISA ban theo phan he - dung mo hinh school_features cua ta | **Da co - validation direction** | - |
| App PH (SISAP) | Mobile app: diem, thuc don, suc khoe, thanh toan khong tien mat, nhap diem giong noi | Cổng PH web + email | Zalo/thanh toan la gap |
| Lien thong phan he | Ho so HS <-> Hoc phi lay sang/cap nhat lai | Module flags da share DB - loi the monolith | - |

## 2. LMS (K12Online / vnEdu LMS / V-Study)

| Kha nang | Ho co | Ta co | Gap |
|---|---|---|---|
| Ngan hang cau hoi | Co | **Co + 2 tang truong/he thong + ti le - hon ho** | - |
| Tao de trac nghiem | Co | Co (DC-03) | - |
| **HS lam bai truc tuyen** | Lop hoc ao, bai tap online, cham tu dong | **Chua co - HS khong lam bai tren he thong** | **LON** |
| Bai giang da phuong tien | Video/SCORM/PDF | Studio tao hoc lieu doc/pptx - khong host courseware | Gap TB |
| Kiem duyet noi dung | Workflow duyet bai giang/KHBD | Co approve chain KHBD, so chu nhiem | - |
| Ca nhan hoa lo trinh | Giao bai theo nhom nang luc | HS can ho tro + ke hoach - chua giao bai theo nhom | TB |
| Dau truong tri thuc | Gamification | Thi dua co nhung khac huong | Thap |
| Hop truc tuyen | Tich hop | Chua co | Thap (dung Meet/Zoom) |

## 3. Thu vien (VIELIB / MISA / VietBiblio)
- So dang ky tong quat, ca biet, SGK theo chuan Thu vien Quoc gia
- Muon/tra, phat qua han, bao cao luu thong, kiem ke
- -> Module ban rieng: catalog + muon/tra + qua han + bao cao chuan.

## 4. Bai hoc UX tu doi thu
- MISA/SMAS ban theo **phan he** - school_features cua ta dung huong,
  can mo rong them module (khoan_thu, thu_vien, lms, y_te).
- PH mobile-first: SISAP app; ta dang web - uu tien Zalo OA truoc app.
- Cap So co cong rieng (tsdc) - ta dang o cap truong, dung scope.

## 5. Uu tien PO (gan vao CR-059 roadmap)
| Dot | Module | Ly do |
|---|---|---|
| Da xong | tuyen_sinh (+ cong apply), module flags | - |
| **Ke** | **khoan_thu (hoc phi)** | Gap lon nhat, ke_toan dang trong, MISA chung minh nhu cau; kha nang ban cao |
| Sau | lms-lite: HS lam trac nghiem online + cham tu dong (tan dung ngan hang da co) | Tan dung tai san san co |
| Sau | thu_vien | Doc lap, de ban kem |
| Sau | bien_dong_hs, xet_tot_nghiep, zalo_oa, thanh_toan | Theo nhu cau khach |
| Backlog | y_te, van_thu, lop_hoc_ao, hoc_nghe_tu_chon | Khi co khach yeu cau |
