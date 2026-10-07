# CR-034 - Remediation sau review ChatGPT Codex (commit 534c947)

## Boi canh

ChatGPT Codex Cloud (repo `saintzzz/so-chu-nhiem-so`, Ultra) review read-only
toan bo codebase tai commit `534c947` va bao ~30 findings (security, RBAC,
tenant isolation, performance, correctness). Codex review **migration files
trong repo**, trong khi RLS tren prod da duoc va truc tiep (initplan rewrite)
- vi vay moi finding duoc verify lai tren code hien tai + schema prod truoc
khi fix. Tai lieu nay la impact assessment + triage: da fix / da co san /
khong xac nhan / deferred.

## A. Da fix trong dot nay (code)

### A1. Correctness

1. **Ma tran de: diem am** (`src/lib/tvc/fallbacks.ts`) - bu chenh lech lam
   tron truoc day do toan bo `diff` vao cell cuoi, co the tao cell -1.5 diem.
   Nay phan bo +-0.25 theo cell lon nhat, floor = diem toi thieu 1 cau
   (`unit[qtype]`), relax xuong 0.25 khi tong nho. Test sweep 1-8 YCCD x
   8 khoi x 7 tong diem: **0 cell <=0, tong khop trong moi ca kha thi**.
   Con han che: tong qua nho so voi so cell toi thieu (vd 5 diem cho 8 YCCD)
   khong giam them duoc - hien tong thuc te, ghi nhan trong tai lieu.

2. **De thi sinh trung cau + insert quan he bo qua loi**
   (`src/app/api/studio/tools/[code]/generate/route.ts`):
   - `sameQtype.includes(x)` so sanh object identity giua 2 query doc lap ->
     cung 1 cau duoc chon 2 lan. Nay dedupe bang `sqIds` (Set id) + recheck
     `used`/`usedStems` tai thoi diem pick, missing question chi sinh khi
     pool that su can.
   - Insert `tvc_exam_questions` truoc day khong check error -> de rong am
     tham. Nay rollback exam + tra loi (ca nhanh de du phong).

3. **Period-log xoa diem danh GV khac** (`period-log-board.tsx`) - recompute
   ngay chi dung entries cua GV dang dang nhap, nen GV B luu co the xoa
   vang source=period_log cua GV A. Nay query toan bo timetable cua lop
   trong ngay + toan bo period_logs cua lop/ngay roi recompute day du.
   Van la multi-step client-side (chua transactional) - ghi nhan o muc C.

4. **Tiet chieu (6-10) bi an** - server validate 1-10 nhung 5 UI surface
   hardcode `[1..5]`. Nay `PERIODS` chung trong `src/lib/utils.ts`, ap dung
   cho timetable editor/page/toolbar, student portal, substitute board.

5. **Nhan xet HK1/HK2 bi gop 1 cot** - portal parent/student/hoc-ba lay
   `rows.find(r => r.result != null)` lam mat ket qua theo ky. Nay tach
   `resultHk1`/`resultHk2`/`resultYear` va render 3 cot nhu mon cham diem.

### A2. Security

6. **Devin callback token doc duoc qua RLS + ghi de khong nguyen tu**
   (`ai_jobs`): BGH/dept co the SELECT `callback_token` -> gia mao callback
   ghi result tuy y. Nay:
   - `fallbackToDevin` sinh token app-side, DB chi luu `sha256(token)`
     (backward-compatible: job cu con plaintext van xac thuc duoc).
   - Callback dung conditional update `status='pending'` + select - callback
     thu hai tra 409 thay vi ghi de ket qua.
   - Guard result: bat buoc object, khong array, <= 1MB.

7. **AI failover mo rong processor khong kiem soat** (`src/lib/ai.ts`,
   `src/lib/devin.ts`): them `AI_ALLOWED_PROVIDERS` (allowlist provider duoc
   nhan du lieu, ke ca khi co key san) va `AI_ALLOW_DEVIN_FALLBACK=false`
   de tat kenh engine thu 4. Mac dinh van mo (khong pha cau hinh hien tai);
   khi DPIA chot danh sach processor thi set env.

8. **fetchAllRows cat ngam** (`src/lib/supabase/fetch-all.ts`): them
   `console.error` khi truncated + `dept/reports` hien banner canh bao.
   `dept/reports` cung bo `.in("student_id", <toan bo UUID>)` - dung
   embedded filter `students!inner(class_id)` + `.in("students.class_id")`,
   khong con URL PostgREST chua hang nghin UUID.

9. **CSV/XLSX formula injection**: `sanitizeSpreadsheetCell` trong
   `src/lib/excel.ts` (prefix `'` khi bat dau = + - @, strip tab/CR/LF).
   Ap dung: audit CSV export (server), class-report-export + export-client
   (exceljs - exceljs coi chuoi bat dau '=' la formula). Template download
   dung du lieu app-side nen khong can.

10. **Radar mutate khi render** (`/school/radar`): trang GET truoc day tu
    insert `early_warnings`. Nay:
    - `src/lib/school/radar.ts` - `buildRadarData` compute thuan doc, dung
      chung cho page + action + cron.
    - `refreshRadarWarnings` server action + nut "Lam moi canh bao".
    - `GET/POST /api/cron/radar-sync` (CRON_SECRET, header-only nhu
      parent-digest) dong bo hang ngay cho moi truong.

## B. Da fix DB (migration prod + file repo)

