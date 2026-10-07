// CR-029: seed 3 truong x 100 giao vien + ngan hang cau hoi chung moi truong.
// Chay: node scripts/seed-test-schools.mjs [--dry]
// Idempotent: skip user da ton tai (email), upsert questions theo code.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const DRY = process.argv.includes("--dry");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Thieu SUPABASE env");
const sb = createClient(url, key, { auth: { persistSession: false } });

const SCHOOLS = [
  { id: "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285", tag: "nd", name: "THCS Nguyễn Du" },
  { id: "31d29038-cb2c-4c52-b245-a47afc4bd45b", tag: "cva", name: "Tiểu học Chu Văn An" },
  { id: "e296f4d3-59ff-43b8-b880-f4316e4f8082", tag: "kd", name: "Tiểu học Kim Đồng" },
];
const PER_SCHOOL = 100;
const PASS = "demo1234";

const FAMILY = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ"];
const GIVEN = ["Văn", "Thị", "Hữu", "Minh", "Thu", "Ngọc", "Quốc", "Thanh", "Hồng", "Đức"];
const NAME = ["An", "Bình", "Chi", "Dũng", "Hà", "Hùng", "Lan", "Mai", "Nam", "Phúc", "Quân", "Sơn", "Thảo", "Tuấn", "Vy", "Yến"];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const fullName = () => `${rnd(FAMILY)} ${rnd(GIVEN)} ${rnd(NAME)}`;

async function ensureUser(email, meta) {
  // createUser loi "da ton tai" -> lay lai id tu profiles
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASS, email_confirm: true, app_metadata: meta,
  });
  if (!error) {
    // trigger chi tao profile mac dinh - set role/truong ro rang
    await sb.from("profiles").update({
      role: meta.role, school_id: meta.school_id ?? null,
      department_id: meta.department_id ?? null,
      org_unit_id: meta.org_unit_id ?? null,
      full_name: meta.full_name,
    }).eq("id", data.user.id);
    return data.user.id;
  }
  const { data: p } = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
  if (p) {
    await sb.from("profiles").update({ role: meta.role, school_id: meta.school_id }).eq("id", p.id);
    return p.id;
  }
  throw new Error(`${email}: ${error.message}`);
}

async function main() {
  console.log("Seed 3 truong x", PER_SCHOOL, "GV" + (DRY ? " (dry)" : ""));
  if (DRY) return;
  const teacherIds = {};
  for (const sc of SCHOOLS) {
    const ids = [];
    for (let i = 1; i <= PER_SCHOOL; i++) {
      const role = i <= 2 ? "to_truong" : i === 3 ? "bgh" : i % 3 === 0 ? "gvcn" : "gvbm";
      const email = `gv${String(i).padStart(3, "0")}@${sc.tag}.test`;
      const id = await ensureUser(email, {
        role, school_id: sc.id, full_name: fullName(),
      });
      ids.push({ id, email, role });
      if (i % 20 === 0) console.log(`  ${sc.name}: ${i}/${PER_SCHOOL}`);
      await new Promise((r) => setTimeout(r, 60));
    }
    teacherIds[sc.id] = ids;
    // tvc.profiles cho FK questions.owner_id
    await sb.from("tvc_profiles").upsert(
      ids.map((t) => ({ id: t.id, role: "giao_vien", full_name: fullName(), email: t.email })),
      { onConflict: "id" },
    );
  }

  // Ngan hang chung moi truong: clone 226 cau mau cua gvcn x6 bien the,
  // chia deu cho GV truong do.
  const { data: tpl } = await sb
    .from("tvc_questions")
    .select("stem, context, qtype, level, points, answer, solution, standard_ids, subject_code, grade")
    .eq("owner_id", "bb57612a-d2ff-4114-981b-634fea437361");
  console.log(`Template: ${tpl?.length ?? 0} cau mau`);
  const REPL = 6;
  for (const sc of SCHOOLS) {
    const ids = teacherIds[sc.id];
    const rows = [];
    let v = 0;
    for (const q of tpl ?? []) {
      for (let k = 0; k < REPL; k++) {
        v += 1;
        const owner = ids[v % ids.length];
        rows.push({
          owner_id: owner.id,
          school_id: sc.id,
          code: `${sc.tag.toUpperCase()}-${String(v).padStart(5, "0")}`,
          stem: `${q.stem} (BT-${v})`,
          context: q.context,
          qtype: q.qtype,
          level: q.level,
          points: q.points,
          answer: q.answer,
          solution: q.solution,
          standard_ids: q.standard_ids,
          subject_code: q.subject_code,
          grade: q.grade,
          source: "imported",
          review_state: v % 4 === 0 ? "unreviewed" : "approved",
        });
      }
    }
    // idempotent: xoa cau seed cu cua truong roi insert lai
    await sb.from("tvc_questions").delete().eq("school_id", sc.id).like("code", `${sc.tag.toUpperCase()}-%`);
    const { error } = await sb.from("tvc_questions").insert(rows);
    if (error) console.error(sc.name, error.message);
    else console.log(`${sc.name}: ${rows.length} cau hoi`);
  }
  console.log("XONG");
}
main().catch((e) => { console.error(e); process.exit(1); });
