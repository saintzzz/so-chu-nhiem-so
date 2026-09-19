"use server";

import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface AssessmentRow {
  id: string;
  teacher_id: string;
  status: string;
}

export async function approveAssessment(assessmentId: string) {
  const profile = await requireRoles(["to_truong"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("teacher_assessments")
    .select("id,teacher_id,status")
    .eq("id", assessmentId)
    .single();
  const assessment = data as AssessmentRow | null;
  if (!assessment) throw new Error("Không tìm thấy đánh giá");

  // Only allow approving assessments of teachers in the same department.
  const { data: teacherRow } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("id", assessment.teacher_id)
    .single();
  const teacher = teacherRow as { department_id: string | null } | null;
  if (!teacher || teacher.department_id !== profile.department_id) {
    throw new Error("Không có quyền duyệt đánh giá này");
  }

  if (!["submitted", "reviewed"].includes(assessment.status)) {
    throw new Error("Đánh giá không ở trạng thái có thể duyệt");
  }

  const { error } = await supabase
    .from("teacher_assessments")
    .update({ status: "approved" })
    .eq("id", assessmentId);
  if (error) throw new Error("Duyệt thất bại: " + error.message);

  revalidatePath("/team/review");
  revalidatePath("/team/home");
}
