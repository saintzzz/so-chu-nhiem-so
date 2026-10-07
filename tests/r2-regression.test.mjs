// R2 regression tests - External Review round 2 fixes.
// Chay: node --test tests/r2-regression.test.mjs
// Boundary: file nay la static guard cho source TS/SQL. Hanh vi RLS +
// trigger duoc test THUC boi tests/r2-db.test.mjs (Postgres container,
// skip neu khong co docker). Phan con lai (server action integration,
// E2E role flows) can staging - khong chay probe ghi len production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const { averageScoreBand, yearAverage, lowGradeStudentIds } = await import(
  join(ROOT, "src/lib/tt22.ts")
);
const { fetchAllRows } = await import(
  join(ROOT, "src/lib/supabase/fetch-all.ts")
);

const MIGRATION = read("supabase/migrations/20261105_r2_security_fixes.sql");

// --- R2-01: nhom diem TB khong gia xep loai TT22 -------------------------
test("R2-01: averageScoreBand tra nhan nhom diem, khong phai xep loai TT22", () => {
  for (const v of [9, 8, 7.9, 6.5, 5.5, 5, 4.9, 0]) {
    const { label } = averageScoreBand(v);
    assert.ok(!["Tốt", "Khá", "Đạt", "Chưa đạt"].includes(label),
      `label "${label}" gia xep loai TT22`);
  }
  assert.equal(averageScoreBand(null).label, "-");
  // Cac nguong dung theo khoang diem
  assert.equal(averageScoreBand(8).label, "≥ 8,0");
  assert.equal(averageScoreBand(6.5).label, "6,5 - 7,9");
  assert.equal(averageScoreBand(5).label, "5,0 - 6,4");
  assert.equal(averageScoreBand(4.9).label, "< 5,0");
});

test("tt22: khong con ham scoreBand (xep loai sai) trong codebase", () => {
  const tt22 = read("src/lib/tt22.ts");
  assert.ok(!tt22.includes("export function scoreBand"),
    "scoreBand cu van con - se bi dung nham nhu xep loai TT22");
});

// --- R2-03: substitute khong cap quyen cho ngay tuong lai -----------------
test("R2-03: substitute chi cap quyen den ngay phan cong (bien tren)", () => {
  const subFns = MIGRATION.match(/scn_i_teach_student_subject[\s\S]*?\$function\$;[\s\S]*?scn_student_in_my_teaching[\s\S]*?\$function\$;/);
  assert.ok(subFns, "migration thieu 2 ham substitute scope");
  const upperBounds = (MIGRATION.match(/r\.date <= current_date/g) ?? []).length;
  assert.ok(upperBounds >= 2,
    `can >= 2 bien tren r.date <= current_date, thay ${upperBounds}`);
});

// --- R2-04: substitute duoc ghi so dau bai dung ngay ----------------------
test("R2-04: period_logs/absences policies chap nhan substitute dung ngay", () => {
  assert.match(MIGRATION, /create or replace function public\.scn_is_sub_ttentry_date/);
  assert.match(MIGRATION, /r\.date = d/, "assignment phai khop DUNG ngay");
  for (const pol of ["pl_owner_ins", "pl_owner_upd", "pl_owner_del",
                     "pa_owner_ins", "pa_owner_upd", "pa_owner_del"]) {
    const re = new RegExp(`create policy ${pol}[\\s\\S]*?;`);
    const m = MIGRATION.match(re);
    assert.ok(m, `thieu policy ${pol}`);
    assert.match(m[0], /scn_is_sub_ttentry_date/,
      `${pol} chua xet substitute`);
  }
});

// DEFECT 2 (re-review): ham sub_ttentry phai co cua so ngay, exact subject,
// va rang buoc school khop lop.
test("R2-04: scn_is_sub_ttentry_date rang buoc ngay/mon/school chat", () => {
  const fn = MIGRATION.match(/scn_is_sub_ttentry_date\(tid uuid, d date\)[\s\S]*?\$function\$;/);
  assert.ok(fn, "thieu ham scn_is_sub_ttentry_date");
  assert.match(fn[0], /d between current_date - 60 and current_date/,
    "thieu cua so [today-60, today] - substitute ghi duoc log tuong lai");
  assert.match(fn[0], /r\.subject_id = t\.subject_id/,
    "subject phai exact match, khong wildcard null");
  assert.ok(!/r\.subject_id is null or/i.test(fn[0]),
    "con wildcard subject_id is null");
  assert.match(fn[0], /r\.school_id = c\.school_id/,
    "thieu rang buoc school khop lop");
});

