# CR-066: thu_vien - module thu vien truong hoc

## Nguon

PO roadmap sau phan tich doi thu (`docs/research/COMPETITIVE-ANALYSIS.md`):
vnEdu/SMAS co phan he thu vien (so dang ky tong quat/ca biet chuan
Thu vien QG, muon/tra, kiem ke). Ta chua co gi. Module doc lap,
ban kem theo `school_features`.

## Quyet dinh PO

- Khong co role `thu_thu` rieng (truong VN thu thu thuong la GV/admin
  kiem nhiem): quan ly = `admin` + `bgh`; moi staff cung truong doc
  duoc danh muc (RLS); HS chi thay sach minh dang muon trong portal.
- So dang ky ca biet (DKCB) danh so tr dong theo truong, atomic, khong
  trung - pattern `fee_receipt_seq` da duyet qua CR-064.
- Nguoi muon = HS (students.id) hoac GV/staff (profiles.id) - XOR.
- Qua han tinh tu `due_at` (khong luu trang thai rieng - nguon su that
  duy nhat la due_at + returned_at).

## Scope v1

1. Danh muc an pham `lib_books`: title, author, publisher, pub_year,
   isbn, category (text + goi y), price, notes.
2. Ban sao `lib_copies`: accession_no (so DKCB), book_id, status
   (available/on_loan/lost/damaged), source, acquired_at.
3. Muon/tra `lib_loans`: copy_id, borrower (student XOR teacher),
   issued_by, borrowed_at, due_at, returned_at, return_condition
   (ok/damaged/lost), notes. Tra voi condition damaged/lost -> cap nhat
   copy status tuong ung.
4. Trang `/library`: tong quan + danh muc sach + dang ky ban sao;
   `/library/loans`: muon moi + dang muon + qua han + tra sach;
   `/library/register`: so dang ky tong quat/ca biet (report chuan).
5. Portal HS: section "Sach dang muon" (chi doc, flag `thu_vien`).
6. Module flag `thu_vien` trong school_features + nav.

## Thiet ke

- `lib_accession_seq(school_id, next_no)` - cap so DKCB atomic qua
  advisory lock + upsert (copy fee_receipt_seq).
- RPC security-definer, moi RPC check `lib_module_enabled()` + role:
  - `lib_add_book(p_title, p_author, p_publisher, p_year, p_isbn,
    p_category, p_price, p_copies, p_source)` -> tao sach + N ban sao
    (cap DKCB).
  - `lib_add_copies(p_book, p_count, p_source)` -> them ban sao.
  - `lib_checkout(p_copy, p_student, p_teacher, p_days, p_note)` ->
    check available + cung truong + borrower XOR -> on_loan.
  - `lib_return(p_loan, p_condition, p_note)` -> returned_at +
    copy status.
- Doc: RLS staff cung truong doc lib_*; HS doc lib_loans cua minh
  (students.profile_id = auth.uid()); ghi chi qua RPC (revoke insert/
  update/delete tren copies+loans); books cho phep RLS update co
  module flag (catalog khong nhay cam - pattern fee).

## RLS / bao mat

- `lib_copies` + `lib_loans`: revoke ghi truc tiep khoi authenticated;
  moi ghi qua RPC.
- Trigger validate same-school: copy.school_id = book.school_id =
  school cua nguoi muon (cross-tenant trigger - pattern CR-064).
- `lib_loans` borrower XOR qua check constraint.
- Unique partial index: 1 copy chi 1 loan dang mo
  (unique(copy_id) where returned_at is null).

## Khong lam (v1)

- Dat truoc sach online, phat tien qua han, barcode/QR scan, kiem ke
  dot (so sanh ton dau ky), Dewey DDC day du - ghi debt.
- Portal GV xem sach dang muon cua minh - ghi debt (chi HS v1).

## Acceptance criteria

- AC-66.1: `thu_vien` la module doc lap trong school_features + nav.
- AC-66.2: Dang ky sach + ban sao -> DKCB tang dan, khong trung
  (verify DB), concurrent add khong race.
- AC-66.3: Cho muon -> copy on_loan; muon lai copy do -> loi;
  tra -> available; tra damaged/lost -> copy status dung.
- AC-66.4: Cross-school: book/copy/loan cua truong khac bi chan
  (trigger + RPC + RLS).
- AC-65.5 -> AC-66.5: module off -> route redirect + RPC
  `module_disabled`.
- AC-66.6: UI qua Playwright: them sach -> muon -> tra; portal HS
  thay sach dang muon; report register render.
