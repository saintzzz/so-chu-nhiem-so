import type { Role, Profile } from "@/types";

/**
 * CR-038: vai trò có thể đứng lớp -> duoc phep kiem nhiem lan nhau
 * (GVCN la GVBM chu nhiem lop; to truong/PHT/BGH van day kiem).
 * ke_toan (hanh chinh), so_gd/ubnd/phu_huynh/hoc_sinh (ngoai truong) va
 * admin (superuser) khong duoc lam concurrent role.
 */
export const CONCURRENT_ELIGIBLE: Role[] = [
  "gvcn",
  "gvbm",
  "to_truong",
  "bgh",
  "pht",
];

/** Tap role hieu luc = role chinh + concurrent_roles hop le. */
export function effectiveRoles(
  profile: Pick<Profile, "role" | "concurrent_roles">,
): Role[] {
  const extra = (profile.concurrent_roles ?? []).filter((r): r is Role =>
    (CONCURRENT_ELIGIBLE as string[]).includes(r),
  );
  return [...new Set([profile.role, ...extra])];
}

export function hasRole(
  profile: Pick<Profile, "role" | "concurrent_roles">,
  role: Role,
): boolean {
  return effectiveRoles(profile).includes(role);
}

export function hasAnyRole(
  profile: Pick<Profile, "role" | "concurrent_roles">,
  roles: Role[],
): boolean {
  return effectiveRoles(profile).some((r) => roles.includes(r));
}
