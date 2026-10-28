# CR-064 - Module khoan thu (hoc phi) - ban kem theo school_features

## Nguon
- PO uu tien 1 tu COMPETITIVE-ANALYSIS.md: MISA EMIS co phan he
  Khoan thu rat lon (dang ky khoan thu, mien giam, dot thu, thu tien,
  hoa don, doi soat, 20+ bao cao). ke_toan cua ta dang trong.
- Module key: khoan_thu. Role chinh: ke_toan + bgh/admin ghi (phe duyet ngoai le o truong nho, ke_toan khong phai luc nao cung co mat); so_gd + PH chi doc.

## Thuc te VN (research MISA EMIS flow)
- Khoan thu: hoc phi, tien an, tien ban tru, trang phuc, bao hiem,
  sach GK, hoat dong... theo khoi/nam hoc.
- Phuong thuc: dang ky khoan thu theo lop/khoi -> dinh muc/HS
  -> mien giam (ho ngheo, chinh sach) -> dot thu -> thu tien
  (thu tien mat/chuyen khoan, bien lai) -> cong no -> bao cao.
- Cong bo mien giam theo chinh sach dia phuong.

## Scope MVP (khong lam hoa don dien tu ND123, thanh toan online - CR sau)
1. fee_items: danh muc khoan thu (ten, loai bat buoc/tu nguyen,
   don gia mac dinh, ap dung khoi/lop).
2. fee_registrations: dang ky khoan thu tu nguyen theo HS (hoc ky/nam).
3. fee_exemptions: mien/giam theo HS (ly do, ti le %, thoi han).
4. fee_periods: dot thu (ten, ky, han nop, trang thai).
5. fee_invoices + fee_payments: hoa don theo HS/dot (so tien phai thu
   = khoan bat buoc + dang ky - mien giam); thu nhieu lan, trang thai
   unpaid/partial/paid/exempt; bien lai so tu tang.
6. Trang ke_toan: /finance/items, /finance/periods, /finance/invoices,
   /finance/reports (theo lop: da thu/chua thu, tong theo khoan).
7. PH xem cong no con qua /portal/parent (read-only) - trong MVP.
8. Guard: layout /finance + actions checkRole ke_toan/bgh/admin +
   assertModule('khoan_thu'). RLS theo school_id.
9. Thong bao PH khi phat hanh dot thu qua notifications/email san co.

## AC
1. AC-64.1: Tao khoan thu, gan khoi/lop; PH/HS khong thay khi module OFF.
2. AC-64.2: Dot thu tinh hoa don dung: bat buoc + dang ky - mien giam.
3. AC-64.3: Thu tung phan -> partial; du -> paid; mien 100% -> exempt;
   finance actions chan role + module, RPC atomic.
4. AC-64.4: Bien lai khong trung so (per school, atomic); migration
   fee_* co RLS tenant + parent view + RPC hardening.
5. AC-64.5: Bao cao theo lop: da thu/chua thu/tong, export CSV;
   finance UI sach convention.
6. Module OFF -> route + action + nav deu mat.
7. ke_toan/bgh/admin thao tac duoc, gvcn/gvbm/phu_huynh khong; so_gd chi doc.

## Khong lam (ghi debt)
- Hoa don dien tu ND123, thanh toan VNPay/QR, Zalo OA thong bao,
  so dư hoan tra nang cao - tung CR rieng.
