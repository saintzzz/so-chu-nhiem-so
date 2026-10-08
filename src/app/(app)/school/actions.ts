"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import { CONCURRENT_ELIGIBLE } from "@/lib/roles";
import type { Role } from "@/types";
import { assertFeature } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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
  if (error) {
    console.error("[school] assign class campus:", error.message);
    return { error: "Không gán được cơ sở cho lớp - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] insert campuses:", error.message);
    return { error: "Không tạo được cơ sở - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] insert support_staff:", error.message);
    return { error: "Không thêm được nhân viên - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] update support_staff:", error.message);
    return { error: "Không cập nhật được nhân viên - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] insert tt15_evaluations:", error.message);
    return { error: "Không lưu được đánh giá TT15 - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] insert equipment:", error.message);
    return { error: "Không thêm được thiết bị - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] update equipment condition:", error.message);
    return { error: "Không cập nhật được tình trạng thiết bị - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] delete equipment:", error.message);
    return { error: "Không xóa được thiết bị - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] insert school_kpis:", error.message);
    return { error: "Không thêm được chỉ tiêu - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] update school_kpis:", error.message);
    return { error: "Không cập nhật được chỉ tiêu - vui lòng thử lại." };
  }
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
  const fDeny = await assertFeature("school.users");
  if (fDeny) return { error: fDeny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const allowed = ["gvcn", "gvbm", "to_truong", "pht", "ke_toan", "bgh"];
  const updates: Record<string, unknown> = {};
  if (patch.role !== undefined) {
    if (!allowed.includes(patch.role))
      return { error: "Vai trò không hợp lệ." };
    if (profileId === profile.id)
      return { error: "Không thể tự đổi vai trò của chính mình." };
    updates.role = patch.role;
  }
  if (patch.campusId) {
    const { data: c } = await supabase
      .from("campuses").select("id")
      .eq("id", patch.campusId).eq("school_id", profile.school_id).maybeSingle();
    if (!c) return { error: "Cơ sở không thuộc trường." };
    updates.campus_id = patch.campusId;
  } else if (patch.campusId === null) {
    updates.campus_id = null;
  }
  if (patch.departmentId) {
    const { data: d } = await supabase
      .from("departments").select("id")
      .eq("id", patch.departmentId).eq("school_id", profile.school_id).maybeSingle();
    if (!d) return { error: "Tổ chuyên môn không thuộc trường." };
    updates.department_id = patch.departmentId;
  } else if (patch.departmentId === null) {
    updates.department_id = null;
  }
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", profileId)
    .eq("school_id", profile.school_id);
  if (error) {
    console.error("[school] update staff account:", error.message);
    return { error: "Không cập nhật được tài khoản - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] insert announcements:", error.message);
    return { error: "Không đăng được thông báo - vui lòng thử lại." };
  }
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

  if (input.id) {
    const { data: entry } = await supabase
      .from("timetable_entries")
      .select("id,classes(school_id)")
      .eq("id", input.id)
      .maybeSingle();
    const cs = (entry as { classes?: { school_id: string }[] | { school_id: string } | null } | null)?.classes;
    const entrySchool = Array.isArray(cs) ? cs[0]?.school_id : cs?.school_id;
    if (!entry || entrySchool !== profile.school_id)
      return { error: "Tiết học không thuộc trường." };
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
  if (error) {
    if (error.code === "23505") {
      return {
        error: "Trùng tiết học (lớp/giáo viên đã có tiết ở khung giờ này).",
      };
    }
    console.error("[school] save timetable_entries:", error.message);
    return { error: "Không lưu được tiết học - vui lòng thử lại." };
  }
  revalidatePath("/schedule/manage");
  return {};
}

export async function deleteTimetableEntry(
  id: string,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const { data: entry } = await supabase
    .from("timetable_entries")
    .select("id,classes(school_id)")
    .eq("id", id)
    .maybeSingle();
  const cs = (entry as { classes?: { school_id: string }[] | { school_id: string } | null } | null)?.classes;
  const entrySchool = Array.isArray(cs) ? cs[0]?.school_id : cs?.school_id;
  if (!entry || entrySchool !== profile.school_id)
    return { error: "Tiết học không thuộc trường." };
  const { error } = await supabase
    .from("timetable_entries")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[school] delete timetable_entries:", error.message);
    return { error: "Không xóa được tiết học - vui lòng thử lại." };
  }
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
  if (error) {
    console.error("[school] update my profile:", error.message);
    return { error: "Không cập nhật được hồ sơ - vui lòng thử lại." };
  }
  revalidatePath("/profile");
  return {};
}

