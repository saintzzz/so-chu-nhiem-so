"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
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
  const { error } = await supabase
    .from("activities")
    .update({ status: approve ? "approved" : "draft" })
    .eq("id", activityId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  revalidatePath("/activities/plan");
  revalidatePath("/school/approvals");
  return {};
}

export async function announceActivity(
  activityId: string,
): Promise<{error?: string; registered?: number }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: actData } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();
  const activity = (actData ?? null) as Activity | null;
  if (!activity) return { error: "Không tìm thấy hoạt động." };

  const { error: annError } = await supabase.from("announcements").insert({
    sender_id: user.id,
    class_id: activity.class_id,
    student_id: null,
    title: `Thông báo hoạt động: ${activity.title}`,
    content:
      activity.description ??
      `Nhà trường thông báo kế hoạch hoạt động "${activity.title}". Phụ huynh vui lòng theo dõi và nhắc nhở học sinh tham gia đầy đủ.`,
  });
  if (annError) return { error: annError.message };

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
    if (regError) return { error: regError.message };
  }

  revalidatePath("/activities/announce");
  revalidatePath("/activities/attendance");
  return { registered: rows.length };
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
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("activity_attendance").insert({
        activity_id: activityId,
        student_id: row.studentId,
        ...payload,
      });
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/activities/attendance");
  return {};
}