// DEFECT 3 (re-review): subr_ins cho phep forge request approved + lop khac
// truong. Phai siết ca INSERT va UPDATE.
test("R2-04: subr_ins/subr_upd chan forge + chi pending khi tao", () => {
  const ins = MIGRATION.match(/create policy subr_ins[\s\S]*?;/);
  assert.ok(ins, "thieu policy subr_ins");
  assert.match(ins[0], /status = 'pending'/,
    "subr_ins khong bat status='pending' - forge approved san duoc");
  assert.match(ins[0], /scn_subr_refs_in_school\(school_id, class_id, subject_id, absent_teacher_id, substitute_teacher_id\)/,
    "subr_ins chua kiem refs cung school");
  const upd = MIGRATION.match(/create policy subr_upd[\s\S]*?;/);
  assert.ok(upd && /status = 'pending'[\s\S]*?any\(array\['bgh','pht','admin'\]\)/.test(upd[0]),
    "subr_upd phai chi cho approver dat trang thai quyet dinh");
  // Trigger rang buoc transition + decided_by
  assert.match(MIGRATION, /create trigger trg_subr_update_guard before update on public\.substitute_requests/);
  const guard = MIGRATION.match(/scn_subr_update_guard\(\)[\s\S]*?\$function\$;/);
  assert.ok(guard, "thieu scn_subr_update_guard");
  assert.match(guard[0], /old\.status = 'pending' and new\.status in \('approved','rejected'\)/,
    "trigger khong rang buoc transition pending -> approved|rejected");
  assert.match(guard[0], /new\.decided_by is distinct from auth\.uid\(\)/,
    "trigger khong bat decided_by = nguoi duyet");
  // Kiem refs cung school o ca 2 chieu
  const refs = MIGRATION.match(/scn_subr_refs_in_school\(school uuid[\s\S]*?\$function\$;/);
  assert.ok(refs, "thieu scn_subr_refs_in_school");
  for (const tbl of ["classes c", "subjects sj", "profiles p"]) {
    assert.ok(refs[0].includes(tbl), `refs check thieu bang ${tbl}`);
  }
  assert.ok((refs[0].match(/school_id = school/g) ?? []).length >= 3,
    "refs phai khop school cho class/subject/teachers");
});

test("R2-04 UI: period-log page nap substitute assignments va danh dau mine", () => {
  const page = read("src/app/(app)/schedule/period-log/page.tsx");
  assert.match(page, /substitute_requests/);
  assert.match(page, /\.eq\("status", "approved"\)/);
  assert.match(page, /\.eq\("date", date\)/, "phai loc dung ngay dang xem");
  assert.match(page, /subEntryIds\.has\(e\.id\)/);
  const board = read("src/components/schedule/period-log-board.tsx");
  assert.match(board, /substitute\?: boolean/);
});

// Round-3: UI match phai chat dung nhu DB helper - exact subject (NULL
// khong wildcard), school khop lop, va cua so [today-60, today].
test("R2-04 UI parity: substitute match giong scn_is_sub_ttentry_date", () => {
  const page = read("src/app/(app)/schedule/period-log/page.tsx");
  assert.ok(!/r\.subject_id === null \|\| r\.subject_id ===/.test(page),
    "con wildcard subject null - UI rong hon DB");
  assert.match(page, /r\.subject_id !== null\s*&&\s*r\.subject_id === e\.subject_id/,
    "subject phai exact match nhu DB");
  assert.match(page, /r\.school_id === entrySchoolId/,
    "phai kiem school cua request khop truong lop");
  assert.match(page, /classes\(school_id\)/,
    "phai embed school cua lop de so sanh");
  assert.match(page, /date <= today && date >= minSubDate/,
    "phai chan phan cong ngoai cua so [today-60, today]");
});

// --- R2-02: messages RLS + server action ----------------------------------
test("R2-02: msg_send bat buoc scn_can_message", () => {
  assert.match(MIGRATION, /create or replace function public\.scn_can_message/);
  const pol = MIGRATION.match(/create policy msg_send[\s\S]*?;/);
  assert.ok(pol && /scn_can_message\(recipient_id, student_id\)/.test(pol[0]),
    "msg_send chua goi scn_can_message");
  // sender khong the nhan tin chinh minh
  assert.match(MIGRATION, /recipient <> auth\.uid\(\)/);
  // msg_read_update co WITH CHECK de khong sua duoc sender/student
  const upd = MIGRATION.match(/create policy msg_read_update[\s\S]*?;/);
  assert.ok(upd && /with check/.test(upd[0]), "msg_read_update thieu WITH CHECK");
});

// DEFECT 1 (re-review): WITH CHECK chi so NEW voi policy, khong chan sua cot
// khac -> can trigger immutable cho moi truong tru read_at.
test("R2-02: trigger trg_messages_immutable khoa moi cot tru read_at", () => {
  assert.match(MIGRATION, /create trigger trg_messages_immutable before update on public\.messages/);
  const fn = MIGRATION.match(/scn_messages_immutable_guard\(\)[\s\S]*?\$function\$;/);
  assert.ok(fn, "thieu function scn_messages_immutable_guard");
  // Moi cot du lieu phai nam trong danh sach bat bien (schema thuc tren prod)
  for (const col of ["id", "sender_id", "recipient_id", "student_id", "content", "created_at"]) {
    assert.ok(new RegExp(`new\\.${col} is distinct from old\\.${col}`).test(fn[0]),
      `trigger khong khoa cot ${col} - recipient van spoof duoc`);
  }
  assert.ok(!/new\.read_at is distinct/.test(fn[0]),
    "read_at phai la cot duy nhat duoc doi");
});

test("R2-02: server actions kiem quan he nguoi nhan truoc khi insert", () => {
  const reply = read("src/app/(app)/parents/actions.ts");
  assert.match(reply, /parent_students/, "replyMessage phai kiem PH cua HS");
  assert.match(reply, /Người nhận không liên quan đến học sinh/);
  const portal = read("src/app/portal/parent/actions.ts");
  assert.match(portal, /STAFF_ROLES/, "replyToTeacher phai kiem nhan vien truong");
});

// --- Round-3 F1: assignSubstitute cho request approved con trong -----------
test("R3-01: assignSubstitute co guard + bat zero-row + notify", () => {
  const act = read("src/app/(app)/school/substitutes/actions.ts");
  assert.match(act, /export async function assignSubstitute/);
  assert.match(act, /checkActionRole\(\["bgh", "pht"\]\)/);
  const body = act.match(/assignSubstitute[\s\S]*?revalidatePath/);
  assert.ok(body, "thieu than assignSubstitute");
  assert.match(body[0], /\.eq\("status", "approved"\)[\s\S]*?\.is\("substitute_teacher_id", null\)/,
    "phai guard chi gan vao request approved con trong");
  assert.match(body[0], /\.select\("id"\)/);
  assert.match(body[0], /updated\?\.length !== 1/, "phai bat zero-row");
  // Trigger prod bat decided_by=auth.uid() tren row approved
  assert.match(body[0], /decided_by: profile\.id/);
  assert.match(body[0], /notifications/);
  // R3-re-review: chi gan profile co role GV (gvcn/gvbm/to_truong), khong gan
  // ke toan/nhan vien khac lam GV day thay.
  assert.match(body[0], /TEACHER_LINK_ROLES\.has/,
    "assignSubstitute phai kiem role GV truoc khi gan");
  // UI: approved + chua co GV hien control phan cong
  const board = read("src/components/school/substitute-board.tsx");
  assert.match(board, /r\.status === "approved" && !r\.substitute_teacher_id/);
  assert.match(board, /assignSubstitute/);
});

// --- Round-3 F2: notification link theo role nguoi nhan --------------------
test("R3-02: substitute notification link GV -> period-log, approver -> queue", () => {
  const act = read("src/app/(app)/school/substitutes/actions.ts");
  assert.match(act, /subNotificationLink/);
  const fn = act.match(/function subNotificationLink[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /schedule\/period-log\?date=/,
    "GV phai duoc link toi so dau bai dung ngay");
  assert.match(fn[0], /\/school\/substitutes/,
    "role khac giu link trang dieu dong");
  // Khong con hardcode link cho moi recipient
  const inserts = act.match(/link: "/g);
  assert.ok(!inserts, "con hardcode link: \"/school/substitutes\" trong insert");
});

// --- Round-3 F3: conduct evaluation khong ghi "tot" ngam -------------------
test("R3-03: evaluation editor khong default tot, chi ghi rating da chon", () => {
  const ed = read("src/components/conduct/evaluation-editor.tsx");
  // Draft init blank, khong con ?? "tot" cho HS chua danh gia
  assert.match(ed, /rating: ev\?\.rating \?\? ""/);
  assert.ok(!/draft\[s\.id\] \?\? \{ rating: "tot"/.test(ed),
    "con fallback rating tot trong save/render");
  // Option trong cho trang thai chua danh gia
  assert.match(ed, /option value=""/);
  assert.match(ed, /Chưa đánh giá/);
  // Save chi upsert row co rating hop le - guard trong flatMap
  const save = ed.match(/function save\(\)[\s\S]*?router\.refresh\(\);[\s\S]*?\}\s*\}/);
  assert.ok(save, "khong tim thay ham save");
  assert.match(save[0], /!RATINGS\.some\(\(r\) => r\.value === d\.rating\)\) return \[\]/,
    "save van upsert ca HS chua chon xep loai");
  assert.match(save[0], /Chưa chọn xếp loại/, "can loi khi khong co gi de luu");
});

// --- R2-05/R2-09: conditional update bat zero-row --------------------------
test("R2-05/R2-09: duyet substitute/activity kiem 1 row bi anh huong", () => {
  const sub = read("src/app/(app)/school/substitutes/actions.ts");
  assert.match(sub, /\.eq\("status", "pending"\)\s*\.select\("id"\)/);
  assert.match(sub, /updated\?\.length !== 1/);
  const act = read("src/app/(app)/activities/actions.ts");
  assert.match(act, /\.eq\("status", "pending"\)\s*\.select\("id"\)/);
  assert.match(act, /updated\?\.length !== 1/);
});

// --- R2-06: dashboard khong .in() toan bo student, incidents phan trang ----
test("R2-06: dashboard loc bang embedded class filter + gioi han incidents", () => {
  const dash = read("src/app/(app)/school/dashboard/page.tsx");
  assert.ok(!/\.in\("student_id"/.test(dash),
    "dashboard van .in() toan bo student_id");
  assert.match(dash, /students!inner\(class_id\)/);
  assert.match(dash, /count: "exact", head: true/, "dem su co tuan bang count");
  assert.match(dash, /\.gte\("occurred_at", weekStart\)/, "loc ngay o DB");
  assert.match(dash, /\.limit\(6\)/, "incidents gan day gioi han 6");
});

// --- R2-07: digest phan trang + lan truyen loi -----------------------------
test("R2-07: digest dung fetchAllRows va loi lam dung run", () => {
  const route = read("src/app/api/cron/parent-digest/route.ts");
  assert.ok(!/pageTable/.test(route), "con pageTable nuot loi");
  const fetches = (route.match(/fetchAllRows/g) ?? []).length;
  assert.ok(fetches >= 5, `can >=5 fetchAllRows (co import), thay ${fetches}`);
  assert.match(route, /order\("id"\)/);
  assert.match(route, /chunkError/, "chunk loi phai dung run");
});

// Round-3: parent_students link query trong moi chunk cung phai paginate -
// 500 PH co the co >1000 con, PostgREST cat ngam neu chi dung .in().
test("R2-07: parent_students links query paginated qua fetchAllRows", () => {
  const route = read("src/app/api/cron/parent-digest/route.ts");
  const linksFetch = route.match(
    /fetchAllRows<\{[\s\S]*?parent_id[\s\S]*?>\([\s\S]*?parent_students[\s\S]*?\.range\(f, t\)/);
  assert.ok(linksFetch,
    "parent_students query trong chunk van khong phan trang");
  assert.match(linksFetch[0], /order\("parent_id"\)[\s\S]*?order\("student_id"\)/,
    "can order composite on dinh (parent_students khong co cot id)");
  // Loi/truncation phai di vao fatalError
  assert.match(route, /linksRes\.error \|\| linksRes\.truncated/);
  assert.match(route, /const links = linksRes\.rows/);
});

// DEFECT 5 (re-review): loi query nguon phai tra 5xx (khong phai 200) de
// scheduler khong ghi nhan success sai; loi insert digest_deliveries cung
// phai xu ly; response khong echo noi dung loi DB (co the chua PII).
test("R2-07: loi nguon tra 500, insert delivery log khong nuot", () => {
  const route = read("src/app/api/cron/parent-digest/route.ts");
  // Fatal source error -> response 5xx
  assert.match(route, /if \(fatalError\)/, "thieu nhanh fatalError");
  const fatal = route.match(/if \(fatalError\) \{[\s\S]*?status: 500[\s\S]*?\}\);/);
  assert.ok(fatal, "fatalError khong tra status 500");
  // Bo phan destructure `const { error: X } = await ...` truoc khi quet,
  // chi phat hien echo raw error vao response body.
  const routeNoDestructuring = route.replace(
    /\{[^}]*error: \w+[^}]*\} = await/g, "await");
  assert.ok(!/error: (parentsErr|linksErr|chunkError|delErr|prev\.error|done\.error)\b/
      .test(routeNoDestructuring),
    "response khong duoc echo message loi DB (co the chua PII)");
  assert.match(fatal[0], /error: fatalError/,
    "response 5xx chi tra nhan loi chung, khong phai raw DB error");
  // digest_deliveries insert error duoc bat
  assert.match(route, /const \{ error: delErr \} = await supabase[\s\S]*?digest_deliveries[\s\S]*?insert\(deliveries\)/,
    "insert digest_deliveries van khong check error");
  assert.match(route, /fatalError = "delivery log insert failed"/,
    "delErr phai lam dung run");
  // Giữ counter partial-send trong response loi
  assert.match(fatal[0], /sent,[\s\S]*?failed,[\s\S]*?skipped,/,
    "response 5xx van phai tra counters");
  // Delivery-level errors dem rieng, khong fail ca run
  assert.match(route, /delivery_errors: failed \|\| undefined/);
});

test("fetchAllRows: loi duoc tra ve, khong nuot", async () => {
  const res = await fetchAllRows(async (f) => {
    if (f === 0) return { data: [{ id: 1 }], error: null };
    return { data: null, error: { message: "boom" } };
  }, 1);
  assert.equal(res.error, "boom");
});

test("fetchAllRows: doc het nhieu trang", async () => {
  const res = await fetchAllRows(async (f) => ({
    data: f < 3 ? [{ id: f }] : [],
    error: null,
  }), 1);
  assert.equal(res.error, null);
  assert.equal(res.rows.length, 3);
});

// --- R2-08: student record history khong nuot loi --------------------------
test("R2-08: insert history loi thi tra error ro rang", () => {
  const act = read("src/app/(app)/records/students/actions.ts");
  assert.match(act, /error: histErr/);
  assert.match(act, /không ghi được lịch sử thay đổi/);
});

// --- R2-10: PHT chua gan campus -> fail-closed -----------------------------
test("R2-10: moi surface PHT fail-closed khi campus_id null", () => {
  const files = [
    "src/lib/school/radar.ts",
    "src/app/(app)/school/dashboard/page.tsx",
    "src/app/(app)/school/daily-reports/page.tsx",
    "src/app/(app)/school/substitutes/page.tsx",
    "src/app/(app)/school/approvals/page.tsx",
    "src/app/(app)/schedule/timetable/page.tsx",
    "src/app/(app)/safety/bgh/page.tsx",
    "src/app/(app)/school/journals/page.tsx",
    "src/app/api/ai/daily-digest/route.ts",
  ];
  for (const f of files) {
    const src = read(f);
    const idx = src.indexOf('profile.role === "pht"');
    assert.ok(idx >= 0, `${f}: thieu dieu kien pht`);
    const guard = src.slice(idx, idx + 400);
    assert.ok(!/role === "pht" && profile\.campus_id/.test(guard),
      `${f}: van fail-open khi campus_id null`);
  }
  // RLS fail-closed o DB
  assert.match(MIGRATION, /scn_pht_allows_campus/);
});

// --- R2-11: chart cuon ngang + menu wrap ----------------------------------
test("R2-11: chart co min-width + scroll container, nav wrap nhan dai", () => {
  const charts = read("src/components/charts.tsx");
  const scrolls = (charts.match(/overflow-x-auto/g) ?? []).length;
  assert.ok(scrolls >= 2, "ca BarChart va LineChart can vung cuon");
  assert.match(charts, /minWidth: width/);
  const nav = read("src/components/sidebar-nav.tsx");
  assert.ok(!/className="truncate">\{item\.label\}/.test(nav),
    "nav item van truncate nhan dai");
  assert.match(nav, /title=\{item\.label\}/);
});

// DEFECT 4 (re-review): role="img" khong duoc bao table (screen reader mat
// table semantics); can empty state ro rang khi data rong.
test("R2-11: ChartCard chi dat role=img khi hien chart, co empty state", () => {
  const charts = read("src/components/charts.tsx");
  // Cau truc moi: showTable && table -> render table thuong; else div role=img
  const card = charts.match(
    /export function ChartCard[\s\S]*?\nexport function LineChart/);
  assert.ok(card, "khong tim thay ChartCard");
  const body = card[0].match(/return \([\s\S]*?\n  \);\n\}/);
  assert.ok(body, "khong tim thay return cua ChartCard");
  const imgIdx = body[0].indexOf('role="img"');
  const tableIdx = body[0].indexOf("showTable && table");
  assert.ok(tableIdx >= 0 && tableIdx < imgIdx,
    "role=\"img\" van bao quanh table - screen reader mat table semantics");
  // Div role=img chi render children (chart), khong render table
  const imgDiv = body[0].slice(imgIdx, imgIdx + 200);
  assert.ok(!/showTable \? table/.test(imgDiv),
    "trong div role=img van co the render table");
  // Empty state ro rang khi data=[]
  assert.match(charts, /data\.length === 0/);
  assert.match(charts, /Chưa có dữ liệu/);
});

