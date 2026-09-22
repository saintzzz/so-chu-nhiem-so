"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

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
  const profile = await getProfile();
  if (!profile?.school_id) return { created: 0, error: "Thiếu hồ sơ trường." };
  if (pairs.length === 0) return { created: 0, error: "Chưa chọn mục nào." };
  if (pairs.length > 200) return { created: 0, error: "Tối đa 200 mục mỗi lần." };

  const supabase = await createClient();
  const studentIds = [...new Set(pairs.map((p) => p.studentId))];
  const subjectIds = [...new Set(pairs.map((p) => p.subjectId))];

  // Verify every student belongs to the user's school and an allowed class.
  const { data: stData, error: stErr } = await supabase
    .from("students")
    .select("id,class_id,classes!inner(id,school_id,gvcn_id)")
    .in("id", studentIds)
    .eq("status", "active");
  if (stErr) return { created: 0, error: stErr.message };

  const allowed = new Map<string, string>();
  for (const s of (stData ?? []) as {
    id: string;
    class_id: string;
    classes: { school_id: string; gvcn_id: string | null } | { school_id: string; gvcn_id: string | null }[];
  }[]) {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
    if (!cls || cls.school_id !== profile.school_id) continue;
    if (profile.role === "gvcn" && cls.gvcn_id !== profile.id) continue;
    allowed.set(s.id, s.class_id);
  }
  if (allowed.size !== studentIds.length) {
    return { created: 0, error: "Có học sinh không thuộc lớp bạn phụ trách." };
  }

  // Verify subjects belong to the school.
  const { data: subData } = await supabase
    .from("subjects")
    .select("id")
    .in("id", subjectIds)
    .eq("school_id", profile.school_id);
  const allowedSubjects = new Set(
    ((subData ?? []) as { id: string }[]).map((s) => s.id),
  );

  // Skip pairs that already have an active plan.
  const { data: existing } = await supabase
    .from("support_plans")
    .select("student_id,subject_id")
    .in("student_id", studentIds)
    .neq("status", "cancelled");
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
  if (insErr) return { created: 0, error: insErr.message };

  logAudit(supabase, {
    action: "support_plans.create",
    entity: "support_plans",
    payload: { count: rows.length, studentIds },
  });

  revalidatePath("/academics/support");
  revalidatePath("/academics/plans");
  return { created: rows.length };
}
