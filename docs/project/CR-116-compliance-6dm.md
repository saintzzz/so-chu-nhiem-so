# CR-116 - Dong cac gap theo audit 6 dau muc chien luoc

**Status:** proposed
**Date:** 2026-11-08
**Audit:** `docs/project/AUDIT-6DM-2026-11-08.md`

## Scope

4 work item doc lap, uu tien theo thu tu tac dong ban hang/trien khai:

### W1 - Doc gia tri gia tang + dieu kien trien khai (docs)

- `docs/positioning/GIA-TRI-GIA-TANG.md`: tai sao can, truong can gi,
  khac biet so voi SMAS/vnEdu/MISA.
- Kem checklist dieu kien trien khai 1 truong (dung cho sale/onboarding).
- Impact: chi docs. Effort: nho.

### W2 - Khoi "Chuc nang hay dung" tren dashboard theo vai tro (UI)

- Dashboard moi vai tro (GVCN, GVBM, BGH, ke toan, to truong, PH, HS)
  co strip the toi da ~6 chuc nang hay dung nhat cua vai tro do.
- Static theo vai tro dot dau (khong tracking ca nhan hoa).
- Impact: `src/app/(app)/dashboard`, `school/dashboard`, portals, nav
  config de xac dinh top functions. Effort: vua.

### W3 - Chuyen du lieu tu he thong cu + chuan bi CSDL nganh (data)

- Mapper "Import tu vnEdu/SMAS": doc file Excel export chuan vnEdu, map
  cot vao import pipeline hien co (preview + bao loi).
- Spec connector CSDL nganh GD&DT trong `docs/research/` (endpoint, auth,
  payload theo cong van Bo khi co) - framework integrations dung san.
- Truong ma dinh danh ca nhan (CCCD/dinh danh dien tu) cho students va
  profiles neu schema chua co - migration kem UI import.
- Kiem tra tenant lien cap (mot truong nhieu cap) khi co demo data.
- Impact: `src/lib/excel.ts`, man hinh import, migrations, integrations.
  Effort: lon - tach thanh PR rieng khi lam.

### W4 - Consent phan biet do tuoi (compliance)

- `consent_records`: suy dien nhom tuoi tu `students.date_of_birth`:
  <14 bat buoc kenh PH (`giay`/`cong` do nguoi giam ho xac nhan),
  >=14 cho phep HS tu dong thuan.
- UI `/school/privacy`: cot nhom tuoi + canh bao khi ghi consent sai
  doi tuong; bo loc "HS <14 chua co consent PH".
- Impact: migration (computed column hoac join), actions, board UI.
  Effort: vua.

## Non-scope (can quyet dinh chien luoc, khong code)

- Chuyen hosting DB ve provider phap nhan VN (Viettel/VNPT/CMC/FPT hoac
  Supabase self-host VPS VN) - quyet dinh theo yeu cau khach hang cong.
- Ho so danh gia ATTT voi A05 khi trien khai quy mo So/toan quoc - can
  don vi tham dinh ben ngoai.
- Dien region Supabase that vao HO-SO-CHUYEN-DU-LIEU (lay tu dashboard,
  human task da ghi nhan).

## Risk

- W3 phu thuoc dinh dang export that cua vnEdu - lay file mau tu truong
  pilot truoc khi finalize mapper.
- W4: thay doi ngu canh consent - kiem tra khong chan ghi consent hop le
  hien tai (chi canh bao, khong hard-block dot dau).