/* ---------- CR-030: tao account + phan quyen chuc nang + ACL du lieu ---------- */

const STAFF_ROLES = ["gvcn", "gvbm", "to_truong", "pht", "ke_toan", "bgh"];

export async function createStaffAccount(input: {
  email: string;
  password: string;
  fullName: string;
  role: string;
  campusId?: string | null;
  departmentId?: string | null;
  staffCode?: string;
  employmentType?: string;
  qualification?: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return { error: deny };
  const fDeny = await assertFeature("school.users");
  if (fDeny) return { error: fDeny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!STAFF_ROLES.includes(input.role)) return { error: "Vai trò không hợp lệ." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    return { error: "Email không hợp lệ." };
  if ((input.password ?? "").length < 8)
    return { error: "Mật khẩu tối thiểu 8 ký tự." };
  if (!input.fullName.trim()) return { error: "Chưa nhập họ tên." };
  if (input.employmentType && !EMPLOYMENT_TYPES.includes(input.employmentType))
    return { error: "Loại hợp đồng không hợp lệ." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    app_metadata: {
      role: input.role,
      school_id: profile.school_id,
      full_name: input.fullName.trim(),
    },
  });
  if (error) {
    console.error("[school] create staff account:", error.message);
    return {
      error: error.message.includes("already")
        ? "Email đã tồn tại."
        : "Không tạo được tài khoản - vui lòng thử lại.",
    };
  }
  if (data.user) {
    // trigger tao profile mac dinh hoc_sinh; set role/truong ro rang qua service role
    const { data: upd, error: pErr } = await admin
      .from("profiles")
      .update({
        role: input.role,
        school_id: profile.school_id,
        full_name: input.fullName.trim(),
        campus_id: input.campusId ?? null,
        department_id: input.departmentId ?? null,
        staff_code: input.staffCode?.trim() || null,
        employment_type: input.employmentType || null,
        qualification: input.qualification?.trim() || null,
      })
      .eq("id", data.user.id)
      .select("id");
    if (pErr || !upd?.length) {
      const { error: dErr } = await admin.auth.admin.deleteUser(data.user.id);
      return {
        error: dErr
          ? "Không gán được hồ sơ tài khoản và tài khoản chưa được dọn. Cần xử lý thủ công."
          : "Không gán được hồ sơ tài khoản.",
      };
    }
  }
  revalidatePath("/school/users");
  return {};
}

export async function setFeatureGrant(input: {
  feature: string;
  role?: string;
  userId?: string;
  effect: "allow" | "deny" | null; // null = xoa override, ve mac dinh
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return { error: deny };
  const fDeny = await assertFeature("school.users");
  if (fDeny) return { error: fDeny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  if (!input.feature) return { error: "Thiếu chức năng." };
  if (!input.role && !input.userId) return { error: "Chọn vai trò hoặc người dùng." };

  if (input.effect === null) {
    // .is() chi nhan null/bool - loc role/user bang eq hoac is(null) theo nhanh
    let q = supabase
      .from("feature_grants")
      .delete()
      .eq("school_id", profile.school_id)
      .eq("feature", input.feature);
    q = input.role ? q.eq("role", input.role) : q.is("role", null);
    q = input.userId ? q.eq("user_id", input.userId) : q.is("user_id", null);
    const { error } = await q;
    if (error) {
      console.error("[school] delete feature_grants:", error.message);
      return { error: "Không xóa được phân quyền - vui lòng thử lại." };
    }
  } else {
    const { error } = await supabase.from("feature_grants").upsert(
      {
        school_id: profile.school_id,
        role: input.role ?? null,
        user_id: input.userId ?? null,
        feature: input.feature,
        effect: input.effect,
        created_by: profile.id,
      },
      { onConflict: input.userId ? "school_id,user_id,feature" : "school_id,role,feature" },
    );
    if (error) {
      console.error("[school] upsert feature_grants:", error.message);
      return { error: "Không lưu được phân quyền - vui lòng thử lại." };
    }
  }
  logAudit(supabase, {
    action: "school.feature_grant",
    entity: "feature_grants",
    payload: { feature: input.feature, role: input.role, userId: input.userId, effect: input.effect },
  });
  revalidatePath("/school/users");
  return {};
}

export async function listFeatureGrants(): Promise<{
  grants: { id: string; feature: string; role: string | null; user_id: string | null; effect: "allow" | "deny" }[];
} | { error: string }> {
  const deny = await checkActionRole(["bgh", "to_truong", "admin"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_grants")
    .select("id, feature, role, user_id, effect");
  if (error) {
    console.error("[school] list feature_grants:", error.message);
    return { error: "Không tải được danh sách phân quyền - vui lòng thử lại." };
  }
  return { grants: data ?? [] };
}

// An/hien 1 muc du lieu voi user cu the (VD: an cau hoi X voi GV A)
export async function setItemAcl(input: {
  table: "questions" | "materials" | "khbd_templates" | "curriculum_standards";
  itemId: string;
  userEmail: string;
  deny: boolean; // false = bo gioi han
}): Promise<{ error?: string }> {
  const denyErr = await checkActionRole(["bgh", "admin"]);
  if (denyErr) return { error: denyErr };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", input.userEmail.trim().toLowerCase())
    .eq("school_id", profile.school_id)
    .single();
  if (!target) return { error: "Không tìm thấy tài khoản trong trường." };

  if (!input.deny) {
    await supabase
      .from("item_acl")
      .delete()
      .eq("school_id", profile.school_id)
      .eq("table_name", input.table)
      .eq("item_id", input.itemId)
      .eq("user_id", target.id);
    logAudit(supabase, {
      action: "school.item_acl_remove",
      entity: "item_acl",
      entityId: input.itemId,
      payload: { table: input.table, userId: target.id },
    });
    return {};
  }
  const { error } = await supabase.from("item_acl").upsert(
    {
      school_id: profile.school_id,
      table_name: input.table,
      item_id: input.itemId,
      user_id: target.id,
      effect: "deny",
      created_by: profile.id,
    },
    { onConflict: "table_name,item_id,user_id" },
  );
  if (error) {
    console.error("[school] upsert item_acl:", error.message);
    return { error: "Không lưu được giới hạn dữ liệu - vui lòng thử lại." };
  }
  logAudit(supabase, {
    action: "school.item_acl_deny",
    entity: "item_acl",
    entityId: input.itemId,
    payload: { table: input.table, userId: target.id },
  });
  return {};
}

// ---------- CR-032: ho so GV day du + mon phu trach + to gan mon ----------

export interface StaffProfileInput {
  role?: string;
  campusId?: string | null;
  departmentId?: string | null;
  staffCode?: string | null;
  employmentType?: string | null;
  qualification?: string | null;
  concurrentRoles?: string[];
}

const EMPLOYMENT_TYPES = ["bien_che", "hop_dong", "thinh_giang"];

export async function updateStaffProfile(
  profileId: string,
  input: StaffProfileInput,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return { error: deny };
  const fDeny = await assertFeature("school.users");
  if (fDeny) return { error: fDeny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const updates: Record<string, unknown> = {};
  if (input.role) {
    if (!STAFF_ROLES.includes(input.role)) return { error: "Vai trò không hợp lệ." };
    if (profileId === profile.id)
      return { error: "Không thể tự đổi vai trò của chính mình." };
    updates.role = input.role;
  }
  // CR-034: campus/department phai thuoc truong hien tai
  const supabase = await createClient();
  if (input.campusId) {
    const { data: c } = await supabase
      .from("campuses")
      .select("id")
      .eq("id", input.campusId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (!c) return { error: "Cơ sở không thuộc trường." };
    updates.campus_id = input.campusId;
  } else if (input.campusId === null) {
    updates.campus_id = null;
  }
  if (input.departmentId) {
    const { data: d } = await supabase
      .from("departments")
      .select("id")
      .eq("id", input.departmentId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (!d) return { error: "Tổ chuyên môn không thuộc trường." };
    updates.department_id = input.departmentId;
  } else if (input.departmentId === null) {
    updates.department_id = null;
  }
  if (input.staffCode !== undefined)
    updates.staff_code = input.staffCode?.trim() || null;
  if (input.employmentType !== undefined) {
    if (input.employmentType && !EMPLOYMENT_TYPES.includes(input.employmentType))
      return { error: "Loại hợp đồng không hợp lệ." };
    updates.employment_type = input.employmentType || null;
  }
  if (input.qualification !== undefined)
    updates.qualification = input.qualification?.trim() || null;
  if (input.concurrentRoles !== undefined) {
    // CR-038: chi nhom role co the dung lop duoc kiem nhiem
    const bad = (input.concurrentRoles ?? []).filter(
      (r) => !CONCURRENT_ELIGIBLE.includes(r as Role),
    );
    if (bad.length) return { error: `Vai trò kiêm nhiệm không hợp lệ: ${bad.join(", ")}` };
    updates.concurrent_roles = [...new Set(input.concurrentRoles)];
  }
  if (!Object.keys(updates).length) return {};

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", profileId)
    .eq("school_id", profile.school_id)
    .select("id");
  if (error || !data?.length)
    return { error: "Không cập nhật được hồ sơ." };
  logAudit(supabase, {
    action: "school.staff_profile_update",
    entity: "profiles",
    entityId: profileId,
    payload: { keys: Object.keys(updates) },
  });
  revalidatePath("/school/users");
  return {};
}

export async function setTeacherSubjects(
  teacherId: string,
  subjectIds: string[],
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "admin", "to_truong"]);
  if (deny) return { error: deny };
  const fDeny = await assertFeature("school.users");
  if (fDeny) return { error: fDeny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  // CR-034: RPC atomic - validate truong + scope to truong + xoa/insert trong 1 txn
  const { error } = await supabase.rpc("scn_set_teacher_subjects", {
    p_teacher: teacherId,
    p_subjects: subjectIds,
  });
  if (error) {
    if (error.message.includes("teacher not in school"))
      return { error: "Không tìm thấy giáo viên." };
    if (error.message.includes("cung to"))
      return { error: "Tổ trưởng chỉ chỉnh môn của GV trong tổ mình." };
    if (error.message.includes("subject not in school"))
      return { error: "Môn học không thuộc trường." };
    console.error("[school] scn_set_teacher_subjects:", error.message);
    return { error: "Không phân công được môn dạy - vui lòng thử lại." };
  }
  logAudit(supabase, {
    action: "school.teacher_subjects",
    entity: "profiles",
    entityId: teacherId,
    payload: { subjects: subjectIds.length },
  });
  revalidatePath("/school/users");
  return {};
}

export async function updateDepartmentSubjects(
  deptId: string,
  subjectIds: string[],
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .update({ subject_ids: subjectIds })
    .eq("id", deptId)
    .eq("school_id", profile.school_id)
    .select("id");
  if (error || !data?.length) return { error: "Không cập nhật được tổ." };
  logAudit(supabase, {
    action: "school.department_subjects",
    entity: "departments",
    entityId: deptId,
    payload: { subjects: subjectIds.length },
  });
  revalidatePath("/school/users");
  return {};
}

export async function listItemAcl(input: {
  table: "questions" | "materials" | "khbd_templates" | "curriculum_standards";
  itemId: string;
}): Promise<{ emails: string[] } | { error: string }> {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return { error: deny };
  const fDeny = await assertFeature("school.users");
  if (fDeny) return { error: fDeny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("item_acl")
    .select("user_id")
    .eq("school_id", profile.school_id)
    .eq("table_name", input.table)
    .eq("item_id", input.itemId)
    .eq("effect", "deny");
  if (!rows?.length) return { emails: [] };
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", rows.map((r) => r.user_id));
  return { emails: (profs ?? []).map((p) => p.email).filter(Boolean) as string[] };
}
