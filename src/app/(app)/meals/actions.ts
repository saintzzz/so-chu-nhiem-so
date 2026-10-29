"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole, getProfile } from "@/lib/auth";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/roles";

const fail = (tag: string, e: { message?: string }) => {
  console.error(`[meals] ${tag}:`, e.message);
  return { error: "Lỗi hệ thống. Vui lòng thử lại." };
};

export async function saveMenu(input: {
  menuDate: string;
  mealType: string;
  description: string;
  allergenNotes?: string;
  supplier?: string;
  costPerPortion?: number;
}): Promise<{ ok?: boolean; error?: string }> {
  const deny = await checkActionRole(["bgh", "pht", "ke_toan", "admin"]);
  if (deny) return { error: deny };
  const mod = await assertModule("bua_an");
  if (mod) return { error: mod };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.description.trim()) return { error: "Mô tả thực đơn bắt buộc." };
  const supabase = await createClient();
  const { error } = await supabase.from("meal_menus").upsert({
    school_id: profile.school_id,
    menu_date: input.menuDate,
    meal_type: input.mealType,
    description: input.description.trim(),
    allergen_notes: input.allergenNotes?.trim() || null,
    supplier: input.supplier?.trim() || null,
    cost_per_portion: input.costPerPortion ?? null,
    created_by: profile.id,
  }, { onConflict: "school_id,menu_date,meal_type" });
  if (error) return fail("saveMenu", error);
  revalidatePath("/meals");
  return { ok: true };
}

export async function saveMealCount(input: {
  classId: string;
  menuDate: string;
  mealType: string;
  plannedCount?: number;
  actualCount?: number;
  note?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh", "pht", "ke_toan", "admin"]);
  if (deny) return { error: deny };
  const mod = await assertModule("bua_an");
  if (mod) return { error: mod };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  // gvcn chi lop chu nhiem
  if (hasRole(profile, "gvcn")) {
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("gvcn_id")
      .eq("id", input.classId)
      .maybeSingle();
    if (clsErr) return fail("saveCount.cls", clsErr);
    if (cls?.gvcn_id !== profile.id)
      return { error: "Chỉ báo số suất ăn lớp bạn chủ nhiệm." };
  }
  const { error } = await supabase.from("meal_counts").upsert({
    school_id: profile.school_id,
    class_id: input.classId,
    menu_date: input.menuDate,
    meal_type: input.mealType,
    planned_count: input.plannedCount ?? 0,
    actual_count: input.actualCount ?? null,
    note: input.note?.trim() || null,
    counted_by: profile.id,
  }, { onConflict: "class_id,menu_date,meal_type" });
  if (error) return fail("saveCount", error);
  revalidatePath("/meals");
  return { ok: true };
}

export async function saveMealRegistration(input: {
  studentId: string;
  year: number;
  month: number;
  mealType: string;
  registered: boolean;
  dietaryNote?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh", "admin", "ke_toan"]);
  if (deny) return { error: deny };
  const mod = await assertModule("bua_an");
  if (mod) return { error: mod };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  if (hasRole(profile, "gvcn")) {
    const { data: stu, error: stuErr } = await supabase
      .from("students")
      .select("classes!inner(gvcn_id)")
      .eq("id", input.studentId)
      .maybeSingle();
    if (stuErr) return fail("saveReg.stu", stuErr);
    const c = stu?.classes;
    const cls = Array.isArray(c) ? c[0] : c;
    if (cls?.gvcn_id !== profile.id)
      return { error: "Chỉ đăng ký học sinh lớp bạn chủ nhiệm." };
  }
  const { error } = await supabase.from("meal_registrations").upsert({
    school_id: profile.school_id,
    student_id: input.studentId,
    year: input.year,
    month: input.month,
    meal_type: input.mealType,
    registered: input.registered,
    dietary_note: input.dietaryNote?.trim() || null,
  }, { onConflict: "student_id,year,month,meal_type" });
  if (error) return fail("saveReg", error);
  revalidatePath("/meals");
  return { ok: true };
}
