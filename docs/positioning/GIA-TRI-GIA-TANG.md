# Gia tri gia tang - tai sao truong can So Chu Nhiem So

Tai lieu dinh vi cho ban hang/trien khai (CR-116-W1). Tra loi 3 cau: tai
sao can, truong can gi de dung, khac biet gi so voi SMAS/vnEdu/MISA.

## 1. Tai sao nha truong can

**Bai toan hang ngay cua GVCN/GVBM** - phan lon thoi gian "lam sach" thay vi
day:

- GVCN tieu bieu mat 3-5 gio/tuan cho so sao chep thu cong: diem danh giay
  -> nhap lai so diem -> tong hop bao cao -> tra loi PH qua Zalo ca nhan ->
  viet so chu nhiem cuoi tuan. Toan bo cong doan lap lai tren dữ lieu da co.
- Du lieu nam rai rac: Excel ca nhan, Zalo, so giay -> khi So/Phong yeu
  cau bao cao dot xuat thi truong phai lam lai tu dau.
- TT 15/2026 (Dieu le moi) + Luat 91/2025 (PDPL) dat yeu cau moi: du lieu
  hoc sinh la du lieu tre em - khong the tiep tuc nam tren may tinh ca
  nhan, Zalo, hoac he thong khong phan quyen. Truong nao khong so hoa co
  kiem soat se mac loi compliance, khong phai chi la cham.
- CSDL nganh (csdl.moet.gov.vn, TT 26/2019 + TT 42/2021) yeu cau ma dinh
  danh thong nhat - truong khong quan ly ma dinh danh ngay tu he thong thi
  moi lan bao cao lai phai ghep tay.

**Con so chat luong**: khi diem danh/ngay day du tu dong thi bao cao ngay
cho BGH la 1 nut, so chu nhiem cuoi tuan tu sinh tu du lieu da nhap, khong
con "viec cuoi tuan".

## 2. Truong can gi de trien khai

| Dieu kien | Cu the | Ghi chu |
|---|---|---|
| Thiet bi | May tinh/dien thoai co trinh duyet. Khong can cai dat, khong can server tai truong (SaaS) | Portal PH/HS toi uu mobile |
| Du lieu dau vao | File Excel danh sach GV/lop/HS - hoac file xuat san tu SMAS/vnEdu (mapper tu nhan dien Ma VEMIS) | Khoi tao 1 buoi cho truong ~500 HS |
| Nhan su van hanh | 1 nguoi phu trach (thuong van phong/PHT) cau hinh dau nam: nam hoc, lop, phan cong GVCN, TKB | Khong can nhan vien IT |
| Tai khoan | Email nhan su (hoac username tao san) - he thong tu sinh email noi bo neu truong khong co domain | Demo flow khoi tao san co |
| Internet | Mang truong binh thuong; cac thao tac hang ngay rat nhe | Khong yeu cau ha tang rieng |
| Phap ly | Dong thuan PHHS cho du lieu tre em (so ghi san trong he thong), phan cong trach nhiem theo Dieu le | Muc 6 - compliance co san |

Khong can: mua may chu, thue IT, doi quy trinh hanh chinh, dung cong cu dang
dung song song (chay parallel voi SMAS/vnEdu trong giai doan chuyen tiep).

## 3. Khac biet so voi doi thu

| Tieu chi | SMAS (Viettel) | vnEdu (VNPT) | MISA QLTH | So Chu Nhiem So |
|---|---|---|---|---|
| Diem khoi dau | Quan tri truong (BGH/van phong) | Nen tang nganh (ket noi VEMIS) | Quan tri + ke toan | **Cong viec hang ngay cua GVCN/GVBM** - diem danh 1 cham, so dau bai, so chu nhiem tu sinh |
| AI | Chua co/gioi han | Mot so diem | EMIS AI co ban | AI da tang: gen de thi, goi y nhan xet, phan tich radar, toan tu cau hoi - chay duoc ngay ca khong co API key (fallback noi bo) |
| Module | Goi tong | Goi theo cum | Ban theo phan he | **19 module ban le** - truong mua dung phan can (hoc ba, van thu, y te, tuyen sinh, LMS...) nhu phu kien |
| Chuan nganh | Theo SMAS | San nhat VEMIS | Theo MISA | **Ma dinh danh nganh (TT26/42) la truong du lieu chinh** - xuat/nhap tuong thich file V.EMIS, hoc ba XML QD3016 |
| Doi tuong phuc vu | Truong cong Viettel | Truong cong VNPT | Truong cong + tu | Truong cong + tu + nhom truong + So GD&DT xem tong hop dia ban |
| Bo sung khac | - | - | - | Cong khai tuyen sinh, portal PH/HS day du, Studio soan hoc lieu, privacy theo Luat 91/2025 |

**Loi the cot loi**: cac he thong nganh (vnEdu/SMAS) manh o "bao cao len Bo"
nhung yeu o "cong viec hang ngay cua giao vien". He nay lam ngon phan hang
ngay truoc - du lieu sach tr dong chay len bao cao, khong can nhap hai lan.

## 4. Checklist trien khai 1 truong (onboarding)

1. Thu thap: danh sach GV (ho ten, mon, to chuyen mon), danh sach lop,
   danh sach HS (chap nhan file SMAS/vnEdu), TKB hien tai, danh muc mon.
2. Khoi tao: chay workbook `khoi-tao-truong.xlsx` hoac import tung phan.
3. Cau hinh: nam hoc, 2 campus/neu co, phan cong GVCN, ma dinh danh nganh
   cho GV/HS da co tu CSDL nganh (neu co).
4. Module: bat cac module truong mua - mac dinh loi chay: diem danh, so
   diem, so dau bai, so chu nhiem, portal PH/HS.
5. Consent: gui thu PHHS + ghi nhan vao so dong thuan (muc 6).
6. Go-live tuan 1: chi can GVCN diem danh dung han - bao cao ngay toi BGH
   tu dong co. Cac phan sau mo dan.