11. **GV day thay duoc duyet nhung khong co quyen ghi**
    (`cr034_substitute_teaching_scope` + `20261101_cr034_*.sql`):
    `scn_i_teach_student_subject` va `scn_student_in_my_teaching` truoc chi
    check `timetable_entries.teacher_id` -> GV day thay bi chan nhap diem,
    diem danh theo tiet, ghi nhan xet. Nay them nhanh
    `substitute_requests.approved` trong cua so 60 ngay (`date >=
    current_date - 60`), match `subject_id` cho ham per-subject.

## C. Da verify tren prod - finding KHONG dung / da co san

- **"GVBM ghi de diem mon khong day"** - `grades_*` policies da dung
  `scn_can_write_grade(student_id, subject_id)` kiem tra phan cong day qua
  timetable (gvcn duoc ghi lop chu nhiem - theo dung vai tro so diem lop).
  Khong phai lo hong.
- **RLS initplan** - 304 policies tren public/tvc/practice da rewrite
  `(select auth.uid())`/`(select my_role())` o dot truoc; advisor
  `auth_rls_initplan` da ve 0.
- **`scn_i_teach_student_subject` fail-open** - ham dung `exists()` +
  `auth.uid()` so sanh truc tiep, null -> false. Khong fail-open.
- **`register_signoffs` RLS** - da co policies submit/sign/delete/read
  phan quyen dung (gvcn homeroom / bgh school / admin).
- **Timetable IDOR** - `tt_write` da check `scn_class_in_school` o with_check.

## D. Deferred - can design rieng (da ghi impact + huong lam)

1. **Khóa sổ học bạ chưa chặn ghi DB** (Codex: "locked records writable").
   Xac nhan: `register_signoffs status='locked'` chi advisory - khong trigger
   nao chan `grades`/`conduct_evaluations` sau khi khoa. Nhung `period` la
   text "Thang M/YYYY" trong khi `grades.term` la hk1/hk2 - khong map duoc
   truc tiep. Thiet ke de xuat (CR tiep):
   - Them cot `term` ('hk1'|'hk2'|'nam') vao `register_signoffs` cho
     `type='so_hoc_ba'` (lock theo ky, khong theo thang).
   - Trigger `BEFORE INSERT/UPDATE` tren `grades`, `conduct_evaluations`,
     `nlpc_comments`: reject khi ton tai signoff `so_hoc_ba` locked cung
     class (qua students.class_id) + term tuong ung; cho phep role
     `bgh`/`admin` (mo khoa co kiem soat).
   - Cap nhat UI lock-records chon ky thay vi thang.

2. **Period-log reconciliation chua transactional** - sau A1.3 van la
   delete+insert nhieu buoc client-side. Thiet ke: RPC
   `scn_save_period_absences(log_id, rows)` lam viec trong 1 transaction
   (delete source='period_log' cua ca ngay/lop + insert lai tu tap day du),
   server action goi thay cho client steps.

3. **Attendance replacement-save race** - saveDaily thay the toan bo ngay;
   2 GV cung save mat ghi cua nhau. Thiet ke: upsert theo
   (student_id, date) thay delete-all + unique constraint
   `attendance_records(student_id, date, source)` + conflict target.

4. **Multi-tenant foreign references** - cac bang co FK sang campus/
   department/subject khong check cung school_id o DB. Thiet ke: trigger
   `scn_assert_same_tenant` (hoac composite FK) cho `students.class_id`,
   `timetable_entries.subject_id`, `profiles.department_id/campus_id`.
   Can audit schema day du truoc - batch migration rieng.

5. **Approval lifecycle tvc.reviews** - 2 nguoi duyet dong thoi ghi de;
   "current/default" khong nguyen tu. Thiet ke: `version` optimistic
   locking + unique partial index `tvc_reviews(material_id) where
   status='pending'` + select for update trong RPC duyet.

6. **PH reopen activity_attendance da chot** - can cot `closed`/
   `locked_at` tren activities + policy update cho phep PH chi khi chua
   chot. Feature-level.

7. **Async AI callback schema per kind** - devin-callback moi chi guard
   object <=1MB. Buoc 2: registry `kind -> zod schema` validate + normalize
   result truoc khi luu (job.kind da co san tren ai_jobs).

8. **AI tenant budget/concurrency** - ai_jobs chua co quota per
   school/profile. Thiet ke: rate-limit table + check trong route tao job.

9. **Question bank pagination** - hien fetch-all toan bank client-side.
   Thiet ke: server-side paging + search params (da co fetchAllRows
   guard, can chuyen sang range query that).

10. **Digest idempotency/volume** - parent-digest can dedupe per
    (parent, week) unique index + resume marker; volume lon can queue.

11. **256 multiple_permissive_policies** - advisor WARN, refactor hop
    nhat policies (nhieu cap _self/_staff) - batch rieng, test lai toan bo
    access matrix sau khi gop.

12. **Schema/grant baseline** - core DDL + grants + RPC chua nam trong
    repo migrations. De xuat: `supabase db dump` snapshot baseline vao
    `supabase/schema.sql` + ghi "prod la source of truth, migrations la
    delta" trong AGENTS.md.

13. **Authorization conformance + load test that** - bo QA script hien
    tai check route-level; can suite per-role row-level (gvbm A khong doc
    duoc hs lop B...) + load test dem so query that bai (script hien dem
    ca loi vao "success sample" - sua script truoc khi tin so lieu).

14. **PH xin nghi phep + duyet theo nguong** (GVCN <=3 ngay) - feature
    backlog (chua co request/approval flow).

## E. Verify gates

- `npx tsc --noEmit`: PASS
- `npm run lint`: PASS (7 warnings co san)
- `node scripts/check-consistency.mjs`: PASS (toan bo check)
- fbMatrix sweep test (esbuild bundle + node): 0 negative, tong khop
- Migration `cr034_substitute_teaching_scope`: applied tren prod
