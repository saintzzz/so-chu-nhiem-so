"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function getOwnParent(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("parents")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .single();
  return (data as { id: string } | null) ?? null;
}

// Xac minh studentId la con cua phu huynh dang nhap (parent_students).
async function ownsStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  studentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parentId)
    .eq("student_id", studentId)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function bookAppointment(input: {
  teacherId: string;
  studentId: string;
  scheduledAt: string;
  purpose: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["phu_huynh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const parent = await getOwnParent(supabase);
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  if (!input.scheduledAt || !input.purpose.trim()) {
    return { error: "Vui lòng chọn thời điểm và nhập mục đích." };
  }
  if (!(await ownsStudent(supabase, parent.id, input.studentId))) {
    return { error: "Học sinh không thuộc tài khoản phụ huynh này." };
  }
  const { error } = await supabase.from("appointments").insert({
    parent_id: parent.id,
    teacher_id: input.teacherId,
    student_id: input.studentId,
    scheduled_at: input.scheduledAt,
    purpose: input.purpose.trim(),
    status: "proposed",
  });
  if (error) return { error: error.message };
  await supabase.from("notifications").insert({
    profile_id: input.teacherId,
    type: "appointment",
    title: "Lịch hẹn mới từ phụ huynh",
    body: input.purpose.trim().slice(0, 120),
    link: "/parents/appointments",
  });
  logAudit(supabase, {
    action: "Phụ huynh đặt lịch hẹn",
    entity: "appointments",
    entityId: input.studentId,
    payload: { teacher_id: input.teacherId, scheduled_at: input.scheduledAt },
  });
  revalidatePath("/portal/parent");
  revalidatePath("/parents/appointments");
  return {};
}

export async function replyToTeacher(input: {
  recipientId: string;
  studentId: string;
  content: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["phu_huynh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.content.trim()) return { error: "Vui lòng nhập nội dung." };
  const parent = await getOwnParent(supabase);
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  if (!(await ownsStudent(supabase, parent.id, input.studentId))) {
    return { error: "Học sinh không thuộc tài khoản phụ huynh này." };
  }
  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: input.recipientId,
    student_id: input.studentId,
    content: input.content.trim(),
  });
  if (error) return { error: error.message };
  await supabase.from("notifications").insert({
    profile_id: input.recipientId,
    type: "message",
    title: "Tin nhắn mới từ phụ huynh",
    body: input.content.trim().slice(0, 120),
    link: "/parents/inbox",
  });
  revalidatePath("/portal/parent");
  revalidatePath("/parents/inbox");
  return {};
}

export async function registerActivity(input: {
  activityId: string;
  studentId: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["phu_huynh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const parent = await getOwnParent(supabase);
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  if (!(await ownsStudent(supabase, parent.id, input.studentId))) {
    return { error: "Học sinh không thuộc tài khoản phụ huynh này." };
  }
  // Hoạt động được announce sẽ auto-registered; nếu PH đã báo vắng thì đăng ký lại
  const { data: existing } = await supabase
    .from("activity_attendance")
    .select("status")
    .eq("activity_id", input.activityId)
    .eq("student_id", input.studentId)
    .limit(1);
  const row = (existing ?? [])[0];
  const { error } = row
    ? await supabase
        .from("activity_attendance")
        .update({ status: "registered" })
        .eq("activity_id", input.activityId)
        .eq("student_id", input.studentId)
    : await supabase.from("activity_attendance").insert({
        activity_id: input.activityId,
        student_id: input.studentId,
        status: "registered",
      });
  if (error) return { error: error.message };
  logAudit(supabase, {
    action: "Phụ huynh đăng ký hoạt động",
    entity: "activity_attendance",
    entityId: input.activityId,
    payload: { student_id: input.studentId },
  });
  revalidatePath("/portal/parent");
  return {};
}

export async function reportActivityAbsence(input: {
  activityId: string;
  studentId: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["phu_huynh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const parent = await getOwnParent(supabase);
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  if (!(await ownsStudent(supabase, parent.id, input.studentId))) {
    return { error: "Học sinh không thuộc tài khoản phụ huynh này." };
  }
  const { error } = await supabase
    .from("activity_attendance")
    .update({ status: "excused" })
    .eq("activity_id", input.activityId)
    .eq("student_id", input.studentId)
    .eq("status", "registered");
  if (error) return { error: error.message };
  logAudit(supabase, {
    action: "Phụ huynh báo vắng hoạt động",
    entity: "activity_attendance",
    entityId: input.activityId,
    payload: { student_id: input.studentId },
  });
  revalidatePath("/portal/parent");
  return {};
}
