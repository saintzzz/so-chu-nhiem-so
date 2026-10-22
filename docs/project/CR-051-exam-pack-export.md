# CR-051: Bộ hồ sơ đề thi - lưu + xuất trọn pack theo chuẩn phòng thi

- **Status**: APPROVED (PO: "làm lần lượt theo SDLC")
- **Nguồn**: gap audit - pack=full sinh 3 doc (đề CT + dự phòng + biên bản phản biện) nhưng chỉ đề CT được save; docDB/docBBPB mất sau khi đóng tab. Chưa có đáp án tách + hướng dẫn chấm + ma trận kèm theo trong 1 bộ hồ sơ.

## Scope

1. **Lưu pack**: tool-runner save thêm docDB + docBBPB thành materials (`type="exam"`, `origin_note` link về exam_id; `title` suffix).
2. **Đáp án + HD chấm**: `buildExamDoc` đã render bảng đáp án cuối đề - tách thành `docDA` riêng (đáp án + thang điểm + lời giải `solution` của câu nếu có) để phòng thi in riêng.
3. **Export pack**: `/api/studio/materials/[id]/export?fmt=docx` giữ nguyên; materials liên kết pack hiển thị nhóm "Bộ hồ sơ" trên trang chi tiết để GV tải đủ 4-5 file.
4. **Biên bản phản biện**: `buildReviewDoc` đã có - lưu như (1).

## Impact assessment

- **Code**: generate route (tách docDA), tool-runner (save n materials, UI nhóm pack), material detail page (hiển thị liên kết pack). Export route không đổi.
- **DB**: `tvc_materials.origin_note` đã có - dùng làm link (`pack:{exam_id}`), không migration.
- **RBAC**: không đổi.
- **Rủi ro**: tách đáp án khỏi đề -> phải đảm bảo đề in ra KHÔNG còn lộ đáp án (docCT hiện nhúng bảng đáp án cuối doc - tách = đổi layout đề).
- **Quyết định**: đề CT giữ nguyên không đáp án; `docDA` riêng. Doc cũ đã lưu không migrate (materials immutable).

## Estimate

Dev ~3-4h + test.

## AC

- AC-51.1: pack=full trả 4+ doc: đề CT (không đáp án), đề dự phòng, đáp án+HD chấm, biên bản phản biện.
- AC-51.2: đề CT export docx không chứa chữ "ĐÁP ÁN" hay bảng đáp án.
- AC-51.3: docDA chứa đáp án + điểm từng câu + solution khi có.
- AC-51.4: save material lưu được tất cả doc của pack, mỗi cái export docx riêng được.
- AC-51.5: pack=simple (đề + đáp án) trả đúng 2 doc.
