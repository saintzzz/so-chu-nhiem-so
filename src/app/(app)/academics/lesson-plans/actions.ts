"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";

export async function submitLessonPlan(input: {
  classId: string;
  subjectId: string;
  week: number | null;
  periods: string;
  title: string;
  content: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["gvbm", "gvcn"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.title.trim()) return { error: "Vui lòng nhập tên bài dạy." };
  if (!input.content.trim()) return { error: "Vui lòng nhập nội dung giáo án." };

  const { data: cls } = await supabase
    .from("classes")
    .select("id,school_id")
    .eq("id", input.classId)
    .maybeSingle();
  if (!cls || cls.school_id !== profile.school_id) {
    return { error: "Lớp không thuộc trường của bạn." };
  }

  const { error } = await supabase.from("lesson_plans").insert({
    school_id: profile.school_id,
    teacher_id: profile.id,
    class_id: input.classId,
    subject_id: input.subjectId,
    week: input.week,
    periods: input.periods.trim() || null,
    title: input.title.trim(),
    content: input.content.trim(),
    status: "submitted",
  });
  if (error) return { error: error.message };

  // Thông báo tổ trưởng cùng trường
  const { data: heads } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "to_truong")
    .eq("school_id", profile.school_id ?? "");
  const rows = ((heads ?? []) as { id: string }[]).map((p) => ({
    profile_id: p.id,
    type: "lesson_plan",
    title: `Giáo án mới chờ duyệt: ${input.title.trim()}`,
    body: `${profile.full_name} nộp giáo án tuần ${input.week ?? "-"}`,
    link: "/team/lesson-plans",
  }));
  if (rows.length) await supabase.from("notifications").insert(rows);

  revalidatePath("/academics/lesson-plans");
  return {};
}

/** Tổ trưởng duyệt -> team_approved, hoặc từ chối -> rejected */
export async function teamReviewLessonPlan(
  planId: string,
  approve: boolean,
  note?: string,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["to_truong"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: plan } = await supabase
    .from("lesson_plans")
    .select("id,school_id,teacher_id,title")
    .eq("id", planId)
    .eq("status", "submitted")
    .maybeSingle();
  if (!plan || plan.school_id !== profile.school_id) {
    return { error: "Giáo án không tồn tại hoặc đã được xử lý." };
  }

  const { error } = await supabase
    .from("lesson_plans")
    .update({
      status: approve ? "team_approved" : "rejected",
      team_reviewed_by: profile.id,
      review_note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);
  if (error) return { error: error.message };

  if (approve) {
    // Chuyển BGH duyệt cuối + báo GV
    const { data: leaders } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["bgh", "pht"])
      .eq("school_id", profile.school_id ?? "");
    const rows = ((leaders ?? []) as { id: string }[]).map((p) => ({
      profile_id: p.id,
      type: "lesson_plan",
      title: `Giáo án đã qua tổ duyệt: ${plan.title}`,
      body: "Chờ Ban Giám Hiệu phê duyệt cuối",
      link: "/school/approvals",
    }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  }
  await supabase.from("notifications").insert({
    profile_id: plan.teacher_id,
    type: "lesson_plan",
    title: approve
      ? `Giáo án "${plan.title}" đã qua duyệt tổ`
      : `Giáo án "${plan.title}" bị trả về`,
    body: note?.trim() || (approve ? "Chờ BGH phê duyệt cuối" : null),
    link: "/academics/lesson-plans",
  });
  revalidatePath("/team/lesson-plans");
  revalidatePath("/academics/lesson-plans");
  revalidatePath("/school/approvals");
  return {};
}

/** BGH duyệt cuối -> approved, hoặc trả về -> rejected */
export async function bghDecideLessonPlan(
  planId: string,
  approve: boolean,
  note?: string,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: plan } = await supabase
    .from("lesson_plans")
    .select("id,school_id,teacher_id,title")
    .eq("id", planId)
    .eq("status", "team_approved")
    .maybeSingle();
  if (!plan || plan.school_id !== profile.school_id) {
    return { error: "Giáo án không tồn tại hoặc chưa qua duyệt tổ." };
  }

  const { error } = await supabase
    .from("lesson_plans")
    .update({
      status: approve ? "approved" : "rejected",
      reviewed_by: profile.id,
      review_note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);
  if (error) return { error: error.message };

  await supabase.from("notifications").insert({
    profile_id: plan.teacher_id,
    type: "lesson_plan",
    title: approve
      ? `Giáo án "${plan.title}" đã được BGH duyệt`
      : `Giáo án "${plan.title}" bị BGH trả về`,
    body: note?.trim() || null,
    link: "/academics/lesson-plans",
  });
  revalidatePath("/school/approvals");
  revalidatePath("/academics/lesson-plans");
  return {};
}
