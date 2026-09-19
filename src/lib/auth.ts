import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, Profile } from "@/types";

export const ROLE_HOME: Record<Role, string> = {
  gvcn: "/dashboard",
  gvbm: "/academics/grades",
  to_truong: "/team/home",
  bgh: "/school/dashboard",
  so_gd: "/dept/dashboard",
  phu_huynh: "/portal/parent",
  hoc_sinh: "/portal/student",
  admin: "/dept/dashboard",
};

export const STAFF_ROLES: Role[] = [
  "gvcn",
  "gvbm",
  "to_truong",
  "bgh",
  "so_gd",
  "admin",
];

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRoles(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(ROLE_HOME[profile.role]);
  return profile;
}

/** Role check for server actions - returns an error message instead of redirecting. */
export async function checkActionRole(roles: Role[]): Promise<string | null> {
  const profile = await getProfile();
  if (!profile) return "Phiên đăng nhập đã hết hạn.";
  if (!roles.includes(profile.role))
    return "Bạn không có quyền thực hiện thao tác này.";
  return null;
}
