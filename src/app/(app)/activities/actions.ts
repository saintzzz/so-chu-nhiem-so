"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emailClassParents } from "@/lib/parent-email";
import { checkActionRole } from "@/lib/auth";
import type { Activity, Profile } from "@/types";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile: (data ?? null) as Profile | null };
}

export async function createActivity(input: {
  classId: string;
  title: string;
  description: string;
  activityDate: string | null;
}): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.title.trim()) return { error: "Vui lòng nhập tên hoạt động." };
  const { error } = await supabase.from("activities").insert({
    class_id: input.classId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    activity_date: input.activityDate || null,
    status: "draft",
  });
  if (error) {
    console.error("[activities] insert failed:", error.message);
    return { error: "Không tạo được hoạt động. Vui lòng thử lại." };
  }
  revalidatePath("/activities/plan");
  return {};
}

export async function submitActivity(
  activityId: string,
): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("activities")
    .update({ status: "pending" })
    .eq("id", activityId)
    .eq("status", "draft");
  if (error) {
    console.error("[activities] submit failed:", error.message);
    return { error: "Không gửi duyệt được hoạt động. Vui lòng thử lại." };
  }
  revalidatePath("/activities/plan");
  return {};
}

export async function reviewActivity(
  activityId: string,
  approve: boolean,
): Promise<{ error?: string }> {
  const { supabase, user, profile } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!profile || !["bgh", "pht", "admin"].includes(profile.role)) {
    return { error: "Chỉ Ban Giám Hiệu mới có quyền phê duyệt." };
  }
  // R2-09: conditional update phai kiem rows affected - nguoi thua trong
  // duyet dong thoi khong duoc nhan thanh cong.
  const { data: updated, error } = await supabase
    .from("activities")
    .update({ status: approve ? "approved" : "draft" })
    .eq("id", activityId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    console.error("[activities] review failed:", error.message);
    return { error: "Không cập nhật được quyết định. Vui lòng thử lại." };
  }
  if (updated?.length !== 1) {
    return { error: "Hoạt động đã được xử lý. Vui lòng tải lại trang." };
  }
  revalidatePath("/activities/plan");
  revalidatePath("/school/approvals");
  return {};
}

export async function announceActivity(
  activityId: string,
): Promise<{
  error?: string;
  registered?: number;
  emailed?: number;
  emailFailed?: number;
  emailSkipped?: boolean;
  emailError?: string;
}> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user, profile } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: actData } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();
  const activity = (actData ?? null) as Activity | null;
  if (!activity) return { error: "Không tìm thấy hoạt động." };

  const annTitle = `Thông báo hoạt động: ${activity.title}`;
  const annContent =
    activity.description ??
    `Nhà trường thông báo kế hoạch hoạt động "${activity.title}". Phụ huynh vui lòng theo dõi và nhắc nhở học sinh tham gia đầy đủ.`;
  const { error: annError } = await supabase.from("announcements").insert({
    sender_id: user.id,
    school_id: profile?.school_id ?? null,
    class_id: activity.class_id,
    student_id: null,
    title: annTitle,
    content: annContent,
  });
  if (annError) {
    console.error("[activity-announce] insert failed:", annError.message);
    return { error: "Không lưu được thông báo. Vui lòng thử lại." };
  }

  // R6-02: email phu huynh cung noi dung thong bao in-app (subject prefix
  // [So Chu Nhiem So] do helper dat).
  const mail = await emailClassParents(supabase, {
    classId: activity.class_id,
    studentId: null,
    title: annTitle,
    content: annContent,
  });

  const { data: studentData } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", activity.class_id)
    .eq("status", "active");
  const studentIds = ((studentData ?? []) as { id: string }[]).map(
    (s) => s.id,
  );

  const { data: existingData } = await supabase
    .from("activity_attendance")
    .select("student_id")
    .eq("activity_id", activityId);
  const existing = new Set(
    ((existingData ?? []) as { student_id: string }[]).map((r) => r.student_id),
  );

  const rows = studentIds
    .filter((id) => !existing.has(id))
    .map((id) => ({
      activity_id: activityId,
      student_id: id,
      status: "registered",
    }));
  if (rows.length) {
    const { error: regError } = await supabase
      .from("activity_attendance")
      .insert(rows);
    if (regError) {
      console.error("[activity-announce] register failed:", regError.message);
      return { error: "Không đăng ký được danh sách học sinh. Vui lòng thử lại." };
    }
  }

  revalidatePath("/activities/announce");
  revalidatePath("/activities/attendance");
  return {
    registered: rows.length,
    emailed: mail.emailed,
    emailFailed: mail.emailFailed,
    emailSkipped: mail.emailSkipped,
    emailError: mail.emailError,
  };
}

export async function saveActivityAttendance(
  activityId: string,
  rows: {
    studentId: string;
    status: "registered" | "present" | "absent" | "excused";
    evaluation: string;
  }[],
): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: existingData } = await supabase
    .from("activity_attendance")
    .select("student_id")
    .eq("activity_id", activityId);
  const existing = new Set(
    ((existingData ?? []) as { student_id: string }[]).map((r) => r.student_id),
  );

  for (const row of rows) {
    const payload = {
      status: row.status,
      evaluation: row.evaluation.trim() || null,
    };
    if (existing.has(row.studentId)) {
      const { error } = await supabase
        .from("activity_attendance")
        .update(payload)
        .eq("activity_id", activityId)
        .eq("student_id", row.studentId);
      if (error) {
        console.error("[activities] attendance update failed:", error.message);
        return { error: "Không lưu được điểm danh. Vui lòng thử lại." };
      }
    } else {
      const { error } = await supabase.from("activity_attendance").insert({
        activity_id: activityId,
        student_id: row.studentId,
        ...payload,
      });
      if (error) {
        console.error("[activities] attendance insert failed:", error.message);
        return { error: "Không lưu được điểm danh. Vui lòng thử lại." };
      }
    }
  }

  revalidatePath("/activities/attendance");
  return {};
}
