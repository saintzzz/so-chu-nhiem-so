/**
 * Seed trường TIỂU HỌC demo - để test chế độ đánh giá T/H/C + NLPC.
 * Tạo school level='th' độc lập với THCS Nguyễn Du.
 * Usage: node scripts/seed-th.mjs
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

const HO = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Huỳnh","Phan","Vũ","Võ","Đặng","Bùi","Đỗ","Hồ","Ngô","Dương","Lý"];
const DEM_NAM = ["Văn","Đức","Minh","Quốc","Gia","Hoàng","Nhật","Đình","Quang","Anh"];
const DEM_NU = ["Thị","Ngọc","Thu","Diễm","Bảo","Kim","Yến","Thanh","Mai","Hồng"];
const TEN_NAM = ["Anh","Bảo","Châu","Dũng","Đạt","Huy","Hùng","Khoa","Kiên","Long","Minh","Nam","Phong","Phúc","Quân","Sơn","Tuấn","Tài","Thắng","Vinh"];
const TEN_NU = ["Anh","Ánh","Chi","Dương","Giang","Hà","Hương","Khuê","Linh","My","Ngân","Ngọc","Nhi","Nhung","Tâm","Trâm","Vy","Yến","Mai","Lan"];
const vnName = (g) =>
  g === "nam"
    ? `${rand(HO)} ${rand(DEM_NAM)} ${rand(TEN_NAM)}`
    : `${rand(HO)} ${rand(DEM_NU)} ${rand(TEN_NU)}`;

async function createAuthUser(email, password, role, full_name, school_id) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role, full_name, school_id },
  });
  if (error) {
    if (error.message.includes("already")) {
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      return list.users.find((x) => x.email === email)?.id;
    }
    throw new Error(`auth ${email}: ${error.message}`);
  }
  return data.user.id;
}

async function batch(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

async function main() {
  console.log("Seeding TIỂU HỌC demo...");

  const { data: school } = await supabase
    .from("schools")
    .upsert(
      { name: "Tiểu học Chu Văn An", code: "TH-CVA", level: "th" },
      { onConflict: "code" },
    )
    .select()
    .single();
  const sid = school.id;
  console.log("school:", sid, "level:", school.level);

  const { data: year } = await supabase
    .from("academic_years")
    .upsert(
      { school_id: sid, name: "2026-2027", start_date: "2026-08-10", end_date: "2027-05-31", is_current: true },
      { onConflict: "school_id,name" },
    )
    .select()
    .single();
  const yid = year.id;

  // Môn học + HĐGD tiểu học
  const SUBJECTS = [
    "Tiếng Việt","Toán","Đạo đức","Tự nhiên và Xã hội","Khoa học",
    "Lịch sử và Địa lý","Tin học và Công nghệ","Tiếng Anh",
    "Âm nhạc","Mĩ thuật","Thể dục","Hoạt động trải nghiệm",
  ];
  const { data: existingSub } = await supabase
    .from("subjects").select("id").eq("school_id", sid).limit(1);
  if (!existingSub?.length) {
    await batch("subjects", SUBJECTS.map((name) => ({ school_id: sid, name })));
  }

  // GVCN accounts - 1 demo account chủ nhiệm 3A, thêm 2 giáo viên phụ
  const gvcnMain = await createAuthUser("gvcn-th@demo.scn", "demo1234", "gvcn", "Nguyễn Thị Thu Hà", sid);
  await supabase.from("profiles").update({ school_id: sid }).eq("id", gvcnMain);
  const gvcn2 = await createAuthUser("gvcn-th2@school.scn", "demo1234", "gvcn", "Trần Minh Đức", sid);
  await supabase.from("profiles").update({ school_id: sid }).eq("id", gvcn2);
  const gvcn3 = await createAuthUser("gvcn-th3@school.scn", "demo1234", "gvcn", "Lê Thu Trang", sid);
  await supabase.from("profiles").update({ school_id: sid }).eq("id", gvcn3);
  const bghTh = await createAuthUser("bgh-th@demo.scn", "demo1234", "bgh", "Phạm Văn Hiệu", sid);
  await supabase.from("profiles").update({ school_id: sid }).eq("id", bghTh);
  console.log("users created");

  // Classes 1A, 3A, 5A
  const classDefs = [
    { name: "1A", grade: 1, gvcn_id: gvcn2 },
    { name: "3A", grade: 3, gvcn_id: gvcnMain },
    { name: "5A", grade: 5, gvcn_id: gvcn3 },
  ];
  const { data: existingCls } = await supabase
    .from("classes").select("id").eq("school_id", sid).eq("academic_year_id", yid).limit(1);
  if (existingCls?.length) {
    console.log("classes already seeded - skip");
    return;
  }
  await batch(
    "classes",
    classDefs.map((c) => ({
      school_id: sid, academic_year_id: yid, status: "active", ...c,
    })),
  );
  const { data: classes } = await supabase
    .from("classes").select().eq("academic_year_id", yid);

  // Students - 25/lớp, dob theo khối (lớp 1 ~ 2019, lớp 3 ~ 2017, lớp 5 ~ 2015)
  const studentRows = [];
  let seq = 0;
  for (const c of classes) {
    const baseYear = 2026 - 6 - c.grade;
    for (let i = 0; i < 25; i++) {
      const gender = chance(0.5) ? "nam" : "nu";
      seq += 1;
      studentRows.push({
        class_id: c.id,
        code: `TH${String(seq).padStart(5, "0")}`,
        national_id: `2${String(200000000 + seq)}`,
        full_name: vnName(gender),
        gender,
        dob: `${baseYear}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`,
        status: "active",
        positive_points: ri(0, 15),
      });
    }
  }
  await batch("students", studentRows);
  console.log("done. Login: gvcn-th@demo.scn / demo1234 (lớp 3A), bgh-th@demo.scn (BGH)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