// --- Round-4 F1: import DDGtx tran cot -> mo rong bang, khong drop ngam ----
test("R4-01: file co nhieu cot DDGtx hon so -> grow txCols (kind tx)", () => {
  const src = read("src/components/academics/grades-editor.tsx");
  // Phai co nhanh mo rong txCols truoc khi do diem
  assert.match(src, /cols\.tx\.length > txCols\.length/,
    "thieu kiem tra so cot DDGtx cua file vuot so hien co");
  assert.match(src, /newColId\("tx"\)/,
    "cot overflow phai tao voi kind tx chung");
  assert.match(src, /setTxCols\(importTxCols\)/,
    "phai setTxCols voi tap cot da mo rong");
  // Vong do diem phai map theo tap cot da mo rong, khong phai txCols cu
  const fill = src.match(/cols\.tx\.forEach\(\(i, j\) => \{[\s\S]*?\}\);/);
  assert.ok(fill, "khong tim thay vong do DDGtx");
  assert.match(fill[0], /importTxCols\[j\]/,
    "van map theo txCols cu - diem cot overflow bi drop ngam");
  assert.ok(!/const col = txCols\[j\]/.test(fill[0]),
    "con drop ngam cot DDGtx vuot so hien co");
  // Canh bao cho GV biet da them cot
  assert.match(src, /thêm \$\{addedTxCols\} cột ĐĐGtx/);
});

