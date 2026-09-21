# CR-007 - Sơ đồ chỗ ngồi: cảnh báo và tự xếp chỗ cho học sinh chưa có ghế

## Bối cảnh

Khi GVCN import thêm học sinh mới (Import Excel) sau khi sơ đồ chỗ ngồi đã được tạo, các em mới không có ghế trong sơ đồ hiện tại mà không có cảnh báo nào. Phát hiện trong đợt QA dense-data (D3): 6A3 import 27 HS nhưng sơ đồ v2 chỉ hiển thị 5 ghế, 27 em "biến mất" khỏi sơ đồ.

## Phạm vi

Trang `/register/seating` (Sơ đồ lớp):

1. **Cảnh báo**: nếu sơ đồ hiện tại còn thiếu học sinh (so với danh sách HS đang học của lớp), hiển thị banner "Còn X học sinh chưa có chỗ ngồi" kèm danh sách tên các em.
2. **Tự xếp chỗ**: nút "Xếp chỗ tự động" điền các em chưa có ghế vào các ô trống còn lại của sơ đồ (theo thứ tự trái->phải, trên->dưới). Nếu không đủ ô trống, báo rõ và gợi ý thêm hàng/cột (đã có từ CR-004).
3. Lưu như phiên bản sơ đồ hiện tại (chỉ cập nhật khi người dùng bấm Lưu - không tự ghi DB).

## Ngoài phạm vi

- Không thay đổi logic kéo-thả, resize hàng/cột, chế độ Tuyên dương.
- Không tự động tạo phiên bản sơ đồ mới khi import HS (vẫn do GVCN quyết định).

## Impact assessment

- Code: `src/components/register/seating-editor.tsx` (thêm banner + hàm auto-assign vào layout state), `app/(app)/register/seating/page.tsx` (truyền danh sách HS chưa xếp).
- Không đổi schema, không đổi RLS, không API mới.
- Rủi ro thấp: thao tác chỉ thay đổi state client, persist vẫn qua nút Lưu hiện có.

## Estimate

Nhỏ - 1 component + page prop, ~40 dòng.
