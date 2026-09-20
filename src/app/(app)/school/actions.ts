"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";

export async function assignClassCampus(
  classId: string,
  campusId: string | null,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: cls } = await supabase
    .from("classes")
    .select("id,school_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || cls.school_id !== profile.school_id) {
    return { error: "Lớp không thuộc trường của bạn." };
  }
  if (campusId) {
    const { data: cp } = await supabase
      .from("campuses")
      .select("id,school_id")
      .eq("id", campusId)
      .maybeSingle();
    if (!cp || cp.school_id !== profile.school_id) {
      return { error: "Cơ sở không thuộc trường." };
    }
  }
  const { error } = await supabase
    .from("classes")
    .update({ campus_id: campusId })
    .eq("id", classId);
  if (error) return { error: error.message };
  revalidatePath("/school/campuses");
  return {};
}

export async function createCampus(input: {
  name: string;
  kind: "main" | "phan_hieu" | "diem_truong";
  distanceKm: number | null;
  address: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.name.trim()) return { error: "Vui lòng nhập tên cơ sở." };

  const { error } = await supabase.from("campuses").insert({
    school_id: profile.school_id,
    name: input.name.trim(),
    kind: input.kind,
    distance_km: input.distanceKm,
    address: input.address.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/school/campuses");
  return {};
}

const STAFF_POSITIONS = new Set([
  "y_te",
  "thu_vien",
  "giao_vu",
  "tam_ly",
  "cntt",
  "thiet_bi",
  "tai_chinh",
]);

export async function addSupportStaff(input: {
  fullName: string;
  position: string;
  campusId: string | null;
  qualification: string;
  standardized: boolean;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "ke_toan"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.fullName.trim()) return { error: "Vui lòng nhập họ tên." };
  if (!STAFF_POSITIONS.has(input.position)) {
    return { error: "Vị trí không hợp lệ." };
  }
  const { error } = await supabase.from("support_staff").insert({
    school_id: profile.school_id,
    campus_id: input.campusId,
    full_name: input.fullName.trim(),
    position: input.position,
    qualification: input.qualification.trim() || null,
    standardized: input.standardized,
  });
  if (error) return { error: error.message };
  revalidatePath("/school/staff");
  revalidatePath("/school/nq37");
  return {};
}

export async function toggleStaffStandardized(
  staffId: string,
  standardized: boolean,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "ke_toan"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("support_staff")
    .update({ standardized })
    .eq("id", staffId)
    .eq("school_id", profile.school_id ?? "");
  if (error) return { error: error.message };
  revalidatePath("/school/staff");
  revalidatePath("/school/nq37");
  return {};
}

export async function saveTt15Evaluation(input: {
  campusId: string;
  term: string;
  scores: Record<string, number>;
  submit: boolean;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };

  const total = Object.values(input.scores).reduce((s, v) => s + (v || 0), 0);
  const rating =
    total >= 80 ? "muc_1" : total >= 65 ? "muc_2" : total >= 50 ? "muc_3" : "chua_dat";

  const { error } = await supabase.from("tt15_evaluations").insert({
    school_id: profile.school_id,
    campus_id: input.campusId,
    term: input.term,
    evaluator_id: profile.id,
    scores: input.scores,
    total,
    rating,
    status: input.submit ? "submitted" : "draft",
  });
  if (error) return { error: error.message };
  revalidatePath("/school/tt15");
  return {};
}
