/**
 * CR-036: wipe demo scn data + seed bo du lieu sat thuc te cho 3 truong.
 *
 *   node scripts/seed-real-demo.mjs          # wipe + seed
 *   node scripts/seed-real-demo.mjs --wipe   # chi wipe
 *
 * Can .env.local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * KHONG dong vao: tvc_* content (chi reassign owner), users @students.ioe-practice.example, org_units.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const WIPE_ONLY = process.argv.includes("--wipe");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PASS = "demo1234";
const S = {
  nd: "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285",
  cva: "31d29038-cb2c-4c52-b245-a47afc4bd45b",
  kd: "e296f4d3-59ff-43b8-b880-f4316e4f8082",
};
const SIDS = Object.values(S);
const DEMO_EMAIL_RE = /@(demo\.scn|school\.scn|nd\.test|cva\.test|kd\.test|nd\.scn|cva\.scn|kd\.scn)$/;

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const ri = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const chance = (p) => Math.random() < p;
const pad = (n) => String(n).padStart(2, "0");
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const slug = (s) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");

// ---------------- name helpers ----------------
const HO = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Huỳnh","Phan","Vũ","Võ","Đặng","Bùi","Đỗ","Hồ","Ngô","Dương","Lý"];
const DEM_NAM = ["Văn","Đức","Minh","Quốc","Gia","Hoàng","Nhật","Đình","Quang","Anh","Hữu","Xuân"];
const DEM_NU = ["Thị","Ngọc","Thu","Diễm","Bảo","Kim","Yến","Thanh","Mai","Hồng","Phương"];
const TEN_NAM = ["Anh","Bảo","Châu","Dũng","Đạt","Huy","Hùng","Khoa","Kiên","Long","Minh","Nam","Phong","Phúc","Quân","Sơn","Tuấn","Tài","Thắng","Vinh","Duy","Hiệp","Trí"];
const TEN_NU = ["Anh","Ánh","Chi","Dương","Giang","Hà","Hương","Khuê","Linh","My","Ngân","Ngọc","Nhi","Nhung","Tâm","Trâm","Vy","Yến","Lan","Hạnh","Thảo","Hằng","Vân"];
function vnName(gender) {
  if (gender === "nam") return `${rand(HO)} ${rand(DEM_NAM)} ${rand(TEN_NAM)}`;
  return `${rand(HO)} ${rand(DEM_NU)} ${rand(TEN_NU)}`;
}

// ---------------- db helpers ----------------
async function batch(table, rows, size = 400) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`    ${table}: ${rows.length}`);
}

async function ids(table, col, filterCol, vals) {
  const out = [];
  for (let i = 0; i < vals.length; i += 200) {
    for (let off = 0; ; off += 1000) {
      const { data } = await sb.from(table).select(col)
        .in(filterCol, vals.slice(i, i + 200)).range(off, off + 999);
      if (!data?.length) break;
      out.push(...data.map((r) => r[col]));
      if (data.length < 1000) break;
    }
  }
  return [...new Set(out)];
}

async function delIn(table, col, vals) {
  if (!vals.length) return;
  for (let i = 0; i < vals.length; i += 200) {
    const { error } = await sb.from(table).delete().in(col, vals.slice(i, i + 200));
    if (error) throw new Error(`del ${table}: ${error.message}`);
  }
  console.log(`    del ${table} (${col} <- ${vals.length})`);
}

let authList = null;
async function findAuthUser(email) {
  authList ??= await (async () => {
    const all = [];
    for (let page = 1; ; page++) {
      const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (!data?.users?.length) break;
      all.push(...data.users);
      if (data.users.length < 1000) break;
    }
    return all;
  })();
  return authList.find((u) => u.email === email);
}

async function waitProfile(uid) {
  // trigger tao profile khong dong bo - cho den khi row ton tai
  for (let i = 0; i < 30; i++) {
    const { data } = await sb.from("profiles").select("id").eq("id", uid).maybeSingle();
    if (data) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`profile ${uid} khong duoc tao boi trigger`);
}

async function applyProfile(uid, email, meta) {
  await waitProfile(uid);
  const payload = {
    role: meta.role, school_id: meta.school_id ?? null, department_id: meta.department_id ?? null,
    campus_id: meta.campus_id ?? null, org_unit_id: meta.org_unit_id ?? null,
    full_name: meta.full_name, email,
    staff_code: meta.staff_code ?? null, employment_type: meta.employment_type ?? null,
    qualification: meta.qualification ?? null, concurrent_roles: meta.concurrent_roles ?? [],
  };
  const { error } = await sb.from("profiles").update(payload).eq("id", uid).select("id");
  if (error) throw new Error(`profile update ${email}: ${error.message}`);
  await new Promise((r) => setTimeout(r, 40));
  return uid;
}

async function ensureUser(email, meta) {
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASS, email_confirm: true, app_metadata: meta,
  });
  if (!error) return applyProfile(data.user.id, email, meta);
  if (error.message.includes("already")) {
    const u = await findAuthUser(email);
    if (u) return applyProfile(u.id, email, meta);
    const { data: p } = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
    if (p) return applyProfile(p.id, email, meta);
  }
  throw new Error(`auth ${email}: ${error.message}`);
}

// ================= WIPE =================
async function wipe() {
  console.log("WIPE demo data...");
  // scope ids (lay truoc khi xoa)
  const { data: profs } = await sb.from("profiles").select("id,email").or(
    `school_id.in.(${SIDS.join(",")}),email.like.%@demo.scn,email.like.%@school.scn,email.like.%@nd.test,email.like.%@cva.test,email.like.%@kd.test,email.like.%@nd.scn,email.like.%@cva.scn,email.like.%@kd.scn`,
  );
  const pids = (profs ?? []).map((p) => p.id);
  const oldUids = pids.slice();
  console.log(`  profiles to remove: ${pids.length}`);

  const classIds = await ids("classes", "id", "school_id", SIDS);
  const studentIds = await ids("students", "id", "class_id", classIds);
  const deptIds = await ids("departments", "id", "school_id", SIDS);
  const tteIds = await ids("timetable_entries", "id", "class_id", classIds);
  const actIds = await ids("activities", "id", "class_id", classIds);
  const annIds = await ids("announcements", "id", "class_id", classIds);
  const examIds = await ids("exams", "id", "school_id", SIDS);
  const yearIds = await ids("academic_years", "id", "school_id", SIDS);
  const assessIds = await ids("teacher_assessments", "id", "teacher_id", pids);
  const parentIds = [
    ...(await ids("parent_students", "parent_id", "student_id", studentIds)),
    ...(await ids("parents", "id", "profile_id", pids)),
  ];

  // leaf -> root
  await delIn("announcement_reads", "announcement_id", annIds);
  await delIn("digest_deliveries", "parent_id", parentIds);
  await delIn("activity_attendance", "activity_id", actIds);
  await delIn("activity_attendance", "student_id", studentIds);
  await delIn("assessment_evidence", "assessment_id", assessIds);
  await delIn("notifications", "profile_id", pids);
  await delIn("messages", "sender_id", pids);
  await delIn("messages", "recipient_id", pids);
  await delIn("ai_jobs", "created_by", pids);
  await delIn("tvc_ai_jobs", "created_by", pids);
  await delIn("tvc_generations", "user_id", pids);
  for (const t of ["class_roles","attendance_records","grades","conduct_records","conduct_evaluations",
    "competency_evaluations","nlpc_comments","counseling_cases","support_plans","parent_students",
    "period_absences","student_record_history","early_warnings","incidents"])
    await delIn(t, "student_id", studentIds);
  await delIn("early_warnings", "school_id", SIDS);
  await delIn("incidents", "class_id", classIds);
  await delIn("cmhs_members", "class_id", classIds);
  await delIn("cmhs_members", "parent_id", parentIds);
  await delIn("appointments", "parent_id", parentIds);
  await delIn("appointments", "teacher_id", pids);
  for (const t of ["daily_reports","kpis","register_signoffs","seating_charts","student_groups",
    "tasks","emulation_scores","announcements","lesson_plans","substitute_requests","exam_sessions"])
    await delIn(t, "class_id", classIds);
  await delIn("lesson_plans", "school_id", SIDS);
  await delIn("exam_sessions", "exam_id", examIds);
  await delIn("period_logs", "timetable_entry_id", tteIds);
  await delIn("period_logs", "logged_by", pids);
  await delIn("timetable_entries", "class_id", classIds);
  await delIn("activities", "class_id", classIds);
  for (const t of ["exams","emulation_criteria","school_kpis","equipment","support_staff",
    "tt15_evaluations","feature_grants","item_acl","school_year_events","substitute_requests",
    "announcements","early_warnings"])
    await delIn(t, "school_id", SIDS);
  await delIn("teacher_assessments", "teacher_id", pids);
  await delIn("teacher_subjects", "teacher_id", pids);
  await delIn("dept_meetings", "department_id", deptIds);
  await delIn("audit_logs", "actor_id", pids);
  // du phong: cac bang con tro toi profiles (task cap truong khong co class_id, v.v.)
  await delIn("tasks", "created_by", pids);
  await delIn("seating_charts", "created_by", pids);
  await delIn("activities", "created_by", pids);
  await delIn("dept_meetings", "created_by", pids);
  await delIn("teacher_assessments", "reviewed_by", pids);
  await delIn("teacher_assessments", "academic_year_id", yearIds);
  await delIn("lesson_plans", "teacher_id", pids);
  await delIn("lesson_plans", "reviewed_by", pids);
  await delIn("substitute_requests", "requested_by", pids);
  await delIn("substitute_requests", "decided_by", pids);
  await delIn("support_plans", "created_by", pids);
  await delIn("support_plans", "approved_by", pids);
  await delIn("early_warnings", "acknowledged_by", pids);
  await delIn("tt15_evaluations", "evaluator_id", pids);
  await delIn("conduct_evaluations", "evaluated_by", pids);
  await delIn("competency_evaluations", "evaluated_by", pids);
  await delIn("nlpc_comments", "evaluated_by", pids);
  await delIn("feature_grants", "created_by", pids);
  await delIn("feature_grants", "user_id", pids);
  await delIn("item_acl", "created_by", pids);
  await delIn("item_acl", "user_id", pids);
  await delIn("announcements", "sender_id", pids);
  await delIn("daily_reports", "gvcn_id", pids);
  await delIn("students", "class_id", classIds);
  await delIn("parents", "id", parentIds);
  await delIn("parents", "profile_id", pids);
  await delIn("classes", "school_id", SIDS);
  // departments.head_id -> profiles (vong FK): go lien ket truoc khi xoa profiles
  await sb.from("departments").update({ head_id: null }).in("school_id", SIDS);
  const campusIds0 = await ids("campuses", "id", "school_id", SIDS);
  await sb.from("profiles").update({ campus_id: null, department_id: null })
    .or(`campus_id.in.(${campusIds0.join(",") || "00000000-0000-0000-0000-000000000000"}),department_id.in.(${deptIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
  await delIn("profiles", "id", pids);
  for (const t of ["academic_years","departments","subjects","campuses"])
    await delIn(t, "school_id", SIDS);

  // auth users (cascade da xoa profiles)
  let delCount = 0;
  for (const uid of oldUids) {
    const { error } = await sb.auth.admin.deleteUser(uid);
    if (!error) delCount++;
    else if (!/not found/i.test(error.message)) console.log(`    auth del ${uid}: ${error.message}`);
    await new Promise((r) => setTimeout(r, 30));
  }
  console.log(`  auth users deleted: ${delCount}`);
  return oldUids;
}

// ================= SEED CONFIG =================
const SUBJ = {
  thcs: [
    ["Toán","score"],["Ngữ văn","score"],["Tiếng Anh","score"],["Vật lý","score"],
    ["Hóa học","score"],["Sinh học","score"],["Lịch sử và Địa lý","score"],["Giáo dục công dân","score"],
    ["Tin học","comment"],["Công nghệ","comment"],["Thể dục","comment"],["Âm nhạc","comment"],["Mỹ thuật","comment"],
  ],
  th: [
    ["Tiếng Việt","score"],["Toán","score"],["Tiếng Anh","score"],
    ["Đạo đức","comment"],["Tự nhiên và Xã hội","comment"],["Khoa học","comment"],
    ["Lịch sử và Địa lý","comment"],["Tin học","comment"],["Thể dục","comment"],["Âm nhạc","comment"],["Mỹ thuật","comment"],
  ],
};

// staffing THCS: [subject, so luong GV] - thu tu uu tien gan GVCN truoc
const THCS_STAFF = [
  ["Toán", 4], ["Ngữ văn", 4], ["Tiếng Anh", 3], ["Vật lý", 2], ["Lịch sử và Địa lý", 2],
  ["Thể dục", 2], ["Hóa học", 1], ["Sinh học", 1], ["Giáo dục công dân", 1],
  ["Tin học", 1], ["Công nghệ", 1], ["Âm nhạc", 1], ["Mỹ thuật", 1],
];
const THCS_GVCN_SUBJECTS = ["Toán","Toán","Toán","Ngữ văn","Ngữ văn","Ngữ văn","Tiếng Anh","Tiếng Anh","Vật lý","Lịch sử và Địa lý","Giáo dục công dân","Sinh học"];
const TH_SPECIAL = [["Tiếng Anh","gvbm"],["Tin học","gvbm"],["Thể dục","gvbm"],["Âm nhạc","gvbm"],["Mỹ thuật","gvbm"],["Công nghệ","gvbm"]];
// GV chu nhiem TH day: Tieng Viet + Toan + mon comment theo khoi
const TH_GVCN_SUBJECTS_123 = ["Tiếng Việt","Toán","Đạo đức","Tự nhiên và Xã hội"];
const TH_GVCN_SUBJECTS_45 = ["Tiếng Việt","Toán","Đạo đức","Khoa học","Lịch sử và Địa lý"];

const SCHOOLS = [
  {
    key: "nd", id: S.nd, kind: "thcs", name: "THCS Nguyễn Du",
    campuses: [["Cơ sở chính", "main", "123 Đường Nguyễn Du"], ["Cơ sở 2", "phan_hieu", "45 Đường Lê Lợi"]],
    classes: ["6A1","6A2","6A3","7A1","7A2","7A3","8A1","8A2","8A3","9A1","9A2","9A3"],
    cs2: (name) => name.endsWith("3"),
    depts: [
      { name: "Tổ Toán - Tự nhiên", subjects: ["Toán","Vật lý","Hóa học","Sinh học","Tin học"] },
      { name: "Tổ Văn - Xã hội", subjects: ["Ngữ văn","Lịch sử và Địa lý","Giáo dục công dân"] },
      { name: "Tổ Ngoại ngữ", subjects: ["Tiếng Anh"] },
      { name: "Tổ Thể chất - Nghệ thuật", subjects: ["Thể dục","Âm nhạc","Mỹ thuật","Công nghệ"] },
    ],
    studentsPerClass: 36,
  },
  {
    key: "cva", id: S.cva, kind: "th", name: "Tiểu học Chu Văn An",
    campuses: [["Cơ sở chính", "main", "78 Đường Chu Văn An"]],
    classes: ["1A1","1A2","1A3","2A1","2A2","2A3","3A1","3A2","3A3","4A1","4A2","4A3","5A1","5A2","5A3"],
    cs2: () => false,
    depts: [
      { name: "Tổ Khối 1-2", subjects: [] },
      { name: "Tổ Khối 3", subjects: [] },
      { name: "Tổ Khối 4-5", subjects: [] },
      { name: "Tổ Chuyên biệt", subjects: ["Tiếng Anh","Tin học","Thể dục","Âm nhạc","Mỹ thuật","Công nghệ"] },
    ],
    studentsPerClass: 33,
  },
  {
    key: "kd", id: S.kd, kind: "th", name: "Tiểu học Kim Đồng",
    campuses: [["Cơ sở chính", "main", "12 Đường Kim Đồng"]],
    classes: ["1A1","1A2","2A1","2A2","3A1","3A2","4A1","4A2","5A1","5A2"],
    cs2: () => false,
    depts: [
      { name: "Tổ Khối 1-2", subjects: [] },
      { name: "Tổ Khối 3-5", subjects: [] },
      { name: "Tổ Chuyên biệt", subjects: ["Tiếng Anh","Tin học","Thể dục","Âm nhạc","Mỹ thuật","Công nghệ"] },
    ],
    studentsPerClass: 33,
  },
];

const DEMO = {
  nd: {
    gvcn: { email: "gvcn@demo.scn", name: "Phạm Thị Lan Anh" },
    gvbm: { email: "gvbm@demo.scn", name: "Trần Văn Minh", subject: "Vật lý" },
    tt: { email: "totruong@demo.scn", name: "Lê Thị Hồng Hạnh" },
    bgh: { email: "bgh@demo.scn", name: "Nguyễn Văn Hải" },
    pht: { email: "pht@demo.scn", name: "Lê Minh Đức" },
    kt: { email: "ketoan@demo.scn", name: "Phạm Thu Trang" },
  },
  cva: {
    gvcn: { email: "gvcn.cva@demo.scn", name: "Đỗ Thị Kim Oanh" },
    tt: { email: "totruong.cva@demo.scn", name: "Trương Thị Bích Liên" },
    bgh: { email: "bgh.cva@demo.scn", name: "Trần Thị Mai Phương" },
    kt: { email: "ketoan.cva@demo.scn", name: "Vũ Thanh Hà" },
  },
  kd: {
    gvcn: { email: "gvcn.kd@demo.scn", name: "Lý Thị Thanh Nga" },
    bgh: { email: "bgh.kd@demo.scn", name: "Hoàng Đức Long" },
    kt: { email: "ketoan.kd@demo.scn", name: "Đinh Ngọc Ánh" },
  },
};

let staffSeq = 0;
function teacherEmail(name, tag) {
  const parts = name.split(" ");
  const ten = slug(parts[parts.length - 1]);
  const init = parts.slice(0, -1).map((w) => slug(w)[0]).join("");
  return `${ten}.${init}@${tag}.scn`;
}

async function seedSchool(cfg, demo) {
  console.log(`\n=== ${cfg.name} ===`);
  const sid = cfg.id;
  const tag = cfg.key;

  // campuses
  const campusIds = [];
  for (const [name, kind, address] of cfg.campuses) {
    const { data, error } = await sb.from("campuses").insert({ school_id: sid, name, kind, address }).select().single();
    if (error) throw new Error(`campuses: ${error.message}`);
    campusIds.push(data.id);
  }
  const mainCampus = campusIds[0];
  const cs2 = campusIds[1] ?? null;

  // academic year
  const { data: year } = await sb.from("academic_years").insert({
    school_id: sid, name: "2026-2027", start_date: "2026-08-10", end_date: "2027-05-31", is_current: true,
  }).select().single();
  const yid = year.id;

  // subjects
  const subjDefs = SUBJ[cfg.kind];
  const codeOf = (n) => slug(n).slice(0, 10).toUpperCase();
  await batch("subjects", subjDefs.map(([name, m]) => ({ school_id: sid, name, code: codeOf(name), assessment_method: m })));
  const { data: subjects } = await sb.from("subjects").select().eq("school_id", sid);
  const subjByName = Object.fromEntries(subjects.map((s) => [s.name, s]));

  // ----- users -----
  const demoMail = {};
  const mkMeta = (role, extra = {}) => ({
    role, school_id: sid, staff_code: `${tag.toUpperCase()}-${String(++staffSeq).padStart(3, "0")}`,
    employment_type: chance(0.8) ? "bien_che" : "hop_dong",
    qualification: rand(["Cử nhân sư phạm","Cử nhân sư phạm","Thạc sĩ"]),
    ...extra,
  });

  // BGH + ke toan
  const bghPht = demo.bgh ? await ensureUser(demo.bgh.email, mkMeta("bgh", { full_name: demo.bgh.name, campus_id: mainCampus })) : null;
  demoMail[demo.bgh?.email] = bghPht;
  let phtUid = null;
  if (demo.pht) {
    phtUid = await ensureUser(demo.pht.email, mkMeta("pht", { full_name: demo.pht.name, campus_id: cs2 ?? mainCampus }));
    demoMail[demo.pht.email] = phtUid;
  }
  const pht2Name = vnName("nu");
  await ensureUser(teacherEmail(pht2Name, tag), mkMeta("bgh", { full_name: pht2Name, campus_id: mainCampus }));
  if (demo.kt) demoMail[demo.kt.email] = await ensureUser(demo.kt.email, mkMeta("ke_toan", { full_name: demo.kt.name }));

  // departments + to_truong
  const deptIds = [];
  const ttUids = [];
  for (let di = 0; di < cfg.depts.length; di++) {
    const d = cfg.depts[di];
    const subjIds = d.subjects.map((n) => subjByName[n]?.id).filter(Boolean);
    const { data: dept } = await sb.from("departments").insert({ school_id: sid, name: d.name, subject_ids: subjIds }).select().single();
    deptIds.push({ id: dept.id, name: d.name, subjects: d.subjects });
    const isDemoTT = di === 0 && demo.tt;
    const ttName = isDemoTT ? demo.tt.name : vnName(chance(0.7) ? "nu" : "nam");
    const email = isDemoTT ? demo.tt.email : teacherEmail(ttName, tag);
    const uid = await ensureUser(email, mkMeta("to_truong", {
      full_name: ttName, department_id: dept.id, campus_id: mainCampus, concurrent_roles: ["gvbm"],
    }));
    if (isDemoTT) demoMail[email] = uid;
    await sb.from("departments").update({ head_id: uid }).eq("id", dept.id);
    ttUids.push({ uid, deptId: dept.id, subjects: d.subjects });
  }

  // ----- teacher roster -----
  // tra ve: [{uid, role, deptIdx, subjects:[names], campus}]
  const teachers = [];
  if (cfg.kind === "thcs") {
    // gan GVCN vao mon uu tien, con lai gvbm
    const gvcnSubs = THCS_GVCN_SUBJECTS.slice(0, cfg.classes.length);
    const gvcnQueue = gvcnSubs.slice();
    // mon cua demo.gvbm khong duoc roi vao slot GVCN - doi sang mon khac
    if (demo.gvbm) {
      const vi = gvcnQueue.indexOf(demo.gvbm.subject);
      if (vi >= 0) gvcnQueue[vi] = "Hóa học";
    }
    for (const [subj, count] of THCS_STAFF) {
      const deptIdx = cfg.depts.findIndex((d) => d.subjects.includes(subj));
      let demoGvcnUsed = false;
      for (let i = 0; i < count; i++) {
        let role = "gvbm", sName = subj;
        const gi = gvcnQueue.indexOf(subj);
        if (gi >= 0) {
          role = "gvcn";
          gvcnQueue.splice(gi, 1);
        }
        let name, email;
        if (role === "gvcn" && subj === "Toán" && demo.gvcn && !demoGvcnUsed) {
          name = demo.gvcn.name; email = demo.gvcn.email; demoGvcnUsed = true;
        } else if (demo.gvbm && subj === demo.gvbm.subject && !demoMail[demo.gvbm.email]) {
          name = demo.gvbm.name; email = demo.gvbm.email;
        } else { name = vnName(chance(0.55) ? "nu" : "nam"); email = teacherEmail(name, tag); }
        const uid = await ensureUser(email, mkMeta(role, { full_name: name, department_id: deptIds[deptIdx].id, campus_id: mainCampus }));
        if (email.endsWith("@demo.scn")) demoMail[email] = uid;
        teachers.push({ uid, role, deptIdx, subjects: [sName], campus: mainCampus });
      }
    }
  } else {
    // TH: GVCN day mon chinh, GVBM chuyen biet
    const gradeOf = (cname) => parseInt(cname[0]);
    const deptIdxFor = (grade) => {
      if (cfg.depts.length === 4) return grade <= 2 ? 0 : grade === 3 ? 1 : 2;
      return grade <= 2 ? 0 : 1;
    };
    const specDept = cfg.depts.length - 1;
    for (let i = 0; i < cfg.classes.length; i++) {
      const grade = gradeOf(cfg.classes[i]);
      const subs = grade >= 4 ? TH_GVCN_SUBJECTS_45 : TH_GVCN_SUBJECTS_123;
      const isDemo = i === Math.floor(cfg.classes.length / 2) && demo.gvcn;
      const name = isDemo ? demo.gvcn.name : vnName(chance(0.8) ? "nu" : "nam");
      const email = isDemo ? demo.gvcn.email : teacherEmail(name, tag);
      const uid = await ensureUser(email, mkMeta("gvcn", { full_name: name, department_id: deptIds[deptIdxFor(grade)].id, campus_id: mainCampus }));
      if (isDemo) demoMail[demo.gvcn.email] = uid;
      teachers.push({ uid, role: "gvcn", deptIdx: deptIdxFor(grade), subjects: subs, campus: mainCampus });
    }
    const specCount = Math.max(5, Math.round(cfg.classes.length * 0.55));
    for (let i = 0; i < specCount; i++) {
      const subj = TH_SPECIAL[i % TH_SPECIAL.length][0];
      const name = vnName(chance(0.6) ? "nu" : "nam");
      const uid = await ensureUser(teacherEmail(name, tag), mkMeta("gvbm", { full_name: name, department_id: deptIds[specDept].id, campus_id: mainCampus }));
      teachers.push({ uid, role: "gvbm", deptIdx: specDept, subjects: [subj], campus: mainCampus });
    }
    // to_truong TH kiem day lop -> gan them mon
    for (const tt of ttUids) {
      const { data: prof } = await sb.from("profiles").select("full_name").eq("id", tt.uid).single();
      teachers.push({ uid: tt.uid, role: "to_truong", deptIdx: deptIds.findIndex((d) => d.id === tt.deptId), subjects: ["Tiếng Việt","Toán"], campus: mainCampus, _name: prof?.full_name });
    }
  }
  // to_truong THCS cung day mon dau tien cua to
  if (cfg.kind === "thcs") {
    for (const tt of ttUids) {
      if (tt.subjects.length) teachers.push({ uid: tt.uid, role: "to_truong", deptIdx: deptIds.findIndex((d) => d.id === tt.deptId), subjects: [tt.subjects[0]], campus: mainCampus });
    }
  }

  // teacher_subjects
  const tsRows = [];
  for (const t of teachers)
    for (const sn of t.subjects) {
      const s = subjByName[sn];
      if (s) tsRows.push({ teacher_id: t.uid, subject_id: s.id });
    }
  await batch("teacher_subjects", [...new Map(tsRows.map((r) => [`${r.teacher_id}|${r.subject_id}`, r])).values()]);

  // ----- classes -----
  const gvcnPool = teachers.filter((t) => t.role === "gvcn");
  // demo GVCN chu nhiem lop giua danh sach (ND: 8A2)
  const demoGvcnUid = demo.gvcn ? demoMail[demo.gvcn.email] : null;
  const anchorIdx = cfg.kind === "thcs" ? cfg.classes.indexOf("8A2") : Math.floor(cfg.classes.length / 2);
  const demoGvcnIdx = gvcnPool.findIndex((t) => t.uid === demoGvcnUid);
  if (demoGvcnIdx >= 0 && anchorIdx >= 0) {
    const tmp = gvcnPool[anchorIdx];
    gvcnPool[anchorIdx] = gvcnPool[demoGvcnIdx];
    gvcnPool[demoGvcnIdx] = tmp;
  }
  const classRows = cfg.classes.map((name, i) => ({
    school_id: sid, academic_year_id: yid, name, grade: parseInt(name[0]),
    gvcn_id: gvcnPool[i]?.uid ?? null,
    campus_id: cfg.cs2(name) && cs2 ? cs2 : mainCampus,
    status: "active",
  }));
  await batch("classes", classRows);
  const { data: classes } = await sb.from("classes").select().eq("academic_year_id", yid);
  const classByName = Object.fromEntries(classes.map((c) => [c.name, c]));
  // GVCN cua lop CS2 gan campus CS2
  for (const c of classes) {
    if (c.campus_id === cs2 && c.gvcn_id)
      await sb.from("profiles").update({ campus_id: cs2 }).eq("id", c.gvcn_id);
  }

  // ----- students + groups + parents -----
  const groupRows = [];
  for (const c of classes) for (let g = 1; g <= 4; g++) groupRows.push({ class_id: c.id, name: `Tổ ${g}` });
  await batch("student_groups", groupRows);
  const { data: groups } = await sb.from("student_groups").select().in("class_id", classes.map((c) => c.id));
  const groupsByClass = {};
  groups.forEach((g) => (groupsByClass[g.class_id] ??= []).push(g));

  const studentRows = [];
  const parentRows = [];
  let seq = 1;
  for (const c of classes) {
    const gs = groupsByClass[c.id];
    const n = cfg.studentsPerClass + ri(-2, 3);
    for (let i = 0; i < n; i++) {
      const gender = chance(0.5) ? "nam" : "nu";
      const code = `${tag.toUpperCase()}${String(seq++).padStart(5, "0")}`;
      studentRows.push({
        class_id: c.id, group_id: gs[i % 4].id, code, full_name: vnName(gender), gender,
        dob: `${2027 - parseInt(c.name[0]) - (cfg.kind === "th" ? 6 : 6)}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`,
        status: "active", positive_points: ri(0, 20),
      });
      const father = chance(0.55);
      parentRows.push({
        full_name: vnName(father ? "nam" : "nu"), phone: `09${String(ri(10000000, 99999999))}`,
        email: `${code.toLowerCase()}.ph@mail.scn`, relationship: father ? "bố" : "mẹ", _code: code,
      });
      if (chance(0.3)) parentRows.push({
        full_name: vnName(father ? "nu" : "nam"), phone: `08${String(ri(10000000, 99999999))}`,
        email: `${code.toLowerCase()}.ph2@mail.scn`, relationship: father ? "mẹ" : "bố", _code: code,
      });
    }
  }
  await batch("parents", parentRows.map(({ _code, ...r }) => r));
  await batch("students", studentRows);
  const { data: students } = await sb.from("students").select().in("class_id", classes.map((c) => c.id));
  const { data: parents } = await sb.from("parents").select().like("email", `${tag}%@mail.scn`);
  const studentByCode = Object.fromEntries(students.map((s) => [s.code, s]));
  const byEmail = Object.fromEntries(parents.map((p) => [p.email, p]));
  const psRows = [];
  for (const p of parentRows) {
    const db = byEmail[p.email];
    const st = studentByCode[p._code];
    if (db && st) psRows.push({ parent_id: db.id, student_id: st.id });
  }
  await batch("parent_students", psRows);

  // class roles
  const crRows = [];
  for (const c of classes) {
    const ss = students.filter((s) => s.class_id === c.id);
    const roles = ["lop_truong", "lop_pho_hoc_tap", "lop_pho_van_nghe"];
    ss.slice(0, 3).forEach((s, i) => crRows.push({ student_id: s.id, role: roles[i] }));
    groupsByClass[c.id].forEach((g, i) => { if (ss[3 + i]) crRows.push({ student_id: ss[3 + i].id, role: "to_truong" }); });
  }
  await batch("class_roles", crRows);

  // ----- timetable -----
  const teacherBySubject = {};
  for (const t of teachers)
    for (const sn of t.subjects)
      (teacherBySubject[sn] ??= []).push(t.uid);
  const busy = new Set();
  const deptTeachers = {};
  for (const t of teachers) (deptTeachers[t.deptIdx] ??= []).push(t.uid);
  const allTeacherIds = teachers.map((t) => t.uid);
  const pickTeacher = (sn, wd, p, cls) => {
    const k = (uid) => `${uid}|${wd}|${p}`;
    const pools = [teacherBySubject[sn] ?? [], deptTeachers[cfg.depts.findIndex((d) => d.subjects.includes(sn))] ?? [], allTeacherIds];
    for (const pool of pools)
      for (const uid of pool)
        if (!busy.has(k(uid))) { busy.add(k(uid)); return uid; }
    return null;
  };
  const ttRows = [];
  const today = new Date("2026-10-09");
  if (cfg.kind === "thcs") {
    const dayPlans = [
      ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Thể dục"],
      ["Ngữ văn","Toán","Lịch sử và Địa lý","Hóa học","Âm nhạc"],
      ["Toán","Tiếng Anh","Ngữ văn","Sinh học","Tin học"],
      ["Tiếng Anh","Toán","Vật lý","Giáo dục công dân","Thể dục"],
      ["Ngữ văn","Hóa học","Toán","Lịch sử và Địa lý","Mỹ thuật"],
      ["Sinh học","Tiếng Anh","Công nghệ","Ngữ văn","Giáo dục công dân"],
    ];
    classes.forEach((c, ci) => {
      for (let wd = 2; wd <= 7; wd++) {
        // xoay vong mon theo lop de dan deu GV theo tiet
        const base = dayPlans[wd - 2];
        const plan = base.map((_, i) => base[(i + ci) % base.length]);
        plan.forEach((sn, p) => {
          const s = subjByName[sn];
          if (!s) return;
          ttRows.push({ class_id: c.id, subject_id: s.id, teacher_id: pickTeacher(sn, wd, p + 1, c), weekday: wd, period: p + 1, room: `P${c.name}` });
        });
      }
    });
  } else {
    for (const c of classes) {
      const grade = parseInt(c.name[0]);
      const core = grade >= 4
        ? [["Tiếng Việt",5],["Toán",5],["Đạo đức",1],["Khoa học",2],["Lịch sử và Địa lý",2]]
        : [["Tiếng Việt",6],["Toán",5],["Đạo đức",1],["Tự nhiên và Xã hội",3]];
      const spec = [["Tiếng Anh",2],["Thể dục",2],["Tin học",1],["Âm nhạc",1],["Mỹ thuật",1]];
      const week = [];
      for (const [sn, n] of [...core, ...spec]) for (let i = 0; i < n; i++) week.push(sn);
      while (week.length < 25) week.push("Tiếng Việt");
      // shuffle deterministic-ish
      week.sort(() => Math.random() - 0.5);
      let idx = 0;
      for (let wd = 2; wd <= 6; wd++) {
        for (let p = 1; p <= 5; p++) {
          const sn = week[idx++];
          const s = subjByName[sn];
          if (!s) continue;
          const isSpec = spec.some(([n]) => n === sn);
          const tid = isSpec ? pickTeacher(sn, wd, p, c) : c.gvcn_id;
          if (tid) busy.add(`${tid}|${wd}|${p}`);
          ttRows.push({ class_id: c.id, subject_id: s.id, teacher_id: tid, weekday: wd, period: p, room: `P${c.name}` });
        }
      }
    }
  }
  await batch("timetable_entries", ttRows);
  const { data: timetable } = await sb.from("timetable_entries").select().in("class_id", classes.map((c) => c.id));

  // ----- grades -----
  const scoreSubs = subjects.filter((s) => s.assessment_method === "score");
  const commentSubs = subjects.filter((s) => s.assessment_method === "comment");
  const rndScore = () => Math.round(Math.min(10, Math.max(3, 5.8 + Math.random() * 4 - (chance(0.12) ? 2 : 0))) * 10) / 10;
  const gradeRows = [];
  for (const st of students) {
    for (const s of scoreSubs) {
      for (let i = 0; i < ri(2, 3); i++)
        gradeRows.push({ student_id: st.id, subject_id: s.id, term: "hk1", assessment_type: "ddg_tx", score: rndScore(), seq: i + 1 });
      gradeRows.push({ student_id: st.id, subject_id: s.id, term: "hk1", assessment_type: "ddg_gk", score: rndScore(), seq: 1 });
      if (chance(0.7)) gradeRows.push({ student_id: st.id, subject_id: s.id, term: "hk1", assessment_type: "ddg_ck", score: rndScore(), seq: 1 });
    }
    for (const s of commentSubs)
      gradeRows.push({ student_id: st.id, subject_id: s.id, term: "hk1", assessment_type: "ddg_ck", score: null, seq: 1, result: chance(0.92) ? "dat" : "chua_dat" });
  }
  await batch("grades", gradeRows);

  // ----- attendance -----
  const attRows = [];
  const days = cfg.kind === "thcs" ? 40 : 25;
  for (let d = days; d >= 0; d--) {
    const day = new Date(today); day.setDate(day.getDate() - d);
    if (day.getDay() === 0) continue;
    for (const st of students) {
      const r = Math.random();
      const status = r < 0.94 ? "present" : r < 0.965 ? "excused" : r < 0.985 ? "late" : "unexcused";
      attRows.push({ student_id: st.id, date: ds(day), status, source: "manual" });
    }
  }
  await batch("attendance_records", attRows);

  // ----- conduct -----
  const cr2 = [];
  for (const st of students) {
    if (chance(0.15)) cr2.push({ student_id: st.id, type: "khen_thuong", content: "Tích cực phát biểu, giúp đỡ bạn bè", points: 5, date: ds(new Date(today.getTime() - ri(1, 30) * 864e5)) });
    if (chance(0.1)) cr2.push({ student_id: st.id, type: "vi_pham", content: rand(["Đi học muộn","Không làm bài tập","Nói chuyện trong giờ","Quên đồng phục"]), points: -3, date: ds(new Date(today.getTime() - ri(1, 30) * 864e5)) });
  }
  await batch("conduct_records", cr2);
  await batch("conduct_evaluations", students.map((st) => ({
    student_id: st.id, term: "hk1", rating: rand(["tot","tot","tot","kha","kha","dat"]), comment: null,
  })));

  // ----- incidents / activities / announcements -----
  const incRows = [];
  const incTypes = ["Va chạm nhẹ trong giờ thể dục","Trượt ngã ở hành lang","Đau bụng trong giờ học","Mâu thuẫn với bạn cùng tổ","Quên mang theo thuốc uống định kỳ"];
  for (let i = 0; i < Math.max(6, classes.length / 2); i++) {
    const c = rand(classes);
    const ss = students.filter((s) => s.class_id === c.id);
    incRows.push({
      student_id: rand(ss).id, class_id: c.id, type: rand(incTypes),
      severity: rand(["low","low","medium","medium","high"]),
      status: rand(["resolved","following","new"]),
      description: "Sự cố được ghi nhận và xử lý theo quy trình của nhà trường.",
      reported_to_bgh: chance(0.6),
      occurred_at: new Date(today.getTime() - ri(0, 50) * 864e5).toISOString(),
    });
  }
  await batch("incidents", incRows);

  const actTitles = ["Sinh hoạt chủ đề An toàn giao thông","Tham quan Bảo tàng Lịch sử","Ngày hội việc tốt","Chủ nhật xanh - vệ sinh trường","Sinh hoạt truyền thống 20/11","Hội thao cấp trường"];
  await batch("activities", classes.slice(0, Math.min(7, classes.length)).map((c) => ({
    class_id: c.id, title: rand(actTitles), description: "Hoạt động giáo dục ngoài giờ lên lớp",
    activity_date: ds(new Date(today.getTime() + ri(-20, 30) * 864e5)),
    status: rand(["approved","done","pending"]), created_by: c.gvcn_id,
    approved_by: chance(0.7) ? bghPht : null,
  })));

  const annRows = [];
  for (const c of classes.slice(0, Math.min(8, classes.length))) {
    const ss = students.filter((s) => s.class_id === c.id);
    annRows.push({ sender_id: c.gvcn_id ?? bghPht, class_id: c.id, school_id: sid, title: "Thông báo lịch sinh hoạt lớp", content: "Kính gửi quý phụ huynh lịch sinh hoạt lớp cuối tuần này." });
    if (chance(0.6)) annRows.push({ sender_id: c.gvcn_id ?? bghPht, class_id: c.id, school_id: sid, student_id: rand(ss).id, title: "Thông báo về tình hình học tập", content: "Em có dấu hiệu sa sút, đề nghị gia đình phối hợp." });
  }
  await batch("announcements", annRows);

  // ----- seating -----
  const seatRows = [];
  for (const c of classes) {
    const ss = students.filter((s) => s.class_id === c.id);
    const seats = ss.map((s, i) => ({ x: i % 8, y: Math.floor(i / 8), student_id: s.id }));
    seatRows.push({ class_id: c.id, month: "2026-10-01", version: 1, is_current: true, layout: { cols: 8, rows: 5, seats }, created_by: c.gvcn_id });
    seatRows.push({ class_id: c.id, month: "2026-09-01", version: 1, is_current: false, layout: { cols: 8, rows: 5, seats: seats.slice().reverse().map((s, i) => ({ ...s, x: i % 8, y: Math.floor(i / 8) })) }, created_by: c.gvcn_id });
  }
  await batch("seating_charts", seatRows);

  // ----- events + tasks + kpis + signoffs -----
  const syeRows = [
    { title: "Khai giảng năm học mới", event_date: "2026-09-05", month: 9, category: "su_kien" },
    { title: "Kiểm tra giữa kỳ I", event_date: "2026-10-20", month: 10, category: "kiem_tra" },
    { title: "Ngày Nhà giáo Việt Nam 20/11", event_date: "2026-11-20", month: 11, category: "su_kien" },
    { title: "Thi học kỳ I", event_date: "2026-12-25", month: 12, category: "kiem_tra" },
    { title: "Sơ kết học kỳ I", event_date: "2027-01-10", month: 1, category: "bao_cao" },
    { title: "Kiểm tra giữa kỳ II", event_date: "2027-03-15", month: 3, category: "kiem_tra" },
    { title: "Thi học kỳ II", event_date: "2027-05-10", month: 5, category: "kiem_tra" },
  ].map((e) => ({ ...e, school_id: sid, academic_year_id: yid }));
  await batch("school_year_events", syeRows);
  await batch("tasks", syeRows.slice(0, 5).flatMap((e) => [
    { class_id: null, title: `Chuẩn bị: ${e.title}`, due_date: e.event_date, month: e.month, source: "suggested", status: "pending", created_by: bghPht },
    { class_id: classes[0].id, title: `${e.title} - kế hoạch lớp`, due_date: e.event_date, month: e.month, source: "suggested", status: rand(["pending","approved"]), created_by: classes[0].gvcn_id },
  ]));
  await batch("kpis", classes.map((c) => ({
    class_id: c.id, period: "2026-HK1",
    content: { chuyen_can: "≥95%", ty_le_kha: "≥60%", vi_pham: "≤2 HS" },
    status: rand(["registered","approved"]),
  })));
  await batch("register_signoffs", classes.map((c) => ({
    class_id: c.id, period: "2026-09", type: "so_chu_nhiem", status: rand(["pending","signed"]),
  })));

  // ----- emulation -----
  const critDefs = [
    { name: "Chuyên cần", max_score: 30, category: "nep" },
    { name: "Học tập", max_score: 30, category: "hoc_tap" },
    { name: "Vệ sinh & nề nếp", max_score: 20, category: "nep" },
    { name: "Hoạt động phong trào", max_score: 20, category: "phong_trao" },
  ];
  await batch("emulation_criteria", critDefs.map((c) => ({ ...c, school_id: sid })));
  const { data: crits } = await sb.from("emulation_criteria").select().eq("school_id", sid);
  await batch("emulation_scores", classes.flatMap((c) => crits.map((cr) => ({
    class_id: c.id, criterion_id: cr.id, period: "2026-T10",
    score: Math.round(cr.max_score * (0.7 + Math.random() * 0.28)),
  }))));

  // ----- support / counseling / dept meetings / assessments -----
  await batch("support_plans", students.slice(0, 10).map((st) => ({
    student_id: st.id, subject_id: rand(scoreSubs).id,
    reason: "Điểm trung bình môn dưới 5.0", plan: "Phụ đạo 2 buổi/tuần, giao bài tập bổ sung",
    status: rand(["pending","approved","in_progress"]),
    created_by: classByName[Object.keys(classByName).find((n) => classByName[n].id === st.class_id)].gvcn_id,
  })));
  await batch("counseling_cases", students.slice(10, 18).map((st) => ({
    student_id: st.id, issue: rand(["Dấu hiệu chán học","Xung đột với bạn bè","Hoàn cảnh gia đình khó khăn","Áp lực điểm số"]),
    severity: rand(["low","medium","medium"]), status: rand(["new","assessing","counseling"]),
  })));
  await batch("dept_meetings", deptIds.map((d, i) => ({
    department_id: d.id, title: `Sinh hoạt chuyên môn tháng 10 - ${d.name}`,
    meeting_date: "2026-10-06", content: "Thống nhất tiến độ, kế hoạch kiểm tra giữa kỳ I, dự giờ đồng nghiệp.",
    created_by: ttUids[i]?.uid ?? null,
  })));
  await batch("teacher_assessments", [
    { teacher_id: gvcnPool[0]?.uid, academic_year_id: yid, self_review: "Hoàn thành tốt nhiệm vụ chủ nhiệm lớp", plan: "Nâng cao kỹ năng tư vấn học sinh", status: "submitted" },
    { teacher_id: teachers.find((t) => t.role === "gvbm")?.uid, academic_year_id: yid, self_review: "Đảm bảo tiến độ giảng dạy theo kế hoạch", plan: "Ứng dụng CNTT trong dạy học", status: "draft" },
  ].filter((r) => r.teacher_id));

  // ----- period logs today -----
  const wdToday = ((today.getDay() + 6) % 7) + 2; // Fri 2026-10-09 -> 6
  const todayTT = timetable.filter((t) => t.weekday === Math.min(wdToday, 7));
  await batch("period_logs", todayTT.slice(0, 25).map((t) => ({
    timetable_entry_id: t.id, date: ds(today), logged_by: t.teacher_id, present_count: ri(30, 36), note: null,
  })));

  // ----- school-level: equipment, kpis, support staff, exams, warnings, substitutes, daily reports -----
  await batch("equipment", [
    { name: "Máy chiếu projector", category: "thiet_bi_day_hoc", quantity: classes.length, condition: "tot" },
    { name: "Máy tính phòng tin học", category: "thiet_bi_day_hoc", quantity: 30, condition: "tot" },
    { name: "Bộ thí nghiệm Vật lý", category: "do_dung_thi_nghiem", quantity: 6, condition: "tot" },
    { name: "Bóng đá", category: "the_thao", quantity: 12, condition: "tot" },
    { name: "Máy in văn phòng", category: "van_phong", quantity: 3, condition: "hong_nhe" },
  ].map((e) => ({ ...e, school_id: sid, campus_id: mainCampus })));
  await batch("school_kpis", [
    { period: "2026-2027", title: "Tỷ lệ chuyên cần toàn trường", target: "97", actual: "96.2", unit: "%", status: "dang_thuc_hien" },
    { period: "2026-2027", title: "HS xếp loại Khá trở lên HK1", target: "65", actual: null, unit: "%", status: "dang_thuc_hien" },
    { period: "2026-2027", title: "Giáo án được duyệt đúng hạn", target: "90", actual: "84", unit: "%", status: "dang_thuc_hien" },
  ].map((e) => ({ ...e, school_id: sid })));
  await batch("support_staff", [
    { full_name: vnName("nam"), position: "Nhân viên y tế", qualification: "Cử nhân điều dưỡng", standardized: true },
    { full_name: vnName("nam"), position: "Nhân viên thư viện", qualification: "Cao đẳng", standardized: true },
    { full_name: vnName("nu"), position: "Cán bộ tư vấn học đường", qualification: "Cử nhân tâm lý", standardized: false },
  ].map((e) => ({ ...e, school_id: sid, campus_id: mainCampus })));

  const { data: exam } = await sb.from("exams").insert({
    school_id: sid, name: "Kiểm tra giữa kỳ I", term: "hk1",
    start_date: "2026-10-20", end_date: "2026-10-24", status: "published",
  }).select().single();
  const examSubjects = scoreSubs.slice(0, 3);
  await batch("exam_sessions", classes.slice(0, 4).flatMap((c) => examSubjects.map((s, i) => ({
    exam_id: exam.id, class_id: c.id, subject_id: s.id,
    date: "2026-10-21", start_time: "07:30", end_time: "08:30", room: `P${c.name}`,
    proctor_id: pickTeacher(s.name, c),
  }))));

  await batch("early_warnings", students.slice(0, 5).map((st, i) => ({
    school_id: sid, class_id: st.class_id, student_id: st.id,
    category: rand(["chuyen_can","hoc_tap","tam_ly"]), severity: rand(["low","medium"]),
    title: "Cảnh báo sớm tự động", detail: "Hệ thống phát hiện dấu hiệu cần theo dõi.",
    suggestion: "GVCN trao đổi với phụ huynh trong tuần này.",
    status: i === 0 ? "acknowledged" : "open", dedupe_key: `seed-${st.id}-${i}`,
  })));
  const gvbmPool = teachers.filter((t) => ["gvbm","to_truong"].includes(t.role));
  await batch("substitute_requests", [
    { school_id: sid, class_id: classes[1].id, subject_id: scoreSubs[0]?.id, date: ds(new Date(today.getTime() + 2 * 864e5)), period: 1,
      absent_teacher_id: classes[1].gvcn_id, substitute_teacher_id: gvbmPool[0]?.uid, requested_by: bghPht,
      decided_by: bghPht, decided_at: new Date().toISOString(), reason: "GV đi học tập bồi dưỡng", status: "approved" },
    { school_id: sid, class_id: classes[2].id, subject_id: scoreSubs[1]?.id, date: ds(new Date(today.getTime() + 3 * 864e5)), period: 2,
      absent_teacher_id: classes[2].gvcn_id, requested_by: bghPht, reason: "GV nghỉ ốm đột xuất", status: "pending" },
  ]);
  await batch("cmhs_members", classes.slice(0, 6).flatMap((c, i) => {
    const p = parents[i * 3];
    return p ? [{ class_id: c.id, parent_id: p.id, role: i % 2 ? "truong_ban" : "uy_vien", note: "Bầu đầu năm học" }] : [];
  }));
  for (let d = 3; d >= 0; d--) {
    const day = new Date(today); day.setDate(day.getDate() - d);
    if (day.getDay() === 0) continue;
    await batch("daily_reports", classes.slice(0, 5).map((c) => ({
      class_id: c.id, date: ds(day), gvcn_id: c.gvcn_id,
      absent_count: ri(0, 2), late_count: ri(0, 3), violation_count: ri(0, 1), commendation_count: ri(0, 2),
      content: "Lớp học ổn định, nề nếp tốt.", status: "submitted", submitted_at: new Date().toISOString(),
    })));
  }

  // ----- lesson plans (structured KHBD) -----
  const lpTeachers = teachers.filter((t) => ["gvcn","gvbm","to_truong"].includes(t.role)).slice(0, 4);
  const sampleKhbd = (mon) => ({
    muc_tieu_kien_thuc: `HS nắm được kiến thức trọng tâm bài học môn ${mon}; vận dụng giải bài tập cơ bản.`,
    muc_tieu_nang_luc: "Năng lực tự học, giải quyết vấn đề, hợp tác nhóm.",
    muc_tieu_pham_chat: "Chăm chỉ, trung thực, có trách nhiệm với bạn bè.",
    thiet_bi_gv: "Máy chiếu, bảng phụ, phiếu học tập.",
    thiet_bi_hs: "SGK, vở ghi, đồ dùng học tập.",
    khoi_dong: { muc_tieu: "Tạo hứng thú, kết nối bài cũ.", to_chuc: "Trò chơi khởi động 3 phút; GV đặt câu hỏi mở.", san_pham: "Câu trả lời của HS.", danh_gia: "Quan sát, nhận xét nhanh." },
    kham_pha: { muc_tieu: "Hình thành kiến thức mới.", to_chuc: "HS thảo luận nhóm 4, GV hướng dẫn gợi mở.", san_pham: "Bảng nhóm, phiếu học tập.", danh_gia: "Chấm phiếu, góp ý." },
    luyen_tap: { muc_tieu: "Củng cố kiến thức.", to_chuc: "HS làm bài tập SGK cá nhân rồi chữa chung.", san_pham: "Vở bài tập.", danh_gia: "Chấm điểm miệng." },
    van_dung: { muc_tieu: "Vận dụng vào thực tế.", to_chuc: "Bài tập tình huống thực tiễn.", san_pham: "Bài làm trên vở.", danh_gia: "Nhận xét, dặn dò." },
    dieu_chinh: "Điều chỉnh thời lượng hoạt động theo lớp.",
  });
  const lpStatuses = ["submitted","team_approved","approved","draft"];
  const lpRows = lpTeachers.map((t, i) => {
    const sn = t.subjects[0];
    const c = classes[i % classes.length];
    return {
      school_id: sid, class_id: c.id, teacher_id: t.uid,
      subject_id: subjByName[sn]?.id,
      title: `${sn} - Bài ${i + 5} (tuần ${7 + i})`,
      content: `I. Mục tiêu\n1. Kiến thức: nắm được nội dung bài học môn ${sn}.\nII. Thiết bị - học liệu\nIII. Các hoạt động`,
      content_json: sampleKhbd(sn),
      status: lpStatuses[i],
      week: 7 + i, periods: 1,
      team_reviewed_by: ["team_approved","approved"].includes(lpStatuses[i]) ? ttUids[0].uid : null,
      reviewed_by: lpStatuses[i] === "approved" ? bghPht : null,
    };
  });
  await batch("lesson_plans", lpRows);

  return { classes, students, teachers, demoMail, classByName, bghPht, ttUids, gvcnPool, timetable, today };
}

// ================= MAIN =================
async function main() {
  const oldUids = await wipe();
  if (WIPE_ONLY) { console.log("Wipe only - done"); return; }

  // org units cho so_gd/ubnd
  let { data: ous } = await sb.from("org_units").select();
  if (!ous?.length) {
    await sb.from("org_units").insert([
      { type: "so_gd", name: "Sở Giáo dục và Đào tạo tỉnh Demo", province: "Demo" },
      { type: "ubnd", name: "UBND phường Demo", province: "Demo" },
    ]);
    ({ data: ous } = await sb.from("org_units").select());
  }
  const ouSo = ous.find((o) => o.type === "so_gd") ?? ous[0];
  const ouUbnd = ous.find((o) => o.type === "ubnd") ?? ous[0];

  const results = {};
  for (const cfg of SCHOOLS) results[cfg.key] = await seedSchool(cfg, DEMO[cfg.key]);

  // system users
  const sysUsers = [
    ["sogd@demo.scn", "so_gd", "Vũ Quản Trị Sở", ouSo?.id],
    ["ubnd@demo.scn", "ubnd", "Ngô Văn Lãnh Đạo", ouUbnd?.id],
    ["admin@demo.scn", "admin", "Quản trị hệ thống", null],
  ];
  for (const [email, role, name, ou] of sysUsers)
    await ensureUser(email, { role, full_name: name, org_unit_id: ou, school_id: null });

  // PH + HS demo (ND, lop 8A2)
  const nd = results.nd;
  const demoStudent = nd.students.find((s) => s.class_id === nd.classByName["8A2"].id);
  const phUid = await ensureUser("phuhuynh@demo.scn", { role: "phu_huynh", full_name: "Nguyễn Văn An", school_id: S.nd });
  const hsUid = await ensureUser("hocsinh@demo.scn", { role: "hoc_sinh", full_name: "Nguyễn Gia Bảo", school_id: S.nd });
  const { data: dp } = await sb.from("parents").insert({
    profile_id: phUid, full_name: "Nguyễn Văn An", phone: "0901234567",
    email: "phuhuynh@demo.scn", relationship: "bố",
  }).select().single();
  await sb.from("parent_students").insert({ parent_id: dp.id, student_id: demoStudent.id });
  await sb.from("students").update({ full_name: "Nguyễn Gia Bảo", profile_id: hsUid }).eq("id", demoStudent.id);
  await batch("appointments", [{
    parent_id: dp.id, teacher_id: nd.gvcnPool.find((t) => t.uid === nd.classByName["8A2"].gvcn_id)?.uid ?? nd.bghPht,
    student_id: demoStudent.id, scheduled_at: "2026-10-15T15:30:00Z",
    purpose: "Trao đổi về tình hình học tập đầu năm", status: "confirmed",
  }]);
  const gvcnUid = nd.classByName["8A2"].gvcn_id;
  await batch("messages", [
    { sender_id: phUid, recipient_id: gvcnUid, student_id: demoStudent.id, content: "Cô ơi, cháu hôm nay bị sốt nên xin nghỉ ạ." },
    { sender_id: gvcnUid, recipient_id: phUid, student_id: demoStudent.id, content: "Vâng, gia đình cho cháu nghỉ dưỡng. Tôi đã ghi nhận phép." },
  ]);

  // notifications cho demo users
  const demoUids = Object.values(results).flatMap((r) => Object.values(r.demoMail)).filter(Boolean);
  const notifTypes = { announcement: ["Thông báo mới từ GVCN","/dashboard"], task: ["Công việc sắp đến hạn","/register/plans"], incident: ["Sự cố mới cần xử lý","/safety/followup"], grade: ["Điểm mới được cập nhật","/academics/grades"], message: ["Tin nhắn mới","/notifications"] };
  await batch("notifications", demoUids.flatMap((uid) =>
    Object.entries(notifTypes).slice(0, ri(2, 4)).map(([type, [title, link]]) => ({
      profile_id: uid, type, title, body: "Nội dung chi tiết thông báo.", link,
      read_at: chance(0.5) ? new Date().toISOString() : null,
    })),
  ));
  // message notifications cho cap PH-GVCN co thread that (check link:messages->notifications)
  await batch("notifications", [
    { profile_id: gvcnUid, type: "message", title: "Tin nhắn mới từ phụ huynh", body: "Cô ơi, cháu hôm nay bị sốt nên xin nghỉ ạ.", link: "/messages" },
    { profile_id: phUid, type: "message", title: "Tin nhắn mới từ GVCN", body: "Vâng, gia đình cho cháu nghỉ dưỡng. Tôi đã ghi nhận phép.", link: "/portal/parent" },
  ]);

  // reassign tvc ownership sang GV moi cung truong
  console.log("\nReassign tvc owners...");
  for (const cfg of SCHOOLS) {
    const r = results[cfg.key];
    const newIds = r.teachers.map((t) => t.uid);
    const { data: qs } = await sb.from("tvc_questions").select("id,owner_id").eq("school_id", cfg.id);
    const staleOwners = [...new Set((qs ?? []).map((q) => q.owner_id).filter((o) => !newIds.includes(o)))];
    for (let i = 0; i < staleOwners.length; i++)
      await sb.from("tvc_questions").update({ owner_id: newIds[i % newIds.length] }).eq("owner_id", staleOwners[i]);
    console.log(`  ${cfg.name}: ${staleOwners.length} owners reassigned`);
    for (const t of r.teachers) {
      const { data: p } = await sb.from("profiles").select("full_name,email").eq("id", t.uid).single();
      await sb.from("tvc_profiles").upsert({ id: t.uid, role: "giao_vien", full_name: p?.full_name, email: p?.email });
    }
  }

  console.log("\nDONE.");
}

main().catch((e) => { console.error(e); process.exit(1); });
