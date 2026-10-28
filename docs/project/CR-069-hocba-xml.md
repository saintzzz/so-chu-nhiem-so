# CR-069 hoc_ba XML QD 3016 + ky so he thong

## What / Why
Xuat hoc ba so ra XML co chu ky so 2 cap: GVCN ky truoc -> BGH ky sau.
Chong gia mao bang sha256 + HMAC he thong (secret trong env). CA thuong
mai / USB token -> BACKLOG-CREDENTIALS (can nha cung cap CA + ky duyet
phap nhan). XML schema v1 (SCN-QD3016-v1) - khi Bo ban hanh spec chinh
thuc se anh xa lai (connector ministry_gd CR-072).

## Scope
- `hb_exports` (student, year, xml, sha256, status generated ->
  gvcn_signed -> bgh_signed, 2 chu ky + actor + time).
- RPC `hb_store` (gvcn lop do | bgh|admin; upsert chi khi chua ky BGH).
- RPC `hb_sign` (gvcn -> gvcn_signed; bgh|admin -> bgh_signed; sai
  trinh tu / sai lop -> forbidden/not_found).
- Server actions: generate (bundle -> XML -> sha -> store), sign
  (HMAC(HB_SIGNING_SECRET, id|role|sha) -> hb_sign), download (tra XML
  da gop block ChuKy + verify tai cho).
- Page `/records/exports`: chon lop -> trang thai export tung HS +
  hanh dong Ky/Download. Module `hoc_ba` san co.

## Roles
- gvcn: tao/ky cap 1 cho HS lop chu nhiem minh.
- bgh|admin: ky cap 2 + xem moi lop.
- so_gd: read.

## Out of scope
- CA thuong mai / USB token / chu ky so cong nhan phap ly (backlog cred).
- Nap XML len CSDL Bo (can spec + creds - backlog).
