# PM Report - Backlog batch 2026-10-01

## Scope

4 muc backlog user giao: audit-trail ho so dien tu (SCN), delivery-log/retry digest (SCN),
placement + digest (EA), thi tren may theo du thao TT (TVC360). Moi muc = 1 CR, qua pipeline
BA -> Dev -> QA -> Deploy.

## Delivered

| CR | Repo | Commit | Evidence |
|---|---|---|---|
| CR-020 audit-trail coverage | so-chu-nhiem | aff705f | logAudit vao 5 write path ho so (grades/attendance/conduct/eval/period-log); tab "Lich su cap nhat ho so" + export CSV `/register/audit/export` giu filter |
| CR-021 digest delivery log | so-chu-nhiem | 9c90a52, 83a5735 | bang `digest_deliveries` (RLS staff); run_id + status + attempts; `?retry=<run_id>`; idempotent theo week_start; tab "Email digest" tren trang audit |
| CR-23 placement + digest | student-self-practice-web | 0cd5b06 | PlacementScreen 15 cau/5 lop tu ngan hang image-choice; luu `placement_grade`; admin tab Tien do co "Bao cao tuan" + cot "Lop goi y" |
| CR-18 thi tren may | tvc360-congcuso | 57436dc | `tvc.exam_sessions`/`tvc.exam_submissions`; `/thi/[code]` public (dap an khong roi server); `/app/sessions` mo/dong phong + cham tu luan |

## QA evidence

### SCN
- `npm run typecheck` + lint (0 error) + `check-consistency.mjs` ALL PASS.
- Cron route: run1 `{skipped:365, parents:365}` -> 365 delivery rows; retry -> attempts=2;
  run lai sau khi 1 parent `sent` -> parents=364 (idempotent OK). Test rows da cleanup.
- Prod `/register/audit?type=digest`: bang Thoi diem/Tuan/Email/Trang thai/Run/Loi + Xuat CSV.

### TVC360 (dev :3111 + prod)
- GET `/api/exam-take/TEST66`: 29 cau, payload KHONG co answer/solution.
- POST: 4 cau tu cham dung -> 1.0 dung tay; sai het -> 0; TF 1/4 dung -> 0.06 (ti le QD 764).
- Phong `closed` -> GET/POST 410; ma sai -> 404.
- Playwright: HS join -> timer -> nop -> hien diem; GV thay 3 bai nop, cham tu luan 2.5 -> tong 3.5.
- Bug bat duoc khi test: view alias `tvc_exam_submissions` cu khong co cot `essay_score` (view
  tao truoc khi alter) -> recreate view; code sai `toLowerCase` vs join_code uppercase -> fix.
- `npm run check` xanh; prod `/thi/TEST66` 200, API tra JSON.

### EA (prod ea.vieschool.com)
- Map co nut "Lam bai kiem tra dau vao" -> PlacementScreen "Cau 1/15" render image-choice.
- Admin "Bao cao tuan (7 ngay)": 1 luot luyen, 1 HS, 95% dung, breakdown theo lop.
- Console 0 error (tru favicon 404 co san).

## Security/RBAC

- `/thi/[code]` public nhung chi nhan de sach + nop bai qua service-role route; submissions
  RLS owner-only; HS khong doc duoc bai nguoi khac.
- `/app/sessions*` `requireRoles(["giao_vien"])`; actions `checkActionRole` + `eq("owner_id")`.
- Cron route: Bearer CRON_SECRET timing-safe; digest_deliveries RLS `scn_parent_in_school`.
- POST exam-take loc answer keys theo vi tri cau hop le.

## Known limitations / follow-ups

1. Thi tren may: chua chong chuyen tab/gian lan, HS co the nop nhieu lan (chua dedupe theo
   ten+lop), chua co nhieu ma de/phien. Du cho kiem tra lop hoc, chua dung cho thi chinh thuc.
2. Digest retry thu cong qua `?retry=<run_id>` - chua auto-retry trong cron; webhook Resend
   (bounced/complained) chua cap nhat status.
3. `digest_deliveries` tren prod chua co du lieu that - cron chay 07:00 Thu 2 se ghi.
4. EMAIL_FROM van `aal.vn` - cho verify domain `vieschool.com` (DNS Cloudflare da ban giao).
