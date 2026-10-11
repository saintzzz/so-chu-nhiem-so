"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emailClassParents } from "@/lib/parent-email";
import { checkActionRole, getProfile } from "@/lib/auth";
import type { Activity } from "@/types";
import { hasAnyRole } from "@/lib/roles";

// getClaims qua getProfile (local JWT, cached) - getUser() goi Auth server
// co the timeout im lang trong server action.
async function getContext() {
  const supabase = await createClient();
  const profile = await getProfile();
  return { supabase, user: profile ? { id: profile.id } : null, profile };
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
  if (!profile || !hasAnyRole(profile, ["bgh", "pht", "admin"])) {
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

  const { data: actData, error: actErr } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();
  const activity = (actData ?? null) as Activity | null;
  if (actErr) {
    if (actErr.code === "PGRST116")
      return { error: "Không tìm thấy hoạt động." };
    console.error("[activity-announce] activity:", actErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!activity) return { error: "Không tìm thấy hoạt động." };

  // r22 M: doc DU nguon truoc moi side effect - announcement/email la
  // one-shot, retry sau partial commit se insert + gui email lan nua.
  const { data: studentData, error: stuErr } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", activity.class_id)
    .eq("status", "active");
  if (stuErr) {
    console.error("[activity-announce] students:", stuErr.message);
    return { error: "Không tải được danh sách học sinh. Vui lòng thử lại." };
  }
  const studentIds = ((studentData ?? []) as { id: string }[]).map(
    (s) => s.id,
  );

  const { data: existingData, error: exErr } = await supabase
    .from("activity_attendance")
    .select("student_id")
    .eq("activity_id", activityId);
  if (exErr) {
    console.error("[activity-announce] existing:", exErr.message);
    return {
      error: "Không tải được danh sách đăng ký hiện có. Vui lòng thử lại.",
    };
  }
  const existing = new Set(
    ((existingData ?? []) as { student_id: string }[]).map((r) => r.student_id),
  );

  const annTitle = `Thông báo hoạt động: ${activity.title}`;
  const annContent =
    activity.description ??
    `Nhà trường thông báo kế hoạch hoạt động "${activity.title}". Phụ huynh vui lòng theo dõi và nhắc nhở học sinh tham gia đầy đủ.`;

  // r22 M: retry sau khi INSERT dang ky loi KHONG duoc lap lai
  // announcement + email. Title deterministic theo activity nen kiem
  // announcement da ton tai lam idempotency marker.
  const { data: priorAnn, error: priorErr } = await supabase
    .from("announcements")
    .select("id")
    .eq("sender_id", user.id)
    .eq("class_id", activity.class_id)
    .eq("title", annTitle)
    .limit(1);
  if (priorErr) {
    console.error("[activity-announce] prior check:", priorErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }

  let mail: {
    emailed: number;
    emailFailed: number;
    emailSkipped?: boolean;
    emailError?: string;
  } = { emailed: 0, emailFailed: 0, emailSkipped: true };
  if (!(priorAnn ?? []).length) {
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
    mail = await emailClassParents(supabase, {
      classId: activity.class_id,
      studentId: null,
      title: annTitle,
      content: annContent,
    });
  }

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
      // Announcement + email da committed - revalidate va bao committed;
      // retry se thay prior announcement nen chi chay lai phan dang ky.
      revalidatePath("/activities/announce");
      revalidatePath("/activities/attendance");
      return {
        error:
          "Đã lưu thông báo và gửi email cho phụ huynh, nhưng không đăng ký được danh sách học sinh - vui lòng bấm lại để hoàn tất đăng ký.",
        emailed: mail.emailed,
        emailFailed: mail.emailFailed,
        emailSkipped: mail.emailSkipped,
        emailError: mail.emailError,
      };
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

  if (rows.length === 0) {
    revalidatePath("/activities/attendance");
    return {};
  }
  // PK (activity_id, student_id) -> 1 upsert thay vi N update/insert tuan tu
  // (lop ~45 HS tung mat ~45 RTT).
  const { error } = await supabase.from("activity_attendance").upsert(
    rows.map((row) => ({
      activity_id: activityId,
      student_id: row.studentId,
      status: row.status,
      evaluation: row.evaluation.trim() || null,
    })),
    { onConflict: "activity_id,student_id" },
  );
  if (error) {
    console.error("[activities] attendance upsert failed:", error.message);
    return { error: "Không lưu được điểm danh. Vui lòng thử lại." };
  }

  revalidatePath("/activities/attendance");
  return {};
}
