"use server";

import { revalidatePath } from "next/cache";
import { assertModule } from "@/lib/modules";
import { checkActionRole, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { hasRole } from "@/lib/roles";
import { fetchAllRowsIn } from "@/lib/supabase/fetch-all";

export interface SupportPlanPair {
  studentId: string;
  subjectId: string;
  avg: number;
}

/** Bulk-create pending support_plans for weak student+subject pairs. */
export async function createSupportPlans(
  pairs: SupportPlanPair[],
): Promise<{ created: number; error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { created: 0, error: deny };
  const modErr = await assertModule("ky_thi_danh_gia");
  if (modErr) return { created: 0, error: modErr };
  const profile = await getProfile();
  if (!profile?.school_id) return { created: 0, error: "Thiếu hồ sơ trường." };
  if (pairs.length === 0) return { created: 0, error: "Chưa chọn mục nào." };
  if (pairs.length > 200) return { created: 0, error: "Tối đa 200 mục mỗi lần." };

  const supabase = await createClient();
  const studentIds = [...new Set(pairs.map((p) => p.studentId))];
  const subjectIds = [...new Set(pairs.map((p) => p.subjectId))];

  // Verify every student belongs to the user's school and an allowed class.
  // r26: .in chunk + phan trang - bulk create co the truyen >1000 ids.
  const stRes = await fetchAllRowsIn<{
    id: string;
    class_id: string;
    classes: { school_id: string; gvcn_id: string | null } | { school_id: string; gvcn_id: string | null }[];
  }>((chunk, f, t) =>
    supabase
      .from("students")
      .select("id,class_id,classes!inner(id,school_id,gvcn_id)")
      .in("id", chunk)
      .eq("status", "active")
      .order("id")
      .range(f, t),
  studentIds);
  if (stRes.error || stRes.truncated) {
    console.error("[support] list students:", stRes.error ?? "truncated");
    return { created: 0, error: "Không tải được danh sách học sinh - vui lòng thử lại." };
  }
  const stData = stRes.rows;

  const allowed = new Map<string, string>();
  for (const s of (stData ?? []) as {
    id: string;
    class_id: string;
    classes: { school_id: string; gvcn_id: string | null } | { school_id: string; gvcn_id: string | null }[];
  }[]) {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
    if (!cls || cls.school_id !== profile.school_id) continue;
    if (hasRole(profile, "gvcn") && cls.gvcn_id !== profile.id) continue;
    allowed.set(s.id, s.class_id);
  }
  if (allowed.size !== studentIds.length) {
    return { created: 0, error: "Có học sinh không thuộc lớp bạn phụ trách." };
  }

  // Verify subjects belong to the school - r21 M: SELECT loi khong
  // duoc suy ra "khong mon nao hop le" (loc het) hoac "chua co ke
  // hoach nao" (INSERT trung).
  const { data: subData, error: subErr } = await supabase
    .from("subjects")
    .select("id")
    .in("id", subjectIds)
    .eq("school_id", profile.school_id);
  if (subErr) {
    console.error("[support] subjects lookup:", subErr.message);
    return { created: 0, error: "Lỗi tra cứu môn học - vui lòng thử lại." };
  }
  const allowedSubjects = new Set(
    ((subData ?? []) as { id: string }[]).map((s) => s.id),
  );

  // Skip pairs that already have an active plan.
  const exRes = await fetchAllRowsIn<{ student_id: string; subject_id: string }>(
    (chunk, f, t) =>
      supabase
        .from("support_plans")
        .select("student_id,subject_id")
        .in("student_id", chunk)
        .neq("status", "cancelled")
        .order("id")
        .range(f, t),
    studentIds,
  );
  if (exRes.error || exRes.truncated) {
    console.error("[support] existing plans:", exRes.error ?? "truncated");
    return { created: 0, error: "Không tải được kế hoạch hiện có để chống trùng - vui lòng thử lại." };
  }
  const existing = exRes.rows;
  const existingKeys = new Set(
    ((existing ?? []) as { student_id: string; subject_id: string }[]).map(
      (e) => `${e.student_id}:${e.subject_id}`,
    ),
  );

  const rows = pairs
    .filter(
      (p) =>
        allowed.has(p.studentId) &&
        allowedSubjects.has(p.subjectId) &&
        !existingKeys.has(`${p.studentId}:${p.subjectId}`),
    )
    .map((p) => ({
      student_id: p.studentId,
      subject_id: p.subjectId,
      reason: `Điểm trung bình môn ${p.avg.toFixed(1)} dưới 5.0`,
      plan: "Phụ đạo 2 buổi/tuần, giao bài tập bổ sung, theo dõi tiến độ hàng tuần",
      status: "pending" as const,
      created_by: profile.id,
    }));

  if (rows.length === 0) {
    return { created: 0, error: "Tất cả mục đã chọn đều đã có kế hoạch." };
  }

  const { error: insErr } = await supabase.from("support_plans").insert(rows);
  if (insErr) {
    console.error("[support] insert support_plans:", insErr.message);
    return { created: 0, error: "Không tạo được kế hoạch phụ đạo - vui lòng thử lại." };
  }

  logAudit(supabase, {
    action: "support_plans.create",
    entity: "support_plans",
    payload: { count: rows.length, studentIds },
  });

  revalidatePath("/academics/support");
  revalidatePath("/academics/plans");
  return { created: rows.length };
}
