"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// r24: loi lookup KHONG duoc bien thanh "khong tim thay" - tra failed de
// caller bao loi he thong thay vi deny sai ly do.
async function getOwnParent(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ parent: { id: string } | null; failed: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { parent: null, failed: false };
  const { data, error } = await supabase
    .from("parents")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[portal/parent] own parent lookup:", error.message);
    return { parent: null, failed: true };
  }
  return { parent: (data as { id: string } | null) ?? null, failed: false };
}

// Xac minh studentId la con cua phu huynh dang nhap (parent_students).
async function ownsStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  studentId: string,
): Promise<{ owns: boolean; failed: boolean }> {
  const { data, error } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parentId)
    .eq("student_id", studentId)
    .limit(1);
  if (error) {
    console.error("[portal/parent] owns-student lookup:", error.message);
    return { owns: false, failed: true };
  }
  return { owns: (data ?? []).length > 0, failed: false };
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
  const { parent, failed: pFailed } = await getOwnParent(supabase);
  if (pFailed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  if (!input.scheduledAt || !input.purpose.trim()) {
    return { error: "Vui lòng chọn thời điểm và nhập mục đích." };
  }
  const own = await ownsStudent(supabase, parent.id, input.studentId);
  if (own.failed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!own.owns) {
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
  if (error) {
    console.error("[portal/parent] insert appointments:", error.message);
    return { error: "Không đặt được lịch hẹn - vui lòng thử lại." };
  }
  const { error: notiErr } = await supabase.from("notifications").insert({
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
  if (notiErr) {
    console.error("[portal/parent] appt notify:", notiErr.message);
    return { error: "Đã đặt lịch hẹn, nhưng gửi thông báo cho giáo viên thất bại." };
  }
  return {};
}

export async function replyToTeacher(input: {
  recipientId: string;
  studentId: string;
  content: string;
}): Promise<{ error?: string; committed?: boolean; messageId?: string }> {
  const deny = await checkActionRole(["phu_huynh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.content.trim()) return { error: "Vui lòng nhập nội dung." };
  const { parent, failed: pFailed } = await getOwnParent(supabase);
  if (pFailed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  const own = await ownsStudent(supabase, parent.id, input.studentId);
  if (own.failed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!own.owns) {
    return { error: "Học sinh không thuộc tài khoản phụ huynh này." };
  }
  // R2-02: nguoi nhan phai la nhan vien truong cua hoc sinh.
  // r21: loi lookup khong duoc bien thanh "nguoi nhan khong hop le".
  const { data: stu, error: stuErr } = await supabase
    .from("students")
    .select("classes!inner(school_id)")
    .eq("id", input.studentId)
    .single();
  if (stuErr && stuErr.code !== "PGRST116") {
    console.error("[portal/parent] student lookup:", stuErr.message);
    return { error: "Lỗi tra cứu dữ liệu - vui lòng thử lại." };
  }
  const stuSchool =
    stu &&
    (Array.isArray(stu.classes)
      ? stu.classes[0]?.school_id
      : (stu.classes as { school_id: string } | null)?.school_id);
  const { data: rec, error: recErr } = await supabase
    .from("profiles")
    .select("id,role,school_id")
    .eq("id", input.recipientId)
    .maybeSingle();
  if (recErr) {
    console.error("[portal/parent] recipient lookup:", recErr.message);
    return { error: "Lỗi tra cứu người nhận - vui lòng thử lại." };
  }
  const STAFF_ROLES = new Set([
    "gvcn",
    "gvbm",
    "to_truong",
    "bgh",
    "pht",
    "admin",
  ]);
  if (
    !rec ||
    !STAFF_ROLES.has((rec as { role: string }).role) ||
    (rec as { school_id: string | null }).school_id !== stuSchool
  ) {
    return { error: "Người nhận không phải giáo viên trường của con bạn." };
  }
  // r26 M: tra committed+messageId de client xoa draft ngay khi tin da
  // luu - retry sau partial commit (notification loi) khong tao ban sao.
  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      sender_id: user.id,
      recipient_id: input.recipientId,
      student_id: input.studentId,
      content: input.content.trim(),
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[portal/parent] insert messages:", error?.message);
    return { error: "Không gửi được tin nhắn - vui lòng thử lại." };
  }
  const { error: notiErr } = await supabase.from("notifications").insert({
    profile_id: input.recipientId,
    type: "message",
    title: "Tin nhắn mới từ phụ huynh",
    body: input.content.trim().slice(0, 120),
    link: "/parents/inbox",
  });
  revalidatePath("/portal/parent");
  revalidatePath("/parents/inbox");
  if (notiErr) {
    console.error("[portal/parent] reply notify:", notiErr.message);
    return {
      error: "Đã gửi tin nhắn, nhưng gửi thông báo cho giáo viên thất bại.",
      committed: true,
      messageId: (inserted as { id: string }).id,
    };
  }
  return { committed: true, messageId: (inserted as { id: string }).id };
}

export async function registerActivity(input: {
  activityId: string;
  studentId: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["phu_huynh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { parent, failed: pFailed } = await getOwnParent(supabase);
  if (pFailed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  const own = await ownsStudent(supabase, parent.id, input.studentId);
  if (own.failed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!own.owns) {
    return { error: "Học sinh không thuộc tài khoản phụ huynh này." };
  }
  // Hoạt động được announce sẽ auto-registered; nếu PH đã báo vắng thì đăng ký lại
  const { data: existing, error: exErr } = await supabase
    .from("activity_attendance")
    .select("status")
    .eq("activity_id", input.activityId)
    .eq("student_id", input.studentId)
    .limit(1);
  if (exErr) {
    console.error("[portal/parent] attendance lookup:", exErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  const row = (existing ?? [])[0];
  // CAS tren status da doc: thao tac bao vang dang ky doi cho khong duoc
  // ghi de lan nhau mot cach mu - mat row => xung dot, bao thu lai.
  const { data: updRows, error } = row
    ? await supabase
        .from("activity_attendance")
        .update({ status: "registered" })
        .eq("activity_id", input.activityId)
        .eq("student_id", input.studentId)
        .eq("status", row.status)
        .select("activity_id")
    : await supabase
        .from("activity_attendance")
        .insert({
          activity_id: input.activityId,
          student_id: input.studentId,
          status: "registered",
        })
        .select("activity_id");
  if (error) {
    console.error(
      "[portal/parent] register activity_attendance:",
      error.message,
    );
    return { error: "Không đăng ký được hoạt động - vui lòng thử lại." };
  }
  if (!updRows?.length) {
    return {
      error: "Trạng thái đăng ký vừa thay đổi - vui lòng tải lại trang.",
    };
  }
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
  const { parent, failed: pFailed } = await getOwnParent(supabase);
  if (pFailed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!parent) return { error: "Không tìm thấy hồ sơ phụ huynh." };
  const own = await ownsStudent(supabase, parent.id, input.studentId);
  if (own.failed) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (!own.owns) {
    return { error: "Học sinh không thuộc tài khoản phụ huynh này." };
  }
  // r24: CAS + kiem rows affected - 0 rows nghia la da bao vang/chua dang ky
  // o phien khac, khong duoc bao thanh cong.
  const { data: updated, error } = await supabase
    .from("activity_attendance")
    .update({ status: "excused" })
    .eq("activity_id", input.activityId)
    .eq("student_id", input.studentId)
    .eq("status", "registered")
    .select("activity_id");
  if (error) {
    console.error("[portal/parent] report activity absence:", error.message);
    return { error: "Không báo vắng được - vui lòng thử lại." };
  }
  if (!updated?.length) {
    return {
      error: "Chưa đăng ký hoặc đã báo vắng trước đó - vui lòng tải lại trang.",
    };
  }
  logAudit(supabase, {
    action: "Phụ huynh báo vắng hoạt động",
    entity: "activity_attendance",
    entityId: input.activityId,
    payload: { student_id: input.studentId },
  });
  revalidatePath("/portal/parent");
  return {};
}
