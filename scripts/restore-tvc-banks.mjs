/**
 * CR-036: khoi phuc ngan hang cau hoi tvc360 cho 3 truong demo.
 * Bi mat do xoa auth users cu (tvc.profiles cascade). Clone tu ngan hang mau
 * (school_id null) va gan owner = GV moi cua tung truong.
 *   node scripts/restore-tvc-banks.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCHOOLS = [
  { id: "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285", tag: "ND", name: "THCS Nguyễn Du" },
  { id: "31d29038-cb2c-4c52-b245-a47afc4bd45b", tag: "CVA", name: "TH Chu Văn An" },
  { id: "e296f4d3-59ff-43b8-b880-f4316e4f8082", tag: "KD", name: "TH Kim Đồng" },
];
const PER_SCHOOL = 360;

async function main() {
  // ngan hang mau: tat ca cau hoi school_id null
  const tpl = [];
  for (let off = 0; ; off += 1000) {
    const { data } = await sb.from("tvc_questions")
      .select("stem,context,qtype,level,points,answer,solution,standard_ids,subject_code,grade")
      .is("school_id", null).range(off, off + 999);
    if (!data?.length) break;
    tpl.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`template: ${tpl.length} cau`);
  if (!tpl.length) throw new Error("khong co cau hoi mau");

  for (const sc of SCHOOLS) {
    const { data: teachers } = await sb.from("profiles").select("id")
      .eq("school_id", sc.id).in("role", ["gvcn", "gvbm", "to_truong"]);
    const ids = teachers.map((t) => t.id);
    if (!ids.length) throw new Error(`${sc.name}: khong co GV`);

    // xoa ban seed cu cua truong (neu co) roi insert moi
    await sb.from("tvc_questions").delete().eq("school_id", sc.id).like("code", `${sc.tag}-%`);
    const rows = [];
    for (let i = 0; i < PER_SCHOOL; i++) {
      const q = tpl[i % tpl.length];
      rows.push({
        ...q,
        code: `${sc.tag}-${String(i + 1).padStart(5, "0")}`,
        stem: q.stem,
        owner_id: ids[i % ids.length],
        school_id: sc.id,
        source: "imported",
        review_state: i % 4 === 0 ? "unreviewed" : "approved",
      });
    }
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await sb.from("tvc_questions").insert(rows.slice(i, i + 400));
      if (error) throw new Error(`${sc.name} questions: ${error.message}`);
    }
    console.log(`${sc.name}: ${rows.length} cau hoi, ${ids.length} GV`);

    // reassign cac ban ghi orphan (questions/exams/matrices) sang GV moi
    for (const [table, col] of [["tvc_questions", "owner_id"], ["tvc_exams", "owner_id"], ["tvc_matrices", "owner_id"], ["tvc_khbd_templates", "created_by"]]) {
      const { data: orphans } = await sb.from(table).select(`id,${col}`).eq("school_id", sc.id);
      let n = 0;
      for (const r of orphans ?? []) {
        const { data: p } = await sb.from("profiles").select("id").eq("id", r[col]).maybeSingle();
        if (!p) { await sb.from(table).update({ [col]: ids[n++ % ids.length] }).eq("id", r.id); }
      }
      if (n) console.log(`  ${table}: ${n} orphan -> GV moi`);
    }
    // rows khong co school_id nhung owner orphan
    for (const [table, col] of [["tvc_exams", "owner_id"], ["tvc_matrices", "owner_id"]]) {
      const { data: orphans } = await sb.from(table).select(`id,${col}`);
      let n = 0;
      for (const r of orphans ?? []) {
        const { data: p } = await sb.from("profiles").select("id").eq("id", r[col]).maybeSingle();
        if (!p) { await sb.from(table).update({ [col]: ids[n++ % ids.length] }).eq("id", r.id); }
      }
      if (n) console.log(`  ${table} (no school): ${n} orphan -> GV ${sc.tag}`);
    }
  }
  console.log("DONE.");
}
main().catch((e) => { console.error(e); process.exit(1); });
