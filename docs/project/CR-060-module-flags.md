# CR-060: Module hoa tinh nang theo truong (feature flags)

Nguon: CR-059 item F (dot 1). Muc tieu: truong mua goi module nao thi menu + route + action cua module do moi hoat dong - vua la co che ban hang, vua lam menu gon.

## Scope

1. Bang `school_features(school_id, module, enabled, updated_at, updated_by)` - PK (school_id, module).
   - RLS: doc cho staff cung truong + admin; ghi chi admin/so_gd.
   - `school_id IS NULL` = default cua he thong (module co san cho moi truong khi chua override).
2. Module keys ban dau: `studio` (TVC360), `hoc_ba`, `attendance`, `conduct`, `safety`, `parents_portal`, `exams`, `emulation`, `substitutes`, `counseling`, `dept_report`. (Ten module khop voi nhom route trong `src/lib/nav.ts`.)
3. `src/lib/nav.ts`: gan `module` vao tung NavSection/item; `mergedNav` nhan them tap module enabled -> loc.
4. Moi route group co `requireRoles` cung check `schoolFeature(module)` - mac dinh deny khi module off, redirect /dashboard.
5. Admin UI: `/school/modules` - BGH/admin bat/tat module cua truong minh; so_gd/admin bat/tat default.
6. Default migration: bat het module cho 3 truong hien co (khong thay doi behavior hien tai).

## Impact

- DB: 1 bang moi + RLS (can supabase-postgres-best-practices).
- App: nav.ts, (app)/layout hoac tung page guard, moi admin page.
- Tests: check-nav-access mo rong doc module map; test deny khi tat module.
- Khong an migration du lieu.

## AC

- AC-60.1: Tat module `studio` -> menu Studio bien mat + /studio/* redirect + action reject.
- AC-60.2: Bat lai -> tra ve binh thuong.
- AC-60.3: Truong A tat khong anh huong truong B.
- AC-60.4: Default (truong moi) = module mac dinh he thong.
- AC-60.5: admin/so_gd sua duoc; GVCN khong.
