# QA Report - Studio TVC360 E2E (module Công cụ soạn học liệu)

- **Ngày**: 2026-10-11
- **Môi trường**: production `https://sochunhiem.vieschool.com` (Supabase shared với TVC360)
- **Script**: `scripts/qa-studio-e2e.mjs` (Playwright + service-role DB verify)
- **Kết quả**: **17/17 PASS** - `docs/qa/studio-e2e-2026-10-11.json`
- **Phạm vi SDLC**: Phase 6 (Tester) scoped review - module Studio. Tìm thấy 1 bug production đã fix trong phiên (commit `1756635`).

## Luồng kiểm chứng (business-flow E2E trên prod)

| Stage | Vai trò | Nội dung | Verify |
|---|---|---|---|
| T1 | GV `anhptl@nd.scn` (gvcn) | Hub 13 tools; DC-01 sinh KHBD + lưu; gửi duyệt; export DOCX; DC-02 ma trận; DC-03 rút đề từ ngân hàng 22.877 câu; A-01 bài đọc AI; ngân hàng; thư viện | tvc_materials / tvc_matrices / status / file PK-zip |
| T2 | Tổ trưởng `linhnm@nd.scn` | Duyệt lớp 1 | status `in_review -> totruong_ok`, reviews layer=1 |
| T3 | BGH `hainv@nd.scn` | Duyệt lớp 2 - xuất bản | status `-> published`, reviews layer=2 |
| T4 | Phụ huynh | Vào `/studio` | redirect `/portal/parent`, không leak data |
| F | service role | Cleanup QA-% | sạch materials + matrices + reviews |

## Bug production tìm được (đã fix + verify)

**BGH không thể duyệt/xuất bản học liệu** - Critical trước khi fix.

- **Hiện tượng**: `scn_review_material` RPC cho BGH trả lỗi
  `insert or update on table "reviews" violates foreign key constraint "reviews_reviewer_id_fkey"`,
  toàn bộ transaction rollback, status kẹt `totruong_ok`, UI chỉ báo "Không cập nhật được."
- **Root cause**: `tvc.reviews.reviewer_id` FK -> `tvc.profiles`, nhưng `ensureTvcProfile()`
  chỉ được gọi trong `saveMaterial` và generate route. Reviewer chưa từng soạn học liệu
  (đa số BGH) không có row trong `tvc.profiles` -> insert reviews fail.
- **Tái hiện**: gọi RPC trực tiếp bằng JWT của `hainv` (bgh) trên material `totruong_ok`
  -> FK violation; `linhnm` (to_truong) thì qua vì đã có tvc profile.
- **Fix**: thêm `await ensureTvcProfile()` vào `reviewMaterial` trước khi RPC
  (`src/lib/tvc/actions.ts`). Self-upsert `tvc_profiles` idempotent, RLS cho phép.
- **Verify**: sau deploy, E2E T3 `published` PASS; DB `tvc_reviews` ghi layer=2 approved.
- **Ảnh hưởng thực tế trước fix**: mọi BGH/tổ trưởng chưa từng soạn học liệu không thể
  duyệt - toàn bộ luồng kiểm duyệt 2 lớp của trường bị đứng. Prod có 21+ materials
  nhưng chỉ 1 BGH hiện diện trong `tvc.profiles`.

## Script bugs tự sửa trong vòng QA

1. `tvc_matrices` dùng `owner_id`, không phải `created_by` -> verify query đúng cột.
2. Trang DC-01 chỉ render checkbox YCCĐ cho môn/lớp có chuẩn - chọn `toan`/6 thay vì
   index ngẫu nhiên (standards chỉ có: toán 1-12, tiếng Anh 3-12, ngữ văn 6-12, tiếng Việt 1-5).
3. Query `tvc_materials` ngay sau "Đã lưu" thỉnh thoảng transient null -> retry 4x.
4. Approve buttons có thể click trước hydration -> retry theo DB status.
5. A-01 AI 5xx transient (fallback chain đang đổi key) -> retry 1 lần.
6. Material DC-02/DC-03 giờ được tag `QA-` để cleanup tự động.

## Kết quả chi tiết 17 checks

```
PASS cleanup pre-test                      PASS DC-02 ma trận + tvc_matrices
PASS login GV                              PASS DC-03 rút đề + exam material
PASS hub 13 tools                          PASS A-01 bài đọc AI (gemini)
PASS DC-01 KHBD -> personal                PASS ngân hàng /studio/questions
PASS gửi duyệt -> in_review                PASS thư viện hiện material QA
PASS export DOCX (PK zip 12-14KB)          PASS login to_truong + duyệt -> totruong_ok
PASS login BGH + duyệt -> published        PASS PH bị chặn khỏi /studio
PASS cleanup post-test (3 mats + 1 mx)
```

## Output artifacts

- `docs/user-guide/KICH-BAN-DEMO-STUDIO-E2E.pptx` - deck 19 slides, 13 screenshot thật
- `docs/demo/e2e-assets/s1..s14-*.png` - screenshot từng bước trên prod
- `scripts/capture-studio-e2e-screens.mjs` - tái chụp ảnh (chạy full flow thật)
- `scripts/gen-studio-e2e-demo-pptx.mjs` - regen deck

## Còn lại / đề xuất

- `check-consistency` vẫn timeout trên bảng lớn khi Supabase throttle (đã có backlog).
- `tvc_reviews.reviewer_id` FK dựa vào lazy profile - nên có backfill/đồng bộ
  `tvc.profiles` định kỳ thay vì chờ ensure* (đề xuất CR, không block).
- DC-01 qua AI mất 30-77s - cân nhắc progress indicator rõ hơn cho GV.
