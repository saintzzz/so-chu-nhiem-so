/**
 * Seed script - Sổ Chủ Nhiệm Số
 * Generates realistic Vietnamese demo data via service-role client.
 * Usage: node scripts/seed.mjs
 * Requires .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=", 2).map((s) => s.trim())),
);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ri = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const chance = (p) => Math.random() < p;
const pad = (n) => String(n).padStart(2, "0");
const dateStr = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function batch(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase
      .from(table)
      .insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

// Vietnamese name parts
const HO = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Huỳnh","Phan","Vũ","Võ","Đặng","Bùi","Đỗ","Hồ","Ngô","Dương","Lý"];
const DEM_NAM = ["Văn","Đức","Minh","Quốc","Gia","Hoàng","Nhật","Đình","Quang","Anh"];
const DEM_NU = ["Thị","Ngọc","Thu","Diễm","Bảo","Kim","Yến","Thanh","Mai","Hồng"];
const TEN_NAM = ["Anh","Bảo","Châu","Dũng","Đạt","Huy","Hùng","Khoa","Kiên","Long","Minh","Nam","Phong","Phúc","Quân","Sơn","Tuấn","Tài","Thắng","Vinh"];
const TEN_NU = ["Anh","Ánh","Chi","Dương","Giang","Hà","Hương","Khuê","Linh","My","Ngân","Ngọc","Nhi","Nhung","Tâm","Trâm","Vy","Yến","Mai","Lan"];
function vnName(gender) {
  const ho = rand(HO);
  if (gender === "nam") return `${ho} ${rand(DEM_NAM)} ${rand(TEN_NAM)}`;
  return `${ho} ${rand(DEM_NU)} ${rand(TEN_NU)}`;
}

async function createAuthUser(email, password, role, full_name, school_id, department_id) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role, full_name, school_id, department_id },
  });
  if (error) {
    if (error.message.includes("already")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const u = list.users.find((x) => x.email === email);
      return u?.id;
    }
    throw new Error(`auth ${email}: ${error.message}`);
  }
  return data.user.id;
}

async function main() {
  console.log("Seeding Sổ Chủ Nhiệm Số...");

  // 1. Org
  const { data: school } = await supabase
    .from("schools")
    .upsert({ name: "THCS Nguyễn Du", code: "THCS-ND" }, { onConflict: "code" })
    .select()
    .single();
  const sid = school.id;
  console.log("school:", sid);

  const { data: year } = await supabase
    .from("academic_years")
    .upsert(
      { school_id: sid, name: "2026-2027", start_date: "2026-08-10", end_date: "2027-05-31", is_current: true },
      { onConflict: "school_id,name" },
    )
    .select()
    .single();
  const yid = year.id;

  const { data: deptTN } = await supabase.from("departments").insert({ name: "Tổ Tự nhiên", school_id: sid }).select().single();
  const { data: deptXH } = await supabase.from("departments").insert({ name: "Tổ Xã hội", school_id: sid }).select().single();

  // 2. Auth users / profiles
  console.log("creating auth users...");
  const demoUsers = [
    ["gvcn@demo.scn", "gvcn", "Phạm Thị Lan Anh", null],
    ["gvbm@demo.scn", "gvbm", "Trần Văn Minh", deptTN.id],
    ["totruong@demo.scn", "to_truong", "Lê Thị Hồng Hạnh", deptTN.id],
    ["bgh@demo.scn", "bgh", "Nguyễn Văn Hiệu Trưởng", null],
    ["sogd@demo.scn", "so_gd", "Vũ Quản Trị Sở", null],
    ["phuhuynh@demo.scn", "phu_huynh", "Nguyễn Văn Phụ Huynh", null],
    ["hocsinh@demo.scn", "hoc_sinh", "Nguyễn Gia Bảo", null],
  ];
  const uids = {};
  for (const [email, role, name, dept] of demoUsers) {
    uids[email] = await createAuthUser(email, "demo1234", role, name, role === "so_gd" ? null : sid, dept);
    if (role !== "so_gd")
      await supabase.from("profiles").update({ school_id: sid, department_id: dept }).eq("id", uids[email]);
  }
  console.log("demo users created");

  // Extra teachers (no login needed for most)
  const teacherProfiles = [];
  const gvcnNames = ["Phạm Thị Lan Anh","Nguyễn Văn Hoàng","Trần Thị Bích Ngọc","Lê Văn Đức","Hoàng Thị Mai","Vũ Đức Thắng","Đỗ Thị Hạnh","Bùi Văn Nam"];
  for (let i = 0; i < 8; i++) {
    const email = `gvcn${i + 1}@school.scn`;
    const id = await createAuthUser(email, "demo1234", "gvcn", gvcnNames[i], sid, rand([deptTN.id, deptXH.id]));
    if (i === 0) await supabase.from("profiles").update({ id: uids["gvcn@demo.scn"] }).eq("id", uids["gvcn@demo.scn"]); // noop
    teacherProfiles.push({ id, role: "gvcn", name: gvcnNames[i] });
  }
  // gvcn@demo.scn is class 8A2 teacher - reuse as one of the 8
  teacherProfiles[1] = { id: uids["gvcn@demo.scn"], role: "gvcn", name: "Phạm Thị Lan Anh" };
  // delete the extra auth user we made for slot 1 to avoid orphan? keep it, harmless.

  const SUBJECTS = ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Lịch sử","Địa lý","GDCD","Tin học","Thể dục","Âm nhạc","Mỹ thuật"];
  const subjectRows = SUBJECTS.map((name) => ({ school_id: sid, name }));
  await batch("subjects", subjectRows);
  const { data: subjects } = await supabase.from("subjects").select().eq("school_id", sid);
  const subByName = Object.fromEntries(subjects.map((s) => [s.name, s.id]));

  const gvbmIds = [uids["gvbm@demo.scn"]];
  for (let i = 0; i < 14; i++) {
    const id = await createAuthUser(`gvbm${i + 1}@school.scn`, "demo1234", "gvbm", vnName(i % 2 ? "nam" : "nu"), sid, rand([deptTN.id, deptXH.id]));
    gvbmIds.push(id);
  }
  const teacherSubjectPairs = [];
  gvbmIds.forEach((t, i) => {
    teacherSubjectPairs.push({ teacher_id: t, subject_id: subjects[i % subjects.length].id });
    if (i % 3 === 0) teacherSubjectPairs.push({ teacher_id: t, subject_id: subjects[(i + 5) % subjects.length].id });
  });
  await batch("teacher_subjects", teacherSubjectPairs);

  // 3. Classes
  const classNames = ["6A1","6A2","7A1","7A2","8A1","8A2","9A1","9A2"];
  const classRows = classNames.map((name, i) => ({
    school_id: sid, academic_year_id: yid, name,
    grade: parseInt(name[0]),
    gvcn_id: teacherProfiles[i]?.id ?? null,
    status: "active",
  }));
  await batch("classes", classRows);
  const { data: classes } = await supabase.from("classes").select().eq("academic_year_id", yid);
  const classByName = Object.fromEntries(classes.map((c) => [c.name, c]));
  console.log("classes:", classes.length);

  // 4. Groups + students + parents
  const allStudents = [];
  const groupRows = [];
  for (const c of classes) {
    for (let g = 1; g <= 4; g++) groupRows.push({ class_id: c.id, name: `Tổ ${g}` });
  }
  await batch("student_groups", groupRows);
  const { data: groups } = await supabase.from("student_groups").select();
  const groupsByClass = {};
  groups.forEach((g) => (groupsByClass[g.class_id] ??= []).push(g));

  const parentRows = [];
  const studentRows = [];
  let seq = 1;
  for (const c of classes) {
    const gs = groupsByClass[c.id];
    const n = 36 + (classNames.indexOf(c.name) % 3);
    for (let i = 0; i < n; i++) {
      const gender = chance(0.5) ? "nam" : "nu";
      const code = `HS${String(seq++).padStart(6, "0")}`;
      const student = {
        class_id: c.id, group_id: gs[i % 4].id, code,
        full_name: vnName(gender), gender,
        dob: `${2015 - parseInt(c.name[0]) + 6}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`,
        status: "active",
        positive_points: ri(0, 20),
      };
      studentRows.push(student);
      parentRows.push({
        full_name: vnName(chance(0.6) ? "nam" : "nu"),
        phone: `09${String(ri(10000000, 99999999))}`,
        relationship: rand(["bố", "mẹ", "ông/bà"]),
        _student_code: code,
      });
    }
  }
  await batch("parents", parentRows.map(({ _student_code, ...p }) => p));
  await batch("students", studentRows.map((s) => s));
  const { data: students } = await supabase.from("students").select();
  const { data: parents } = await supabase.from("parents").select();
  const studentByCode = Object.fromEntries(students.map((s) => [s.code, s]));
  const psRows = parents.map((p, i) => ({
    parent_id: p.id,
    student_id: studentByCode[parentRows[i]._student_code].id,
  }));
  await batch("parent_students", psRows);

  // Link demo parent + student
  const demoStudent = students.find((s) => s.class_id === classByName["8A2"].id);
  await supabase.from("parents").insert({
    profile_id: uids["phuhuynh@demo.scn"], full_name: "Nguyễn Văn Phụ Huynh",
    phone: "0901234567", relationship: "bố",
  }).select().single().then(async ({ data: dp }) => {
    await supabase.from("parent_students").insert({ parent_id: dp.id, student_id: demoStudent.id });
    await supabase.from("students").update({ full_name: "Nguyễn Gia Bảo" }).eq("id", demoStudent.id);
  });
  await supabase.from("students").update({ profile_id: uids["hocsinh@demo.scn"] }).eq("id", demoStudent.id);
  allStudents.push(...students);

  // 5. Class roles (BCS)
  const roleRows = [];
  for (const c of classes) {
    const ss = students.filter((s) => s.class_id === c.id);
    const roles = ["lop_truong", "lop_pho_hoc_tap", "lop_pho_van_nghe"];
    ss.slice(0, 3).forEach((s, i) => roleRows.push({ student_id: s.id, role: roles[i] }));
    groupsByClass[c.id].forEach((g, i) => {
      if (ss[3 + i]) roleRows.push({ student_id: ss[3 + i].id, role: "to_truong" });
    });
  }
  await batch("class_roles", roleRows);

  // 6. Timetable (Mon-Sat, 5 periods)
  const ttRows = [];
  for (const c of classes) {
    let si = classNames.indexOf(c.name);
    for (let wd = 2; wd <= 7; wd++) {
      for (let p = 1; p <= 5; p++) {
        const subj = subjects[(si + wd + p) % subjects.length];
        const teacher = teacherSubjectPairs.find((ts) => ts.subject_id === subj.id);
        ttRows.push({
          class_id: c.id, subject_id: subj.id, teacher_id: teacher?.teacher_id ?? null,
          weekday: wd, period: p, room: `P${c.name}`,
        });
      }
    }
  }
  await batch("timetable_entries", ttRows);
  const { data: timetable } = await supabase.from("timetable_entries").select();

  // 7. Grades (gk1 + ck1 hoc_ky for all subjects per student - ~2 rows/student/subject)
  const gradeRows = [];
  for (const s of students) {
    for (const subj of subjects.slice(0, 9)) {
      for (const term of ["gk1", "ck1"]) {
        gradeRows.push({
          student_id: s.id, subject_id: subj.id, term,
          assessment_type: "hoc_ky",
          score: Math.min(10, Math.max(3, 5.5 + (Math.random() * 4.5) - (chance(0.12) ? 2 : 0))).toFixed(1) * 1,
        });
      }
    }
  }
  await batch("grades", gradeRows.map((g) => ({ ...g, score: Math.round(g.score * 10) / 10 })));

  // 8. Attendance - last 45 school days
  const attRows = [];
  const today = new Date("2026-09-18");
  for (let d = 40; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    if (day.getDay() === 0) continue;
    for (const s of students) {
      const r = Math.random();
      const status = r < 0.94 ? "present" : r < 0.965 ? "excused" : r < 0.985 ? "late" : "unexcused";
      attRows.push({ student_id: s.id, date: dateStr(day), status, source: "manual" });
    }
  }
  await batch("attendance_records", attRows);

  // 9. Conduct records + evaluations
  const crRows = [];
  for (const s of students) {
    if (chance(0.15)) crRows.push({ student_id: s.id, type: "khen_thuong", content: "Tích cực phát biểu, giúp đỡ bạn bè", points: 5, date: dateStr(new Date(today.getTime() - ri(1, 30) * 864e5)) });
    if (chance(0.1)) crRows.push({ student_id: s.id, type: "vi_pham", content: rand(["Đi học muộn", "Không làm bài tập", "Nói chuyện trong giờ", "Quên đồng phục"]), points: -3, date: dateStr(new Date(today.getTime() - ri(1, 30) * 864e5)) });
    if (chance(0.08)) crRows.push({ student_id: s.id, type: "nhan_xet", content: "Có tiến bộ rõ rệt trong tháng qua", points: 0, date: dateStr(new Date(today.getTime() - ri(1, 20) * 864e5)) });
  }
  await batch("conduct_records", crRows);
  const ceRows = students.map((s) => ({
    student_id: s.id, term: "hk1",
    rating: rand(["tot", "tot", "tot", "kha", "kha", "trung_binh"]),
    comment: null,
  }));
  await batch("conduct_evaluations", ceRows);

  // 10. Incidents
  const incidentTypes = ["Va chạm nhẹ trong giờ thể dục", "Bị bạn bè trong lớp trách", "Trượt ngã ở hành lang", "Đau bụng trong giờ học", "Mâu thuẫn với bạn cùng tổ"];
  const incRows = [];
  for (let i = 0; i < 8; i++) {
    const c = rand(classes);
    const ss = students.filter((s) => s.class_id === c.id);
    incRows.push({
      student_id: rand(ss).id, class_id: c.id,
      type: incidentTypes[i % incidentTypes.length],
      severity: rand(["low", "low", "medium", "medium", "high"]),
      status: rand(["resolved", "following", "new"]),
      description: "Sự cố được ghi nhận và xử lý theo quy trình của nhà trường.",
      reported_to_bgh: chance(0.6),
      occurred_at: new Date(today.getTime() - ri(0, 50) * 864e5).toISOString(),
    });
  }
  await batch("incidents", incRows);

  // 11. Activities
  const actRows = [];
  const actTitles = ["Sinh hoạt chủ đề An toàn giao thông", "Tham quan Bảo tàng Lịch sử", "Ngày hội việc tốt", "Chủ nhật xanh - vệ sinh trường", "Sinh hoạt truyền thống 20/11"];
  for (const c of classes.slice(0, 5)) {
    actRows.push({
      class_id: c.id, title: rand(actTitles),
      description: "Hoạt động giáo dục ngoài giờ lên lớp",
      activity_date: dateStr(new Date(today.getTime() + ri(-20, 30) * 864e5)),
      status: rand(["approved", "done", "pending"]),
    });
  }
  await batch("activities", actRows);

  // 12. Announcements + notifications
  const annRows = [];
  for (const c of classes.slice(0, 6)) {
    const ss = students.filter((s) => s.class_id === c.id);
    annRows.push({ sender_id: c.gvcn_id ?? uids["bgh@demo.scn"], class_id: c.id, title: "Thông báo lịch sinh hoạt lớp", content: "Kính gửi quý phụ huynh lịch sinh hoạt lớp cuối tuần này." });
    if (chance(0.7)) annRows.push({ sender_id: c.gvcn_id ?? uids["bgh@demo.scn"], class_id: c.id, student_id: rand(ss).id, title: "Thông báo về tình hình học tập", content: "Em có dấu hiệu sa sút, đề nghị gia đình phối hợp." });
  }
  await batch("announcements", annRows);

  const notifRows = [];
  for (const [email, uid] of Object.entries(uids)) {
    for (let i = 0; i < ri(2, 4); i++) {
      notifRows.push({
        profile_id: uid, type: rand(["announcement", "task", "incident", "grade"]),
        title: rand(["Thông báo mới từ GVCN", "Công việc sắp đến hạn", "Sự cố mới cần xử lý", "Điểm mới được cập nhật", "Phụ huynh xin phép nghỉ"]),
        body: "Nội dung chi tiết thông báo demo.",
        read_at: chance(0.5) ? new Date().toISOString() : null,
      });
    }
  }
  await batch("notifications", notifRows);

  // 13. Seating charts (8x5 grid)
  const seatRows = [];
  for (const c of classes) {
    const ss = students.filter((s) => s.class_id === c.id);
    const seats = [];
    ss.forEach((s, i) => seats.push({ x: i % 8, y: Math.floor(i / 8), student_id: s.id }));
    seatRows.push({
      class_id: c.id, month: "2026-09-01", version: 1, is_current: true,
      layout: { cols: 8, rows: 5, seats },
    });
    seatRows.push({
      class_id: c.id, month: "2026-08-01", version: 1, is_current: false,
      layout: { cols: 8, rows: 5, seats: seats.slice().reverse().map((s, i) => ({ ...s, x: i % 8, y: Math.floor(i / 8) })) },
    });
  }
  await batch("seating_charts", seatRows);

  // 14. School year events + suggested tasks
  const syeRows = [
    { school_id: sid, academic_year_id: yid, title: "Khai giảng năm học mới", event_date: "2026-09-05", month: 9, category: "su_kien" },
    { school_id: sid, academic_year_id: yid, title: "Kiểm tra giữa kỳ I", event_date: "2026-10-20", month: 10, category: "kiem_tra" },
    { school_id: sid, academic_year_id: yid, title: "Ngày Nhà giáo Việt Nam 20/11", event_date: "2026-11-20", month: 11, category: "su_kien" },
    { school_id: sid, academic_year_id: yid, title: "Thi học kỳ I", event_date: "2026-12-25", month: 12, category: "kiem_tra" },
    { school_id: sid, academic_year_id: yid, title: "Sơ kết học kỳ I", event_date: "2027-01-10", month: 1, category: "bao_cao" },
    { school_id: sid, academic_year_id: yid, title: "Kiểm tra giữa kỳ II", event_date: "2027-03-15", month: 3, category: "kiem_tra" },
    { school_id: sid, academic_year_id: yid, title: "Thi học kỳ II", event_date: "2027-05-10", month: 5, category: "kiem_tra" },
  ];
  await batch("school_year_events", syeRows);
  const taskRows = syeRows.slice(0, 5).flatMap((e) => [
    { class_id: null, title: `Chuẩn bị: ${e.title}`, due_date: e.event_date, month: e.month, source: "suggested", status: "pending" },
    { class_id: classes[5].id, title: `${e.title} - kế hoạch lớp 8A2`, due_date: e.event_date, month: e.month, source: "suggested", status: rand(["pending", "approved"]) },
  ]);
  await batch("tasks", taskRows);

  // 15. KPIs + signoffs
  await batch("kpis", classes.map((c) => ({
    class_id: c.id, period: "2026-HK1",
    content: { chuyen_can: "≥95%", ty_le_kha: "≥60%", vi_pham: "≤2 HS" },
    status: rand(["registered", "approved"]),
  })));
  await batch("register_signoffs", classes.map((c) => ({
    class_id: c.id, period: "2026-09", type: "so_chu_nhiem",
    status: rand(["pending", "signed"]),
  })));

  // 16. Emulation
  const critRows = [
    { school_id: sid, name: "Chuyên cần", max_score: 30, category: "nep" },
    { school_id: sid, name: "Học tập", max_score: 30, category: "hoc_tap" },
    { school_id: sid, name: "Vệ sinh & nề nếp", max_score: 20, category: "nep" },
    { school_id: sid, name: "Hoạt động phong trào", max_score: 20, category: "phong_trao" },
  ];
  await batch("emulation_criteria", critRows);
  const { data: crits } = await supabase.from("emulation_criteria").select();
  const esRows = [];
  for (const c of classes) {
    for (const cr of crits) {
      esRows.push({
        class_id: c.id, criterion_id: cr.id, period: "2026-T9",
        score: Math.round(cr.max_score * (0.7 + Math.random() * 0.28)),
      });
    }
  }
  await batch("emulation_scores", esRows);

  // 17. Support plans + counseling + appointments + messages
  const weak = students.slice(0, 12);
  await batch("support_plans", weak.map((s) => ({
    student_id: s.id, subject_id: rand(subjects).id,
    reason: "Điểm trung bình môn dưới 5.0", plan: "Phụ đạo 2 buổi/tuần, giao bài tập bổ sung",
    status: rand(["pending", "approved", "in_progress"]),
  })));
  await batch("counseling_cases", students.slice(10, 18).map((s) => ({
    student_id: s.id, issue: rand(["Dấu hiệu chán học", "Xung đột với bạn bè", "Hoàn cảnh gia đình khó khăn", "Áp lực điểm số"]),
    severity: rand(["low", "medium", "medium"]),
    status: rand(["new", "assessing", "counseling"]),
  })));
  const demoParent = await supabase.from("parents").select().eq("profile_id", uids["phuhuynh@demo.scn"]).single();
  await batch("appointments", [
    { parent_id: demoParent.data.id, teacher_id: uids["gvcn@demo.scn"], student_id: demoStudent.id, scheduled_at: "2026-10-05T16:30:00Z", purpose: "Trao đổi về tình hình học tập", status: "confirmed" },
    { parent_id: parents[0].id, teacher_id: classes[0].gvcn_id, student_id: students[0].id, scheduled_at: "2026-10-08T15:00:00Z", purpose: "Sinh hoạt phụ huynh đầu năm", status: "proposed" },
  ]);
  await batch("messages", [
    { sender_id: uids["phuhuynh@demo.scn"], recipient_id: uids["gvcn@demo.scn"], student_id: demoStudent.id, content: "Cô ơi, cháu hôm nay bị sốt nên xin nghỉ ạ." },
    { sender_id: uids["gvcn@demo.scn"], recipient_id: uids["phuhuynh@demo.scn"], student_id: demoStudent.id, content: "Vâng, gia đình cho cháu nghỉ dưỡng. Tôi đã ghi nhận phép." },
  ]);

  // 18. Teacher assessments + dept meetings
  await batch("teacher_assessments", [
    { teacher_id: uids["gvcn@demo.scn"], academic_year_id: yid, self_review: "Hoàn thành tốt nhiệm vụ chủ nhiệm", plan: "Nâng cao kỹ năng tư vấn học sinh", status: "submitted" },
    { teacher_id: uids["gvbm@demo.scn"], academic_year_id: yid, self_review: "Đảm bảo tiến độ giảng dạy", plan: "Ứng dụng CNTT nhiều hơn", status: "draft" },
  ]);
  await batch("dept_meetings", [
    { department_id: deptTN.id, title: "Sinh hoạt chuyên môn tháng 9", meeting_date: "2026-09-15", content: "Thống nhất kế hoạch kiểm tra giữa kỳ I", created_by: uids["totruong@demo.scn"] },
    { department_id: deptXH.id, title: "Họp tổ đầu năm", meeting_date: "2026-09-08", content: "Phân công dự giờ, thao giảng", created_by: null },
  ]);
  await batch("school_year_events", []);
  await batch("student_record_history", students.slice(0, 10).map((s) => ({
    student_id: s.id, changed_by: classByName[classNames.find((n) => classByName[n].id === s.class_id)].gvcn_id,
    field: "address", old_value: "Chưa cập nhật", new_value: "Đã cập nhật địa chỉ mới",
  })));

  // 19. Period logs (sổ đầu bài) for today
  const plRows = [];
  const todayStr = "2026-09-18";
  const wd = 5; // Friday
  const todayTT = timetable.filter((t) => t.weekday === wd);
  for (const t of todayTT.slice(0, 20)) {
    plRows.push({
      timetable_entry_id: t.id, date: todayStr,
      logged_by: t.teacher_id, present_count: ri(33, 38),
      note: null,
    });
  }
  await batch("period_logs", plRows);
  const { data: plogs } = await supabase.from("period_logs").select().eq("date", todayStr);
  const paRows = [];
  for (const pl of plogs.slice(0, 8)) {
    const tt = timetable.find((t) => t.id === pl.timetable_entry_id);
    const ss = students.filter((s) => s.class_id === tt.class_id);
    for (const s of ss.slice(0, ri(1, 3))) {
      paRows.push({ period_log_id: pl.id, student_id: s.id, status: rand(["excused", "unexcused", "late"]) });
    }
  }
  await batch("period_absences", paRows);

  console.log("\n✅ Seed complete!");
  console.log("Demo accounts (password: demo1234):");
  demoUsers.forEach(([e, r]) => console.log(`  ${r.padEnd(10)} ${e}`));
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
