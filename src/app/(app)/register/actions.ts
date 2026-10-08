"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { hasRole } from "@/lib/roles";

/* ---------- CR-034: cap tai khoan dang nhap cho phu huynh ---------- */

export async function grantParentAccess(input: {
  parentId: string;
  email: string;
  password: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh", "admin"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile?.school_id) return { error: "Phiên đăng nhập đã hết hạn." };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email đăng nhập không hợp lệ." };
  if ((input.password ?? "").length < 8)
    return { error: "Mật khẩu tối thiểu 8 ký tự." };

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("parents")
    .select("id,full_name,profile_id,email")
    .eq("id", input.parentId)
    .maybeSingle();
  if (!parent) return { error: "Không tìm thấy phụ huynh." };
  if (parent.profile_id)
    return { error: "Phụ huynh này đã có tài khoản đăng nhập." };

  // ownership: PH phai link vao HS thuoc pham vi nguoi goi
  const { data: links } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parent.id);
  const studentIds = (links ?? []).map((l) => l.student_id);
  if (!studentIds.length)
    return { error: "Liên kết phụ huynh với học sinh trước khi cấp tài khoản." };
  const { data: studs } = await supabase
    .from("students")
    .select("id,class_id")
    .in("id", studentIds);
  const { data: classes } = await supabase
    .from("classes")
    .select("id,school_id,gvcn_id")
    .in("id", (studs ?? []).map((s) => s.class_id));
  const allowed =
    hasRole(profile, "gvcn")
      ? (classes ?? []).some((c) => c.gvcn_id === profile.id)
      : (classes ?? []).some((c) => c.school_id === profile.school_id);
  if (!allowed)
    return { error: "Phụ huynh không thuộc phạm vi lớp/trường của bạn." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: {
      role: "phu_huynh",
      school_id: profile.school_id,
      full_name: parent.full_name,
    },
  });
  if (error || !data.user)
    return {
      error: error?.message.includes("already")
        ? "Email đã tồn tại tài khoản."
        : "Không tạo được tài khoản.",
    };

  // trigger tao profile mac dinh hoc_sinh; gan role/truong ro rang qua service role
  const { data: upd, error: pErr } = await admin
    .from("profiles")
    .update({
      role: "phu_huynh",
      school_id: profile.school_id,
      full_name: parent.full_name,
    })
    .eq("id", data.user.id)
    .select("id");
  if (pErr || !upd?.length) {
    const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
    if (delErr) console.error("[grantParentAccess] orphan auth user", data.user.id);
    return {
      error: delErr
        ? "Không gán được hồ sơ tài khoản - báo quản trị dọn tài khoản lẻ."
        : "Không gán được hồ sơ tài khoản.",
    };
  }

  // conditional update + verify 1 row - tranh 2 request tao 2 account cho 1 PH
  const { data: linked, error: linkErr } = await supabase
    .from("parents")
    .update({
      profile_id: data.user.id,
      email: parent.email?.trim() ? parent.email : email,
    })
    .eq("id", parent.id)
    .is("profile_id", null)
    .select("id");
  if (linkErr || !linked?.length) {
    const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
    if (delErr) console.error("[grantParentAccess] orphan auth user", data.user.id);
    return {
      error: delErr
        ? "Không gắn được tài khoản vào hồ sơ phụ huynh - báo quản trị dọn tài khoản lẻ."
        : "Không gắn được tài khoản vào hồ sơ phụ huynh.",
    };
  }

  await logAudit(supabase, {
    action: "parent.grant_access",
    entity: "parents",
    entityId: parent.id,
    payload: { email },
  });
  revalidatePath("/register/roster");
  return {};
}
