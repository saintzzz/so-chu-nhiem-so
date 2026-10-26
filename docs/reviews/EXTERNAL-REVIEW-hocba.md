# External Review - Học bạ số (TT22/2021)

Scope: tính toán xếp loại cuối năm, workflow GVCN→BGH, locking, export DOCX/PDF, audit trail, portal học sinh, phân quyền, write-boundary qua PostgREST.

## Round r-hb1 — REJECT (4 findings)

| # | Sev | Finding | Triệu chứng |
|---|-----|---------|-------------|
| F1 | High | Direct PostgREST bypass action validation | `yed_gvcn_ins` cho INSERT `status='submitted'` với snapshot giả; trigger không check completeness/legal ground |
| F2 | High | Submit chấp nhận quyết định thiếu trường | `validateDecision()` chỉ check enum; null kqht/kqrl/promotion qua được; chỉ UI `submitReady` chặn |
| F3 | Medium | Không có UI chọn môn miễn | Payload luôn gửi `dec?.exempt_subject_ids ?? []` |
| F4 | Medium | Nhãn "BẢN NHÁP" PDF dính trang HS trước | `pageBreak:"before"` đặt sau nhãn nháp |

### Fix + verify r-hb1 (commit `94b68fc`)

- Policy `yed_gvcn_ins` → draft-only; action insert luôn draft, submit qua UPDATE.
- Trigger `scn_yed_submit_guard`: submitted ⇒ 4 trường pháp lý non-null; ground ⇒ note non-empty (bypass `service_role` cho seed/admin).
- `approveYearEnd`: recompute bundle, chặn duyệt quyết định lệch gợi ý không căn cứ.
- Exemption editor (chips) + `exemptChanged` → `needsGround`.
- PDF: `pageBreak` gắn `block[0]` (nhãn nháp nếu có).
- Live DB: submit null-fields BLOCKED; ground-no-note BLOCKED; happy path OK.
- Prod E2E: GVCN submit với exempt Âm nhạc + mien_mon + note → `submitted`; BGH approve → `approved`; forged row (tot/tot, no ground) → approve bị chặn "lệch gợi ý... thiếu căn cứ pháp lý".

## Round r-hb2 — REJECT (2 findings)

| # | Sev | Finding | Triệu chứng |
|---|-----|---------|-------------|
| F1r | High | Ungrounded exemption bypass | GVCN UPDATE draft trực tiếp với exempt loại môn yếu + giá trị khớp tính toán sau-miễn + snapshot non-null, không ground → `bundleFor` dùng exempt của chính row đó → approve thấy không lệch → duyệt mà không cần căn cứ |
| F2r | Medium | Snapshot tính theo exempt cũ | Action tính bundle trước khi áp exempt incoming → snapshot lệch so với trạng thái sau lưu → false "source drift" |

### Fix + verify r-hb2 (commit `2f449b2`)

- Trigger: `submitted` + `exempt_subject_ids` non-empty ⇒ bắt buộc ground + note (chặn cả insert-exempt-rồi-submit lẫn update-exempt).
- `approveYearEnd`: check độc lập `cur.exempt_subject_ids?.length` ⇒ ground+note; recompute với `exemptOverride = cur.exempt_subject_ids`.
- `getStudentYearEndBundle(studentId, yearId, exemptOverride?)`; `saveYearEndDecision` truyền `input.exemptSubjectIds` → comp/snapshot theo tập miễn incoming.
- Live DB attack: draft+exempt → submit không ground = BLOCKED; exempt+ground+note = ALLOWED.

### Residual risk (documented, accepted)

- GVCN kiên quyết vẫn ghi được quyết định tùy ý kèm ground+note **giả mạo** qua PostgREST (draft→update). Không thể chặn ở DB vì DB không recompute TT22; biện pháp: approve recompute + audit trail bắt buộc (ground+note hiển thị minh bạch cho BGH). Đây là process control có audit, không phải silent forgery.
- `service_role` bypass trigger là cố ý (seed/admin); service key không lộ cho client.

## Test suite

- `tests/tt22-year-end.test.mjs`: 29/29 (công thức TT22, Đ.9.3, ma trận KQRL, danh hiệu, stages).
- `tests/cr053-review.test.mjs`: 10/10 static guards cho write-boundary.
- Gates: tsc, eslint, build, consistency, RTM 41/41, preflight PASS.

## Outstanding (ngoài scope round này)

- TT27/2020 (tiểu học): đánh giá theo nhận xét - chưa audit kỹ; cần pass riêng khi mở rộng cấp TH.
- Export `stu_pdf`/`bad_fmt` trả 500 (lần test trước, chưa tái hiện lần này) - kiểm tra trong round sau nếu còn.