// --- Round-4 F2: import mon nhan xet chi nhan alias ro rang ----------------
test("R4-02: comment import dung alias map - gia tri la khong thanh dat", () => {
  const src = read("src/components/academics/grades-editor.tsx");
  // Alias map tuong minh, normalize bo dau truoc khi tra
  assert.match(src, /const RESULT_ALIAS: Record<string, "dat" \| "chua_dat">/);
  const fn = src.match(/function parseResult[\s\S]*?\n\}/);
  assert.ok(fn, "thieu ham parseResult");
  assert.match(fn[0], /normalizeKey\(raw\)/,
    "phai normalize (lowercase + bo dau) truoc khi tra alias");
  assert.match(fn[0], /RESULT_ALIAS\[k\] \?\? "invalid"/,
    "gia tri ngoai alias map phai la invalid, khong doan");
  for (const alias of ["dat", "d", "chua_dat", "cd"]) {
    assert.ok(new RegExp(`\\b${alias}: "`).test(src),
      `RESULT_ALIAS thieu alias "${alias}"`);
  }
  // Branch comment: invalid giu nguyen o cu + bao cao, khong fallback "dat"
  const branch = src.match(
    /else if \(method === "comment"\) \{[\s\S]*?commentCk: cmtCol/);
  assert.ok(branch, "khong tim thay nhanh method=comment");
  assert.match(branch[0], /parseResult\(raw\)/);
  assert.match(branch[0], /parsed === "invalid"\s*\?\s*cur\.result/,
    "invalid phai giu ket qua cu, khong doan thanh dat");
  assert.ok(!/v\.includes\("chưa"\)/.test(branch[0]) &&
            !/includes\("chua"\)/.test(branch[0]),
    "con heuristic includes(chua) - moi gia tri khac deu thanh dat");
  assert.ok(!/\? "chua_dat"[\s\S]*?: "dat"/.test(branch[0]),
    "con fallback bat ky gia tri khong rong -> dat");
  // O invalid duoc ghi ten HS + gia tri vao canh bao import
  assert.match(branch[0], /invalid\.push\(/);
  assert.match(src, /giá trị không hợp lệ \(giữ nguyên ô cũ\)/);
});

// --- R5-03: yearAverage nghiem ngat - can du 2 hoc ky ----------------------
test("R5-03: yearAverage tra null khi thieu 1 trong 2 hoc ky", () => {
  assert.equal(yearAverage(8, null), null,
    "HK1-only khong duoc hien nhu ket qua ca nam");
  assert.equal(yearAverage(null, 8), null,
    "HK2-only khong duoc hien nhu ket qua ca nam");
  assert.equal(yearAverage(null, null), null);
  assert.equal(yearAverage(6, 8), Math.round(((6 + 16) / 3) * 10) / 10);
  assert.equal(yearAverage(6, 8), 7.3);
});

test("R5-03: yearAverage khong con fallback return hk1/hk2 (static)", () => {
  const tt = read("src/lib/tt22.ts");
  const fn = tt.match(/export function yearAverage[\s\S]*?\n\}/);
  assert.ok(fn, "thieu ham yearAverage");
  assert.ok(!/return hk1\b/.test(fn[0]) && !/return hk2\b/.test(fn[0]),
    "yearAverage con fallback mot hoc ky - gia ket qua ca nam");
});

