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

/** Lop 6: duyet ho so (xet tuyen) -> approved | rejected. */
export async function reviewApplication(
  applicationId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<{ error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  const supabase = await createClient();
  const { error } = await supabase
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
  const { data: apps, error } = await supabase
    .from("admission_applications")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "submitted")
    .order("full_name");
  if (error) {
    console.error("[admissions] assignExamNumbers load:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  const { data: existing, error: existErr } = await supabase
    .from("admission_applications")
    .select("exam_number")
    .eq("campaign_id", campaignId)
    .not("exam_number", "is", null);
  if (existErr) {
    console.error("[admissions] assignExamNumbers existing:", existErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  let seq = (existing ?? []).length;
  let assigned = 0;
  for (const app of apps ?? []) {
    seq += 1;
    const sbd = `TS${String(seq).padStart(4, "0")}`;
    const { error: uErr } = await supabase
      .from("admission_applications")
      .update({ exam_number: sbd, status: "exam_registered" })
      .eq("id", app.id)
      .eq("status", "submitted")
      .select("id");
    if (uErr) {
      console.error("[admissions] assignExamNumbers update:", uErr.message);
      return { error: `Lỗi khi cấp SBD ${sbd}.` };
    }
    assigned += 1;
  }
  revalidatePath(`/school/admissions/${campaignId}`);
  return { assigned };
}

/** Lop 10: nhap diem tung mon -> exam_scores + total_score. */
export async function saveScores(
  applicationId: string,
  scores: Record<string, number>,
): Promise<{ error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    if (typeof v === "number" && v >= 0 && v <= 10) clean[k] = v;
  }
  const total = Object.values(clean).reduce((a, b) => a + b, 0);
  const supabase = await createClient();
  const { error } = await supabase
    .from("admission_applications")
    .update({
      exam_scores: clean,
      total_score: Math.round(total * 100) / 100,
    })
    .eq("id", applicationId)
    .in("status", ["exam_registered", "passed", "failed"])
    .select("id");
  if (error) {
    console.error("[admissions] saveScores:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
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
  const { data: camp, error: campErr } = await supabase
    .from("admission_campaigns")
    .select("benchmark")
    .eq("id", campaignId)
    .single();
  if (campErr || !camp) return { error: "Không tìm thấy đợt tuyển." };
  if (camp.benchmark == null) return { error: "Chưa đặt điểm chuẩn." };

  const { data: apps, error } = await supabase
    .from("admission_applications")
    .select("id,total_score")
    .eq("campaign_id", campaignId)
    .eq("status", "exam_registered")
    .not("total_score", "is", null);
  if (error) {
    console.error("[admissions] finalizeResults load:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  let passed = 0;
  let failed = 0;
  for (const app of apps ?? []) {
    const ok = (app.total_score ?? 0) >= camp.benchmark;
    const { error: uErr } = await supabase
      .from("admission_applications")
      .update({
        status: ok ? "passed" : "failed",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", app.id)
      .eq("status", "exam_registered")
      .select("id");
    if (uErr) {
      console.error("[admissions] finalizeResults update:", uErr.message);
      return { error: "Lỗi khi chốt kết quả." };
    }
    if (ok) passed += 1;
    else failed += 1;
  }
  revalidatePath(`/school/admissions/${campaignId}`);
  return { passed, failed };
}

/** Nhap hoc: tao students trong lop da chon cho approved|passed chua enrolled. */
export async function enrollApplications(
  campaignId: string,
  classId: string,
): Promise<{ enrolled?: number; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Thiếu hồ sơ trường." };
  const supabase = await createClient();

  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id,school_id")
    .eq("id", classId)
    .single();
  if (clsErr || !cls || cls.school_id !== profile.school_id) {
    return { error: "Lớp đích không hợp lệ." };
  }

  const { data: apps, error } = await supabase
    .from("admission_applications")
    .select("id,full_name,dob,gender,address,id_number,exam_number")
    .eq("campaign_id", campaignId)
    .in("status", ["approved", "passed"])
    .is("student_id", null);
  if (error) {
    console.error("[admissions] enrollApplications load:", error.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!apps?.length) return { enrolled: 0 };

  let enrolled = 0;
  for (const app of apps) {
    // code unique theo truong - dung so dinh danh neu co, khong thi TS+id
    // (max-code-theo-lop se trung vi code la global trong truong).
    const code = app.id_number || `TS${app.id.slice(0, 8).toUpperCase()}`;
    const { data: st, error: iErr } = await supabase
      .from("students")
      .insert({
        class_id: classId,
        code,
        full_name: app.full_name,
        dob: app.dob,
        gender: app.gender,
        address: app.address,
        national_id: app.id_number,
        status: "active",
        positive_points: 0,
      })
      .select("id")
      .single();
    if (iErr || !st) {
      console.error("[admissions] enroll insert:", iErr?.message);
      return { error: `Lỗi khi nhập học cho ${app.full_name}.` };
    }
    const { error: uErr } = await supabase
      .from("admission_applications")
      .update({ status: "enrolled", student_id: st.id })
      .eq("id", app.id)
      .in("status", ["approved", "passed"])
      .select("id");
    if (uErr) {
      console.error("[admissions] enroll link:", uErr.message);
      return { error: "Lỗi khi liên kết hồ sơ." };
    }
    enrolled += 1;
  }
  revalidatePath(`/school/admissions/${campaignId}`);
  return { enrolled };
}
