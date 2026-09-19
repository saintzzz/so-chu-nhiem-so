"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole } from "@/lib/auth";

export async function sendAnnouncement(input: {
  classId: string;
  studentId: string | null;
  title: string;
  content: string;
}): Promise<{error?: string }> {
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
  revalidatePath("/parents/compose");
  return {};
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
