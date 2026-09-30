# CR-018 - Cap nhat can cu phap ly: TT 15/2026 thay TT 32/2020

**Status:** approved (research-driven, human directive: "deep research xem can
phai lam gi tot nhat dua theo thong tin cap nhat moi nhat tu bo giao duc")
**Date:** 2026-09-30
**Research basis:** `docs/research/REGULATIONS-UPDATE-2026.md`

## What changes

Thong tu 15/2026/TT-BGDĐT (eff. 10/5/2026) thay the TT 32/2020 (Dieu le truong
THCS/THPT) + TT 28/2020 (tieu hoc). Moi tham chieu "TT 32/2020" trong UI va
docs phu thuoc vao Dieu le cu, phai cap nhat.

### Trong code (user-facing)

- `src/app/(app)/parents/cmhs/page.tsx`: "theo Điều 44, Thông tư 32/2020" ->
  tham chieu Dieu le moi (TT 15/2026).
- `src/components/parents/cmhs-board.tsx`: "Điều 44 TT 32/2020" -> TT 15/2026.

Ruling: khong pin so Dieu moi vi toan van TT 15/2026 danh Ban dai dien CMHS
vao chuong "Quan he giua nha truong, gia dinh va xa hoi" - trich dan theo
chuong thay vi so dieu de tranh sai.

### Trong docs

- `docs/research/ROLE-MATRIX.md`: them TT 15/2026 la van ban goc, danh dau
  TT 32/2020 da het hieu luc.
- `docs/research/FUNCTIONAL-CHECKLIST.md`: cap nhat can cu.
- `docs/user-guide/HUONG-DAN-SU-DUNG.md`: giu TT 22/2021 (cong thuc DTBm -
  van hien hanh, chi sap sua boi du thao moi).

## Impact assessment

- Chi doi chuoi van ban trong UI/docs - khong doi logic, schema, RBAC.
- Khong phu thuoc vao feature khac.
- Risk: thap.

## Non-changes (verified compliant)

- `/emulation/ranking` xep hang THI DUA cap lop - khong phai so sanh ca nhan
  HS, khong vi pham Dieu 22.2 TT 15/2026 (cam so sanh HS-HS).
- CR-017 (bo Phong GD&DT) da dung voi TT 10/2025 + TT 15/2026 (chinh quyen
  2 cap: UBND xa nghiem thu).
