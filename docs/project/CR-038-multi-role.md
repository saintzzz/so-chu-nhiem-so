# CR-038: Multi-role - vai trò kiêm nhiệm (concurrent_roles)

Ngày: 2026-10-08 | Trạng thái: Đã duyệt (user: "nghiên cứu thực tế rồi apply")

## 1. Vấn đề

Thực tế trường VN, một người giữ nhiều chức danh cùng lúc:

- GVCN luôn là GVBM (vừa dạy môn vừa chủ nhiệm lớp).
- Tổ trưởng chuyên môn là giáo viên kiêm nhiệm - vẫn dạy, có thể kiêm
  chủ nhiệm lớp.
- PHT/BGH giảm tiết nhưng vẫn đứng lớp (kiêm GVBM).

Hệ thống hiện tại single-role: `profiles.role` là scalar, `requireRoles`/
`checkActionRole`/nav/`ROLE_HOME`/RLS `my_role()` đều đọc 1 giá trị.
`concurrent_roles` (text[]) đã tồn tại từ CR-032 nhưng chỉ lưu trữ,
không cấp quyền. Hệ quả: GVCN kiêm tổ trưởng không vào được `/team/*`,
tổ trưởng kiêm chủ nhiệm bị policy `my_role()='gvcn'` chặn dù
`classes.gvcn_id` trỏ đúng họ.

## 2. Quyết định thiết kế

- **Model**: `role` = vai trò chính (xác định trang chủ, nhãn mặc định);
  `concurrent_roles` = vai trò kiêm nhiệm. Effective roles = hợp 2 tập.
- **Phạm vi kiêm nhiệm** (theo thực tế biên chế): chỉ trong nhóm có thể
  đứng lớp `{gvcn, gvbm, to_truong, bgh, pht}`. Không cho kiêm:
  `ke_toan` (hành chính không dạy), `so_gd`, `ubnd`, `phu_huynh`,
  `hoc_sinh` (ngoài trường), `admin` (superuser).
- **UX**: gộp menu - một nav duy nhất = hợp nhất quyền các role, không
  cần role switcher (user đã chọn).
- **RLS**: thêm `my_roles()` = `role || concurrent_roles`, recreate các
  policy dùng `my_role()` thành so sánh mảng (`'x' = any(my_roles())`,
  `my_roles() && array[...]`). Admin không thể là concurrent nên
  `my_role()='admin'` vẫn chỉ khớp primary - không nới quyền admin.

## 3. Impact assessment

- `src/lib/auth.ts`: `effectiveRoles`, union check.
- `src/lib/nav.ts` + `sidebar-nav.tsx` + layout: merge NAV theo roles.
- `users-board.tsx` + `school/actions.ts`: checkbox vai trò kiêm +
  validate eligibility.
- Migration: `my_roles()` + recreate ~139 policies dùng `my_role()`
  (rewrite cơ khí từ pg_policies dump) + CHECK constraint giới hạn
  giá trị concurrent_roles.
- Seed: combo thực tế (tổ trưởng kiêm GVCN, PHT kiêm GVBM).
- Rủi ro: rewrite policy sai cú pháp -> test bằng DB fixture trước khi
  apply prod; semantics chỉ NỚI cho người có concurrent, không siết.

## 4. Acceptance criteria

- AC-1: User `to_truong` + concurrent `gvcn` (là GVCN một lớp) vào được
  cả `/team/*` lẫn route GVCN, menu gộp đủ 2 nhóm.
- AC-2: `checkActionRole` chấp nhận concurrent; hành động review của
  tổ trưởng pass RLS.
- AC-3: concurrent_roles chỉ nhận giá trị trong nhóm eligible (client +
  server + DB CHECK).
- AC-4: User single-role không đổi quyền (regression).
- AC-5: Tests + tsc/lint/build/consistency xanh; Playwright verify
  merged nav + policy trên prod.

## 5. Ket qua thuc hien (done)

- `src/lib/roles.ts` moi: `CONCURRENT_ELIGIBLE` + `effectiveRoles` +
  `hasRole`/`hasAnyRole` - dung chung cho server component, action va
  client component.
- ~110 call-site `profile.role === 'x'` -> `hasRole(profile,'x')`;
  cac query `.in("role",...)` -> them dieu kien `concurrent_roles.ov/cs`.
- Nav: `mergedNav(effectiveRoles)` gop menu nhieu role, dedupe href
  toan cuc, giu thu tu primary truoc; topbar hien label nhieu role.
- DB: `public.my_roles()` + CHECK `profiles_concurrent_roles_eligible`
  (chi gvcn/gvbm/to_truong/bgh/pht, khong admin, khong non-staff primary).
- Rewrite toan bo policy dung `my_role()` thanh so sanh mang qua
  `pg_temp.cr038_rw`: cover bare `=`, bare `= ANY`, SELECT-wrap, alias
  `my_role`/`my_roles`, casted literal, double-wrap `( SELECT ( SELECT
  my_role() ...) ...)` khi call nam trong scalar subquery; mask
  `tvc.my_role()` (schema TVC360, bang profiles rieng) de khong cham.
  Guard fail-closed: bat ky `my_roles()` sot lai khong dung `@>`/`&&`
  -> rollback toan bo.
- Function updates: `is_staff`, `is_school_staff`, `guard_gvcn_assignment`,
  `scn_can_write_grade`, `scn_has_feature` (grant xung dot -> deny thang),
  `scn_is_dept_head`, `scn_can_message`, `scn_subr_refs_in_school`,
  `scn_set_teacher_subjects`, `scn_subr_update_guard`, `scn_pht_allows_campus`
  (fail-closed khi campus null), `tvc.review_material` (giu signature
  co `note text default ''`).
- SECURITY fix: `profiles_no_priv_escalation` bay gio guard ca
  `concurrent_roles` - truoc do `profiles_self_update` cho user tu
  update row minh nen co the tu gan `{bgh}` leo quyen; them trigger
  idempotent cho env nao chua co.
- Prod apply: 3 lan rollback fail-closed (signature default, deparsed
  shape moi, mask token) -> v3 applied thanh cong; 0 scalar `my_role()`
  con sot tren public, `tvc.my_role()` giu nguyen.
- Tests: 124/124 static, 69/69 DB (container Postgres 16), bao gom
  escalation guard, dept head concurrent, review_material 2 tang,
  messaging concurrent, wrap-probe policies.
- Seed prod: 37 GVCN +{gvbm}, 11 to_truong +{gvbm}, PHT +{gvbm}+GDCD,
  HT +{gvbm}+LS&DL; showcase 3 truong: GVCN demo vua chu nhiem vua la
  `departments.head_id` (concurrent {gvbm,to_truong}); seed script
  cap nhat de reproducible.
