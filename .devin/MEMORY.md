
## 2026-10-27 - CR-060 pha 2: module map 9 key (ban do doanh thu)
- Commits fc3c7b3 -> 807e4e9 -> a10fd23. Modules: chuyen_can, hoc_ba,
  ky_thi_danh_gia, phu_huynh_hoat_dong, tu_van_an_toan, thi_dua,
  to_chuyen_mon, studio, van_hanh_nang_cao. Core luon mo.
- Guard: 8 nested layout + 14 page + ~30 actions + 12 AI routes +
  cron radar-sync filter. nav.module typed ModuleKey.
- E2E: chuyen_can OFF truong KD -> GVCN mat menu + /attendance/daily
  redirect; phu_huynh ON -> /parents/compose van vao.
- Debt: client direct writes (scn_save_attendance rpc, exams-board,
  cmhs, register_signoffs, counseling, competency) -> RLS-level gate CR.
