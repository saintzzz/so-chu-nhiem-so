"use server";

import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createMeeting(formData: FormData) {
  const profile = await requireRoles(["to_truong"]);
  if (!profile.department_id) throw new Error("Chưa được phân tổ");

  const title = String(formData.get("title") ?? "").trim();
  const meetingDate = String(formData.get("meeting_date") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !meetingDate) {
    throw new Error("Vui lòng nhập tiêu đề và ngày sinh hoạt");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dept_meetings").insert({
    department_id: profile.department_id,
    title,
    meeting_date: meetingDate,
    content: content || null,
    created_by: profile.id,
  });
  if (error) throw new Error("Tạo buổi sinh hoạt thất bại: " + error.message);

  revalidatePath("/team/meetings");
  revalidatePath("/team/home");
}
