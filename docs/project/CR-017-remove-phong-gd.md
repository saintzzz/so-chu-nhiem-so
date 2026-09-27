# CR-017: Xóa vai trò Phòng Giáo dục và Đào tạo (`phong_gd`) theo chính quyền địa phương 2 cấp

## Nguồn yêu cầu

Người dùng: "theo quy chế mới nhất có đúng là không còn Phòng giáo dục không? nếu đúng thế thì hãy xóa thông tin phòng giao dục đi nhé."

## Căn cứ pháp lý (đã xác minh)

- Mô hình chính quyền địa phương 2 cấp (tỉnh + xã) hiệu lực 1/7/2025, bỏ cấp huyện.
- **Phòng GD&ĐT cấp huyện chấm dứt hoạt động.**
- Nghị định 142/2025/NĐ-CP, Thông tư 13/2025/TT-BGDĐT, Thông tư 15/2025/TT-BGDĐT, Công văn 1581/BGD&ĐT-GDPT:
  - Nhiệm vụ chuyên môn, tuyển dụng/điều động GV, THPT → **Sở GD&ĐT (cấp tỉnh)**.
  - Quản lý trường mầm non, tiểu học, THCS, trung tâm học tập cộng đồng → **UBND cấp xã** (Phòng Văn hóa - Xã hội tham mưu).
- TT 13/2025 sửa trực tiếp Điều lệ trường (TT 32/2020): bỏ "Trưởng phòng GD&ĐT", thay tham chiếu cấp huyện bằng cấp xã.

## Phạm vi thay đổi

### Code
- `src/types/index.ts`: bỏ `"phong_gd"` khỏi union `Role`.
- `src/lib/auth.ts`: bỏ khỏi `ROLE_HOME` + `STAFF_ROLES`.
- `src/lib/nav.ts`: bỏ nav block + `ROLE_LABELS.phong_gd`.
- `src/app/(app)/dept/*`: bỏ `phong_gd` khỏi `requireRoles` + nhánh scope `org_unit_id` (dashboard, wards, facilities, reports, users).
- `src/app/api/ai/dept-brief/route.ts`: bỏ khỏi allow-list + sửa prompt.
- `src/app/login/login-form.tsx`: bỏ demo account `phonggd@demo.scn`.

### DB
- `scn_is_dept()`: bỏ `'phong_gd'` khỏi array role (migration mới + apply live).
- Xóa profile `phonggd@demo.scn` + auth user (demo data).
- Kiểm tra `org_units` loại `phong`: xóa đơn vị demo nếu có (nhiệm vụ chuyển UBND xã/Sở).

### Test & docs
- `scripts/qa-full-coverage.mjs`: bỏ `phong_gd` khỏi MATRIX/ROLE_EMAIL/ROLE_HOME/render loop.
- `scripts/seed-new-roles.mjs`, `qa-e2e.mjs`: bỏ tham chiếu.
- `docs/research/ROLE-MATRIX.md`, user guide, MO-TA-CHUC-NANG: cập nhật; regenerate PPTX/DOCX.

## Ngoài phạm vi

- Giữ `so_gd` (Sở GD&ĐT cấp tỉnh) và `ubnd` (UBND cấp xã) — đúng quy chế mới.
- Không đổi cấu trúc `org_units` ngoài xóa đơn vị demo loại phòng.
