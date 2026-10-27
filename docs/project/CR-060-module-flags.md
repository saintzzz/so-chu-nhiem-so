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

## Rulings & implementation notes (r-h0601)

Doi so voi scope ban dau - ghi nhan co chu dich:

1. **4 module ship dot nay**: `studio`, `hoc_ba`, `tu_van_an_toan` (gom safety + counseling), `thi_dua` (gom emulation + competency). Cac key con lai (`attendance`, `conduct`, `parents_portal`, `exams`, `substitutes`, `dept_report`) la core nghiep vu - bat module cho chung can tach menu thanh tung nhom nho hon, de CR tiep theo khi co nhu cau ban that.
2. **`school_id NOT NULL`, khong co system-default row**: absence-of-row = mac dinh BAT. Trang thai false hien dien = tat. Don gian hon va khong can seed.
3. **Admin UI la `/dept/modules`** (admin + so_gd), khong phai `/school/modules` - khop AC-60.5: truong khong tu bat module chua mua (day la co che ban hang, vendor-side control).
4. **Guard layer**: nested layout.tsx cho studio/safety/counseling/emulation/competency (bao phu 21 page + sub-route); hoc_ba guard truc tiep trong page + export API + lock-records page (layout 2-segment `/records/hoc-ba` lam xung dot global `LayoutProps` giua `.next/types` cu va `.next/dev/types` moi - generated-types quirk cua Next 16.4.2).
5. **API coverage**: studio generate + audio + questions/extract + materials export deu `assertModule("studio")`; safety actions `assertModule("tu_van_an_toan")`; hoc-ba export `assertModule("hoc_ba")`.
6. **Nav fail-open, route fail-closed**: layout bat loi `disabledModules()` -> nav hien day du (khong vo toan bo app khi bang chua migrate); `requireModule` van throw -> chan route. Grants explicit (`authenticated` select, `service_role` all).
7. **E2E evidence (local, anhhd@cva.scn)**: insert `studio=false` cho TH-CVA -> nav mat section "Cong cu soan hoc lieu" + `/studio` redirect `/dashboard`; `/safety/report` van vao duoc; xoa flag -> `/studio` hoat dong lai.
8. Residual: cac action chung khac (counseling/emulation/competency khong co actions.ts rieng - chung dung shared actions chua gan module) va studio sub-actions ngoai 4 API da chan; khi ban module that se tiep tuc mo rong guard vao action-level tung nhom.
9. **Debt B2 (deferred, pre-existing)**: `/register/lock-records` ghi `register_signoffs` bang client anon truc tiep (lock-records-client.tsx) - page guard chan navigation nhung khong chan PostgREST truc tiep. Gate that cho client-direct writes phai la RLS tren `register_signoffs` join `school_features` - tach migration rieng vi dung vao write path ky duyet.
10. **Perf note (finding C)**: fetch DC-03 fan-out x2 (moi job = 2 query theo nguon, CHUNK=8 -> 16 req/batch). Da ghi comment tai code. Do latency that cua 1 lan sinh DC-03 trong E2E production sau deploy.

## Pha 2 - mo rong 9 module + deferred debt (2026-10-27)

Module map mo rong 4 -> 9 key (doanh thu): them chuyen_can,
ky_thi_danh_gia, phu_huynh_hoat_dong, to_chuyen_mon, van_hanh_nang_cao.
Core luon mo: dashboard, ho so, quan ly HS co ban, TKB/diem/so dau bai,
so chu nhiem, nhan su co ban.

### Debt con lai (ghi nhan, can CR rieng - RLS-level gate)
- Ghi truc tiep tu browser client bo qua app-layer flag:
  - attendance daily-roster -> rpc scn_save_attendance
  - exams-board -> exams/exam_sessions
  - cmhs-board -> cmhs_members
  - register_signoffs (da biet tu pha 1)
- Fix dung: RLS policy join school_features tren cac bang business,
  hoac chuyen write path sang server action co assertModule.
