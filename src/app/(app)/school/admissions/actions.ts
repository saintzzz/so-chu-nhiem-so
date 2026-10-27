"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole, getProfile } from "@/lib/auth";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { hasAnyRole } from "@/lib/roles";
import type { Role } from "@/types";

const ROLES: Role[] = ["bgh", "pht", "admin"];

async function guard() {
  const deny = await checkActionRole(ROLES);
  if (deny) return deny;
  const modErr = await assertModule("tuyen_sinh");
  if (modErr) return modErr;
  return null;
}

export interface ApplicationRow {
  full_name: string;
  dob?: string | null;
  gender?: string | null;
  id_number?: string | null;
  address?: string | null;
  source_school?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  priority_order?: number;
}

export async function createCampaign(input: {
  level: "khoi_6" | "khoi_10";
  name: string;
  quota?: number | null;
  academicYearId?: string | null;
  examSubjects?: string[];
}): Promise<{ id?: string; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Thiếu hồ sơ trường." };
  if (!input.name.trim()) return { error: "Thiếu tên đợt tuyển." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admission_campaigns")
    .insert({
      school_id: profile.school_id,
      academic_year_id: input.academicYearId ?? null,
      level: input.level,
      name: input.name.trim(),
      quota: input.quota ?? null,
      exam_subjects:
        input.level === "khoi_10"
          ? (input.examSubjects?.length
              ? input.examSubjects
              : ["toan", "van", "ngoai_ngu"])
          : [],
      status: "draft",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[admissions] createCampaign:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  revalidatePath("/school/admissions");
  return { id: data.id };
}

export async function updateCampaign(
  campaignId: string,
  patch: {
    status?: "draft" | "open" | "closed";
    benchmark?: number | null;
    quota?: number | null;
  },
): Promise<{ error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  // cas-ok: patch den tu form co kiem soat; status chi draft/open/closed,
  // khong phai workflow nhay cam nen chi can loc theo id.
  const { error } = await supabase
    .from("admission_campaigns")
    .update(patch)
    .eq("id", campaignId);
  if (error) {
    console.error("[admissions] updateCampaign:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  revalidatePath(`/school/admissions/${campaignId}`);
  revalidatePath("/school/admissions");
  return {};
}

export async function addApplications(
  campaignId: string,
  rows: ApplicationRow[],
): Promise<{ added?: number; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Thiếu hồ sơ trường." };
  if (!rows.length) return { error: "Không có hồ sơ nào." };
  if (rows.length > 2000) return { error: "Tối đa 2000 hồ sơ mỗi lần." };

  const supabase = await createClient();
  const { data: camp, error: campErr } = await supabase
    .from("admission_campaigns")
    .select("id,school_id")
    .eq("id", campaignId)
    .single();
  if (campErr || !camp) return { error: "Không tìm thấy đợt tuyển." };
  if (camp.school_id !== profile.school_id && !hasAnyRole(profile, ["admin"])) {
    return { error: "Đợt tuyển không thuộc trường bạn." };
  }

  const normGender = (g?: string | null) => {
    const v = (g ?? "").trim().toLowerCase();
    if (v === "nam" || v === "trai") return "nam";
    if (v === "nu" || v === "nữ" || v === "gái") return "nu";
    return null;
  };
  const payload = rows
    .filter((r) => r.full_name?.trim())
    .map((r) => ({
      campaign_id: campaignId,
      school_id: camp.school_id,
      full_name: r.full_name.trim(),
      dob: r.dob || null,
      gender: normGender(r.gender),
      id_number: r.id_number || null,
      address: r.address || null,
      source_school: r.source_school || null,
      parent_name: r.parent_name || null,
      parent_phone: r.parent_phone || null,
      priority_order: r.priority_order ?? 1,
      status: "submitted" as const,
    }));
  if (!payload.length) return { error: "Không có hồ sơ hợp lệ." };

  const { error } = await supabase
    .from("admission_applications")
    .insert(payload);
  if (error) {
    console.error("[admissions] addApplications:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  revalidatePath(`/school/admissions/${campaignId}`);
  return { added: payload.length };
}

/** Lop 6: duyet ho so (xet tuyen) -> approved | rejected. Chi khoi_6. */
export async function reviewApplication(
  applicationId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<{ error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: app, error: appErr } = await supabase
    .from("admission_applications")
    .select("id,admission_campaigns(level)")
    .eq("id", applicationId)
    .single();
  if (appErr || !app) return { error: "Không tìm thấy hồ sơ." };
  const level = (app.admission_campaigns as { level?: string } | null)?.level;
  if (level !== "khoi_6") {
    return { error: "Duyệt hồ sơ chỉ áp dụng cho tuyển lớp 6 (xét tuyển)." };
  }
  const { data: updated, error } = await supabase
    .from("admission_applications")
    .update({
      status: decision,
      notes: note ?? null,
      reviewed_by: profile?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "submitted")
    .select("id");
  if (error) {
    console.error("[admissions] reviewApplication:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!updated?.length) {
    return { error: "Hồ sơ đã đổi trạng thái - tải lại trang." };
  }
  revalidatePath("/school/admissions");
  return {};
}

/** Lop 10: cap so bao danh cho toan bo ho so submitted -> exam_registered. */
export async function assignExamNumbers(
  campaignId: string,
): Promise<{ assigned?: number; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admission_assign_exam_numbers", {
    p_campaign: campaignId,
  });
  if (error) {
    console.error("[admissions] assignExamNumbers:", error.message);
    if (error.message.includes("wrong_level")) {
      return { error: "Chỉ đợt tuyển lớp 10 (thi tuyển) mới cấp SBD." };
    }
    if (error.message.includes("campaign_not_found")) {
      return { error: "Không tìm thấy đợt tuyển." };
    }
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  revalidatePath(`/school/admissions/${campaignId}`);
  return { assigned: data as number };
}

/** Lop 10: nhap diem tung mon -> exam_scores + total_score. */
export async function saveScores(
  applicationId: string,
  scores: Record<string, number>,
): Promise<{ error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();

  // xac thuc mon nam trong exam_subjects cua campaign va diem 0-10 hop le
  const { data: app, error: appErr } = await supabase
    .from("admission_applications")
    .select("id,campaign_id,admission_campaigns(exam_subjects)")
    .eq("id", applicationId)
    .single();
  if (appErr || !app) return { error: "Không tìm thấy hồ sơ." };
  const subjects =
    (app.admission_campaigns as { exam_subjects?: string[] } | null)
      ?.exam_subjects ?? [];
  const keys = Object.keys(scores);
  const unknown = keys.filter((k) => !subjects.includes(k));
  if (unknown.length) return { error: `Môn không hợp lệ: ${unknown.join(", ")}.` };
  const missing = subjects.filter((s) => !(s in scores));
  if (missing.length) return { error: `Thiếu điểm môn: ${missing.join(", ")}.` };

  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10) {
      return { error: `Điểm môn ${k} không hợp lệ (0-10).` };
    }
    clean[k] = v;
  }
  const total = Object.values(clean).reduce((a, b) => a + b, 0);
  const { data: updated, error } = await supabase
    .from("admission_applications")
    .update({
      exam_scores: clean,
      total_score: Math.round(total * 100) / 100,
    })
    .eq("id", applicationId)
    .eq("status", "exam_registered")
    .select("id");
  if (error) {
    console.error("[admissions] saveScores:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!updated?.length) {
    return {
      error: "Hồ sơ đã chốt kết quả hoặc đổi trạng thái - không sửa được điểm.",
    };
  }
  revalidatePath("/school/admissions");
  return {};
}

/** Lop 10: chot diem chuan -> danh dau passed/failed theo total_score. */
export async function finalizeResults(
  campaignId: string,
): Promise<{ passed?: number; failed?: number; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admission_finalize", {
    p_campaign: campaignId,
  });
  if (error) {
    console.error("[admissions] finalizeResults:", error.message);
    const m = error.message.match(/missing_scores:(\d+)/);
    if (m) {
      return { error: `Còn ${m[1]} thí sinh chưa có điểm - nhập đủ điểm trước khi chốt.` };
    }
    if (error.message.includes("no_benchmark")) {
      return { error: "Chưa đặt điểm chuẩn." };
    }
    if (error.message.includes("wrong_level")) {
      return { error: "Chốt điểm chỉ áp dụng cho đợt tuyển lớp 10 (thi tuyển)." };
    }
    if (error.message.includes("campaign_not_found")) {
      return { error: "Không tìm thấy đợt tuyển." };
    }
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  const r = data as { passed?: number; failed?: number };
  revalidatePath(`/school/admissions/${campaignId}`);
  return { passed: r.passed ?? 0, failed: r.failed ?? 0 };
}

/** Nhap hoc: tao students trong lop da chon cho approved|passed chua enrolled. */
export async function enrollApplications(
  campaignId: string,
  classId: string,
): Promise<{ enrolled?: number; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile) return { error: "Thiếu hồ sơ." };
  const supabase = await createClient();

  const { data: camp, error: campErr } = await supabase
    .from("admission_campaigns")
    .select("id,school_id")
    .eq("id", campaignId)
    .single();
  if (campErr || !camp) return { error: "Không tìm thấy đợt tuyển." };
  if (!hasAnyRole(profile, ["admin"]) && camp.school_id !== profile.school_id) {
    return { error: "Đợt tuyển không thuộc trường bạn." };
  }

  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id,school_id")
    .eq("id", classId)
    .single();
  if (clsErr || !cls) return { error: "Lớp đích không hợp lệ." };
  if (cls.school_id !== camp.school_id) {
    return { error: "Lớp đích và đợt tuyển không cùng trường." };
  }
  if (!hasAnyRole(profile, ["admin"]) && cls.school_id !== profile.school_id) {
    return { error: "Lớp đích không thuộc trường bạn." };
  }

  const { data, error } = await supabase.rpc("admission_enroll", {
    p_campaign: campaignId,
    p_class: classId,
  });
  if (error) {
    console.error("[admissions] enrollApplications:", error.message);
    if (error.message.includes("school_mismatch")) {
      return { error: "Lớp đích và đợt tuyển không cùng trường." };
    }
    if (error.message.includes("campaign_not_found")) {
      return { error: "Không tìm thấy đợt tuyển." };
    }
    if (error.message.includes("class_not_found")) {
      return { error: "Không tìm thấy lớp đích." };
    }
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  revalidatePath(`/school/admissions/${campaignId}`);
  return { enrolled: data as number };
}
