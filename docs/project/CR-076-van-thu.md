# CR-076: van_thu - So cong van den/di

## Pham vi
- Bang `vt_documents`: direction (den/di), doc_no, doc_type (cong_van/quyet_dinh/bao_cao/to_trinh/khac), issued_date, from_org, to_org, subject, note, status (registered/processing/done/archived), handler_id, deadline. Unique (school_id, direction, doc_no).
- RLS read: bgh/admin/pht/ke_toan/so_gd cung truong + module `van_thu` bat. Write chi qua RPC `vt_create`/`vt_update` (bgh|admin) - revoke DML.
- Page `/school/documents`: tab den/di, bang so cong van (han qua han to do), form dang ky + cap nhat trang thai/nguoi xu ly.
- Nav: bgh + pht trong "Hoc sinh & chat luong", gate module `van_thu`. Suite `quan_ly`.

## Ngoai pham vi
- So den/so di so hieu tu dong tang theo nam (so dang ky cap truong): backlog.
- Dinh kem file scan cong van: can Storage bucket - backlog credentials.
- Ky so cong van di: backlog.
