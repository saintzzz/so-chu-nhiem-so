"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/* ---------- CR-034: provision truong moi cho gate demo 15/10 ---------- */

const LEVELS = ["th", "thcs", "thpt"] as const;

const LEVEL_SUBJECTS: Record<(typeof LEVELS)[number], string[]> = {
  th: [
    "Toán", "Tiếng Việt", "Tiếng Anh", "Đạo đức", "Tự nhiên và Xã hội",
    "Khoa học", "Lịch sử và Địa lý", "Tin học", "Công nghệ", "Thể dục",
    "Âm nhạc", "Mỹ thuật", "Hoạt động trải nghiệm",
  ],
  thcs: [
    "Toán", "Ngữ văn", "Tiếng Anh", "Vật lý", "Hóa học", "Sinh học",
    "Lịch sử", "Địa lý", "GDCD", "Tin học", "Công nghệ", "Thể dục",
    "Âm nhạc", "Mỹ thuật",
  ],
  thpt: [
    "Toán", "Ngữ văn", "Tiếng Anh", "Vật lý", "Hóa học", "Sinh học",
    "Lịch sử", "Địa lý", "GDCD", "Tin học", "Công nghệ", "Thể dục",
    "Giáo dục quốc phòng",
  ],
};

const DEMO_NAMES = [
  "Nguyễn Minh An", "Trần Thu Hà", "Lê Quốc Bảo", "Phạm Ngọc Linh",
  "Hoàng Đức Long", "Vũ Thanh Mai", "Đặng Hữu Nam", "Bùi Thu Trang",
];

const GRADE_NAMES: Record<(typeof LEVELS)[number], string[]> = {
  th: ["1A1", "2A1", "3A1", "4A1", "5A1"],
  thcs: ["6A1", "7A1", "8A1", "9A1"],
  thpt: ["10A1", "11A1", "12A1"],
};

