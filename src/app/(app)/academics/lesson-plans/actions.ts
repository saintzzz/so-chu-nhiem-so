"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import { khbdHasContent, parseKhbd, renderKhbdText } from "@/lib/khbd";
import type { KhbdContent } from "@/lib/khbd";

export async function submitLessonPlan(input: {
  classId: string;
  subjectId: string;
  week: number | null;
  periods: string;
  title: string;
  content: string;
  contentJson?: KhbdContent | null;
  filePath?: string;
  fileName?: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["gvbm", "gvcn"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.title.trim()) return { error: "Vui lòng nhập tên bài dạy." };
  if (input.title.trim().length > 200) {
    return { error: "Tên bài dạy quá dài (tối đa 200 ký tự)." };
  }
  if (
    input.week !== null &&
    (!Number.isInteger(input.week) || input.week < 1 || input.week > 45)
  ) {
    return { error: "Tuần không hợp lệ (1-45)." };
  }
  // CR-035: structured content -> content la ban render phang mirror.
  const structured = input.contentJson ? parseKhbd(input.contentJson) : null;
  if (structured && JSON.stringify(structured).length > 100_000) {
    return { error: "Nội dung giáo án quá lớn - vui lòng rút gọn." };
  }
  // File phai nam trong thu muc cua truong - chan path traversal /
  // tro sang file truong khac.
  const filePath = input.filePath ?? null;
  if (
    filePath &&
    (!filePath.startsWith(`${profile.school_id}/`) || filePath.includes(".."))
  ) {
    return { error: "File đính kèm không hợp lệ." };
  }
  const contentText =
    (structured && khbdHasContent(structured)
      ? renderKhbdText(structured)
      : input.content.trim()) || null;
  if (!contentText && !filePath)
    return { error: "Giáo án cần có nội dung hoặc file đính kèm." };

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
    content: contentText,
    content_json: structured && khbdHasContent(structured) ? structured : null,
    file_path: filePath,
    file_name: input.fileName?.slice(0, 200) ?? null,
    status: "submitted",
  });
  if (error) {
    console.error("[lesson-plans] insert lesson_plans:", error.message);
    return { error: "Không nộp được giáo án - vui lòng thử lại." };
  }

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
  if (rows.length) {
    const { error: nErr } = await supabase.from("notifications").insert(rows);
    if (nErr) console.error("[lesson-plans] notify heads:", nErr.message);
  }

  revalidatePath("/academics/lesson-plans");
  return {};
}

/** URL ký (1 giờ) để người duyệt/GV mở file giáo án đính kèm. */
export async function lessonPlanFileUrl(
  filePath: string,
): Promise<{ url?: string; error?: string }> {
  const deny = await checkActionRole(["gvbm", "gvcn", "to_truong", "bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  // Chi ky URL cho file nam trong thu muc truong minh + gan voi 1 giao an
  // ton tai - chan lay signed URL cho path truong khac.
  if (
    !filePath.startsWith(`${profile.school_id}/`) ||
    filePath.includes("..")
  ) {
    return { error: "File không hợp lệ." };
  }
  const { data: plan } = await supabase
    .from("lesson_plans")
    .select("id")
    .eq("school_id", profile.school_id ?? "")
    .eq("file_path", filePath)
    .maybeSingle();
  if (!plan) return { error: "File không tồn tại." };
  const { data, error } = await supabase.storage
    .from("lesson-plans")
    .createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) {
    console.error("[lesson-plans] createSignedUrl:", error?.message ?? "no url");
    return { error: "Không tạo được liên kết file - vui lòng thử lại." };
  }
  return { url: data.signedUrl };
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

  // Predicate status tren update: tranh 2 nguoi duyet song song ghi de -
  // luot sau se thay 0 rows va bao loi thay vi overwrite.
  const { data: updated, error } = await supabase
    .from("lesson_plans")
    .update({
      status: approve ? "team_approved" : "rejected",
      team_reviewed_by: profile.id,
      review_note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("status", "submitted")
    .select("id");
  if (error) {
    console.error("[lesson-plans] team review update:", error.message);
    return { error: "Không cập nhật được giáo án - vui lòng thử lại." };
  }
  if (!updated?.length) {
    return { error: "Giáo án đã được người khác xử lý." };
  }

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
    if (rows.length) {
      const { error: nErr } = await supabase.from("notifications").insert(rows);
      if (nErr) console.error("[lesson-plans] notify leaders:", nErr.message);
    }
  }
  const { error: tnErr } = await supabase.from("notifications").insert({
    profile_id: plan.teacher_id,
    type: "lesson_plan",
    title: approve
      ? `Giáo án "${plan.title}" đã qua duyệt tổ`
      : `Giáo án "${plan.title}" bị trả về`,
    body: note?.trim() || (approve ? "Chờ BGH phê duyệt cuối" : null),
    link: "/academics/lesson-plans",
  });
  if (tnErr) console.error("[lesson-plans] notify teacher:", tnErr.message);
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

  const { data: updated, error } = await supabase
    .from("lesson_plans")
    .update({
      status: approve ? "approved" : "rejected",
      reviewed_by: profile.id,
      review_note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("status", "team_approved")
    .select("id");
  if (error) {
    console.error("[lesson-plans] bgh decide update:", error.message);
    return { error: "Không cập nhật được giáo án - vui lòng thử lại." };
  }
  if (!updated?.length) {
    return { error: "Giáo án đã được người khác xử lý." };
  }

  const { error: nErr } = await supabase.from("notifications").insert({
    profile_id: plan.teacher_id,
    type: "lesson_plan",
    title: approve
      ? `Giáo án "${plan.title}" đã được BGH duyệt`
      : `Giáo án "${plan.title}" bị BGH trả về`,
    body: note?.trim() || null,
    link: "/academics/lesson-plans",
  });
  if (nErr) console.error("[lesson-plans] notify teacher:", nErr.message);
  revalidatePath("/school/approvals");
  revalidatePath("/academics/lesson-plans");
  return {};
}