// --- R5-01: radar nhom diem theo ky - bat bien thu tu hang -----------------
test("R5-01: lowGradeStudentIds bat bien voi thu tu hang (nhom theo term)", () => {
  const g = (sid, term, type, score) => ({
    student_id: sid,
    subject_id: "m1",
    term,
    assessment_type: type,
    score,
  });
  // HS1: HK1 toan 2, HK2 toan 8 -> ky moi nhat (HK2) = 8 -> khong flag.
  // HS2: chi co HK1 toan 2 -> flag.
  const rows = [
    g("s1", "hk1", "ddg_tx", 2), g("s1", "hk1", "ddg_gk", 2), g("s1", "hk1", "ddg_ck", 2),
    g("s1", "hk2", "ddg_tx", 8), g("s1", "hk2", "ddg_gk", 8), g("s1", "hk2", "ddg_ck", 8),
    g("s2", "hk1", "ddg_gk", 2), g("s2", "hk1", "ddg_ck", 2),
  ];
  const fwd = lowGradeStudentIds(rows);
  const rev = lowGradeStudentIds([...rows].reverse());
  assert.deepEqual([...fwd].sort(), [...rev].sort(),
    "ket qua phu thuoc thu tu hang - semester-average bi tron ky");
  assert.equal(fwd.has("s1"), false, "HK2=8 phai thang HK1=2");
  assert.equal(fwd.has("s2"), true, "HS chi co HK1 <5 phai bi flag");
});

