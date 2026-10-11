import type { PiiName } from "@/lib/ai-privacy";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

/** CR-049 r8 H4 + r9 H9 + r10 H6/H7: roster dinh danh cua TRUONG -> bang
 *  alias cho PII minimization.
 *  - r9: lay TAT CA lop/HS (ke ca inactive/chuyen truong).
 *  - r10 H6: dung admin client - caller chay duoi RLS (campus PHT) chi
 *    doc duoc MOT PHAN roster, thanh cong-nhung-thieu se bi coi la day
 *    du va ten HS campus khac lo ra provider. Roster PII bat buoc day du
 *    truong, fail-closed khi khong chung minh duoc coverage.
 *  - r10 H7: them ten GIAO VIEN (profiles cung truong, prefix GV) va
 *    PHU HUYNH (lien ket voi HS truong, prefix PH) - free text nhu
 *    meeting notes/de xuat thuong nhac ten GV/PH.
 *  Tra ve { error: true } khi bat ky nguon nao loi/truncate - route
 *  phai fail-closed, khong duoc goi AI khi roster khong day du. */
export async function schoolPiiNames(
  schoolId: string,
): Promise<{ names: PiiName[]; error?: never } | { names?: never; error: true }> {
  if (!schoolId) return { error: true };
  const admin = createAdminClient();

  // HS: moi lop cua truong (active + inactive), phan trang ca 2 tang.
  const clsRes = await fetchAllRows<{ id: string }>((f, t) =>
    admin
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .order("id")
      .range(f, t),
  );
  if (clsRes.error || clsRes.truncated) return { error: true };
  const clsIds = clsRes.rows.map((c) => c.id);

  const studentRows: { full_name: string; id: string }[] = [];
  for (let i = 0; i < clsIds.length; i += 200) {
    const chunk = clsIds.slice(i, i + 200);
    const stuRes = await fetchAllRows<{ full_name: string; id: string }>(
      (f, t) =>
        admin
          .from("students")
          .select("id, full_name")
          .in("class_id", chunk)
          .order("id")
          .range(f, t),
    );
    if (stuRes.error || stuRes.truncated) return { error: true };
    studentRows.push(...stuRes.rows);
  }

  // GV: moi profile thuoc truong (moi role - meeting notes nhac ten bat ky ai).
  const profRes = await fetchAllRows<{ full_name: string }>((f, t) =>
    admin
      .from("profiles")
      .select("full_name")
      .eq("school_id", schoolId)
      .order("id")
      .range(f, t),
  );
  if (profRes.error || profRes.truncated) return { error: true };

  // PH: cha me lien ket voi HS cua truong (distinct parent_id).
  const parentRows: { full_name: string }[] = [];
  if (studentRows.length) {
    const pids = new Set<string>();
    const stuIds = studentRows.map((s) => s.id);
    for (let i = 0; i < stuIds.length; i += 200) {
      const linksRes = await fetchAllRows<{ parent_id: string }>((f, t) =>
        admin
          .from("parent_students")
          .select("parent_id")
          .in("student_id", stuIds.slice(i, i + 200))
          .order("parent_id")
          .range(f, t),
      );
      if (linksRes.error || linksRes.truncated) return { error: true };
      for (const l of linksRes.rows) pids.add(l.parent_id);
    }
    const pidList = [...pids];
    for (let i = 0; i < pidList.length; i += 200) {
      const parRes = await fetchAllRows<{ full_name: string }>((f, t) =>
        admin
          .from("parents")
          .select("full_name")
          .in("id", pidList.slice(i, i + 200))
          .order("id")
          .range(f, t),
      );
      if (parRes.error || parRes.truncated) return { error: true };
      parentRows.push(...parRes.rows);
    }
  }

  const names: PiiName[] = [];
  let i = 0;
  for (const s of studentRows) {
    if (s.full_name) names.push({ name: s.full_name, alias: `⟦HS${String(++i).padStart(3, "0")}⟧` });
  }
  for (const t of profRes.rows) {
    if (t.full_name) names.push({ name: t.full_name, alias: `⟦GV${String(++i).padStart(3, "0")}⟧` });
  }
  for (const p of parentRows) {
    if (p.full_name) names.push({ name: p.full_name, alias: `⟦PH${String(++i).padStart(3, "0")}⟧` });
  }
  return { names };
}
