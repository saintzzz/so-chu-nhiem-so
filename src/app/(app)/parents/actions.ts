"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { checkActionRole } from "@/lib/auth";

export async function sendAnnouncement(input: {
  classId: string;
  studentId: string | null;
  title: string;
  content: string;
}): Promise<{error?: string; emailed?: number; emailSkipped?: boolean }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.title.trim() || !input.content.trim()) {
    return { error: "Vui lòng nhập tiêu đề và nội dung." };
  }
  const { error } = await supabase.from("announcements").insert({
    sender_id: user.id,
    class_id: input.classId,
    student_id: input.studentId,
    title: input.title.trim(),
    content: input.content.trim(),
  });
  if (error) return { error: error.message };

  // Email kênh liên hệ duy nhất hiện tại (Zalo/SMS chưa áp dụng).
  // Resolve: class -> students -> parent_students -> parents.email
  let emailed = 0;
  let emailSkipped = false;
  let studentQ = supabase
    .from("students")
    .select("id")
    .eq("class_id", input.classId)
    .eq("status", "active");
  if (input.studentId) studentQ = studentQ.eq("id", input.studentId);
  const { data: stuRows } = await studentQ;
  const stuIds = ((stuRows ?? []) as { id: string }[]).map((s) => s.id);
  if (stuIds.length) {
    const { data: linkRows } = await supabase
      .from("parent_students")
      .select("parent_id")
      .in("student_id", stuIds);
    const parentIds = [
      ...new Set(
        ((linkRows ?? []) as { parent_id: string }[]).map((l) => l.parent_id),
      ),
    ];
    if (parentIds.length) {
      const { data: parentRows } = await supabase
        .from("parents")
        .select("email")
        .in("id", parentIds)
        .not("email", "is", null);
      const emails = ((parentRows ?? []) as { email: string | null }[])
        .map((p) => p.email)
        .filter((e): e is string => Boolean(e));
      if (emails.length) {
        const res = await sendEmail({
          to: emails,
          subject: `[Sổ Chủ Nhiệm Số] ${input.title.trim()}`,
          text: input.content.trim(),
        });
        emailed = res.sent;
        emailSkipped = Boolean(res.skipped);
      }
    }
  }
  revalidatePath("/parents/compose");
  revalidatePath("/attendance/notify");
  return { emailed, emailSkipped };
}

export async function markMessageRead(
  messageId: string,
): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/parents/inbox");
  return {};
}

export async function replyMessage(input: {
  recipientId: string;
  studentId: string | null;
  content: string;
}): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.content.trim()) return { error: "Vui lòng nhập nội dung trả lời." };
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
    title: "Tin nhắn mới",
    body: input.content.trim().slice(0, 120),
    link: "/parents/inbox",
  });
  revalidatePath("/parents/inbox");
  return {};
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "confirmed" | "done" | "cancelled",
): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);
  if (error) return { error: error.message };
  revalidatePath("/parents/appointments");
  revalidatePath("/parents/portal");
  return {};
}
