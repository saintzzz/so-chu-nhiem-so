/**
 * CR-039: khoi tao truong moi tu file Excel (docs/templates/khoi-tao-truong.xlsx).
 *
 *   node scripts/bootstrap-school.mjs --file khoi-tao-truong.xlsx --school <ma|id>
 *   node scripts/bootstrap-school.mjs --file khoi-tao-truong.xlsx --school <ma|id> --apply
 *   node scripts/bootstrap-school.mjs --cleanup --school <ma|id>
 *
 * Mac dinh DRY-RUN: chi validate + bao loi, khong ghi gi. --apply moi ghi.
 * --cleanup xoa truong kiem thu cung toan bo du lieu + tai khoan auth.
 *
 * Thu tu khoi tao (FK-safe): co_so -> to_chuyen_mon -> can_bo -> head to ->
 * lop -> hoc_sinh -> phu_huynh -> tkb. Chay lai an toan (idempotent).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=", 2).map((s) => s.trim().replace(/^"|"$/g, ""))),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = process.argv.slice(2);
const argOf = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const APPLY = args.includes("--apply");
const CLEANUP = args.includes("--cleanup");
const FILE = argOf("--file");
const SCHOOL = argOf("--school");

const STAFF_ROLES = new Set(["gvcn", "gvbm", "to_truong", "bgh", "pht", "ke_toan"]);
const CONCURRENT_OK = new Set(["gvcn", "gvbm", "to_truong", "bgh", "pht"]);
const CAMPUS_KINDS = new Set(["main", "phan_hieu", "diem_truong"]);
const EMP_TYPES = new Set(["bien_che", "hop_dong", "thinh_giang"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const errors = [];
const warns = [];
const stats = {};
const bump = (k, n = 1) => (stats[k] = (stats[k] ?? 0) + n);

/* ================= Helpers ================= */
const norm = (v) => String(v ?? "").trim();
const normLow = (v) => norm(v).toLowerCase();
const splitList = (v) => norm(v).split(/[,;]/).map((s) => s.trim()).filter(Boolean);

async function readSheet(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) return [];
  const rows = [];
  const header = [];
  ws.getRow(1).eachCell((c) => header.push(norm(c.value).replace(/\s*\(\*\)\s*$/, "")));
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const obj = {};
    let empty = true;
    header.forEach((h, i) => {
      let v = row.getCell(i + 1).value;
      if (v && typeof v === "object" && v.text) v = v.text; // hyperlink cell
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      obj[h] = norm(v);
      if (norm(v)) empty = false;
    });
    // bo qua dong note italic cuoi sheet va dong trong
    if (!empty && !norm(obj[header[0]]).startsWith("mon_phu_trach:") && !norm(obj[header[0]]).match(/^[a-z_]+:/)) {
      obj.__line = n;
      rows.push(obj);
    }
  });
  return rows;
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
  for (let i = 0; i < 30; i++) {
    const { data } = await sb.from("profiles").select("id").eq("id", uid).maybeSingle();
    if (data) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`profile ${uid} khong duoc tao boi trigger`);
}

async function ensureUser(email, password, meta) {
  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: meta,
  });
  let uid;
  if (!error) uid = data.user.id;
  else if (error.message.includes("already")) {
    const u = await findAuthUser(email);
    if (!u) throw new Error(`auth ${email}: da ton tai nhung khong tim thay`);
    uid = u.id;
  } else throw new Error(`auth ${email}: ${error.message}`);
  await waitProfile(uid);
  const { error: pErr } = await sb.from("profiles").update({
    role: meta.role, school_id: meta.school_id ?? null,
    department_id: meta.department_id ?? null, campus_id: meta.campus_id ?? null,
    org_unit_id: meta.org_unit_id ?? null, full_name: meta.full_name, email,
    staff_code: meta.staff_code ?? null, employment_type: meta.employment_type ?? null,
    qualification: meta.qualification ?? null, concurrent_roles: meta.concurrent_roles ?? [],
  }).eq("id", uid).select("id");
  if (pErr) throw new Error(`profile ${email}: ${pErr.message}`);
  return uid;
}