export async function createSchool(input: {
  name: string;
  code: string;
  level: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  seedDemo: boolean;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["so_gd", "admin"]);
  if (deny) return { error: deny };
  const profile = await getProfile();

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name || name.length > 200) return { error: "Tên trường trống hoặc quá dài (tối đa 200 ký tự)." };
  if (!/^[A-Z0-9-]{2,32}$/.test(code))
    return { error: "Mã trường chỉ gồm chữ HOA, số và dấu - (2-32 ký tự)." };
  if (!LEVELS.includes(input.level as (typeof LEVELS)[number]))
    return { error: "Cấp học không hợp lệ." };
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
    return { error: "Email admin trường không hợp lệ." };
  if ((input.adminPassword ?? "").length < 8)
    return { error: "Mật khẩu admin tối thiểu 8 ký tự." };
  if (!input.adminName.trim() || input.adminName.trim().length > 200)
    return { error: "Tên admin trường trống hoặc quá dài (tối đa 200 ký tự)." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: school, error: sErr } = await admin
    .from("schools")
    .insert({
      name,
      code,
      level: input.level,
      org_unit_id: profile?.org_unit_id ?? null,
    })
    .select("id")
    .single();
  if (sErr || !school)
    return { error: "Không tạo được trường - mã trường có thể đã tồn tại." };
  const sid = school.id;

  const cleanup = async () => {
    const problems: string[] = [];
    const { data: cls, error: clsErr } = await admin
      .from("classes")
      .select("id")
      .eq("school_id", sid);
    if (clsErr) problems.push("classes-lookup");
    const classIds = (cls ?? []).map((c) => c.id);
    if (classIds.length) {
      const { error } = await admin.from("students").delete().in("class_id", classIds);
      if (error) problems.push("students");
    }
    for (const t of ["classes", "subjects", "departments", "academic_years"] as const) {
      const { error } = await admin.from(t).delete().eq("school_id", sid);
      if (error) problems.push(t);
    }
    const { error: pErr } = await admin
      .from("profiles")
      .delete()
      .eq("school_id", sid);
    if (pErr) problems.push("profiles");
    const { error } = await admin.from("schools").delete().eq("id", sid);
    if (error) problems.push("schools");
    return problems;
  };

  const fail = async (error: string, userId?: string) => {
    // xoa auth user TRUOC cleanup - profiles.school_id giu FK toi schools
    const problems: string[] = [];
    if (userId) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) problems.push("auth_user");
    }
    problems.push(...(await cleanup()));
    if (problems.length) {
      console.error("[createSchool] rollback khong day du", sid, problems);
      return {
        error: `${error} Rollback chưa xóa hết dữ liệu (${problems.join(", ")}) - báo quản trị dọn trường mã ${code}.`,
      };
    }
    return { error };
  };

  const { data: year, error: yErr } = await admin
    .from("academic_years")
    .insert({
      school_id: sid,
      name: "2026-2027",
      start_date: "2026-08-10",
      end_date: "2027-05-31",
      is_current: true,
    })
    .select("id")
    .single();
  if (yErr || !year) return fail("Không tạo được năm học cho trường.");

  const { error: dErr } = await admin.from("departments").insert([
    { name: "Tổ Tự nhiên", school_id: sid },
    { name: "Tổ Xã hội", school_id: sid },
  ]);
  if (dErr) return fail("Không tạo được tổ chuyên môn mặc định.");

  const { error: subErr } = await admin
    .from("subjects")
    .insert(
      LEVEL_SUBJECTS[input.level as (typeof LEVELS)[number]].map((n) => ({
        school_id: sid,
        name: n,
      })),
    );
  if (subErr) return fail("Không tạo được bộ môn học cho trường.");

  const { data: userData, error: uErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: input.adminPassword,
    email_confirm: true,
    app_metadata: {
      role: "bgh",
      school_id: sid,
      full_name: input.adminName.trim(),
    },
  });
  if (uErr || !userData.user) {
    return fail(
      uErr?.message.includes("already")
        ? "Email admin đã tồn tại."
        : "Không tạo được tài khoản admin trường.",
    );
  }

  // trigger tao profile mac dinh hoc_sinh; gan role/truong ro rang qua service role
  const { data: upd, error: pErr } = await admin
    .from("profiles")
    .update({
      role: "bgh",
      school_id: sid,
      full_name: input.adminName.trim(),
    })
    .eq("id", userData.user.id)
    .select("id");
  if (pErr || !upd?.length)
    return fail("Không gán được hồ sơ admin trường.", userData.user.id);

  if (input.seedDemo) {
    const classNames = GRADE_NAMES[input.level as (typeof LEVELS)[number]];
    const { data: classes, error: cErr } = await admin
      .from("classes")
      .insert(
        classNames.map((n) => ({
          school_id: sid,
          academic_year_id: year.id,
          name: n,
          grade: parseInt(n.match(/^\d+/)?.[0] ?? "0", 10),
          status: "active",
        })),
      )
      .select("id,name");
    if (cErr || !classes?.length)
      return fail("Không tạo được lớp mẫu.", userData.user.id);
    const studentRows = classes.flatMap((c) =>
      DEMO_NAMES.map((n, i) => ({
        class_id: c.id,
        code: `${c.name.replace(/\D/g, "")}${String(i + 1).padStart(3, "0")}`,
        full_name: n,
        gender: i % 2 ? "nam" : "nu",
        status: "active",
      })),
    );
    const { error: stErr } = await admin.from("students").insert(studentRows);
    if (stErr) return fail("Không tạo được học sinh mẫu.", userData.user.id);
  }

  const supabase = await createClient();
  await logAudit(supabase, {
    action: "school.provision",
    entity: "schools",
    entityId: sid,
    payload: { name, code, level: input.level, admin: adminEmail },
  });
  revalidatePath("/dept/schools");
  revalidatePath("/dept/usage");
  return {};
}
