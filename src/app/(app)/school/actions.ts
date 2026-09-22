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

/* ---------- CR-011: equipment / school KPIs / users / announce ---------- */

export async function addEquipment(input: {
  name: string;
  category: string;
  quantity: number;
  condition: string;
  campusId: string | null;
  note: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht", "ke_toan"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.name.trim()) return { error: "Vui lòng nhập tên thiết bị." };
  if (input.quantity < 1) return { error: "Số lượng phải >= 1." };
  const { error } = await supabase.from("equipment").insert({
    school_id: profile.school_id,
    campus_id: input.campusId,
    name: input.name.trim(),
    category: input.category,
    quantity: input.quantity,
    condition: input.condition,
    note: input.note.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/school/equipment");
  return {};
}

export async function updateEquipmentCondition(
  id: string,
  condition: string,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht", "ke_toan"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("equipment")
    .update({ condition })
    .eq("id", id)
    .eq("school_id", profile.school_id);
  if (error) return { error: error.message };
  revalidatePath("/school/equipment");
  return {};
}

export async function deleteEquipment(id: string): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "ke_toan"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("equipment")
    .delete()
    .eq("id", id)
    .eq("school_id", profile.school_id);
  if (error) return { error: error.message };
  revalidatePath("/school/equipment");
  return {};
}

export async function addSchoolKpi(input: {
  period: string;
  title: string;
  target: string;
  unit: string;
  note: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.title.trim()) return { error: "Vui lòng nhập tên chỉ tiêu." };
  const { error } = await supabase.from("school_kpis").insert({
    school_id: profile.school_id,
    period: input.period,
    title: input.title.trim(),
    target: input.target.trim() || null,
    unit: input.unit.trim() || null,
    note: input.note.trim() || null,
    status: "dang_thuc_hien",
  });
  if (error) return { error: error.message };
  revalidatePath("/school/strategy");
  return {};
}

export async function updateSchoolKpi(
  id: string,
  patch: { actual?: string; status?: string },
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("school_kpis")
    .update(patch)
    .eq("id", id)
    .eq("school_id", profile.school_id);
  if (error) return { error: error.message };
  revalidatePath("/school/strategy");
  return {};
}

export async function updateStaffAccount(
  profileId: string,
  patch: {
    role?: string;
    campusId?: string | null;
    departmentId?: string | null;
  },
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const allowed = ["gvcn", "gvbm", "to_truong", "pht", "ke_toan", "bgh"];
  const updates: Record<string, unknown> = {};
  if (patch.role !== undefined) {
    if (!allowed.includes(patch.role))
      return { error: "Vai trò không hợp lệ." };
    updates.role = patch.role;
  }
  if (patch.campusId !== undefined) updates.campus_id = patch.campusId;
  if (patch.departmentId !== undefined)
    updates.department_id = patch.departmentId;
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", profileId)
    .eq("school_id", profile.school_id);
  if (error) return { error: error.message };
  revalidatePath("/school/users");
  return {};
}

export async function postSchoolAnnouncement(input: {
  title: string;
  content: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.title.trim() || !input.content.trim())
    return { error: "Vui lòng nhập tiêu đề và nội dung." };
  const { error } = await supabase.from("announcements").insert({
    sender_id: profile.id,
    school_id: profile.school_id,
    title: input.title.trim(),
    content: input.content.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/school/announce");
  return {};
}

/* ---------- TKB editor ---------- */

export async function saveTimetableEntry(input: {
  id?: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  weekday: number;
  period: number;
  room: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const { data: cls } = await supabase
    .from("classes")
    .select("id,school_id")
    .eq("id", input.classId)
    .maybeSingle();
  if (!cls || cls.school_id !== profile.school_id)
    return { error: "Lớp không thuộc trường." };
  if (!input.subjectId) return { error: "Vui lòng chọn môn học." };
  if (input.weekday < 2 || input.weekday > 7)
    return { error: "Thứ không hợp lệ (2-7)." };
  if (input.period < 1 || input.period > 10)
    return { error: "Tiết không hợp lệ (1-10)." };

  // Conflict check cùng ngày-tiết trong trường
  const { data: schoolClasses } = await supabase
    .from("classes")
    .select("id")
    .eq("school_id", profile.school_id);
  const schoolClassIds = (schoolClasses ?? []).map(
    (c: { id: string }) => c.id,
  );
  const { data: conflicts } = await supabase
    .from("timetable_entries")
    .select("id,class_id,teacher_id,room,classes(name)")
    .eq("weekday", input.weekday)
    .eq("period", input.period)
    .in("class_id", schoolClassIds.length ? schoolClassIds : ["none"]);
  const others = ((conflicts ?? []) as unknown as {
    id: string;
    class_id: string;
    teacher_id: string | null;
    room: string | null;
    classes: { name: string }[] | { name: string } | null;
  }[]).filter((e) => e.id !== input.id);
  if (others.some((e) => e.class_id === input.classId))
    return { error: "Lớp đã có tiết học khác ở khung giờ này." };
  if (
    input.teacherId &&
    others.some((e) => e.teacher_id === input.teacherId)
  ) {
    const c = others.find((e) => e.teacher_id === input.teacherId);
    const cn = c?.classes
      ? Array.isArray(c.classes)
        ? c.classes[0]?.name
        : c.classes.name
      : null;
    return {
      error: `Giáo viên đã dạy lớp ${cn ?? "khác"} ở khung giờ này.`,
    };
  }
  const room = input.room.trim();
  if (room && others.some((e) => e.room === room)) {
    const c = others.find((e) => e.room === room);
    const cn = c?.classes
      ? Array.isArray(c.classes)
        ? c.classes[0]?.name
        : c.classes.name
      : null;
    return {
      error: `Phòng ${room} đã được lớp ${cn ?? "khác"} sử dụng ở khung giờ này.`,
    };
  }

  const row = {
    class_id: input.classId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId || null,
    weekday: input.weekday,
    period: input.period,
    room: input.room.trim() || null,
  };
  const { error } = input.id
    ? await supabase.from("timetable_entries").update(row).eq("id", input.id)
    : await supabase.from("timetable_entries").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/schedule/manage");
  return {};
}

export async function deleteTimetableEntry(
  id: string,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { error } = await supabase
    .from("timetable_entries")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/schedule/manage");
  return {};
}

/* ---------- profile tự cập nhật ---------- */

export async function updateMyProfile(input: {
  phone: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("profiles")
    .update({ phone: input.phone.trim() || null })
    .eq("id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return {};
}
