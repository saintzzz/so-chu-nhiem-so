#!/usr/bin/env node
/**
 * Bootstrap demo data for Sổ Chủ Nhiệm Số (post-wipe).
 *
 * Tạo lại cấu trúc tối thiểu mà UI chưa có màn hình onboarding:
 *   classes, student_groups, students, parents, parent_students, class_roles,
 *   teacher_subjects, timetable_entries, support_staff, school_year_events.
 *
 * Yêu cầu: .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * Chạy: node scripts/bootstrap-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rand = (arr) => arr[ri(0, arr.length - 1)];
const pad = (n) => String(n).padStart(2, "0");

const HO = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Huỳnh","Phan","Vũ","Võ","Đặng","Bùi","Đỗ","Hồ","Ngô","Dương","Lý"];
const DEM_NAM = ["Văn","Đức","Minh","Quốc","Gia","Hoàng","Thanh","Anh","Tuấn","Hữu"];
const DEM_NU = ["Thị","Thu","Ngọc","Thanh","Minh","Hồng","Phương","Mai","Kim","Anh"];
const TEN_NAM = ["Anh","Bảo","Châu","Dũng","Đạt","Huy","Hùng","Khoa","Kiên","Long","Minh","Nam","Phong","Phúc","Quân","Sơn","Tuấn","Tài","Thắng","Vinh"];
const TEN_NU = ["Anh","Ánh","Chi","Dương","Giang","Hà","Hương","Khuê","Linh","My","Ngân","Ngọc","Nhi","Nhung","Tâm","Trâm","Vy","Yến","Mai","Lan"];
function vnName(gender) {
  const ho = rand(HO);
  if (gender === "nam") return `${ho} ${rand(DEM_NAM)} ${rand(TEN_NAM)}`;
  return `${ho} ${rand(DEM_NU)} ${rand(TEN_NU)}`;
}

async function batch(table, rows, chunk = 200) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: +${rows.length}`);
}

// Phân bổ tiết/tuần theo cấp học (tổng ~30 tiết)
const WEEKLY_THCS = {
  "Toán": 5, "Ngữ văn": 5, "Tiếng Anh": 4, "Vật lý": 2, "Hóa học": 2,
  "Sinh học": 2, "Lịch sử": 2, "Địa lý": 2, "GDCD": 1, "Tin học": 2,
  "Thể dục": 2, "Âm nhạc": 1, "Mỹ thuật": 1,
};
const WEEKLY_TH = {
  "Tiếng Việt": 8, "Toán": 6, "Đạo đức": 2, "Tự nhiên và Xã hội": 2,
  "Khoa học": 2, "Lịch sử và Địa lý": 2, "Tin học và Công nghệ": 1,
  "Tiếng Anh": 2, "Âm nhạc": 1, "Mĩ thuật": 1, "Thể dục": 2,
  "Hoạt động trải nghiệm": 1,
};

async function bootstrapSchool({ schoolId, yearId, classDefs, weeklyPlan, codePrefix, yearOfBirthBase, campusFor }) {
  console.log(`\n=== Bootstrap school ${schoolId} ===`);

  const { data: subjects } = await supabase.from("subjects").select().eq("school_id", schoolId);
  const subjectByName = Object.fromEntries(subjects.map((s) => [s.name, s]));
  const planSubjects = Object.keys(weeklyPlan).filter((n) => subjectByName[n]);
  const missing = Object.keys(weeklyPlan).filter((n) => !subjectByName[n]);
  if (missing.length) console.warn("  ! thiếu môn:", missing.join(", "));

  // 1. Classes
  const classRows = classDefs.map((d) => ({
    school_id: schoolId, academic_year_id: yearId, name: d.name,
    grade: d.grade, gvcn_id: d.gvcnId, status: "active",
    campus_id: campusFor ? campusFor(d.name) : null,
  }));
  await batch("classes", classRows);
  const { data: classes } = await supabase.from("classes").select().eq("academic_year_id", yearId);
  const classByName = Object.fromEntries(classes.map((c) => [c.name, c]));

  // 2. Groups
  const groupRows = [];
  for (const c of classes) for (let g = 1; g <= 4; g++) groupRows.push({ class_id: c.id, name: `Tổ ${g}` });
  await batch("student_groups", groupRows);
  const { data: groups } = await supabase.from("student_groups").select();
  const groupsByClass = {};
  groups.forEach((g) => (groupsByClass[g.class_id] ??= []).push(g));

  // 3. Students + parents
  const studentRows = [], parentRows = [];
  let seq = 1;
  for (const c of classes) {
    const gs = groupsByClass[c.id];
    const n = classDefs.find((d) => d.name === c.name)?.size ?? 30;
    for (let i = 0; i < n; i++) {
      const gender = Math.random() < 0.5 ? "nam" : "nu";
      const code = `${codePrefix}${String(seq++).padStart(6, "0")}`;
      const grade = Number(c.grade);
      studentRows.push({
        class_id: c.id, group_id: gs[i % 4].id, code,
        full_name: vnName(gender), gender,
        dob: `${yearOfBirthBase - grade + 6}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`,
        national_id: `001${String(200000000 + seq)}`,
        status: "active", positive_points: ri(0, 15),
      });
      parentRows.push({
        full_name: vnName(Math.random() < 0.6 ? "nam" : "nu"),
        phone: `09${String(ri(10000000, 99999999))}`,
        email: `${code.toLowerCase()}.ph@demo.scn`,
        relationship: rand(["bố", "mẹ", "ông/bà"]),
        _code: code,
      });
    }
  }
  await batch("parents", parentRows.map((r) => { const p = { ...r }; delete p._code; return p; }));
  await batch("students", studentRows);
  const { data: students } = await supabase.from("students").select();
  const { data: parents } = await supabase.from("parents").select();
  const studentByCode = Object.fromEntries(students.map((s) => [s.code, s]));
  const parentByEmail = Object.fromEntries(parents.map((p) => [p.email, p]));
  await batch("parent_students", parentRows.map((p) => ({
    parent_id: parentByEmail[`${p._code.toLowerCase()}.ph@demo.scn`].id,
    student_id: studentByCode[p._code].id,
  })));

  // 4. Class roles (BCS)
  const roleRows = [];
  for (const c of classes) {
    const ss = students.filter((s) => s.class_id === c.id);
    ["lop_truong", "lop_pho_hoc_tap", "lop_pho_van_nghe"].forEach((r, i) => {
      if (ss[i]) roleRows.push({ student_id: ss[i].id, role: r });
    });
    groupsByClass[c.id].forEach((g, i) => {
      if (ss[3 + i]) roleRows.push({ student_id: ss[3 + i].id, role: "to_truong" });
    });
  }
  await batch("class_roles", roleRows);

  // 5. teacher_subjects: mỗi GVBM 1-2 môn trong plan
  const { data: teachers } = await supabase
    .from("profiles").select("id,full_name").eq("school_id", schoolId)
    .in("role", ["gvbm", "gvcn", "to_truong"]);
  const teacherRows = [];
  const teacherBySubject = {};
  teachers.forEach((t, i) => {
    const subj = planSubjects[i % planSubjects.length];
    teacherRows.push({ teacher_id: t.id, subject_id: subjectByName[subj].id });
    (teacherBySubject[subj] ??= []).push(t.id);
    if (i % 3 === 0 && planSubjects.length > 1) {
      const subj2 = planSubjects[(i + 4) % planSubjects.length];
      teacherRows.push({ teacher_id: t.id, subject_id: subjectByName[subj2].id });
      (teacherBySubject[subj2] ??= []).push(t.id);
    }
  });
  await batch("teacher_subjects", teacherRows);

  // 6. Timetable: T2-T7 × 5 tiết, xoay vòng môn theo weekly plan
  const ttRows = [];
  for (const c of classes) {
    const slots = [];
    for (const [name, count] of Object.entries(weeklyPlan)) {
      if (!subjectByName[name]) continue;
      for (let k = 0; k < count; k++) slots.push(subjectByName[name].id);
    }
    while (slots.length < 30) slots.push(subjectByName[planSubjects[0]].id);
    let si = 0;
    for (let wd = 2; wd <= 7; wd++) {
      for (let p = 1; p <= 5; p++) {
        const subjectId = slots[si % slots.length]; si += 3; // trộn
        const subjName = subjects.find((s) => s.id === subjectId)?.name;
        const pool = teacherBySubject[subjName] ?? teachers.map((t) => t.id);
        ttRows.push({
          class_id: c.id, subject_id: subjectId,
          teacher_id: pool[(si + wd + p) % pool.length],
          weekday: wd, period: p, room: `P.${grade_room(c.grade)}${p}`,
        });
      }
    }
  }
  await batch("timetable_entries", ttRows);
  return { classes, students, classByName };
}
function grade_room(g) { return `${g}0`; }

async function main() {
  console.log("Bootstrap demo data...");
  const { data: schools } = await supabase.from("schools").select();
  const thcs = schools.find((s) => s.level === "thcs");
  const th = schools.find((s) => s.level === "th");
  const { data: years } = await supabase.from("academic_years").select().eq("is_current", true);
  const { data: campuses } = await supabase.from("campuses").select();
  const { data: profiles } = await supabase.from("profiles").select("id,email,role,school_id");

  const uid = (email) => profiles.find((p) => p.email === email)?.id ?? null;
  const campusTT = campuses.find((c) => c.name.includes("Trung tâm"))?.id;
  const campusBM = campuses.find((c) => c.name.includes("Bản Mới"))?.id;
  const campusTH = campuses.find((c) => c.name.includes("chính"))?.id;

  // ---- THCS Nguyễn Du: 8 lớp (9A2 ở phân hiệu Bản Mới cho PHT demo) ----
  const thcsDefs = [
    { name: "6A1", grade: 6, gvcnId: uid("gvcn1@school.scn"), size: 34 },
    { name: "6A2", grade: 6, gvcnId: uid("gvcn2@school.scn"), size: 34 },
    { name: "7A1", grade: 7, gvcnId: uid("gvcn3@school.scn"), size: 33 },
    { name: "7A2", grade: 7, gvcnId: uid("gvcn4@school.scn"), size: 33 },
    { name: "8A1", grade: 8, gvcnId: uid("gvcn5@school.scn"), size: 32 },
    { name: "8A2", grade: 8, gvcnId: uid("gvcn@demo.scn"), size: 32 },
    { name: "9A1", grade: 9, gvcnId: uid("gvcn7@school.scn"), size: 31 },
    { name: "9A2", grade: 9, gvcnId: uid("gvcn8@school.scn"), size: 31 },
  ];
  const r1 = await bootstrapSchool({
    schoolId: thcs.id, yearId: years.find((y) => y.school_id === thcs.id).id,
    classDefs: thcsDefs, weeklyPlan: WEEKLY_THCS, codePrefix: "HS",
    yearOfBirthBase: 2015,
    campusFor: (name) => (name === "9A2" ? campusBM : campusTT),
  });

  // ---- Tiểu học Chu Văn An: 3 lớp ----
  const thDefs = [
    { name: "1A", grade: 1, gvcnId: uid("gvcn-th2@school.scn"), size: 25 },
    { name: "3A", grade: 3, gvcnId: uid("gvcn-th@demo.scn"), size: 25 },
    { name: "5A", grade: 5, gvcnId: uid("gvcn-th3@school.scn"), size: 24 },
  ];
  const r2 = await bootstrapSchool({
    schoolId: th.id, yearId: years.find((y) => y.school_id === th.id).id,
    classDefs: thDefs, weeklyPlan: WEEKLY_TH, codePrefix: "TH",
    yearOfBirthBase: 2019,
    campusFor: () => campusTH,
  });

  // ---- Link tài khoản demo PH/HS vào HS thật ----
  const bao = r1.students.find((s) => s.class_id === r1.classByName["8A2"].id);
  await supabase.from("students").update({ full_name: "Nguyễn Gia Bảo", profile_id: uid("hocsinh@demo.scn") }).eq("id", bao.id);
  const { data: p1 } = await supabase.from("parents").insert({
    profile_id: uid("phuhuynh@demo.scn"), full_name: "Nguyễn Văn Phụ Huynh",
    phone: "0901234567", email: "phuhuynh@demo.scn", relationship: "bố",
  }).select().single();
  const { data: p2 } = await supabase.from("parents").insert({
    profile_id: uid("phuhuynh2@demo.scn"), full_name: "Nguyễn Thị Mai Lan",
    phone: "0901234568", email: "phuhuynh2@demo.scn", relationship: "mẹ",
  }).select().single();
  await batch("parent_students", [
    { parent_id: p1.id, student_id: bao.id },
    { parent_id: p2.id, student_id: bao.id },
  ]);

  const thKid = r2.students.find((s) => s.class_id === r2.classByName["3A"].id);
  await supabase.from("students").update({ full_name: "Trần Minh Khang", profile_id: uid("hocsinh-th@demo.scn") }).eq("id", thKid.id);
  const { data: pth } = await supabase.from("parents").insert({
    profile_id: uid("phuhuynh-th@demo.scn"), full_name: "Trần Văn Phụ Huynh TH",
    phone: "0901234569", email: "phuhuynh-th@demo.scn", relationship: "bố",
  }).select().single();
  await batch("parent_students", [{ parent_id: pth.id, student_id: thKid.id }]);

  // ---- Support staff + sự kiện năm học ----
  await batch("support_staff", [
    { school_id: thcs.id, campus_id: campusTT, full_name: "Nguyễn Thị Văn Thư", position: "Văn thư", qualification: "CĐ Văn thư lưu trữ", standardized: true },
    { school_id: thcs.id, campus_id: campusTT, full_name: "Trần Văn Y Tế", position: "Nhân viên y tế", qualification: "Y sĩ đa khoa", standardized: true },
    { school_id: th.id, campus_id: campusTH, full_name: "Lê Thị Hồng", position: "Văn thư", qualification: "CĐ Văn thư", standardized: false },
  ]);

  const yid1 = years.find((y) => y.school_id === thcs.id).id;
  const yid2 = years.find((y) => y.school_id === th.id).id;
  const evs = [
    ["Lễ khai giảng năm học mới", "2026-09-05", 9, "su_kien"],
    ["Kiểm tra giữa kỳ I", "2026-10-26", 10, "kiem_tra"],
    ["Họp phụ huynh lần 1", "2026-10-17", 10, "hop_phu_huynh"],
    ["Ngày Nhà giáo Việt Nam 20/11", "2026-11-20", 11, "su_kien"],
    ["Kiểm tra cuối kỳ I", "2027-01-05", 1, "kiem_tra"],
    ["Lễ tổng kết năm học", "2027-05-25", 5, "su_kien"],
  ];
  await batch("school_year_events", [
    ...evs.map(([title, d, m, c]) => ({ school_id: thcs.id, academic_year_id: yid1, title, event_date: d, month: m, category: c })),
    ...evs.map(([title, d, m, c]) => ({ school_id: th.id, academic_year_id: yid2, title, event_date: d, month: m, category: c })),
  ]);

  console.log("\nDone. Students:", r1.students.length + r2.students.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
