// R2 regression tests - External Review round 2 fixes.
// Chay: node --test tests/r2-regression.test.mjs
// Boundary: file nay la static guard cho source TS/SQL. Hanh vi RLS +
// trigger duoc test THUC boi tests/r2-db.test.mjs (Postgres container,
// skip neu khong co docker). Phan con lai (server action integration,
// E2E role flows) can staging - khong chay probe ghi len production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
const { olderMessagesPredicate, mergeChatMessages, STAFF_CHAT_ROLES } =
  await import(join(ROOT, "src/lib/chat.ts"));
const { messageLinkForRole, teacherChatLinkForRole } = await import(
  join(ROOT, "src/lib/message-link.ts")
);
const { monthParts, prevMonthOf } = await import(
  join(ROOT, "src/lib/utils.ts")
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
  // ke toan/nhan vien khac lam GV day thay. R7-01: check nam trong shared
  // helper validateSubTeacher (create/decide/assign dung chung).
  assert.match(body[0], /validateSubTeacher\(|TEACHER_LINK_ROLES\.has/,
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

// --- R6-01: sendEmail dem loi tung dia chi (partial failure) ----------------
test("R6-01: sendEmail tra sent=1, failed=1 khi 1/2 dia chi loi", async () => {
  // Env phai dat truoc khi goi sendEmail (getEmailConfig doc env o call-time;
  // EMAIL_PROVIDER ep duong env, bo qua vault).
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "test";
  const { sendEmail } = await import(join(ROOT, "src/lib/email.ts"));
  const origFetch = globalThis.fetch;
  const statuses = [200, 500];
  let call = 0;
  globalThis.fetch = async () =>
    new Response("{}", { status: statuses[call++] ?? 200 });
  try {
    const res = await sendEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "s",
      text: "t",
    });
    assert.equal(res.sent, 1);
    assert.equal(res.failed, 1,
      "dia chi that bai phai duoc dem vao failed - truoc day bi nuot");
    assert.equal(res.error, undefined,
      "partial failure khong phai tin hieu total-failure (error chi khi sent=0)");
    assert.equal(call, 2, "phai thu gui cho ca 2 dia chi");
  } finally {
    globalThis.fetch = origFetch;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
  }
});

test("R6-01: EmailResult co truong failed va error giu ngu nghia total-failure", () => {
  const email = read("src/lib/email.ts");
  assert.match(email, /failed: number/, "EmailResult thieu truong failed");
  assert.match(email, /failed: to\.length - sent/);
  assert.match(email, /error: sent \? undefined : lastError/,
    "error phai chi la tin hieu sent===0 - digest dung no cho tung delivery");
});

// --- R6-02: helper emailClassParents dung chung -----------------------------
test("R6-02: sendAnnouncement + announceActivity goi helper emailClassParents", () => {
  const parents = read("src/app/(app)/parents/actions.ts");
  assert.match(parents, /emailClassParents\(supabase/,
    "sendAnnouncement phai dung helper chung thay vi inline resolve");
  assert.match(parents, /emailFailed: mail\.emailFailed/,
    "sendAnnouncement phai tra emailFailed");
  const act = read("src/app/(app)/activities/actions.ts");
  assert.match(act, /import \{ emailClassParents \} from "@\/lib\/parent-email"/);
  const body = act.match(/announceActivity[\s\S]*?announcements"\)\.insert/);
  assert.ok(body, "khong tim thay announcements insert trong announceActivity");
  const afterInsert = act.slice(act.indexOf('announcements").insert'));
  assert.match(afterInsert, /emailClassParents\(supabase/,
    "announceActivity phai email phu huynh sau khi insert announcement");
  assert.match(act, /emailSkipped: mail\.emailSkipped/);
  // emailError phai truyen xuyen qua ca 2 action de UI phan biet duoc
  // "khong co nguoi nhan" voi "lookup failed".
  assert.match(parents, /emailError: mail\.emailError/,
    "sendAnnouncement phai tra emailError");
  assert.match(act, /emailError: mail\.emailError/,
    "announceActivity phai tra emailError");
});

test("R6-02: helper tra label loi co dinh, khong echo raw provider error", () => {
  const helper = read("src/lib/parent-email.ts");
  assert.match(helper, /subject: `\[Sổ Chủ Nhiệm Số\]/);
  assert.match(helper, /emailError: res\.error \? "provider error" : undefined/,
    "emailError phai la label co dinh, khong phai raw provider message");
});

test("R6-02: query nguon loi -> lookup failed, khong gia danh sach rong", () => {
  // parent-email dung @/ alias nen khong import duoc bang node test -
  // guard static: moi query resolve phai check error va tra lookup failed.
  const helper = read("src/lib/parent-email.ts");
  assert.match(helper, /emailError: "lookup failed"/,
    "lookupFail phai tra nhan lookup failed co dinh");
  for (const q of ["stuErr", "linkErr", "parentErr"]) {
    assert.ok(
      new RegExp(`${q}\\) return lookupFail`).test(helper),
      `${q} phai tra lookup failed thay vi xu ly tiep nhu khong co nguoi nhan`);
  }
});

test("R6-02: raw DB error khong ra client o 2 action da cham", () => {
  const parents = read("src/app/(app)/parents/actions.ts");
  const act = read("src/app/(app)/activities/actions.ts");
  assert.ok(!/annError\) return \{ error: annError\.message/.test(act) &&
            !/annError\.message/.test(act.match(/return \{[^}]*annError[^}]*\}/)?.[0] ?? ""),
    "annError.message khong duoc tra ve client");
  assert.ok(!/regError\.message/.test(act.match(/return \{[^}]*regError[^}]*\}/)?.[0] ?? ""),
    "regError.message khong duoc tra ve client");
  // announcements insert trong sendAnnouncement cung phai la label co dinh
  const annInsert = parents.match(/announcements"\)\.insert[\s\S]{0,400}/);
  assert.ok(annInsert && !/error: error\.message/.test(annInsert[0]),
    "insert announcements loi phai tra label co dinh");
});

test("R6-02: compose-form giu form + bao loi khi toan bo email that bai", () => {
  const form = read("src/components/parents/compose-form.tsx");
  assert.match(form, /res\.emailFailed \?\? 0\) > 0/);
  assert.match(form, /res\.emailed \?\? 0\) === 0/);
  assert.match(form, /không gửi được email nào/);
  // Nhanh loi-toan-bo phai return truoc khi clear form (khong roi vao setTitle("")).
  const branch = form.match(
    /res\.emailed \?\? 0\) === 0[\s\S]*?\}\s*else \{/);
  assert.ok(branch, "khong tim thay nhanh all-failed");
  assert.ok(!/setTitle\(""\)/.test(branch[0]),
    "nhanh all-failed khong duoc clear form - GV can gui lai");
  assert.match(form, /res\.emailed \?\? 0\) > 0 && \(res\.emailFailed \?\? 0\) > 0/,
    "partial failure phai bao so email loi trong message thanh cong");
});

// --- R6-03: announce page phan trang + bao loi nguon ------------------------
test("R6-03: announce page fetchAllRows cho activity_attendance + students", () => {
  const page = read("src/app/(app)/activities/announce/page.tsx");
  const uses = (page.match(/fetchAllRows/g) ?? []).length;
  assert.ok(uses >= 3, `can >=3 fetchAllRows (import + 2 query), thay ${uses}`);
  const att = page.match(/activity_attendance[\s\S]*?\.range\(f, t\)/);
  assert.ok(att, "activity_attendance van query khong phan trang");
  assert.match(att[0], /\.order\("activity_id"\)[\s\S]*?\.order\("student_id"\)/,
    "activity_attendance khong co cot id - can order composite on dinh");
  const stu = page.match(/\.from\("students"\)[\s\S]*?\.range\(f, t\)/);
  assert.ok(stu, "students van query khong phan trang");
  assert.match(stu[0], /\.order\("id"\)/);
  assert.match(page, /errors\.length > 0/,
    "loi/truncated phai hien notice thay vi render so lieu thieu");
});

// --- R6-04: report page khong nuot loi nguon --------------------------------
test("R6-04: report page kiem error/truncated truoc khi render stats", () => {
  const page = read("src/app/(app)/records/report/page.tsx");
  assert.ok(!/\.then\(\(r\) => \(\{ data: r\.rows \}\)\)/.test(page),
    "con .then() nuot error/truncated cua fetchAllRows");
  assert.match(page, /error: classErr/,
    "classQuery error van bi bo qua");
  for (const src of ["stuRes", "attRes", "gradesRes", "violRes"]) {
    assert.ok(
      new RegExp(`${src}\\.error \\|\\| ${src}\\.truncated`).test(page),
      `${src} chua kiem error/truncated`);
  }
  assert.match(page, /errors\.length > 0/,
    "nguon loi phai hien notice thay vi stats + narrative 'Chua ghi nhan vi pham'");
});

// --- R7-01: substitute_teacher role validation (shared helper + RLS) ------
test("R7-01: validateSubTeacher dung chung o create/decide/assign", () => {
  const act = read("src/app/(app)/school/substitutes/actions.ts");
  assert.match(act, /async function validateSubTeacher\(/,
    "thieu shared helper validateSubTeacher");
  const calls = (act.match(/await validateSubTeacher\(/g) ?? []).length;
  assert.ok(calls >= 3,
    `can >=3 call site (create+decide+assign), thay ${calls}`);
  // Helper phai kiem cung school + role GV
  const fn = act.match(/validateSubTeacher[\s\S]*?return \{ teacher: teacher/);
  assert.ok(fn, "khong tim thay than helper");
  assert.match(fn[0], /\.eq\("school_id", schoolId\)/);
  assert.match(fn[0], /TEACHER_LINK_ROLES\.has/,
    "helper phai chan role khong phai GV (bgh/pht/ke_toan)");
  // assignSubstitute khong con inline check trung lap (dung helper).
  const assign = act.match(/assignSubstitute[\s\S]*?revalidatePath/);
  assert.ok(assign);
  assert.match(assign[0], /validateSubTeacher\(/);
});

test("R7-01: migration 20261107 bat role GV cho substitute_teacher_id", () => {
  const mig = read("supabase/migrations/20261107_r7_substitute_role.sql");
  const fn = mig.match(/scn_subr_refs_in_school[\s\S]*?\$function\$;/);
  assert.ok(fn, "thieu scn_subr_refs_in_school trong migration R7");
  assert.match(fn[0],
    /p\.role = any\(array\['gvbm','gvcn','to_truong'\]\)/,
    "sub check phai bat role GV - bgh/pht van gan duoc truoc day");
  // Cac dieu kien khac giu nguyen nhu ban R2.
  assert.match(fn[0], /scn_pht_allows_campus\(c\.campus_id\)/);
  assert.match(fn[0], /sj\.id = subid and sj\.school_id = school/);
  assert.match(fn[0], /p\.id = absent and p\.school_id = school/);
  assert.match(fn[0], /sub is null or exists/,
    "sub NULL (chua phan cong) van phai hop le");
});

// --- R7-02: AI routes khong cat ngam du lieu nguon -------------------------
test("R7-02: AI routes fetchAllRows + tra 500 khi nguon loi", () => {
  for (const f of [
    "src/app/api/ai/class-analysis/route.ts",
    "src/app/api/ai/comments/route.ts",
    "src/app/api/ai/attendance-insight/route.ts",
    "src/app/api/ai/dept-brief/route.ts",
  ]) {
    const src = read(f);
    assert.match(src, /import \{ fetchAllRows \} from "@\/lib\/supabase\/fetch-all"/,
      `${f} chua import fetchAllRows`);
    assert.ok(!/\.limit\(\d+\)/.test(src),
      `${f} con .limit() cap ngam tren query nguon`);
    assert.match(src, /Không tải đủ dữ liệu nguồn/,
      `${f} thieu nhan loi co dinh`);
    assert.match(src, /status: 500/, `${f} khong tra 500`);
    // Loi VA truncated deu phai lam dung request.
    assert.match(src, /\.error \|\| \w+\.truncated/,
      `${f} chi check error ma quen truncated`);
  }
  // R7 re-review: lookup query (classes/students/subjects) cung phai check
  // error - roster loi la 500, khong duoc nuot thanh "lop chua co HS".
  for (const f of [
    "src/app/api/ai/class-analysis/route.ts",
    "src/app/api/ai/attendance-insight/route.ts",
  ]) {
    const src = read(f);
    assert.match(src, /error: clsErr/, `${f} classes lookup chua check error`);
    assert.match(src, /if \(clsErr\)/, `${f} thieu guard clsErr -> 500`);
    assert.match(src, /error: stuErr/, `${f} students lookup chua check error`);
    assert.match(src, /if \(stuErr\)/, `${f} thieu guard stuErr -> 500`);
  }
  const ca = read("src/app/api/ai/class-analysis/route.ts");
  assert.match(ca, /error: subErr/, "class-analysis subjects lookup chua check error");
  assert.match(ca, /\|\| subErr\)/, "class-analysis thieu guard subErr -> 500");
  const comments = read("src/app/api/ai/comments/route.ts");
  assert.match(comments, /error: stuErr/, "comments students lookup chua check error");
  assert.match(comments, /if \(stuErr\)/, "comments thieu guard stuErr -> 500");
  assert.match(comments, /error: subErr/, "comments subjects lookup chua check error");
  assert.match(comments, /if \(subErr\)/, "comments thieu guard subErr -> 500");
  // comments: 8 query nguon (dau vao AI prompt) deu phai phan trang.
  const fetches = (comments.match(/fetchAllRows</g) ?? []).length;
  assert.ok(fetches >= 8, `comments can >=8 fetchAllRows, thay ${fetches}`);
  // incidents giu thu tu occurred_at desc + tie-break on dinh.
  const inc = comments.match(/incidents[\s\S]*?\.range\(f, t\)/);
  assert.ok(inc, "incidents query khong phan trang");
  assert.match(inc[0], /\.order\("occurred_at", \{ ascending: false \}\)/);
  assert.match(inc[0], /\.order\("id"\)/,
    "incidents can tie-break id cho range paging on dinh");
});

// --- R7-03: school pages phan trang timetable ------------------------------
test("R7-03: substitutes/journals page fetchAllRows cho timetable_entries", () => {
  const sub = read("src/app/(app)/school/substitutes/page.tsx");
  assert.match(sub, /import \{ fetchAllRows \} from "@\/lib\/supabase\/fetch-all"/);
  const tt = sub.match(/from\("timetable_entries"\)[\s\S]*?\.range\(f, t\)/);
  assert.ok(tt, "substitutes page van fetch timetable khong phan trang");
  assert.match(tt[0], /\.in\("class_id"/,
    "timetable phai scope theo class_ids cua truong (truoc day lay tat ca)");
  assert.match(tt[0], /\.order\("id"\)/);
  assert.ok(!/from\("timetable_entries"\)\s*\.select\("\*"\)\s*[\n\r\s]*[),]/.test(sub),
    "con query timetable unscoped/unpaginated");
  // teacher_subjects cung phan trang (composite key khong co id).
  const ts = sub.match(/from\("teacher_subjects"\)[\s\S]*?\.range\(f, t\)/);
  assert.ok(ts, "teacher_subjects van khong phan trang");
  assert.match(ts[0], /\.order\("teacher_id"\)[\s\S]*?\.order\("subject_id"\)/,
    "teacher_subjects can order composite on dinh");
  assert.match(sub, /errors\.length > 0/,
    "loi/truncated phai hien notice thay vi render goi y thieu");

  const jr = read("src/app/(app)/school/journals/page.tsx");
  assert.match(jr, /import \{ fetchAllRows \} from "@\/lib\/supabase\/fetch-all"/);
  const jtt = jr.match(/from\("timetable_entries"\)[\s\S]*?\.range\(f, t\)/);
  assert.ok(jtt, "journals page van fetch timetable khong phan trang");
  assert.match(jtt[0], /\.in\("class_id", classIds\)/);
  assert.match(jtt[0], /\.order\("id"\)/);
  assert.match(jr, /errors\.length > 0/);
});

// --- R7-04: khong echo raw error.message ra client (AST scanner) -----------
// Scanner AST (TypeScript compiler API) - khong dung regex vi bo sot:
//   return { ...{ ok: false }, error: e.message }     (spread long nhau)
//   return { error: e.message.trim() }                (call tren .message)
// Round 2 bo sung (lead review):
//   - binding table 1 cap trong function scope: catch(e), const x = res.error,
//     const x = e.message, const { error } = ...  => x error-typed;
//     `return { error: e }` / `error: e.toString()` / `JSON.stringify(e)` /
//     `String(dbErr)` / `${e}` deu flag. Call binh thuong (featErr('x')) va
//     param kieu string (fail(error: string)) KHONG phai raw.
//   - traversal: ConditionalExpression arms, spread cua call result
//     (...Object.assign({}, {error: e.message})), `*.json(ident)` va
//     `return ident` resolve ve const initializer cung scope; arrow body dang
//     `(x) => ({...})` cung la return.
//   - exemption DUY NHAT: conditional ma CA HAI nhanh la string literal
//     (ke ca long nhau) - test ben trong chi inspect (.includes/.startsWith/
//     .endsWith/...). `.match/.replace/.slice/.trim` khong phai exemption.
const { createRequire } = await import("node:module");
const ts = createRequire(import.meta.url)("typescript");

const ERRISH_IDENT = /^(e|err|error|exc|ex|exception)$/i;

function scanSourceForRawErrorEchoes(sourceText) {
  const sf = ts.createSourceFile(
    "scan.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );
  const hits = [];
  const scopeCache = new Map(); // function/sourceFile node -> Map<name,{init,raw}>

  const unwrap = (e) => {
    while (
      ts.isParenthesizedExpression(e) ||
      ts.isAsExpression(e) ||
      ts.isNonNullExpression(e) ||
      ts.isAwaitExpression(e) ||
      e.kind === ts.SyntaxKind.TypeAssertionExpression
    ) e = e.expression;
    return e;
  };

  // Binding `x = res.error` / `x = res.error.code` / `x = res.error?.slice()`
  // => x mang gia tri error-typed (khac voi doc `chk.error` inline trong
  // payload - do la nhan co dinh theo convention nen khong flag).
  const bindingIsErrorProp = (init) => {
    let e = unwrap(init);
    while (
      ts.isPropertyAccessExpression(e) ||
      ts.isElementAccessExpression(e) ||
      ts.isCallExpression(e)
    ) {
      if (ts.isPropertyAccessExpression(e) && e.name.text === "error") {
        return true;
      }
      e = unwrap(e.expression);
    }
    return false;
  };

  // Nhanh tra ve co chac chan la string literal co dinh khong (ke ca
  // conditional long nhau va chuoi ?? toan literal).
  const isFixedString = (e) => {
    e = unwrap(e);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      return true;
    }
    if (ts.isConditionalExpression(e)) {
      return isFixedString(e.whenTrue) && isFixedString(e.whenFalse);
    }
    if (
      ts.isBinaryExpression(e) &&
      e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return isFixedString(e.left) && isFixedString(e.right);
    }
    return false;
  };

  const enclosingScopeNode = (node) => {
    let p = node.parent;
    while (p) {
      if (ts.isFunctionLike(p)) return p;
      p = p.parent;
    }
    return sf; // top-level: dung source file lam scope
  };

  // Expr co chua raw error (exception/.message/.error binding) khong.
  // Conditional co ca 2 nhanh la string co dinh = inspection hop le -> bo qua
  // ca test (includes/startsWith/... nam trong test khong leak).
  const containsRaw = (expr, scope, depth = 0) => {
    if (!expr || depth > 30 || ts.isFunctionLike(expr)) return false;
    expr = unwrap(expr);
    if (ts.isIdentifier(expr)) {
      const b = scope.get(expr.text);
      if (b) return b.raw;
      return ERRISH_IDENT.test(expr.text); // catch/untyped param errorish
    }
    if (ts.isConditionalExpression(expr)) {
      if (isFixedString(expr.whenTrue) && isFixedString(expr.whenFalse)) {
        return false; // nhan co dinh - test chi inspect
      }
      return (
        containsRaw(expr.condition, scope, depth + 1) ||
        containsRaw(expr.whenTrue, scope, depth + 1) ||
        containsRaw(expr.whenFalse, scope, depth + 1)
      );
    }
    if (ts.isPropertyAccessExpression(expr)) {
      if (expr.name.text === "message") {
        return true; // .message/.message.trim()/.match()/... la raw text
      }
      // Chi base moi la value use - name (`.error`) khong phai identifier loi.
      return containsRaw(expr.expression, scope, depth + 1);
    }
    let found = false;
    ts.forEachChild(expr, (n) => {
      if (found || ts.isFunctionLike(n)) return; // khong di vao nested fn
      if (containsRaw(n, scope, depth + 1)) found = true;
    });
    return found;
  };

  // Binding table 1 cap trong scope: var decl, destructure { error },
  // catch param, function param.
  const buildScope = (scopeNode) => {
    if (scopeCache.has(scopeNode)) return scopeCache.get(scopeNode);
    const scope = new Map();
    scopeCache.set(scopeNode, scope);
    for (const p of scopeNode.parameters ?? []) {
      if (!ts.isIdentifier(p.name)) continue;
      const isLabelParam = !!p.type && /\bstring\b/.test(p.type.getText(sf));
      scope.set(p.name.text, {
        init: null,
        raw: !isLabelParam && ERRISH_IDENT.test(p.name.text),
      });
    }
    const visit = (n) => {
      if (n !== scopeNode && ts.isFunctionLike(n)) return; // scope rieng
      if (ts.isVariableDeclaration(n)) {
        if (ts.isIdentifier(n.name)) {
          const init = n.initializer ?? null;
          scope.set(n.name.text, {
            init,
            // catch (e) - variableDeclaration cua CatchClause cung la
            // VariableDeclaration node, phai check parent truoc.
            raw:
              ts.isCatchClause(n.parent) ||
              (init
                ? bindingIsErrorProp(init) || containsRaw(init, scope)
                : false),
          });
        } else if (ts.isObjectBindingPattern(n.name)) {
          for (const el of n.name.elements) {
            if (!ts.isIdentifier(el.name)) continue;
            const prop =
              el.propertyName && ts.isIdentifier(el.propertyName)
                ? el.propertyName.text
                : el.name.text;
            // destructure `{ error }`/`{ error: x }` = error-typed value
            scope.set(el.name.text, { init: null, raw: prop === "error" });
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(scopeNode, visit);
    return scope;
  };

  // Thu thap moi object literal co the la payload tra ve: object literal,
  // conditional arms, identifier -> const initializer (1 cap), call args
  // (Object.assign, *.json(body), ...), spread cua cac dang tren.
  const collectPayloads = (expr, scope, out, depth = 0, seen = new Set()) => {
    if (!expr || depth > 10 || seen.has(expr)) return;
    seen.add(expr);
    expr = unwrap(expr);
    if (ts.isObjectLiteralExpression(expr)) { out.push(expr); return; }
    if (ts.isConditionalExpression(expr)) {
      collectPayloads(expr.whenTrue, scope, out, depth + 1, seen);
      collectPayloads(expr.whenFalse, scope, out, depth + 1, seen);
      return;
    }
    if (ts.isIdentifier(expr)) {
      const b = scope.get(expr.text);
      if (b && b.init) collectPayloads(b.init, scope, out, depth + 1, seen);
      return;
    }
    if (ts.isCallExpression(expr)) {
      for (const a of expr.arguments) {
        collectPayloads(a, scope, out, depth + 1, seen);
      }
    }
  };

  // Quet object literal o moi do sau: `error` prop raw + nested object
  // (property initializer, spread, spread-of-call, alias).
  const inspectObject = (obj, scope, context, depth = 0) => {
    if (depth > 10) return;
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop)) {
        if (
          (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
          prop.name.text === "error" &&
          containsRaw(prop.initializer, scope)
        ) {
          hits.push(`${context}: error = ${prop.initializer.getText(sf)}`);
        }
        const nested = [];
        collectPayloads(prop.initializer, scope, nested);
        for (const o of nested) inspectObject(o, scope, context, depth + 1);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        if (
          prop.name.text === "error" &&
          containsRaw(prop.name, scope)
        ) {
          hits.push(`${context}: error = ${prop.name.getText(sf)}`);
        }
      } else if (ts.isSpreadAssignment(prop)) {
        const nested = [];
        collectPayloads(prop.expression, scope, nested);
        for (const o of nested) inspectObject(o, scope, context, depth + 1);
      }
    }
  };

  const checkPayloadExpr = (expr, context) => {
    const scope = buildScope(enclosingScopeNode(expr));
    const objs = [];
    collectPayloads(expr, scope, objs);
    for (const o of objs) inspectObject(o, scope, context);
  };

  const visit = (node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      checkPayloadExpr(node.expression, "return");
    } else if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
      checkPayloadExpr(node.body, "return"); // (x) => ({...})
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "json"
    ) {
      const scope = buildScope(enclosingScopeNode(node));
      for (const a of node.arguments) {
        const objs = [];
        collectPayloads(a, scope, objs);
        for (const o of objs) inspectObject(o, scope, "json");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

// Unit test cho chinh scanner truoc - phai bat duoc cac dang echo da biet
// va KHONG flag inspection hop le.
test("R7-04 scanner: bat moi dang echo, bo qua inspection hop le", () => {
  const bad = [
    // --- cac dang da biet tu round 1 ---
    ["plain echo", "function f(e){ return { error: e.message }; }"],
    ["trim echo", "function f(e){ return { error: e.message.trim() }; }"],
    ["nested spread echo",
      "function f(e){ return { ...{ok:false}, error: e.message }; }"],
    ["template echo",
      "function f(e){ return { error: `loi ${e.message}` }; }"],
    ["optional-chain echo",
      "function f(e){ return { error: e?.message ?? 'x' }; }"],
    ["String(e) echo", "function f(e){ return { error: String(e) }; }"],
    ["instanceof leak",
      "function f(e){ return { error: e instanceof Error ? e.message : 'x' }; }"],
    ["nested object echo",
      "function f(e){ return { data: { error: e.message } }; }"],
    ["json() echo",
      "NextResponse.json({ error: e.message }, { status: 500 });"],
    // --- (a) error object serialization ---
    ["catch obj passthrough",
      "function f(){ try{}catch(e){ return { error: e }; } }"],
    ["toString passthrough",
      "function f(){ try{}catch(e){ return { error: e.toString() }; } }"],
    ["JSON.stringify passthrough",
      "function f(){ try{}catch(e){ return { error: JSON.stringify(e) }; } }"],
    ["String(dbErr) bound",
      "function f(res){ const dbErr = res.error; return { error: String(dbErr) }; }"],
    ["bound .error ident",
      "function f(res){ const e = res.error; return { error: e }; }"],
    ["bound .message alias",
      "function f(){ try{}catch(e){ const x = e.message; return { error: x }; } }"],
    ["template raw object",
      "function f(){ try{}catch(e){ return { error: `loi ${e}` }; } }"],
    ["destructured { error }",
      "async function f(db){ const { error } = await db.del(); return { error }; }"],
    // --- (b) traversal gaps ---
    ["conditional arm object",
      "function f(c){ try{}catch(e){ return c ? { error: e.message } : { error: 'x' }; } }"],
    ["spread of call result",
      "function f(e){ return { ...Object.assign({}, { error: e.message }) }; }"],
    ["json() alias",
      "function f(e){ const body = { error: e.message }; return Response.json(body); }"],
    ["return alias",
      "function f(e){ const body = { error: e.message }; return body; }"],
    ["arrow body echo",
      "const f = (e) => ({ error: e.message });"],
    // --- (c) predicate exemption that khong duoc nham ---
    ["match echo", "function f(e){ return { error: e.message.match(/.*/) }; }"],
    ["replace echo",
      "function f(e){ return { error: e.message.replace('a','b') }; }"],
    ["slice echo", "function f(e){ return { error: e.message.slice(0, 10) }; }"],
    ["bare includes bool",
      "function f(e){ return { error: e.message.includes('dup') }; }"],
    ["conditional raw branch",
      "function f(c,e){ return { error: c ? e.message : 'Không lưu được.' }; }"],
  ];
  for (const [name, src] of bad) {
    const hits = scanSourceForRawErrorEchoes(src);
    assert.ok(hits.length >= 1, `scanner bo sot dang: ${name}`);
  }
  const ok = [
    ["fixed label", "function f(){ return { error: 'Không lưu được.' }; }"],
    ["includes -> label",
      `function f(error){ return { error: error.message.includes('dup')
        ? 'Trùng mã.' : 'Không lưu được.' }; }`],
    ["startsWith nested cond -> labels",
      `function f(e){ return { error: e.message.includes('a')
        ? (e.message.startsWith('b') ? 'Lỗi B.' : 'Lỗi A.') : 'Không lưu được.' }; }`],
    ["deny string passthrough", "function f(deny){ return { error: deny }; }"],
    ["typed string param shorthand",
      "function f(error: string){ return { error }; }"],
    ["bound call label (featErr)",
      "async function f(){ const err = await featErr('studio'); return { error: err }; }"],
    ["helper label spread",
      "function f(chk){ return { error: chk.error ?? 'GV không hợp lệ.' }; }"],
    ["logAudit payload khong phai return",
      `function f(e){ logAudit(supabase, { payload: { error: e.message } });
        return { error: 'Không lưu được.' }; }`],
    ["json() fixed label",
      "NextResponse.json({ error: 'Không tải đủ dữ liệu nguồn.' }, { status: 500 });"],
    ["json() alias fixed label",
      "function f(){ const body = { error: 'Không lưu được.' }; return Response.json(body); }"],
    ["conditional test inspect",
      "function f(e){ return { error: e.message ? 'Có lỗi xảy ra.' : 'Không rõ.' }; }"],
  ];
  for (const [name, src] of ok) {
    const hits = scanSourceForRawErrorEchoes(src);
    assert.deepEqual(hits, [], `scanner flag nham dang hop le: ${name}`);
  }
});

test("R7-04: khong con raw-error echo trong actions/routes (AST recursive)", () => {
  // Quet toan bo actions.ts/route.ts duoi src/app + actions.ts duoi src/lib.
  const files = [];
  const walk = (dir, keep) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, keep);
      else if (e.isFile() && keep(e.name)) files.push(p);
    }
  };
  walk(join(ROOT, "src/app"), (n) => n === "actions.ts" || n === "route.ts");
  walk(join(ROOT, "src/lib"), (n) => n === "actions.ts");

  const hits = [];
  for (const f of files) {
    for (const h of scanSourceForRawErrorEchoes(readFileSync(f, "utf8"))) {
      hits.push(`${f.replace(`${ROOT}/`, "")}: ${h}`);
    }
  }
  assert.deepEqual(hits, [],
    `con raw-error echo ve client (dung console.error + nhan co dinh):\n${hits.join("\n")}`);
  assert.ok(files.length >= 40,
    `scanner chi thay ${files.length} file - co ve sai duong dan`);
});

test("R7-04: 3 file R7 goc phai co console.error server-side", () => {
  for (const f of [
    "src/app/portal/parent/actions.ts",
    "src/app/(app)/school/substitutes/actions.ts",
    "src/app/(app)/school/radar/actions.ts",
  ]) {
    const src = read(f);
    assert.ok(!/return \{ error: [^}]*\.message/.test(src),
      `${f} con tra raw error.message cho client`);
    assert.match(src, /console\.error\(/,
      `${f} thieu console.error server-side cho DB error`);
  }
});

// --- R8-01: dept-brief phan trang het 4 nguon + 500 khi loi -----------------
test("R8-01: dept-brief fetchAllRows cho schools/classes/students/attendance", () => {
  const src = read("src/app/api/ai/dept-brief/route.ts");
  const fetches = (src.match(/fetchAllRows</g) ?? []).length;
  assert.ok(fetches >= 4,
    `dept-brief can >=4 fetchAllRows (schools/classes/students/attendance), thay ${fetches}`);
  const att = src.match(/from\("attendance_records"\)[\s\S]*?\.range\(f, t\)/);
  assert.ok(att, "attendance van query .limit(50000) - khong thang PostgREST cap");
  assert.match(att[0], /students!inner\(class_id\)/,
    "embed students!inner(class_id) phai giu nguyen");
  assert.match(att[0], /\.order\("date"\)[\s\S]*?\.order\("id"\)/,
    "attendance can order on dinh (date, id) cho range paging");
  assert.match(src, /Không tải đủ dữ liệu nguồn/);
  assert.match(src, /status: 500/);
});

// --- R8-02: NLPC luu nguyen tu qua RPC + nhan loi co dinh -------------------
test("R8-02: nlpc-editor dung scn_save_nlpc rpc, khong echo raw error", () => {
  const src = read("src/components/conduct/nlpc-editor.tsx");
  assert.match(src, /supabase\.rpc\("scn_save_nlpc"/);
  for (const p of ["p_student_ids", "p_term", "p_evals", "p_comments"]) {
    assert.ok(src.includes(p), `rpc thieu tham so ${p}`);
  }
  // Khong con chuoi delete/insert rieng le - loi giua chung mat du lieu.
  assert.ok(!/\.from\("competency_evaluations"\)[\s\S]*?\.delete\(\)/.test(src),
    "con delete competency_evaluations rieng le tren client");
  assert.ok(!/\.from\("nlpc_comments"\)[\s\S]*?\.delete\(\)/.test(src),
    "con delete nlpc_comments rieng le tren client");
  assert.ok(!/\.from\("competency_evaluations"\)[\s\S]*?\.insert\(/.test(src),
    "con insert competency_evaluations rieng le tren client");
  assert.ok(!/\.from\("nlpc_comments"\)[\s\S]*?\.insert\(/.test(src),
    "con insert nlpc_comments rieng le tren client");
  // UI khong hien raw error.message - nhan co dinh, chi tiet console.error.
  assert.ok(!/setError\([^)]*\.message/.test(src),
    "setError van nhan raw error.message");
  assert.match(src, /Không lưu được đánh giá năng lực phẩm chất/);
  assert.match(src, /console\.error\(/);
});

test("R8-02: migration scn_save_nlpc invoker + capture drift scn_save_grades", () => {
  const mig = read("supabase/migrations/20261108_r8_nlpc_atomic.sql");
  const fn = mig.match(
    /create or replace function public\.scn_save_nlpc\(p_student_ids uuid\[\], p_term text, p_evals jsonb, p_comments jsonb\)[\s\S]*?\$function\$;/);
  assert.ok(fn, "thieu function scn_save_nlpc");
  assert.ok(!/security definer/i.test(fn[0]),
    "scn_save_nlpc phai SECURITY INVOKER (mac dinh) de RLS enforce authz");
  assert.match(fn[0],
    /delete from competency_evaluations\s+where student_id = any\(p_student_ids\) and term = p_term/);
  assert.match(fn[0],
    /delete from nlpc_comments\s+where student_id = any\(p_student_ids\) and term = p_term/);
  assert.match(fn[0],
    /insert into competency_evaluations[\s\S]*?jsonb_array_elements\(p_evals\)/);
  assert.match(fn[0],
    /insert into nlpc_comments[\s\S]*?jsonb_array_elements\(p_comments\)/);
  // evaluated_by phai la auth.uid() trong function - khong tin JSON client.
  assert.match(fn[0], /auth\.uid\(\)/,
    "scn_save_nlpc phai gan evaluated_by = auth.uid()");
  assert.ok(!/r->>'evaluated_by'/.test(fn[0]),
    "evaluated_by khong duoc lay tu JSON client");
  // Drift: scn_save_grades ton tai tren prod nhung khong co migration file -
  // repo phai capture def hien tai de migration history khop prod.
  assert.match(mig,
    /create or replace function public\.scn_save_grades\(p_student_ids uuid\[\], p_subject_id uuid, p_term text, p_rows jsonb\)/);
  assert.match(mig, /grant execute on function public\.scn_save_nlpc/,
    "thieu grant execute cho authenticated (pattern cr029/cr030)");
});

// --- R8-03: leaves page phan trang + notice khi nguon loi -------------------
test("R8-03: leaves page fetchAllRows attendance + bo qua stats khi loi", () => {
  const src = read("src/app/(app)/attendance/leaves/page.tsx");
  assert.match(src,
    /import \{ fetchAllRows \} from "@\/lib\/supabase\/fetch-all"/);
  const att = src.match(/from\("attendance_records"\)[\s\S]*?\.range\(f, t\)/);
  assert.ok(att, "attendance_records van cap .limit(500) ngam");
  assert.match(att[0], /\.in\("status", \["excused", "unexcused", "late"\]\)/,
    "phai giu status filter");
  assert.match(att[0], /\.order\("date", \{ ascending: false \}\)/);
  assert.match(att[0], /\.order\("id"\)/,
    "can tie-break id cho range paging on dinh");
  assert.match(att[0], /\.gte\("date", from\)/, "giu from filter");
  assert.match(att[0], /\.lte\("date", to\)/, "giu to filter");
  assert.match(src, /attRes\.error \|\| attRes\.truncated/,
    "error/truncated phai duoc bat");
  assert.match(src, /errors\.length > 0/,
    "nguon loi phai hien notice thay vi stats/table thieu");
  assert.ok(!/\.limit\(\d+\)/.test(src), "con .limit() cap ngam");
});

// --- R9-01: emulation_scores phan trang het, loi khong xuat ban ket qua -----
test("R9-01: emulation 3 site dung fetchAllRows + bat error/truncated", () => {
  for (const f of [
    "src/app/(app)/emulation/ranking/page.tsx",
    "src/app/(app)/emulation/scoring/page.tsx",
    "src/app/api/ai/emulation-summary/route.ts",
  ]) {
    const src = read(f);
    assert.match(src,
      /import \{ fetchAllRows \} from "@\/lib\/supabase\/fetch-all"/,
      `${f} chua import fetchAllRows`);
    const q = src.match(/from\("emulation_scores"\)[\s\S]*?\.range\(f, t\)/);
    assert.ok(q, `${f}: emulation_scores van query khong phan trang`);
    assert.match(q[0], /\.order\("id"\)/,
      `${f}: can order id on dinh cho range paging`);
    assert.match(src, /scoresRes\.error \|\| scoresRes\.truncated/,
      `${f}: error/truncated cua emulation_scores chua duoc bat`);
  }
  // Hai page: loi nguon -> notice co dinh, skip ranking/scoring output.
  for (const f of [
    "src/app/(app)/emulation/ranking/page.tsx",
    "src/app/(app)/emulation/scoring/page.tsx",
  ]) {
    const src = read(f);
    assert.match(src, /errors\.length > 0/, `${f} thieu nhanh notice`);
    assert.match(src, /Không tải đủ dữ liệu/, `${f} thieu nhan loi co dinh`);
  }
  const rank = read("src/app/(app)/emulation/ranking/page.tsx");
  const noticeIdx = rank.indexOf("Không tải đủ dữ liệu");
  const tableIdx = rank.indexOf("<DataTable");
  assert.ok(noticeIdx >= 0 && tableIdx > noticeIdx,
    "notice phai nam truoc bang xep hang (skip output khi loi)");
  const score = read("src/app/(app)/emulation/scoring/page.tsx");
  const sNotice = score.indexOf("Không tải đủ dữ liệu");
  const gridIdx = score.indexOf("<ScoringGrid");
  assert.ok(sNotice >= 0 && gridIdx > sNotice,
    "notice phai nam truoc ScoringGrid (skip output khi loi)");
  // API route: tra 500 nhan co dinh, khong tom tat tren du lieu thieu.
  const route = read("src/app/api/ai/emulation-summary/route.ts");
  assert.match(route, /critErr \|\| clsErr \|\| scoresRes\.error/,
    "route phai bat loi ca 3 nguon (criteria/classes/scores)");
  assert.match(route, /Không tải đủ dữ liệu nguồn/);
  assert.match(route, /status: 500/);
  assert.ok(!/scoresRaw/.test(route), "route con bien scoresRaw khong phan trang");
});

// --- R9-02: attendance/history fetchAllRows, error/truncated -> notice ------
test("R9-02: history page fetchAllRows, error/truncated hien notice", () => {
  const src = read("src/app/(app)/attendance/history/page.tsx");
  assert.match(src,
    /import \{ fetchAllRows \} from "@\/lib\/supabase\/fetch-all"/);
  assert.ok(!/fetchAllAttendance|for \(let from = 0; from < \d+/.test(src),
    "con vong lap phan trang thu cong / cap ngam");
  const q = src.match(/from\("attendance_records"\)[\s\S]*?\.range\(f, t\)/);
  assert.ok(q, "attendance_records van khong doc qua fetchAllRows");
  assert.match(q[0], /\.order\("date", \{ ascending: false \}\)/,
    "giu order date desc");
  assert.match(q[0], /\.order\("id"\)/,
    "can tie-break id cho range paging on dinh");
  assert.match(q[0], /\.gte\("date", range\.from\)/, "giu from filter");
  assert.match(q[0], /\.lte\("date", range\.to\)/, "giu to filter");
  assert.match(src, /attRes\.error \|\| attRes\.truncated/,
    "caller phai nhan error/truncated tu fetchAllRows");
  assert.match(src, /dataError/, "thieu co loi dua vao render");
  // Notice thay vi "Chua co du lieu chuyen can" khi nguon loi.
  const noticeIdx = src.indexOf("Không tải đủ dữ liệu");
  const statsIdx = src.indexOf("<StatCard");
  assert.ok(noticeIdx >= 0 && statsIdx > noticeIdx,
    "notice phai nam truoc stats/bang (skip output khi loi)");
});

// --- R9-03: client components khong dua raw .message vao UI state -----------
// Pass thu 2 cua R7-04: quet call den UI-state setter (setError/setErr/
// setMsg/setMessage/setMessages/setFeedback/setImportMsg/setNotice/flash/...)
// ma argument chua property-access `.message` (ke ca trong template literal,
// object literal, conditional, updater fn long nhau). Convention:
// console.error(detail) + nhan VN co dinh len UI.
const UI_ERROR_SETTER =
  /^(flash|set\w*(err(or)?|msg|message|feedback|notice)\w*)$/i;
// Ten field state mang loi (khong gom "message" - field do thuong la noi dung
// chat hop le, khong phai echo loi).
const UI_ERROR_FIELD = /^(err(or)?|msg|feedback|notice)$/i;

function scanSourceForUiErrorEchoes(sourceText) {
  const sf = ts.createSourceFile(
    "scan.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  );
  const hits = [];
  const hasMessageAccess = (node, depth = 0) => {
    if (!node || depth > 60) return false;
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "message"
    ) {
      return true;
    }
    let found = false;
    ts.forEachChild(node, (n) => {
      if (!found && hasMessageAccess(n, depth + 1)) found = true;
    });
    return found;
  };
  // Object-state: `{...s, error: e.message}` / updater `()=>({error: e.message})`.
  const hasErrorFieldMessage = (node, depth = 0) => {
    if (!node || depth > 60) return false;
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      UI_ERROR_FIELD.test(node.name.text) &&
      hasMessageAccess(node.initializer)
    ) {
      return true;
    }
    let found = false;
    ts.forEachChild(node, (n) => {
      if (!found && hasErrorFieldMessage(n, depth + 1)) found = true;
    });
    return found;
  };
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression)
    ) {
      const name = node.expression.text;
      const isErrorSetter = UI_ERROR_SETTER.test(name);
      const isGenericSetter = /^set[A-Z]\w*$/.test(name);
      for (const a of node.arguments) {
        const bad = isErrorSetter
          ? hasMessageAccess(a)
          : isGenericSetter && hasErrorFieldMessage(a);
        if (bad) {
          const pos = sf.getLineAndCharacterOfPosition(a.getStart(sf));
          hits.push(
            `${name}(...) @${pos.line + 1}:${pos.character + 1}: ` +
              `${a.getText(sf).slice(0, 80)}`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

test("R9-03 scanner: bat dang .message trong setter, bo qua nhan co dinh", () => {
  const bad = [
    ["plain", "function f(err){ setError(err.message); }"],
    ["template",
      "function f(err){ setError(`Lưu thất bại: ${err.message}`); }"],
    ["flash", "function f(err){ flash(false, err.message); }"],
    ["feedback object",
      "function f(error){ setFeedback({ ok: false, text: `Lỗi ${error.message}` }); }"],
    ["instanceof conditional",
      "function f(e){ setError(e instanceof Error ? e.message : 'Không lưu được'); }"],
    ["nested updater",
      "function f(err){ setErrors((p) => [...p, err.message]); }"],
    ["setErr alias", "function f(up){ setErr(`x ${up.error.message}`); }"],
    ["setMsg", "function f(e){ setMsg(e.message); }"],
    ["setImportMsg", "function f(e){ setImportMsg(e.message); }"],
    ["concat", "function f(up){ return setError('Upload lỗi: ' + up.message); }"],
    ["optional chain", "function f(e){ setError(e?.message ?? 'x'); }"],
    ["deep prop", "function f(res){ setError(res.error.message); }"],
    ["object-state spread",
      "function f(e){ setState({ ...s, error: e.message }); }"],
    ["object-state updater",
      "function f(e){ setState((p) => ({ ...p, err: e.message })); }"],
    ["generic setter feedback field",
      "function f(e){ setForm({ ...form, feedback: e.message }); }"],
  ];
  for (const [name, src] of bad) {
    const hits = scanSourceForUiErrorEchoes(src);
    assert.ok(hits.length >= 1, `scanner bo sot dang: ${name}`);
  }
  const ok = [
    ["fixed label", "function f(){ setError('Không lưu được.'); }"],
    ["console detail + label",
      `function f(err){ console.error('[x] save:', err.message);
        setError('Không lưu được - vui lòng thử lại.'); }`],
    ["flash label", "function f(){ flash(false, 'Không lưu được.'); }"],
    ["feedback label",
      "function f(){ setFeedback({ ok: false, text: 'Thử lại sau.' }); }"],
    ["non-setter named message fn",
      "function f(m){ renderText(m.message); }"],
    ["non-error setter",
      "function f(m){ setStatus(m.message); }"],
    ["prop named message (khong phai access)",
      "function f(t){ setMessage(t); }"],
    ["server label prop",
      "function f(json){ setError(json.error ?? 'Lỗi.'); }"],
    ["object-state fixed label",
      "function f(){ setState({ ...s, error: 'Không lưu được.' }); }"],
    ["content field khong phai loi",
      "function f(m){ setDraft({ ...d, note: m.message }); }"],
  ];
  for (const [name, src] of ok) {
    const hits = scanSourceForUiErrorEchoes(src);
    assert.deepEqual(hits, [], `scanner flag nham dang hop le: ${name}`);
  }
});

test("R9-03: khong con raw .message vao UI state trong src/ (AST pass 2)", () => {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walk(join(ROOT, "src"));

  const hits = [];
  for (const f of files) {
    for (const h of scanSourceForUiErrorEchoes(readFileSync(f, "utf8"))) {
      hits.push(`${f.replace(`${ROOT}/`, "")}: ${h}`);
    }
  }
  assert.deepEqual(hits, [],
    `con raw .message vao UI state (console.error + nhan co dinh):\n${hits.join("\n")}`);
  assert.ok(files.length >= 150,
    `scanner chi thay ${files.length} file - co ve sai duong dan`);
});

test("R9-03: cac site da cham deu co console.error + nhan VN co dinh", () => {
  const cases = [
    ["src/components/school/assignments-board.tsx", /phân công chủ nhiệm|phân công giảng dạy|môn phụ trách/],
    ["src/components/records/new-class-form.tsx", /tiếp nhận lớp/],
    ["src/components/attendance/daily-roster.tsx", /lưu được chuyên cần/i],
    ["src/components/competency/self-assessment-form.tsx", /lưu đánh giá/i],
    ["src/components/competency/evidence-form.tsx", /thêm minh chứng/i],
    ["src/components/academics/lesson-plan-board.tsx", /file đính kèm/],
    ["src/components/academics/chat-thread.tsx", /tin nhắn/],
    ["src/components/academics/plan-actions.tsx", /kế hoạch/],
    ["src/components/academics/grades-editor.tsx", /lưu được điểm/i],
    ["src/components/parents/cmhs-board.tsx", /thành viên|vai trò/],
    ["src/components/schedule/timetable-toolbar.tsx", /thời khóa biểu/],
    ["src/components/schedule/period-log-board.tsx", /sổ đầu bài|rèn luyện/],
    ["src/components/conduct/record-form.tsx", /ghi nhận/],
    ["src/components/conduct/evaluation-editor.tsx", /hạnh kiểm/],
    ["src/components/emulation/scoring-grid.tsx", /lưu điểm/i],
    ["src/components/counseling/intake-form.tsx", /ca tư vấn/],
    ["src/components/counseling/case-controls.tsx", /ca tư vấn/],
    ["src/components/counseling/referral-card.tsx", /chuyển tiếp/],
    ["src/components/exams/exams-board.tsx", /kỳ thi|buổi thi|lịch thi/],
    ["src/components/tvc/question-bank.tsx", /đọc file|tải được ảnh/i],
  ];
  for (const [f, labelRe] of cases) {
    const src = read(f);
    assert.match(src, labelRe, `${f} thieu nhan loi VN co dinh`);
    assert.match(src, /console\.error\(/,
      `${f} thieu console.error cho chi tiet loi`);
  }
});

// --- R10-01: chat history lay trang MOI NHAT + load-older cursor -----------
// PostgREST cap ~1000 rows/request: .order("created_at") asc khong gioi han
// tra ve 1000 tin CU nhat, tin moi bi che. Dung desc + limit + reverse.
const CHAT_PAGES = [
  "src/app/(app)/academics/teacher-chat/page.tsx",
  "src/app/(app)/academics/parent-chat/page.tsx",
  "src/app/(app)/conduct/student-chat/page.tsx",
];

test("R10-01: 3 chat pages order desc + limit 100 + reverse, khong asc unbounded", () => {
  for (const f of CHAT_PAGES) {
    const src = read(f);
    const q = src.match(/from\("messages"\)[\s\S]*?\.limit\(100\)/);
    assert.ok(q, `${f}: messages query thieu limit(100)`);
    assert.match(q[0], /\.order\("created_at", \{ ascending: false \}\)/,
      `${f}: phai lay trang moi nhat - asc bi cap 1000 tin CU`);
    assert.match(q[0], /\.order\("id", \{ ascending: false \}\)/,
      `${f}: can tie-break id cho cursor paging on dinh`);
    assert.match(src, /\.reverse\(\)/,
      `${f}: phai reverse trang desc de render chronological`);
    assert.ok(!/\.order\("created_at"\)/.test(src),
      `${f}: con order created_at asc mac dinh (tra ve tin cu nhat)`);
    assert.match(src, /initialHasOlder=\{hasOlder\}/,
      `${f}: phai truyen initialHasOlder cho ChatThread`);
    assert.match(src, /notifyLink=/,
      `${f}: phai truyen notifyLink cho ChatThread`);
  }
});

test("R10-01: chat-thread co nut tai tin cu + cursor (created_at, id)", () => {
  const src = read("src/components/academics/chat-thread.tsx");
  assert.match(src, /Tải tin nhắn cũ hơn/, "thieu nut tai tin cu");
  assert.match(src,
    /import \{[^}]*olderMessagesPredicate[^}]*\} from "@\/lib\/chat"/,
    "loadOlder phai dung predicate chia se (test duoc) thay vi inline");
  assert.match(src, /olderMessagesPredicate\(oldest\.created_at, oldest\.id\)/,
    "cursor phai la tuple (created_at, id)");
  assert.match(src, /\.limit\(PAGE_SIZE\)/);
  // Gui tin phai append local - refresh lai server props nap trang moi nhat
  // va lam mat lich su cu nguoi dung vua tai.
  assert.ok(!/router\.refresh\(\)/.test(src),
    "con router.refresh() sau khi gui - mat tin cu da tai");
  assert.match(src, /mergeChatMessages\(prev, older\)/,
    "trang cu phai prepend qua mergeChatMessages (dedupe + sort)");
  assert.match(src, /mergeChatMessages\(prev, \[inserted/,
    "tin vua gui phai append qua mergeChatMessages");
});

// --- R10-02: inbox/notifications unread = DB count + load-more -------------
test("R10-02: inbox + notifications dem unread bang head:true count query", () => {
  const inbox = read("src/app/(app)/parents/inbox/page.tsx");
  assert.match(inbox, /count: "exact", head: true/,
    "inbox phai dem unread bang head count query, khong suy tu hang da tai");
  assert.match(inbox, /\.is\("read_at", null\)/);
  assert.match(inbox, /unreadRes\.count/,
    "description phai dung unreadRes.count (DB-accurate)");
  const notif = read("src/app/(app)/notifications/page.tsx");
  assert.match(notif, /count: "exact", head: true/);
  assert.match(notif, /\.is\("read_at", null\)/);
  assert.match(notif, /initialUnreadCount=\{unreadRes\.count/,
    "client phai nhan unread count tu DB, khong derive tu items");
});

test("R10-02: inbox-client + notifications-client co load-more cursor", () => {
  for (const f of [
    "src/components/parents/inbox-client.tsx",
    "src/components/notifications/notifications-client.tsx",
  ]) {
    const src = read(f);
    assert.match(src, /Xem thêm/, `${f} thieu nut Xem them`);
    assert.match(src, /olderMessagesPredicate\(/,
      `${f} phai dung cursor predicate chia se (created_at, id)`);
    assert.match(src, /\.limit\(PAGE_SIZE\)/, `${f} thieu page size`);
    assert.match(src, /\.order\("id", \{ ascending: false \}\)/,
      `${f} thieu tie-break id cho cursor on dinh`);
  }
  // notifications: mark-all-read van cap nhat moi hang chua doc (is null) va
  // unread count phai la state rieng tu DB count, khong derive tu items.
  const notif = read("src/components/notifications/notifications-client.tsx");
  assert.match(notif, /\.is\("read_at", null\)/);
  assert.match(notif, /initialUnreadCount/);
  assert.ok(!/unread = items\.filter/.test(notif),
    "unread con derive tu items da tai - sai khi con trang cu");
});

// --- R10-03: notification link theo role nguoi nhan -------------------------
test("R10-03: replyMessage resolve link theo role nguoi nhan", () => {
  const src = read("src/app/(app)/parents/actions.ts");
  assert.match(src,
    /import \{ messageLinkForRole \} from "@\/lib\/message-link"/,
    "helper phai o src/lib de unit-test duoc, khong inline");
  const body = src.match(/replyMessage[\s\S]*?notifications"\)\.insert\(\{[\s\S]*?\}\)/);
  assert.ok(body, "khong tim thay notification insert trong replyMessage");
  assert.ok(!/link: "\/parents\/inbox"/.test(body[0]),
    "con hardcode link sender-route - phu huynh/HS khong mo duoc");
  assert.match(body[0], /link: messageLinkForRole\(/);
  assert.match(src, /from\("profiles"\)[\s\S]*?select\("role"\)[\s\S]*?eq\("id", input\.recipientId\)/,
    "phai tra role cua recipientId truoc khi insert notification");
});

test("R10-03: chat-thread dung notifyLink prop, khong doc location.pathname", () => {
  const src = read("src/components/academics/chat-thread.tsx");
  assert.ok(!/window\.location\.pathname/.test(src),
    "con link window.location.pathname - path cua NGUOI GUI, sai cho nguoi nhan");
  assert.match(src, /notifyLink: string/);
  assert.match(src, /link: notifyLink/);
  // Moi trang truyen route ma role cua peer mo duoc.
  assert.match(read("src/app/(app)/academics/parent-chat/page.tsx"),
    /notifyLink="\/portal\/parent"/);
  assert.match(read("src/app/(app)/conduct/student-chat/page.tsx"),
    /notifyLink="\/portal\/student"/);
  // teacher-chat deep-link ?to=<sender> chi cho role xem duoc trang - helper
  // map theo peer.role (to_truong recipient bay gio resolve duoc ?to=).
  assert.match(read("src/app/(app)/academics/teacher-chat/page.tsx"),
    /notifyLink=\{teacherChatLinkForRole\(peer\.role, profile\.id\)\}/);
});

// --- R10 behavioral: predicate + merge + link helpers (executable) --------
test("R10 behavioral: olderMessagesPredicate dung shape (lt) OR (eq AND id.lt)", () => {
  const p = olderMessagesPredicate("2026-11-01T08:00:00+00:00", "uuid-1");
  assert.equal(
    p,
    'created_at.lt."2026-11-01T08:00:00+00:00",' +
      'and(created_at.eq."2026-11-01T08:00:00+00:00",id.lt."uuid-1")',
    "cursor phai la tuple (created_at, id) - chi lt(created_at) bo sot tin " +
      "cung timestamp o bien trang",
  );
  // Gia tri duoc quote - timestamptz chua '.'/':' la reserved trong or().
  assert.match(p, /created_at\.lt\."/, "timestamp phai double-quote");
  // Dung cho ca trang dau: order desc (created_at, id) nguoc voi predicate.
  const page = read("src/app/(app)/academics/teacher-chat/page.tsx");
  const q = page.match(/from\("messages"\)[\s\S]*?\.limit\(100\)/);
  assert.match(q[0], /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(q[0], /\.order\("id", \{ ascending: false \}\)/);
});

test("R10 behavioral: mergeChatMessages dedupe id + chronological invariant", () => {
  const m = (id, ts) => ({ id, created_at: ts });
  // Prepend trang cu + append tin gui, dedupe hang trung cursor.
  const current = [m("c", "2026-01-03T00:00:00"), m("d", "2026-01-04T00:00:00")];
  const older = [
    m("a", "2026-01-01T00:00:00"),
    m("b", "2026-01-02T00:00:00"),
    m("c", "2026-01-03T00:00:00"), // bien trang trung id
  ];
  const merged = mergeChatMessages(current, older);
  assert.deepEqual(merged.map((x) => x.id), ["a", "b", "c", "d"],
    "prepend phai dedupe + sort chronological");
  const sent = m("e", "2026-01-05T00:00:00");
  const afterSend = mergeChatMessages(merged, [sent]);
  assert.deepEqual(afterSend.map((x) => x.id), ["a", "b", "c", "d", "e"],
    "tin vua gui phai append cuoi");
  // Tie-break id khi created_at trung nhau - khong phu thuoc thu tu input.
  const t1 = mergeChatMessages([m("b2", "2026-01-01")], [m("a1", "2026-01-01")]);
  const t2 = mergeChatMessages([m("a1", "2026-01-01")], [m("b2", "2026-01-01")]);
  assert.deepEqual(t1.map((x) => x.id), ["a1", "b2"]);
  assert.deepEqual(t2.map((x) => x.id), ["a1", "b2"],
    "cung created_at phai tie-break bang id, bat bien thu tu goi");
  // Input khong bi mutate.
  assert.equal(current.length, 2, "merge khong duoc mutate current");
});

test("R10 behavioral: messageLinkForRole map dung moi role", () => {
  assert.equal(messageLinkForRole("phu_huynh"), "/portal/parent");
  assert.equal(messageLinkForRole("hoc_sinh"), "/portal/student");
  for (const r of STAFF_CHAT_ROLES) {
    assert.equal(messageLinkForRole(r), "/parents/inbox",
      `staff role ${r} phai ve inbox nhan vien`);
  }
  for (const r of ["so_gd", "ubnd", "khong_biet", null, undefined]) {
    assert.equal(messageLinkForRole(r), "/parents/inbox",
      `role ${r} phai ve default an toan`);
  }
});

test("R10 behavioral: teacherChatLinkForRole chi deep-link role xem duoc", () => {
  for (const r of ["gvcn", "gvbm", "to_truong"]) {
    assert.equal(
      teacherChatLinkForRole(r, "S1"),
      "/academics/teacher-chat?to=S1",
      `${r} mo duoc teacher-chat - deep-link vao thread`,
    );
  }
  assert.equal(teacherChatLinkForRole("bgh", "S1"), "/parents/inbox",
    "bgh xem inbox duoc nhung khong vao teacher-chat");
  for (const r of ["pht", "ke_toan", "admin", "phu_huynh", null]) {
    assert.equal(teacherChatLinkForRole(r, "S1"), "/notifications",
      `${r} khong mo duoc teacher-chat/inbox - ve feed notifications`);
  }
});

test("R10: teacher-chat resolve ?to= staff cung truong ngoai peer list", () => {
  const src = read("src/app/(app)/academics/teacher-chat/page.tsx");
  const block = src.match(/requestedTo[\s\S]*?maybeSingle\(\);/);
  assert.ok(block, "thieu nhanh resolve ?to= ngoai danh sach peer mac dinh");
  assert.match(block[0], /\.eq\("school_id", profile\.school_id/,
    "extra peer phai CUNG TRUONG - khong mo rong cross-tenant");
  assert.match(block[0], /\.neq\("id", profile\.id\)/,
    "khong resolve chinh minh lam peer");
  assert.match(block[0], /\.in\("role", \[\.\.\.STAFF_CHAT_ROLES\]\)/,
    "extra peer phai la staff role khop scn_can_message");
  assert.match(src, /import \{ STAFF_CHAT_ROLES \} from "@\/lib\/chat"/);
  // STAFF_CHAT_ROLES phai khop danh sach role staff-staff trong policy.
  const mig = read("supabase/migrations/20261105_r2_security_fixes.sql");
  const branch = mig.match(
    /role from me\) = any\(array\[('gvcn','gvbm','to_truong','bgh','pht','ke_toan','admin')\]\)/);
  assert.ok(branch, "policy staff-staff da doi - dong bo STAFF_CHAT_ROLES");
  assert.deepEqual(
    [...STAFF_CHAT_ROLES].sort(),
    branch[1].split(",").map((s) => s.replace(/'/g, "")).sort(),
    "STAFF_CHAT_ROLES lech voi scn_can_message",
  );
});

// --- R11-01: incident follow-up atomic qua RPC (khong lost update) ---------
test("R11-01: followupIncident goi rpc scn_incident_followup, bo read-then-write", () => {
  const act = read("src/app/(app)/safety/actions.ts");
  const body = act.match(/followupIncident[\s\S]*?revalidatePath\("\/safety\/followup"\)/);
  assert.ok(body, "khong tim thay than followupIncident");
  assert.match(body[0], /\.rpc\("scn_incident_followup"/,
    "phai goi RPC 1 lan thay vi update truc tiep");
  assert.ok(!/\.select\("description"\)/.test(body[0]),
    "con doc description roi concat phia JS - lost update con ton tai");
  assert.ok(!/\.from\("incidents"\)[\s\S]*?\.update\(/.test(body[0]),
    "con update incidents truc tiep trong followup");
  assert.match(body[0], /console\.error\(/);
  // Role check giu nguyen (gvcn lop CN + bgh).
  assert.match(act, /checkActionRole\(\["gvcn", "bgh"\]\)/);
});

test("R11-01: migration scn_incident_followup la 1 UPDATE invoker", () => {
  const mig = read("supabase/migrations/20261109_r11_atomic_writes.sql");
  const fn = mig.match(
    /create or replace function public\.scn_incident_followup\(p_incident uuid, p_status text, p_note text\)[\s\S]*?\$function\$;/);
  assert.ok(fn, "thieu function scn_incident_followup");
  assert.ok(!/security definer/i.test(fn[0]),
    "scn_incident_followup phai SECURITY INVOKER (mac dinh) de RLS ap dung");
  // Mot UPDATE duy nhat - append concat tren gia tri hien tai trong DB.
  const updates = fn[0].match(/\bupdate\s+incidents\b/gi) ?? [];
  assert.equal(updates.length, 1, "function phai gom DUNG 1 UPDATE incidents");
  assert.match(fn[0], /coalesce\(description, ''\)/,
    "phai append tren description hien tai, khong ghi de");
  assert.match(fn[0], /Theo dõi /, "thieu prefix [Theo doi DD/MM/YYYY]");
  assert.match(fn[0], /Asia\/Ho_Chi_Minh/, "stamp phai theo gio VN");
  assert.match(fn[0], /btrim\(p_note\)/, "phai trim note trong SQL");
  assert.match(mig,
    /grant execute on function public\.scn_incident_followup\(uuid, text, text\) to authenticated/);
});

// --- R11-02: class role change atomic qua RPC ------------------------------
test("R11-02: assignRole goi rpc scn_set_class_role, loi hien UI", () => {
  const src = read("src/components/register/roster-client.tsx");
  const body = src.match(/assignRole[\s\S]*?setBusy\(false\);\n  \}/);
  assert.ok(body, "khong tim thay than assignRole");
  assert.match(body[0], /\.rpc\("scn_set_class_role"/,
    "phai goi RPC delete+insert nguyen tu");
  assert.ok(!/\.from\("class_roles"\)/.test(body[0]),
    "con delete/insert truc tiep class_roles tren client");
  // Loi rpc phai console.error + bao ra UI (nhan co dinh) va KHONG doi
  // local state - setRoles chi nam trong nhanh success (else).
  assert.match(body[0], /console\.error\(/);
  assert.match(body[0], /if \(error\) \{[\s\S]*?setMessage\([\s\S]*?\}\s*else \{/,
    "loi rpc phai bao ra UI va khong roi vao nhanh setRoles");
  assert.match(body[0], /Không cập nhật được chức danh/);
  // Audit log cho ca 2 chieu: dat role moi va xoa chuc danh.
  assert.match(body[0], /"Phân chức danh BCS" : "Xóa chức danh BCS"/,
    "can logAudit ca thao tac xoa chuc danh");
});

test("R11-02: migration scn_set_class_role delete+insert invoker", () => {
  const mig = read("supabase/migrations/20261109_r11_atomic_writes.sql");
  const fn = mig.match(
    /create or replace function public\.scn_set_class_role\(p_student uuid, p_role text\)[\s\S]*?\$function\$;/);
  assert.ok(fn, "thieu function scn_set_class_role");
  assert.ok(!/security definer/i.test(fn[0]),
    "scn_set_class_role phai SECURITY INVOKER de RLS ap dung");
  assert.match(fn[0],
    /delete from class_roles where student_id = p_student/);
  assert.match(fn[0],
    /insert into class_roles \(student_id, role\) values \(p_student, p_role\)/);
  assert.match(fn[0], /p_role <> ''/, "role rong = clear, khong insert");
  assert.match(mig,
    /grant execute on function public\.scn_set_class_role\(uuid, text\) to authenticated/);
});

// --- R11-03: audit export khong tra CSV thieu du lieu ----------------------
test("R11-03: export route kiem error/truncated moi nguon + tra 422", () => {
  const route = read("src/app/(app)/register/audit/export/route.ts");
  // Moi ket qua fetchAllRows duoc gan ten deu phai check error||truncated.
  const names = [];
  for (const m of route.matchAll(
    /const (\w+)\s*=\s*await fetchAllRows/g)) names.push(m[1]);
  // records branch: students fetch dung stsRes (co the re-assign tu const).
  for (const m of route.matchAll(
    /const (\w+)\s*=\s*classIds\.length[\s\S]*?await fetchAllRows/g)) {
    names.push(m[1]);
  }
  assert.ok(names.length >= 3,
    `can >=3 fetchAllRows results duoc kiem, thay ${names.join(",")}`);
  for (const n of names) {
    assert.ok(
      new RegExp(`${n}\\.error \\|\\| ${n}\\.truncated`).test(route),
      `${n} chua kiem error/truncated - CSV se bi cat ngam`);
  }
  // classes lookup trong records branch cung phai check error.
  assert.match(route, /error: clsErr/, "classQuery error van bi bo qua");
  assert.match(route, /if \(clsErr\)/, "thieu guard clsErr");
  // Loi/truncated -> 422 nhan co dinh, khong bao gio CSV partial o 200.
  assert.match(route, /status: 422/);
  assert.match(route, /Dữ liệu vượt quá giới hạn xuất hoặc tải lỗi/);
  assert.match(route, /console\.error\(/,
    "loi nguon phai console.error chi tiet server-side");
  // CSV thanh cong chi duoc build sau khi moi nguon da qua guard.
  const csvIdx = route.indexOf('Content-Disposition');
  const guardIdx = route.lastIndexOf("sourceFailed");
  assert.ok(csvIdx > 0 && guardIdx < csvIdx,
    "phan hoi CSV phai sau tat ca guard loi");
});

// --- R12-01: seating save/restore nguyen tu qua RPC -----------------------
test("R12-01: seating-grid save() goi rpc scn_save_seating, bo 2-statement", () => {
  const src = read("src/components/register/seating-grid.tsx");
  const body = src.match(/async function save\(\)[\s\S]*?setSaving\(false\);\n  \}/);
  assert.ok(body, "khong tim thay than save()");
  assert.match(body[0], /\.rpc\(\s*"scn_save_seating"/,
    "phai goi RPC 1 lan thay vi update+insert rieng le");
  for (const p of ["p_class", "p_month", "p_layout"]) {
    assert.ok(body[0].includes(p), `rpc thieu tham so ${p}`);
  }
  assert.ok(!/\.from\("seating_charts"\)/.test(body[0]),
    "con update/insert truc tiep seating_charts tren client");
  // Loi rpc: console.error chi tiet + nhan co dinh, KHONG doi local state
  // (setVersion chi trong nhanh success).
  assert.match(body[0], /console\.error\(/);
  assert.match(body[0],
    /if \(error\) \{[\s\S]*?setMessage\([\s\S]*?\}\s*else \{/,
    "loi rpc phai bao ra UI va khong roi vao nhanh setVersion");
  assert.match(body[0], /Không thể lưu sơ đồ/);
  assert.match(body[0], /setVersion\(v\)/,
    "version hien thi phai lay tu gia tri DB tra ve");
});

test("R12-01: seating-history restore() goi rpc scn_restore_seating", () => {
  const src = read("src/components/register/seating-history-client.tsx");
  const body = src.match(/async function restore[\s\S]*?setBusy\(false\);\n  \}/);
  assert.ok(body, "khong tim thay than restore()");
  assert.match(body[0], /\.rpc\("scn_restore_seating"/);
  assert.match(body[0], /p_chart: chart\.id/);
  assert.ok(!/\.from\("seating_charts"\)/.test(src),
    "con update truc tiep seating_charts tren client");
  assert.match(body[0], /console\.error\(/);
  assert.match(body[0],
    /if \(error\) \{[\s\S]*?setMessage\([\s\S]*?\}\s*else \{/,
    "loi rpc phai bao ra UI va khong doi local charts state");
  assert.match(body[0], /Không thể khôi phục phiên bản này/);
});

test("R12-01: migration scn_save_seating + scn_restore_seating invoker atomic", () => {
  const mig = read("supabase/migrations/20261110_r12_seating_atomic.sql");
  const save = mig.match(
    /create or replace function public\.scn_save_seating\(p_class uuid, p_month text, p_layout jsonb\)[\s\S]*?\$function\$;/);
  assert.ok(save, "thieu function scn_save_seating");
  assert.ok(!/security definer/i.test(save[0]),
    "scn_save_seating phai SECURITY INVOKER (mac dinh) de RLS ap dung");
  assert.match(save[0],
    /update seating_charts\s+set is_current = false\s+where class_id = p_class and month = v_month/,
    "phai tat current cu trong cung transaction");
  assert.match(save[0], /coalesce\(max\(version\), 0\) \+ 1/,
    "version phai tinh phia DB (max+1), khong tin client");
  assert.match(save[0],
    /insert into seating_charts \(class_id, month, version, layout, is_current\)/);
  assert.match(save[0], /is_current\) <> 1/,
    "postcondition phai bat dung 1 ban ghi current");
  assert.match(save[0], /p_month::date/,
    "month la cot date - phai cast p_month");
  const rst = mig.match(
    /create or replace function public\.scn_restore_seating\(p_chart uuid\)[\s\S]*?\$function\$;/);
  assert.ok(rst, "thieu function scn_restore_seating");
  assert.ok(!/security definer/i.test(rst[0]),
    "scn_restore_seating phai SECURITY INVOKER de RLS ap dung");
  assert.match(rst[0],
    /select class_id, month into v_class, v_month[\s\S]*?where id = p_chart/,
    "phai scope update theo class/month cua chinh ban ghi");
  const updates = rst[0].match(/\bupdate\s+seating_charts\b/gi) ?? [];
  assert.equal(updates.length, 2,
    "restore phai gom tat-current + bat-lai trong cung function");
  assert.ok((rst[0].match(/if not found then/g) ?? []).length >= 2,
    "can raise khi chart khong ton tai / update bi RLS loc ve 0 row");
  assert.match(rst[0], /is_current\) <> 1/,
    "postcondition phai bat dung 1 ban ghi current");
  assert.match(mig,
    /grant execute on function public\.scn_save_seating\(uuid, text, jsonb\) to authenticated/);
  assert.match(mig,
    /grant execute on function public\.scn_restore_seating\(uuid\) to authenticated/);
});

// --- R12-02: thang/ky danh gia tai thoi diem goi, khong dong bang ---------
test("R12-02: prevMonthOf/monthParts tinh dung bien nam Dec->Jan", () => {
  // Bien nam: thang 1 phai ve thang 12 cua nam truoc.
  assert.equal(prevMonthOf("2026-01-15"), "2025-12",
    "thang 1 phai ve thang 12 nam truoc - bien Dec->Jan");
  assert.equal(prevMonthOf("2026-12-31"), "2026-11");
  assert.equal(prevMonthOf("2026-03-01"), "2026-02");
  assert.deepEqual(monthParts("2026-03-05"), { year: 2026, month: 3 });
});

test("R12-02: types.ts khong con hang module-level dong bang thang", () => {
  const types = read("src/components/register/types.ts");
  assert.ok(!/export const (CURRENT_MONTH|PREV_MONTH|CURRENT_PERIOD)\b/.test(types),
    "con hang CURRENT_MONTH/PREV_MONTH/CURRENT_PERIOD - dong bang luc import");
  assert.ok(!/^const \w+ = todayVN\(\)/m.test(types),
    "con goi todayVN() o module scope - ket qua van bi dong bang");
  for (const fn of ["currentMonthVN", "prevMonthVN", "currentPeriodVN"]) {
    assert.match(types, new RegExp(`export function ${fn}\\(\\)`),
      `thieu function ${fn}`);
  }
  // Function phai danh gia tai thoi diem goi, khong cache.
  assert.match(types, /export function prevMonthVN\(\)[\s\S]*?prevMonthOf\(todayVN\(\)\)/,
    "prevMonthVN phai goi todayVN() ben trong function body");
});

test("R12-02: moi caller dung dang function, danh gia tai diem ghi", () => {
  // Quet toan src/: khong con import/dung hang so dong bang cu.
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walk(join(ROOT, "src"));
  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (/\b(CURRENT_MONTH|PREV_MONTH|CURRENT_PERIOD)\b/.test(src)) {
      hits.push(f.replace(`${ROOT}/`, ""));
    }
  }
  assert.deepEqual(hits, [],
    `con file dung hang module-level dong bang thang: ${hits.join(", ")}`);
  // Khong co goi ham thang/ky o module scope (const o cot 0 = top-level).
  const modScope = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (/^const \w+ = (todayVN|currentMonthVN|prevMonthVN|currentPeriodVN)\(\)/m
      .test(src)) {
      modScope.push(f.replace(`${ROOT}/`, ""));
    }
  }
  assert.deepEqual(modScope, [],
    `con goi ham thoi gian o module scope: ${modScope.join(", ")}`);

  // Write paths phai tinh ky TAI THOI DIEM bam nut (trong handler).
  const signoff = read("src/components/register/signoff-client.tsx");
  const batch = signoff.match(/async function createBatch[\s\S]*?setBusy\(false\);\n  \}/);
  assert.ok(batch, "khong tim thay createBatch");
  assert.match(batch[0], /const period = currentMonthVN\(\)/,
    "ky phai tinh trong handler tai thoi diem submit, khong phai hang prop");
  assert.match(batch[0], /period: "so_chu_nhiem"|period,/,
    "insert van phai ghi period vua tinh");
  const lock = read("src/components/register/lock-records-client.tsx");
  const lbatch = lock.match(/async function createBatch[\s\S]*?setBusy\(false\);\n  \}/);
  assert.ok(lbatch, "khong tim thay createBatch cua lock-records");
  assert.match(lbatch[0], /const period = currentPeriodVN\(\)/,
    "ky so hoc ba phai tinh trong handler tai thoi diem submit");
  // Default hien thi useState: lazy initializer (danh gia 1 lan khi mount).
  const kpi = read("src/components/register/kpi-client.tsx");
  assert.match(kpi, /useState\(\(\) => currentPeriodVN\(\)\)/,
    "default ky KPI phai la lazy initializer, khong phai hang module");
  // Server components: danh gia theo request.
  const seat = read("src/app/(app)/register/seating/page.tsx");
  assert.match(seat, /currentMonthVN\(\)/);
  assert.match(seat, /prevMonthVN\(\)/);
  const exp = read("src/app/(app)/register/export/page.tsx");
  assert.match(exp, /defaultPeriod=\{currentMonthVN\(\)\}/);
});
