# CR-048 - Đồng bộ tvc.profiles (backfill + trigger)

## Vấn đề / Why

Bug tìm trong QA Studio E2E 2026-10-11 (`docs/qa/QA-STUDIO-E2E-2026-10-11.md`):

- 7 bảng `tvc.*` có FK về `tvc.profiles(id)` (materials.author_id, matrices.owner_id,
  reviews.reviewer_id, questions.owner_id, exams.owner_id, generations.user_id,
  khbd_templates.created_by).
- SCN chỉ tạo row `tvc.profiles` **lazy** qua `ensureTvcProfile()` - và chỉ trong
  `saveMaterial`, generate route, saveQuestion. Reviewer/admin chưa từng soạn
  học liệu không có row → mọi RPC insert vào bảng con → FK violation → rollback.
- Hệ quả đã xác nhận trên prod: BGH không duyệt được học liệu (status kẹt
  `totruong_ok`). Hotfix `ensureTvcProfile()` trong `reviewMaterial` (commit
  `1756635`) chỉ vá 1 path - class bug còn lại ở mọi writer tương lai.

## Giải pháp / What

1. **Backfill 1 lần**: insert `tvc.profiles` cho mọi `public.profiles` có role
   (primary hoặc concurrent) thuộc nhóm staff `gvcn|gvbm|to_truong|bgh|admin`.
   Map role: `admin`→`admin`, `to_truong|bgh`→`kiem_duyet`, còn lại→`giao_vien`.
   Chỉ staff - không tạo cho hs/ph/so_gd (tránh cấp role giáo viên sai trong TVC360).
2. **Trigger** `trg_sync_tvc_profile` trên `public.profiles` (INSERT/UPDATE):
   - Staff role → upsert `tvc.profiles` (id, role lần đầu, `full_name`, `email`).
   - UPDATE chỉ sync `full_name`/`email` - **không downgrade** role đã có
     (user TVC360-native có thể là kiem_duyet/admin thật).
   - SECURITY DEFINER vì caller của insert vào public.profiles không có quyền
     ghi tvc schema.
3. `ensureTvcProfile()` giữ nguyên - vẫn hữu ích cho tài khoản được tạo trực tiếp
   trong auth.users mà chưa có public.profiles.

## Impact assessment

- **Schema**: 1 function `public.sync_tvc_profile()`, 1 trigger, 1 backfill INSERT.
  Không sửa cột/bảng hiện có. Idempotent (`on conflict`).
- **Data**: thêm ~N row vào `tvc.profiles` (số staff chưa có) - kiểm tra: prod có
  81/xxx profiles trong tvc.
- **Risk**: thấp. Trigger chạy sau INSERT/UPDATE profiles - lỗi trigger sẽ làm fail
  cả insert profile → test kỹ tạo user qua `/school/users` sau deploy.
- **Scope không làm**: không xoá tvc.profiles khi user mất role staff (TVC360 tự
  quản quyền riêng); không đồng bộ ngược tvc→public.

## Phases

- BA/Tech Lead: doc này (skipped Designer - no UI).
- Developer: migration qua Supabase `apply_migration`.
- Tester: re-run `scripts/qa-studio-e2e.mjs` + tạo GV mới và kiểm tvc.profiles
  có row ngay (không cần saveMaterial trước).
