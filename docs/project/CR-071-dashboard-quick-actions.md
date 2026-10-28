# CR-071: Dashboard quick-actions theo vai trò

## Vấn đề
Dashboard cấp trường (`/school/dashboard`, bgh/pht/admin) chỉ hiển thị KPI -
lãnh đạo phải tự nhớ và đi tìm các workflow đang chờ phê duyệt rải rác trong
nhiều module (biến động HS, điều động GV, học bạ chờ ký BGH, xét TN, dạy thay).
Mỗi phê duyệt trễ = nghiệp vụ kẹt.

## Phạm vi
- `src/app/(app)/school/dashboard/page.tsx`: strip "Việc chờ phê duyệt" -
  đếm pending theo từng workflow, mỗi mục link thẳng tới màn xử lý.
- Chỉ query/đếm các module đang BẬT (`disabledModules()` - fail-open theo
  convention hiện có của repo).
- Chỉ render strip khi tổng pending > 0 (không render empty noise).
- Tất cả query head-count (không tải rows), parallel Promise.all, tenant-scoped
  `school_id`, `must()` fail-closed.

## Nguồn pending (tất cả đều là route + trạng thái THẬT đã ship)
| Module | Bảng / điều kiện | Link |
|---|---|---|
| bien_dong_hs | sm_requests status='pending' | /movements |
| dieu_dong | dd_assignments status='pending' | /schedule/mobilization |
| hoc_ba | hb_exports status='gvcn_signed' | /records/exports |
| xet_tot_nghiep | tn_decisions decision='pending' | /school/graduation |
| van_hanh_nang_cao | substitute_requests status='pending' | /school/substitutes |

## Ngoài phạm vi
- Portal phụ huynh: không thêm link giả - PH chỉ có 1 trang thật
  (`/portal/parent`), mọi action đã nằm trong `ParentActions`.
- Portal học sinh: đã có link học bạ; bài thi đã surface qua danh sách
  session sẵn có - không duplicate.
- gvcn `/dashboard`: đã có 2 action + pending-task signals sẵn
  (chưa điểm danh / chưa nộp báo cáo / chưa đánh giá) - không thêm.
- to_truong `/team/home`: đã có pending-count + link pattern sẵn.

## Acceptance
- bgh/pht thấy đúng số pending theo từng loại, click tới đúng màn xử lý.
- Module tắt -> mục tương ứng không xuất hiện, không query.
- Không pending nào -> strip ẩn hoàn toàn.
- Zero console errors; pht không thấy gì ngoài scope campus của mình
  (pending counts vẫn school-level theo ROLE-MATRIX - phê duyệt là việc
  cấp trường, không phải theo campus).
