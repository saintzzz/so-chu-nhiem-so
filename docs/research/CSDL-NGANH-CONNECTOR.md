# Spec ket noi CSDL nganh GD&DT (VEMIS) - CR-116-W3c

Nghien cuu: 2026-11-08. Muc tieu: truong dung he thong van gui duoc du lieu
ve CSDL nganh cua Bo GD&DT va nhap du lieu tu he thong cu (SMAS/vnEdu).

## 1. Bo cuc phap ly - ky thuat hien hanh

| Van ban | Noi dung lien quan |
|---|---|
| TT 26/2019/TT-BGDDT | He thong CSDL nganh mam non/pho thong/GDTX. Ma dinh danh **toi da 20 ky tu**, duy nhat, bat bien, do he thong cap tu dong khi tao ho so lan dau. HS/GV/CBQL/NV deu co ma. Khong xoa ma khi doi trang thai (nghi, chuyen, thoi viec). |
| TT 42/2021/TT-BGDDT | CSDL giao duc va dao tao tong the - mo rong pham vi ma dinh danh cho So, Phong, co so GD dai hoc, giao vien, nguoi hoc. Dieu 14 quy dinh ky thuat ve ket noi, chia se. |
| Cong van huong dan hang nam | So GD&DT cap tai khoan truong tren `csdl.moet.gov.vn`; truong bao cao dinh ky (dau nam hoc, giua nam, cuoi nam) qua cong nay. |

He thong CSDL nganh van hanh tai `https://csdl.moet.gov.vn` (mam non, pho
thong, GDTX). Co che ket noi thuc te hien nay: **nhap/xuat file chuan
V.EMIS** (Excel/XML theo mau Bo cong bo) qua tai khoan truong - khong phai
REST API cong khai. vnEdu (VNPT) tich hop sau vi VNPT van hanh VEMIS cho
Bo; SMAS (Viettel) xuat file bao cao V.EMIS de truong nap lai len cong.

## 2. Du lieu can san sang phia minh

| Du lieu | Trang thai he thong |
|---|---|
| `students.national_id` (ma dinh danh HS) | DA CO - validation da noi thanh 6-20 ky tu (CR-116) |
| `profiles.national_id` (ma dinh danh GV/CBQL/NV) | DA CO moi (migration 20261264) - nhap/sua tai `/school/users` |
| Ma dinh danh co so giao duc (truong) | THIEU - can `schools.national_id` (CR ke tiep, them khi biet ma So cap) |
| Ho so HS/GV day du theo truong bat buoc khai bao TT26 | MOT PHAN - can doi chieu danh muc truong bat buoc khi co cong van moi nhat |
| Hoc ba XML QD3016 | DA CO - export `/records/exports` |

## 3. Co che tich hop de xuat (theo giai doan)

**Giai doan 1 - file-based (lam duoc ngay):**

- Export goi "Bao cao CSDL nganh": sinh file theo mau V.EMIS hien hanh
  (danh sach HS/GV kem ma dinh danh, danh sach lop, co so vat chat) -
  truong tai len `csdl.moet.gov.vn` bang tai khoan So cap.
- Mapper da ho tro nhap tu file xuat SMAS/vnEdu (student-uploader nhan
  dien "Ma hoc sinh"/"Ma VEMIS", Ho dem+Ten, dia chi).
- Khi Bo cong bo mau file chinh thuc cho nam hoc hien tai, cap nhat
  template export - khong can doi code chi can cau hinh cot.

**Giai doan 2 - API (khi Bo mo):**

- Dung integration framework hien co (`integration_connectors` +
  `integration_outbox` + retry worker): tao connector type `csdl_nganh`
  voi auth theo spec Bo cong bo (du kien client credentials/VNeID co quan).
- Payload map tu truong noi bo sang schema CSDL nganh; retry + dead-letter
  san co.

## 4. Chuyen du lieu tu he thong cu cua truong (DA TRIEN KHAI 2 CHIEU)

**Import (he thong cu -> VieSchool):** `src/lib/vnedu.ts` `parseStudentTable`
+ `src/components/records/student-uploader.tsx`. Tu dong bo qua khoi tieu de
PHONG GD/TRUONG/LOP 4 dong dau cua file export that; nhan dien header bang
alias khong dau. Khi file co cot cha/me/SĐT/email: tao `parents` (dedupe theo
moi quan he + ten + SĐT de anh/chi em dung chung 1 ban ghi) va link
`parent_students` trong cung lan import.

**Export (VieSchool -> he thong cu):** `src/components/records/vnedu-export.tsx`
tai man hinh `/records/upload` - chon lop -> tai file `.xlsx` dung mau-1
vnEdu (khoi tieu de + **26 cot chuan**), `sanitizeSpreadsheetCell` chong
formula injection. Truong nap file nay len vnEdu/SMAS hoac csdl.moet.gov.vn.

**Round-trip:** `scripts/check-vnedu-roundtrip.mjs` assert export -> parse
lai khong mat: code, ma VEMIS, ho ten, ngay sinh (DD/MM/YYYY), gioi tinh,
dia chi, ten cha/me, SĐT, email. Truong khong round-trip duoc do mau-1
khong ho tro (ghi ro trong test): SĐT nguoi lien he khac cha/me, status
chi di qua cot Ghi chu.

| He thong cu | Cach chuyen |
|---|---|
| SMAS (Viettel) | Ho so HS: Ho so hoc sinh -> Xuat Excel. Nap vao "Nhap danh sach HS" - cot "Ma hoc sinh" vao `code`, "Ma VEMIS" (neu co) vao `national_id`. Diem: Bao cao Emis -> Bang diem (Excel theo mon) - nap tung mon vao so diem. |
| vnEdu (VNPT) | Quan ly lop hoc -> Nhap xuat -> "Xuat ra Excel hoc sinh toan truong (mau 1)". Cot "Ma VEMIS" -> `national_id`, "Ma hoc sinh" -> `code`, "Ho dem"+"Ten" tu gop, "Ten cha/me", "Di dong", "Email" -> `parents` + `parent_students`. |
| Excel thu cong | Template `ma_hs, ma_dinh_danh, ho_ten, ngay_sinh, gioi_tinh` - download tai man hinh nhap. |
| Khong he thong | Khoi tao truong bang `docs/templates/khoi-tao-truong.xlsx` (workbook day du lop/GV/HS/TKB). |

## 5. Viec con lai

- [ ] Them `schools.national_id` + truong nhap trong quan tri truong (ma
      dinh danh co so GD do So cap) - CR nho, lam khi co ma that tu truong
      pilot.
- [ ] Lay mau file V.EMIS hien hanh tu truong pilot -> hoan thien export
      Giai doan 1 (cot chinh xac theo mau Bo nam hoc dang chay - cot mau-1
      da dung cau truc file vnEdu that, con cot CSVC/dan toc can mau Bo).
- [ ] Khi co credential truong tren csdl.moet.gov.vn -> do kiem thu xem
      co endpoint nap file/API khong, cap nhat spec muc 3 (khong gia dinh
      API truoc khi co tai lieu Bo).
- [ ] E2E import file mau-1 that tu truong pilot (fixture hien tai dung cau
      truc quan sat duoc cong khai - can 1 file that de chot alias cuoi).
- [ ] Kiem tra tenant lien cap tren luong xuat bao cao.