/* ================= Resolve school ================= */
async function resolveSchool() {
  const isUuid = /^[0-9a-f-]{36}$/i.test(SCHOOL);
  const { data, error } = await sb.from("schools").select("id,name,code,level")
    .or(isUuid ? `id.eq.${SCHOOL}` : `code.eq.${SCHOOL.toUpperCase()}`).maybeSingle();
  if (error) throw new Error(`tim truong: ${error.message}`);
  if (!data) throw new Error(`Khong tim thay truong '${SCHOOL}' - tao truoc tai /dept/schools`);
  return data;
}

/* ================= CLEANUP ================= */
async function cleanup() {
  const school = await resolveSchool();
  const sid = school.id;
  console.log(`CLEANUP truong ${school.name} (${school.code}) [${sid}]`);

  const cls = (await sb.from("classes").select("id").eq("school_id", sid)).data ?? [];
  const classIds = cls.map((c) => c.id);
  const stuIds = classIds.length
    ? ((await sb.from("students").select("id").in("class_id", classIds)).data ?? []).map((s) => s.id)
    : [];
  const profIds = ((await sb.from("profiles").select("id").eq("school_id", sid)).data ?? []).map((p) => p.id);
  const parIds = ((await sb.from("parents").select("id").in("profile_id", profIds.length ? profIds : ["00000000-0000-0000-0000-000000000000"])).data ?? []).map((p) => p.id);
  // PH khong co tai khoan: tim qua parent_students -> students cua truong
  if (stuIds.length) {
    const extra = (await sb.from("parent_students").select("parent_id").in("student_id", stuIds)).data ?? [];
    for (const e of extra) if (!parIds.includes(e.parent_id)) parIds.push(e.parent_id);
  }

  // Chi xoa bang/cot thuc su ton tai - probe select <col> limit 0.
  const colOkCache = new Map();
  const hasCol = async (t, c) => {
    const k = `${t}.${c}`;
    if (!colOkCache.has(k)) {
      const { error } = await sb.from(t).select(c).limit(0);
      colOkCache.set(k, !error);
    }
    return colOkCache.get(k);
  };
  const del = async (t, q, col) => {
    if (col && !(await hasCol(t, col))) return;
    const { error } = await q;
    if (error) console.log(`  ! ${t}: ${error.message}`);
  };
  // FK-safe order
  if (classIds.length) {
    await del("timetable_entries", sb.from("timetable_entries").delete().in("class_id", classIds), "class_id");
    for (const t of ["attendance_records","period_logs","lesson_plans","grade_records","conduct_records",
      "activities","incidents","seating_charts","class_groups","daily_reports","messages",
      "appointments","leave_requests","substitute_requests","year_events","signoffs",
      "emulation_scores","support_plans","announcements","notifications","audit_logs","digest_deliveries"]) {
      await del(t, sb.from(t).delete().in("class_id", classIds), "class_id");
    }
  }
  if (parIds.length) {
    await del("parent_students", sb.from("parent_students").delete().in("parent_id", parIds), "parent_id");
    await del("parents", sb.from("parents").delete().in("id", parIds), "id");
  }
  if (stuIds.length) {
    for (const t of ["attendance_records","grade_records","conduct_records","support_plans",
      "incidents","leave_requests","messages","student_nlpc","exam_results","activity_attendance"]) {
      await del(t, sb.from(t).delete().in("student_id", stuIds), "student_id");
    }
    await del("students", sb.from("students").delete().in("id", stuIds), "id");
  }
  if (classIds.length) await del("classes", sb.from("classes").delete().in("id", classIds), "id");
  // giai phong head_id truoc khi xoa departments/profiles
  await sb.from("departments").update({ head_id: null }).eq("school_id", sid);
  await sb.from("profiles").update({ department_id: null, campus_id: null }).in("id", profIds.length ? profIds : ["00000000-0000-0000-0000-000000000000"]);
  await del("departments", sb.from("departments").delete().eq("school_id", sid), "school_id");
  if (profIds.length) {
    for (const t of ["substitute_requests","announcements","notifications","audit_logs","tasks",
      "lesson_plans","ai_jobs","digest_deliveries","tvc_questions","tvc_materials","tvc_matrices","tvc_exams"]) {
      await del(t, sb.from(t).delete().in("owner_id", profIds), "owner_id");
    }
    await del("teacher_subjects", sb.from("teacher_subjects").delete().in("teacher_id", profIds), "teacher_id");
    for (const t of ["notifications","audit_logs","announcements","messages","tasks",
      "substitute_requests","feature_grants","leave_requests","daily_reports","support_plans"]) {
      await del(t, sb.from(t).delete().in("profile_id", profIds), "profile_id");
      await del(`${t}:created_by`, sb.from(t).delete().in("created_by", profIds), "created_by");
    }
    await del("school_kpis", sb.from("school_kpis").delete().eq("school_id", sid), "school_id");
    await del("equipment", sb.from("equipment").delete().eq("school_id", sid), "school_id");
    await del("feature_grants", sb.from("feature_grants").delete().eq("school_id", sid), "school_id");
    await del("profiles", sb.from("profiles").delete().in("id", profIds), "id");
  }
  await del("campuses", sb.from("campuses").delete().eq("school_id", sid), "school_id");
  await del("subjects", sb.from("subjects").delete().eq("school_id", sid), "school_id");
  await del("academic_years", sb.from("academic_years").delete().eq("school_id", sid), "school_id");
  await del("schools", sb.from("schools").delete().eq("id", sid), "id");
  for (const uid of profIds) {
    const { error } = await sb.auth.admin.deleteUser(uid);
    if (error) console.log(`  ! auth ${uid}: ${error.message}`);
  }
  console.log(`  xong: ${profIds.length} tai khoan, ${classIds.length} lop, ${stuIds.length} HS, ${parIds.length} PH`);
}