test("R5-01: term khong biet cung rank -> tie-break bat bien thu tu hang", () => {
  const g = (sid, term, score) => ({
    student_id: sid,
    subject_id: "m1",
    term,
    assessment_type: "ddg_ck",
    score,
  });
  // Hai term "other" cung rank 0: fwd/rev phai cho cung ket qua.
  const rows = [g("s1", "termA", 2), g("s1", "termB", 8)];
  const fwd = lowGradeStudentIds(rows);
  const rev = lowGradeStudentIds([...rows].reverse());
  assert.deepEqual([...fwd].sort(), [...rev].sort(),
    "rank tie giua cac term khong biet phai tie-break deterministic");
  // termB > termA theo chuoi -> diem termB=8 thang -> khong flag.
  assert.equal(fwd.has("s1"), false, "term lon nhat theo chuoi phai thang");
});

test("R5-01: radar grades query select term va dung lowGradeStudentIds", () => {
  const radar = read("src/lib/school/radar.ts");
  assert.match(radar,
    /select\("student_id,subject_id,term,assessment_type,score/,
    "grades query phai select term de tach hoc ky");
  assert.match(radar, /lowGradeStudentIds\(gradeRes\.rows\)/,
    "phai gom theo (HS, mon, ky) qua ham thuan");
});

// --- R5-02: radar khong nuot loi nguon -------------------------------------
test("R5-02: RadarData co truong errors va buildRadarData thu loi nguon", () => {
  const radar = read("src/lib/school/radar.ts");
  assert.match(radar, /errors: string\[\]/, "RadarData thieu errors");
  for (const label of ["classes", "students", "attendance", "grades",
                       "incidents", "counseling"]) {
    assert.ok(radar.includes(`fail("${label}"`),
      `thieu nhan loi "${label}" (fail() giu label co dinh)`);
  }
  // errors khong duoc chua raw DB error (no lo ra cron response).
  assert.ok(!/errors\.push\(`[^`]*\$\{[^}]*(?:error|Err|message)/.test(radar),
    "RadarData.errors phai la label co dinh, khong echo raw DB error");
  assert.match(radar, /truncated\) errors\.push\("students truncated"\)/);
});

