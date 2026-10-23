# Project Memory — Sổ Chủ Nhiệm Số + TVC360

Quyết định, ruling và bài học tích lũy qua các CR. Mọi phase đọc file này
trước khi làm việc; cập nhật cùng commit với artifact của phase.

## Kiến trúc đã chốt

- **Stack**: Next.js 16.4.2 App Router + React 19 + TS strict, Supabase/Postgres
  RLS, Tailwind v4, Vercel deploy (push master → auto deploy, KHÔNG standalone).
- **Auth**: `getProfile` React-cache deduped; mọi route `requireRoles([...])`
  default-deny theo `docs/research/ROLE-MATRIX.md`. Server action dùng
  `checkActionRole`/`getProfile` - không dựa vào layout guard.
- **RBAC**: luôn dùng `my_roles()` (array, hỗ trợ concurrent_roles), KHÔNG
  `my_role()` scalar và KHÔNG `is_staff()` cho bảng nhạy cảm (gom gvbm/ke_toan/
  admin → leak). Dept roles (`so_gd`,`ubnd`) KHÔNG nằm trong `is_staff()`.
- **Export**: DOCX qua lib `docx`; PDF qua `pdfmake` bundled vfs Roboto (đủ
  dấu TV). Watermark "BẢN NHÁP - CHƯA DUYỆT" khi decision chưa approved/locked.
- **TT22/2021**: view điểm luôn tách HK1/HK2/CN; môn nhận xét render Đạt/Chưa
  đạt; subject rows build từ catalog đầy đủ của trường (kể cả môn chưa có điểm)
  qua `buildSubjectRows` trong `src/lib/hocba.ts` - dùng chung staff + portal.

## Workflow state machines

- **year_end_decisions** (CR-053): stage `initial` → `after_retest` (cần initial
  approved + promotion=kiem_tra_danh_gia_lai) / `after_summer` (cần approved +
  ren_luyen_he). Status draft→submitted→approved/rejected→locked.
  - `approved→locked` CHỈ qua trigger từ `register_signoffs` type=`so_hoc_ba`
    (lock-records UI: BGH tạo đợt → GVCN nộp → BGH duyệt&khóa).
  - Reject bắt buộc lý do ≥10 ký tự; resubmit rejected→submitted tăng revision.
  - Ghi đè gợi ý hệ thống: bắt buộc `override_legal_ground` + `override_note`.
  - Save path: stage=initial insert (23505→CAS update); stage sau update trực
    tiếp - trigger "stage already exists" chạy TRƯỚC unique constraint, nên
    insert lại stage row sẽ bị P0001 chứ không phải 23505.

## Bài học đã trả giá

- **Empty array là truthy**: `mergedNav()` init `children:[]` làm sidebar render
  accordion chết thay vì Link - check `children?.length`, đừng init mảng rỗng.
- **"Thấy text" ≠ "click được"**: verify UI bằng click/interact thật, không chỉ
  đọc DOM text hay snapshot.
- **E2E phải poll DB, không sleep cố định**: server action + router.refresh có
  thể >1.5s; assert ngay sau sleep cố định gây flake.
- **Supabase micro compute**: chuỗi E2E nặng gây statement timeout + credit
  throttle → test lúc DB khỏe, giữ result làm bằng chứng, rerun khi flake.
- **pre-commit preflight**: chạy typecheck+lint+build+audit+rtm+reliability+
  repo-laws+vercel-config+spec+uiux. INTENT.md tồn tại thì MEMORY.md bắt buộc.
- **RTM gate**: mọi `AC-x.y` trong docs phải xuất hiện trong ít nhất 1 file test
  (tests/e2e/scripts hoặc *.test.*). Script E2E phải COMMIT - temp script xóa
  đi là mất traceability.

## Demo accounts (đều demo1234)

- GVCN: anhptl@nd.scn (8A2), huynq@nd.scn (9A3); BGH: hainv@nd.scn;
  PHT: duclm@nd.scn (campus PH: 6A3/7A3/8A3/9A3); Sở GD: sovqt@demo.scn;
  UBND: daonvl@demo.scn (phường Trung Tâm: Nguyễn Du + Chu Văn An).

## Đang mở

- Supabase micro compute throttle khi chuỗi QA nặng - cân nhắc Pro+Small trước
  khi scale trường thật (đã ghi trong HANDOVER-2026-10-09).
- `ke_toan` đọc được tên HS qua `students_staff_read` - discrepancy chờ chốt.

## 2026-12-23 - CR-053 review loop dong (r33->r34)

- r33 (nemotron qua lead-review-cr053.mjs) bat 6 majors: server tin client
  computedSnapshot; chip dau tien xoa 3 field con lai; rejected->draft bi
  trigger chan; BGH sua duoc decided_by/at; stale-check thieu
  danhHieu+absentTotal; export fallback computed khi da co quyet dinh;
  Promise.all voi await ben trong = chay tuan tu.
- Fix commit d483ba0 + triage r34 commit 4dd999e. Migration
  20261223_cr053_yed_guard_attribution applied prod - BGH path khong
  rewrite duoc decided_by/decided_at nua.
- Regression asserts: tests/r2-regression.test.mjs r33-1..r33-7.
- Lead reviewer cho repo nay: scripts/lead-review-cr053.mjs (OpenRouter
  nemotron-3-ultra:free, doc .env.local). Khong phai Codex Cloud.
