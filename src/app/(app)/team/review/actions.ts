"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/modules";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface AssessmentRow {
  id: string;
  teacher_id: string;
  status: string;
}

export async function approveAssessment(assessmentId: string) {
  const profile = await requireRoles(["to_truong"]);
  await requireModule("to_chuyen_mon");
  const supabase = await createClient();

  const { data, error: aErr } = await supabase
    .from("teacher_assessments")
    .select("id,teacher_id,status")
    .eq("id", assessmentId)
    .maybeSingle();
  const assessment = data as AssessmentRow | null;
  if (aErr) {
    console.error("[team/review] assessment lookup:", aErr.message);
    throw new Error("Lỗi hệ thống - vui lòng thử lại");
  }
  if (!assessment) throw new Error("Không tìm thấy đánh giá");

  // Only allow approving assessments of teachers in the same department.
  const { data: teacherRow, error: tErr } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("id", assessment.teacher_id)
    .maybeSingle();
  if (tErr) {
    console.error("[team/review] teacher lookup:", tErr.message);
    throw new Error("Lỗi hệ thống - vui lòng thử lại");
  }
  const teacher = teacherRow as { department_id: string | null } | null;
  if (!teacher || teacher.department_id !== profile.department_id) {
    throw new Error("Không có quyền duyệt đánh giá này");
  }

  if (!["submitted", "reviewed"].includes(assessment.status)) {
    throw new Error("Đánh giá không ở trạng thái có thể duyệt");
  }

  // CAS: giu dieu kien status trong UPDATE - nguoi duyet khac co the da
  // xu ly giua luc doc va ghi.
  const { data: updated, error } = await supabase
    .from("teacher_assessments")
    .update({ status: "approved" })
    .eq("id", assessmentId)
    .in("status", ["submitted", "reviewed"])
    .select("id");
  if (error) {
    console.error("[team/review] approve assessment:", error.message);
    throw new Error("Không duyệt được đánh giá - vui lòng thử lại.");
  }
  if (!updated?.length) {
    throw new Error("Đánh giá đã được xử lý - vui lòng tải lại trang.");
  }

  revalidatePath("/team/review");
  revalidatePath("/team/home");
}