test("R5-02: radar-sync kiem loi schools query + tra 500 khi co loi", () => {
  const route = read("src/app/api/cron/radar-sync/route.ts");
  assert.match(route, /error: schoolsErr/, "schools query chua check error");
  const fail = route.match(/if \(schoolsErr\) \{[\s\S]*?status: 500[\s\S]*?\}\);/);
  assert.ok(fail, "schools query loi phai tra 500 ngay");
  assert.ok(!/schoolsErr\.message/.test(fail[0].match(/json\([\s\S]*?\}\)/)?.[0] ?? ""),
    "response khong duoc echo raw DB error");
  assert.match(route, /data\.errors\.length/, "phai skip school co data errors");
  assert.match(route, /status: errors\.length \? 500 : 200/,
    "partial failure phai tra 500, khong phai 200 ok");
  // errors day ra response chi duoc la label co dinh - khong echo raw DB
  // error hay exception message (parent-digest precedent).
  assert.ok(!/errors\.push\(`[^`]*error\.message/.test(route),
    "insert error phai push label co dinh, khong echo error.message");
  assert.ok(!/errors\.push\(`[^`]*e instanceof Error/.test(route),
    "catch block phai push label co dinh, khong echo exception");
});

test("R5-02: radar page + refresh action chan khi errors non-empty", () => {
  const page = read("src/app/(app)/school/radar/page.tsx");
  assert.match(page, /errors\.length > 0/, "page phai hien loi thay bang rui ro");
  const act = read("src/app/(app)/school/radar/actions.ts");
  const guard = act.match(/if \(data\.errors\.length\) \{[\s\S]*?\n  \}/);
  assert.ok(guard, "refreshRadarWarnings thieu guard errors");
  assert.match(guard[0], /return \{[\s\S]*?error:/,
    "errors non-empty phai return error, khong insert warnings");
});