/* ================= BOOTSTRAP ================= */
async function bootstrap() {
  if (!FILE) throw new Error("Thieu --file <khoi-tao-truong.xlsx>");
  const school = await resolveSchool();
  const sid = school.id;
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} truong ${school.name} (${school.code}) cap ${school.level}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const [coSo, toCM, canBo, lop, hocSinh, phuHuynh, tkb] = await Promise.all([
    readSheet(wb, "co_so"), readSheet(wb, "to_chuyen_mon"), readSheet(wb, "can_bo"),
    readSheet(wb, "lop"), readSheet(wb, "hoc_sinh"), readSheet(wb, "phu_huynh"),
    readSheet(wb, "tkb"),
  ]);

  // ---- reference data hien co ----
  const [{ data: subjData }, { data: year }, { data: exCls }, { data: exStu }, { data: exProf }] =
    await Promise.all([
      sb.from("subjects").select("id,name").eq("school_id", sid),
      sb.from("academic_years").select("id,name").eq("school_id", sid).eq("is_current", true).maybeSingle(),
      sb.from("classes").select("id,name").eq("school_id", sid),
      sb.from("students").select("id,code,class_id").in("class_id",
        ((await sb.from("classes").select("id").eq("school_id", sid)).data ?? []).map((c) => c.id).length
          ? ((await sb.from("classes").select("id").eq("school_id", sid)).data ?? []).map((c) => c.id)
          : ["00000000-0000-0000-0000-000000000000"]),
      sb.from("profiles").select("id,email").eq("school_id", sid),
    ]);
  if (!year) throw new Error("Truong chua co nam hoc (is_current) - tao truong bang /dept/schools truoc");
  const subjByName = new Map((subjData ?? []).map((s) => [normLow(s.name), s.id]));
  const clsByName = new Map((exCls ?? []).map((c) => [normLow(c.name), c.id]));
  const stuByCode = new Map((exStu ?? []).map((s) => [s.code, s.id]));
  const profByEmail = new Map((exProf ?? []).map((p) => [p.email, p.id]));

  /* ---- VALIDATE ---- */
  const V = (sheetName, line, msg) => errors.push(`${sheetName} dong ${line}: ${msg}`);

  for (const r of coSo) {
    if (!r["ten"]) V("co_so", r.__line, "thieu ten");
    if (!CAMPUS_KINDS.has(normLow(r["loai"]))) V("co_so", r.__line, `loai '${r["loai"]}' khong hop le (main|phan_hieu|diem_truong)`);
  }
  for (const r of toCM) {
    if (!r["ten"]) V("to_chuyen_mon", r.__line, "thieu ten");
    for (const m of splitList(r["mon_phu_trach"]))
      if (!subjByName.has(normLow(m))) V("to_chuyen_mon", r.__line, `mon '${m}' khong co trong bo mon cua truong`);
  }
  const staffEmails = new Set();
  for (const r of canBo) {
    const e = normLow(r["email"]);
    if (!r["ho_ten"]) V("can_bo", r.__line, "thieu ho_ten");
    if (!EMAIL_RE.test(e)) V("can_bo", r.__line, `email '${r["email"]}' khong hop le`);
    if (staffEmails.has(e)) V("can_bo", r.__line, `email trung '${e}'`);
    staffEmails.add(e);
    if (!STAFF_ROLES.has(normLow(r["vai_tro"]))) V("can_bo", r.__line, `vai_tro '${r["vai_tro"]}' khong hop le`);
    for (const cr of splitList(r["vai_tro_kiem"])) {
      if (!CONCURRENT_OK.has(normLow(cr))) V("can_bo", r.__line, `vai_tro_kiem '${cr}' khong hop le`);
      if (normLow(cr) === normLow(r["vai_tro"])) V("can_bo", r.__line, `vai_tro_kiem trung vai_tro chinh`);
    }
    if (r["mat_khau"] && r["mat_khau"].length < 8) V("can_bo", r.__line, "mat_khau < 8 ky tu");
    if (r["hop_dong"] && !EMP_TYPES.has(normLow(r["hop_dong"]))) V("can_bo", r.__line, `hop_dong '${r["hop_dong"]}' khong hop le`);
    for (const m of splitList(r["mon_day"]))
      if (!subjByName.has(normLow(m))) V("can_bo", r.__line, `mon_day '${m}' khong co trong bo mon`);
  }
  const coSoNames = new Set(coSo.map((r) => normLow(r["ten"])));
  for (const r of canBo)
    if (r["co_so"] && !coSoNames.has(normLow(r["co_so"]))) warns.push(`can_bo ${r["email"]}: co_so '${r["co_so"]}' khong co trong sheet co_so - dung co so chinh`);
  for (const r of lop) {
    if (!r["ten"]) V("lop", r.__line, "thieu ten");
    const g = parseInt(r["khoi"], 10);
    if (!(g >= 1 && g <= 12)) V("lop", r.__line, `khoi '${r["khoi"]}' khong hop le`);
    if (r["gvcn_email"] && !staffEmails.has(normLow(r["gvcn_email"])))
      V("lop", r.__line, `gvcn_email '${r["gvcn_email"]}' khong co trong sheet can_bo`);
    if (r["co_so"] && !coSoNames.has(normLow(r["co_so"])))
      V("lop", r.__line, `co_so '${r["co_so"]}' khong co trong sheet co_so`);
  }
  const hsCodes = new Set();
  for (const r of hocSinh) {
    if (!r["ma_hs"]) V("hoc_sinh", r.__line, "thieu ma_hs");
    if (!r["ho_ten"]) V("hoc_sinh", r.__line, "thieu ho_ten");
    if (hsCodes.has(r["ma_hs"])) V("hoc_sinh", r.__line, `ma_hs trung '${r["ma_hs"]}'`);
    hsCodes.add(r["ma_hs"]);
    if (r["gioi_tinh"] && !["nam", "nu"].includes(normLow(r["gioi_tinh"]))) V("hoc_sinh", r.__line, `gioi_tinh '${r["gioi_tinh"]}' khong hop le`);
  }
  for (const r of phuHuynh) {
    if (!r["ho_ten"]) V("phu_huynh", r.__line, "thieu ho_ten");
    if (!r["ma_hs_con"]) V("phu_huynh", r.__line, "thieu ma_hs_con");
    if (r["email"] && !EMAIL_RE.test(normLow(r["email"]))) V("phu_huynh", r.__line, `email '${r["email"]}' khong hop le`);
    if (r["email"] && !r["mat_khau"]) warns.push(`phu_huynh ${r["ho_ten"]}: co email nhung khong mat_khau - chi luu lien lac, khong cap tai khoan`);
    if (r["mat_khau"] && !r["email"]) V("phu_huynh", r.__line, "co mat_khau nhung thieu email dang nhap");
    if (r["mat_khau"] && r["mat_khau"].length < 8) V("phu_huynh", r.__line, "mat_khau < 8 ky tu");
  }
  const lopNames = new Set(lop.map((r) => normLow(r["ten"])));
  for (const r of hocSinh)
    if (r["lop"] && !lopNames.has(normLow(r["lop"])) && !clsByName.has(normLow(r["lop"])))
      V("hoc_sinh", r.__line, `lop '${r["lop"]}' khong co trong sheet lop`);
  for (const r of phuHuynh)
    for (const code of splitList(r["ma_hs_con"]))
      if (!hsCodes.has(code) && !stuByCode.has(code)) V("phu_huynh", r.__line, `ma_hs_con '${code}' khong co trong sheet hoc_sinh`);
  for (const r of tkb) {
    if (!lopNames.has(normLow(r["lop"])) && !clsByName.has(normLow(r["lop"]))) V("tkb", r.__line, `lop '${r["lop"]}' khong ton tai`);
    const d = parseInt(r["thu"], 10), p = parseInt(r["tiet"], 10);
    if (!(d >= 2 && d <= 7)) V("tkb", r.__line, `thu '${r["thu"]}' phai 2-7`);
    if (!(p >= 1 && p <= 10)) V("tkb", r.__line, `tiet '${r["tiet"]}' phai 1-10`);
    if (!subjByName.has(normLow(r["mon"]))) V("tkb", r.__line, `mon '${r["mon"]}' khong co trong bo mon`);
    if (r["giao_vien_email"] && !staffEmails.has(normLow(r["giao_vien_email"])) && !profByEmail.has(normLow(r["giao_vien_email"])))
      V("tkb", r.__line, `giao_vien_email '${r["giao_vien_email"]}' khong co trong can_bo`);
  }

  console.log(`\nValidate: ${coSo.length} co_so, ${toCM.length} to, ${canBo.length} can_bo, ${lop.length} lop, ${hocSinh.length} HS, ${phuHuynh.length} PH, ${tkb.length} tiet TKB`);
  for (const w of warns) console.log(`  WARN ${w}`);
  if (errors.length) {
    for (const e of errors) console.log(`  ERR  ${e}`);
    console.log(`\n${errors.length} loi - sua file roi chay lai. Khong ghi gi.`);
    process.exit(1);
  }
  if (!APPLY) {
    console.log("\nDRY-RUN OK - them --apply de ghi vao he thong.");
    return;
  }

  /* ---- APPLY ---- */
  // 1. campuses
  const campusByName = new Map();
  {
    const { data: ex } = await sb.from("campuses").select("id,name").eq("school_id", sid);
    for (const c of ex ?? []) campusByName.set(normLow(c.name), c.id);
  }
  for (const r of coSo) {
    const key = normLow(r["ten"]);
    if (campusByName.has(key)) { bump("campus_skip"); continue; }
    const { data, error } = await sb.from("campuses")
      .insert({ school_id: sid, name: r["ten"], kind: normLow(r["loai"]), address: r["dia_chi"] || null })
      .select("id").single();
    if (error) throw new Error(`campus ${r["ten"]}: ${error.message}`);
    campusByName.set(key, data.id);
    bump("campus_new");
  }
  const mainCampus = coSo.find((r) => normLow(r["loai"]) === "main") ?? coSo[0];
  const campusOf = (name) => campusByName.get(normLow(name || mainCampus?.["ten"])) ?? null;

  // 2. departments + subject_ids
  const deptByName = new Map();
  {
    const { data: ex } = await sb.from("departments").select("id,name,subject_ids").eq("school_id", sid);
    for (const d of ex ?? []) deptByName.set(normLow(d.name), d.id);
  }
  for (const r of toCM) {
    const sids = splitList(r["mon_phu_trach"]).map((m) => subjByName.get(normLow(m))).filter(Boolean);
    const key = normLow(r["ten"]);
    if (deptByName.has(key)) {
      await sb.from("departments").update({ subject_ids: sids }).eq("id", deptByName.get(key));
      bump("dept_upd");
    } else {
      const { data, error } = await sb.from("departments")
        .insert({ school_id: sid, name: r["ten"], subject_ids: sids }).select("id").single();
      if (error) throw new Error(`dept ${r["ten"]}: ${error.message}`);
      deptByName.set(key, data.id);
      bump("dept_new");
    }
  }
  // truong cua toCM sheet khong khai -> van ton tai dept mac dinh tu createSchool; giu nguyen.

  // 3. can_bo -> auth + profiles + teacher_subjects
  for (const r of canBo) {
    const email = normLow(r["email"]);
    const deptId = r["to_chuyen_mon"] ? deptByName.get(normLow(r["to_chuyen_mon"])) ?? null : null;
    const uid = await ensureUser(email, r["mat_khau"] || "Demo@123456", {
      role: normLow(r["vai_tro"]), school_id: sid, full_name: r["ho_ten"],
      campus_id: campusOf(r["co_so"]), department_id: deptId,
      staff_code: r["ma_nv"] || null, employment_type: normLow(r["hop_dong"]) || null,
      qualification: r["trinh_do"] || null,
      concurrent_roles: splitList(r["vai_tro_kiem"]).map((s) => normLow(s)),
    });
    profByEmail.set(email, uid);
    bump("staff");
    for (const m of splitList(r["mon_day"])) {
      const subId = subjByName.get(normLow(m));
      if (!subId) continue;
      const { error } = await sb.from("teacher_subjects")
        .upsert({ teacher_id: uid, subject_id: subId }, { onConflict: "teacher_id,subject_id" });
      if (error) throw new Error(`teacher_subjects ${email}/${m}: ${error.message}`);
      bump("mon_day");
    }
  }

  // 4. head_id cua to tu truong_to_email
  for (const r of toCM) {
    const headEmail = normLow(r["truong_to_email"]);
    if (!headEmail) continue;
    const headId = profByEmail.get(headEmail);
    if (!headId) { warns.push(`to ${r["ten"]}: truong_to_email ${headEmail} khong co tai khoan`); continue; }
    await sb.from("departments").update({ head_id: headId }).eq("id", deptByName.get(normLow(r["ten"])));
    bump("dept_head");
  }

  // 5. lop
  for (const r of lop) {
    const key = normLow(r["ten"]);
    const gvcnId = r["gvcn_email"] ? profByEmail.get(normLow(r["gvcn_email"])) ?? null : null;
    const payload = {
      school_id: sid, academic_year_id: year.id, name: r["ten"],
      grade: parseInt(r["khoi"], 10), campus_id: campusOf(r["co_so"]),
      gvcn_id: gvcnId, status: "active",
    };
    if (clsByName.has(key)) {
      await sb.from("classes").update(payload).eq("id", clsByName.get(key));
      bump("class_upd");
    } else {
      const { data, error } = await sb.from("classes").insert(payload).select("id").single();
      if (error) throw new Error(`lop ${r["ten"]}: ${error.message}`);
      clsByName.set(key, data.id);
      bump("class_new");
    }
  }

  // 6. hoc_sinh
  const stuRows = [];
  for (const r of hocSinh) {
    if (stuByCode.has(r["ma_hs"])) { bump("hs_skip"); continue; }
    const classId = clsByName.get(normLow(r["lop"]));
    if (!classId) { warns.push(`HS ${r["ma_hs"]}: lop '${r["lop"]}' khong ton tai - bo qua`); continue; }
    stuRows.push({
      code: r["ma_hs"], full_name: r["ho_ten"], dob: r["ngay_sinh"] || null,
      gender: normLow(r["gioi_tinh"]) || null, class_id: classId,
      national_id: r["ma_dinh_danh"] || null, status: "active",
    });
  }
  if (stuRows.length) {
    const { error } = await sb.from("students").insert(stuRows);
    if (error) throw new Error(`hoc_sinh: ${error.message}`);
    bump("hs_new", stuRows.length);
    const { data: all } = await sb.from("students").select("id,code").in("class_id", [...clsByName.values()]);
    for (const s of all ?? []) stuByCode.set(s.code, s.id);
  }

  // 7. phu_huynh + lien ket + tai khoan (tuy chon)
  // Dedupe PH: theo email trong file (email la dinh danh tai khoan);
  // PH khong email: chi dedupe trong PH da link vao HS cua truong nay
  // (tranh match trung ten voi PH truong khac + tranh cap 1000 rows PostgREST).
  const fileEmails = [...new Set(phuHuynh.map((r) => normLow(r["email"])).filter(Boolean))];
  const { data: exParByEmail } = fileEmails.length
    ? await sb.from("parents").select("id,email").in("email", fileEmails)
    : { data: [] };
  const parByEmail = new Map((exParByEmail ?? []).map((p) => [normLow(p.email), p.id]));
  const { data: linksAll } = stuByCode.size
    ? await sb.from("parent_students").select("parent_id").in("student_id", [...stuByCode.values()])
    : { data: [] };
  const schoolParIds = [...new Set((linksAll ?? []).map((l) => l.parent_id))];
  const { data: schoolPars } = schoolParIds.length
    ? await sb.from("parents").select("id,full_name").in("id", schoolParIds)
    : { data: [] };
  const parByName = new Map((schoolPars ?? []).map((p) => [normLow(p.full_name), p.id]));
  for (const r of phuHuynh) {
    let parentId = r["email"]
      ? parByEmail.get(normLow(r["email"]))
      : parByName.get(normLow(r["ho_ten"]));
    if (!parentId) {
      const { data, error } = await sb.from("parents").insert({
        full_name: r["ho_ten"], relationship: normLow(r["quan_he"]) || null,
        phone: r["dien_thoai"] || null, email: normLow(r["email"]) || null,
      }).select("id").single();
      if (error) throw new Error(`phu_huynh ${r["ho_ten"]}: ${error.message}`);
      parentId = data.id;
      bump("ph_new");
    } else bump("ph_skip");
    if (r["email"]) parByEmail.set(normLow(r["email"]), parentId);
    parByName.set(normLow(r["ho_ten"]), parentId);
    for (const code of splitList(r["ma_hs_con"])) {
      const stuId = stuByCode.get(code);
      if (!stuId) { warns.push(`PH ${r["ho_ten"]}: ma_hs '${code}' khong ton tai - bo qua link`); continue; }
      const { error } = await sb.from("parent_students")
        .upsert({ parent_id: parentId, student_id: stuId }, { onConflict: "parent_id,student_id" });
      if (error) throw new Error(`parent_students ${code}: ${error.message}`);
      bump("ph_link");
    }
    if (r["email"] && r["mat_khau"]) {
      const { data: par } = await sb.from("parents").select("profile_id").eq("id", parentId).single();
      if (!par?.profile_id) {
        const uid = await ensureUser(normLow(r["email"]), r["mat_khau"], {
          role: "phu_huynh", school_id: sid, full_name: r["ho_ten"],
        });
        await sb.from("parents").update({ profile_id: uid, email: normLow(r["email"]) })
          .eq("id", parentId).is("profile_id", null);
        bump("ph_account");
      }
    }
  }

  // 8. tkb
  const tkbRows = [];
  for (const r of tkb) {
    const classId = clsByName.get(normLow(r["lop"]));
    const subId = subjByName.get(normLow(r["mon"]));
    if (!classId || !subId) continue;
    tkbRows.push({
      class_id: classId, weekday: parseInt(r["thu"], 10), period: parseInt(r["tiet"], 10),
      subject_id: subId,
      teacher_id: r["giao_vien_email"] ? profByEmail.get(normLow(r["giao_vien_email"])) ?? null : null,
      room: r["phong"] || null,
    });
  }
  if (tkbRows.length) {
    const { error } = await sb.from("timetable_entries")
      .upsert(tkbRows, { onConflict: "class_id,weekday,period" });
    if (error) throw new Error(`tkb: ${error.message}`);
    bump("tkb", tkbRows.length);
  }

  console.log("\nDONE:", JSON.stringify(stats));
  for (const w of warns) console.log(`  WARN ${w}`);
}

/* ================= main ================= */
try {
  if (!SCHOOL) throw new Error("Thieu --school <ma-truong|uuid>");
  if (CLEANUP) await cleanup();
  else await bootstrap();
} catch (e) {
  console.error(`\nFAIL: ${e.message}`);
  process.exit(1);
}
