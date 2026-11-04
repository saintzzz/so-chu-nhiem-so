# RUNBOOK - Quy trinh xu ly su co ro ri du lieu ca nhan (72h)

Phap cu: Luat 91/2025 - ro ri DLCN nhay cam phai thong bao co quan chuyen
trach ve bao ve du lieu ca nhan trong 72 gio; thong bao chu the khi anh huong.
Co quan tiep nhan hien nay: Cuc An ninh mang va phong chong toi pham cong
nghe cao - Bo Cong an (A05) qua cong thong tin/chinh thu chi dao.

## Vai tro

- **Dau moi phu trach (IR lead)**: Lê Duy Linh - linhld@vieschool.com - quyet dinh muc do + thong bao.
- **Ky thuat**: chain log truy cap, RLS, Supabase audit, Vercel logs.
- **Lien he truong**: thong bao quan tri truong bi anh huong.

## T+0 den T+2h: Phat hien - Chan ro

1. Ghi nhan nguon phat hien: canh bao he thong, bao cao user, review dinh ky.
2. Chan duong ro ngay: thu hoi key/token bi lo, khoa tai khoan lo, tat connector/endpoint bi loi, rollback migration loi neu can.
3. Bat dau nhat ky su kien (thoi diem, hanh dong, nguoi thuc hien) - luu trong su kien rieng, khong sua lai.

## T+2h den T+24h: Danh gia pham vi

4. Xac dinh pham vi theo checklist:
   - Du lieu gi: tai khoan, nghiep vu HS, nhay cam (y te, BHYT, sinh trac), lien he PHHS?
   - Bao nhieu chu the, cua truong nao (cross-tenant hay 1 truong)?
   - Kenh ro: loi RLS, lo key, endpoint public, email nham, backup?
   - Thoi gian ro: tu - den; con dang ro hay da dong?
5. Phan loai: (a) DL thuong, (b) DL tre em, (c) DL nhay cam. (b)+(c) = bao cao bat buoc 72h ke ca rui ro thap.

## T+24h den T+72h: Thong bao

6. Thong bao co quan chuyen trach (A05 - Bo Cong an) theo mau ngan gon:
   - Thong tin don vi, nguoi lien he.
   - Mo ta su co, thoi diem, loai du lieu, so luong chu the uoc tinh.
   - Bien phap da thuc hien, bien phap du kien, trang thai hien tai.
   - Neu chua du thong tin: nop bao cao so bo trong 72h + bo sung sau - khong duoc tre han cho du lieu.
7. Thong bao truong bi anh huong (qua email quan tri): pham vi, bien phap, khuyen nghi cho truong.
8. Thong bao chu the bi anh huong khi rui ro cao (VD ro CCCD, suc khoe, tai khoan) - phoi hop truong de thong bao PHHS.
9. Thu hoi/reset: doi password tai khoan lo, rotate key, yeu cau dang nhap lai.

## Sau T+72h: Hau kiem

10. Bao cao noi bo: nguyen nhan goc, bien phap ngan tai dien, cap nhat DPIA/runbook.
11. Neu loi cau truc (RLS, route guard, logging): mo CR ky thuat, khong patch nong.

## Checklist chung cu luu giu (phuc vu kiem tra)

- [ ] Nhat ky su kien day du (ai - khi nao - lam gi)
- [ ] Bang ke khai pham vi du lieu + so chu the
- [ ] Ban thong bao co quan (so bo + bo sung) kem thoi diem gui
- [ ] Ban thong bao truong/chu the
- [ ] Bien ban hau kiem + CR ky thuat (neu co)

## Dien tap

- Muc tieu: chay thu 1 lan/quy tinh tu "phat hien gia lap" den "mau bao cao" trong <4h.
- Kich ban dien tap de xuat: lo service-role key trong log; truong A doc duoc danh sach HS truong B do RLS sai.
