# CR-078 - Cap nhat tai lieu NDT theo thuc te 02/11/2026 + hop dong ca nhan

- Ngay: 2026-11-02
- Loai: docs/business (khong doi code, khong doi schema)
- Nguon: user yeu cau "update theo tinh hinh thuc te, gui pptx moi nhat + soan hop dong ca nhan ky voi ca nhan"

## Pham vi

1. `docs/handover/PROPOSAL-tong-dau-tu-2ty8.md` - cap nhat so lieu:
   - Phan A keo dai den 02/11/2026 (~8 thang): ~859.5M (truoc ~793.7M den 15/10)
   - Phan B: 03/11/2026 - 18/04/2027, bo sung deliverables da co (suite entitlement, integration framework, TRIAL01)
   - Phan C: T05/2027 - T01/2029
   - Tong: ~2 854 450 000 VND (~2.85 ty); PA-1 dev ganh ~2.44 ty; PA-2 dev ganh ~1.86 ty
   - Rev-share window: 24 thang tu khach tra phi dau tien (thay moc co dinh T03/27-T03/29)
2. `scripts/gen-proposal-investment-pptx.mjs` - dong bo toan bo slide; regenerate `.pptx` (9 slide, verified khong con so cu)
3. `docs/handover/HOP-DONG-HOP-TAC-DAU-TU-TEMPLATE.md` + `scripts/gen-contract-docx.mjs` render 2 ban FINAL in san:
   - `HOP-DONG-HOP-TAC-DAU-TU-PA1.{md,docx}`: gop 414 725 000, rev-share B 40/A 60, co phan tuong lai 12.5% (giua khoang de xuat 10-15%)
   - `HOP-DONG-HOP-TAC-DAU-TU-PA2.{md,docx}`: gop 997 475 000, rev-share B 45/A 55, co phan tuong lai 17.5% (giua khoang 15-20%)
   - Format final: quoc hieu CHXHCN VN, bang thong tin 2 ben, cho ky 2 cot, page number footer, bo het placeholder mem (boi thuong 10%, TAND co tham quyen, 4 ban/moi ben 2)
   - Phu luc 1: ngan sach chi tiet B (PA1) / B+C (PA2) - so lieu tu PROPOSAL
   - Phu luc 2: lich giai ngan + milestone nghiem thu + mau bien ban nghiem thu; PA-2 = lich PA-1 + 7 dot quy 83 250 000 (Phan C)
   - Phu luc 3: trang xac nhan phuong an da chon
   - Phu luc 4: danh muc tai san that (repo, domain, Vercel, Supabase, 3 demo + TRIAL01)

## Impact

- Chi tai lieu + script gen; khong cham app code, DB, entitlement.
- Hop dong la DRAFT dam phan: placeholder dinh danh, chon PA-1/PA-2, ty le co phan [x]%; co disclaimer can luat su/cong chung/tu van thue.
- Cau truc: von gop share-risk KHONG phai vay; co phan tuong lai = cam ket khung co dieu kien (chua co phap nhan) -> khong hua co phan bat hop phap.

## Verify

- `node scripts/gen-proposal-investment-pptx.mjs` + unzip check: 9 slides, khong con "2 788"/"793"/"15/10"/"31/03"/"T12/2028"/"49 CR".
- `node scripts/gen-contract-docx.mjs`: 2 ban docx, khong em/en-dash, khong token {{}} sot, so tien/ty le dung tung phuong an.
