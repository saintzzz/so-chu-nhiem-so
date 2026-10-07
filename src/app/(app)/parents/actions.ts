"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emailClassParents } from "@/lib/parent-email";
import { checkActionRole, getProfile } from "@/lib/auth";
// R10-03: link thong bao theo role nguoi nhan (helper chia se, test duoc).
import { messageLinkForRole } from "@/lib/message-link";

export async function sendAnnouncement(input: {
  classId: string;
  studentId: string | null;
  title: string;
  content: string;
}): Promise<{
  error?: string;
  emailed?: number;
  emailFailed?: number;
  emailSkipped?: boolean;
  emailError?: string;
}> {
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
  const profile = await getProfile();
  const { error } = await supabase.from("announcements").insert({
    sender_id: user.id,
    school_id: profile?.school_id ?? null,
    class_id: input.classId,
    student_id: input.studentId,
    title: input.title.trim(),
    content: input.content.trim(),
  });
  if (error) {
    console.error("[announce] insert failed:", error.message);
    return { error: "Không lưu được thông báo. Vui lòng thử lại." };
  }

  // Email kênh liên hệ duy nhất hiện tại (Zalo/SMS chưa áp dụng).
  const mail = await emailClassParents(supabase, input);
  revalidatePath("/parents/compose");
  revalidatePath("/attendance/notify");
  return {
    emailed: mail.emailed,
    emailFailed: mail.emailFailed,
    emailSkipped: mail.emailSkipped,
    emailError: mail.emailError,
  };
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
  if (error) {
    console.error("[messages] markRead failed:", error.message);
    return { error: "Không cập nhật được tin nhắn. Vui lòng thử lại." };
  }
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
  // R2-02: kiểm tra quan hệ người nhận - học sinh ở tầng action (RLS
  // scn_can_message là tuyến phòng thủ cuối cho client insert trực tiếp).
  const profile = await getProfile();
  if (!input.studentId) {
    return { error: "Thiếu học sinh liên quan đến tin nhắn." };
  }
  const { data: st } = await supabase
    .from("students")
    .select("id,profile_id,classes!inner(school_id,gvcn_id)")
    .eq("id", input.studentId)
    .maybeSingle();
  const stuCls =
    st &&
    (Array.isArray(st.classes) ? st.classes[0] : (st.classes as {
      school_id: string;
      gvcn_id: string | null;
    } | null));
  if (!st || !stuCls || stuCls.school_id !== profile?.school_id) {
    return { error: "Học sinh không thuộc trường của bạn." };
  }
  if (profile?.role === "gvcn" && stuCls.gvcn_id !== profile.id) {
    return { error: "Chỉ trả lời tin nhắn về học sinh lớp bạn chủ nhiệm." };
  }
  // Người nhận phải là phụ huynh của học sinh này hoặc chính học sinh.
  const { data: parentLinks } = await supabase
    .from("parent_students")
    .select("parents!inner(profile_id)")
    .eq("student_id", input.studentId);
  const allowed = new Set<string>(
    ((parentLinks ?? []) as { parents: { profile_id: string | null } | { profile_id: string | null }[] }[])
      .map((l) =>
        Array.isArray(l.parents) ? l.parents[0]?.profile_id : l.parents?.profile_id,
      )
      .filter((x): x is string => Boolean(x)),
  );
  if (st.profile_id) allowed.add(st.profile_id as string);
  if (!allowed.has(input.recipientId)) {
    return { error: "Người nhận không liên quan đến học sinh này." };
  }
  // Role nguoi nhan quyet dinh link thong bao (portal vs inbox nhan vien).
  const { data: recipient } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", input.recipientId)
    .maybeSingle();
  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: input.recipientId,
    student_id: input.studentId,
    content: input.content.trim(),
  });
  if (error) {
    console.error("[messages] reply insert failed:", error.message);
    return { error: "Không gửi được tin nhắn. Vui lòng thử lại." };
  }
  await supabase.from("notifications").insert({
    profile_id: input.recipientId,
    type: "message",
    title: "Tin nhắn mới",
    body: input.content.trim().slice(0, 120),
    link: messageLinkForRole(
      (recipient as { role: string } | null)?.role,
    ),
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
  if (error) {
    console.error("[appointments] update failed:", error.message);
    return { error: "Không cập nhật được lịch hẹn. Vui lòng thử lại." };
  }
  revalidatePath("/parents/appointments");
  revalidatePath("/parents/portal");
  return {};
}
