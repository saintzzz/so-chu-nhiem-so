// R10-03: link thong bao tin nhan phai theo role NGUOI NHAN. Phu huynh va
// hoc sinh khong mo duoc route (app) cua nhan vien (requireRoles gvcn/bgh),
// nen notification phai tro ve cong portal cua ho; role khong nhan dien duoc
// ve mac dinh an toan /parents/inbox (gvcn/bgh).
export function messageLinkForRole(role: string | null | undefined): string {
  if (role === "phu_huynh") return "/portal/parent";
  if (role === "hoc_sinh") return "/portal/student";
  return "/parents/inbox";
}

// Roles mo duoc route /academics/teacher-chat (requireRoles cua page).
const TEACHER_CHAT_VIEWER_ROLES = new Set(["gvcn", "gvbm", "to_truong"]);

/**
 * Link thong bao cho tin nhan giua nhan vien tren trang teacher-chat.
 * Deep-link `?to=<sender>` chi dung duoc khi role nguoi nhan xem duoc trang;
 * bgh doc qua /parents/inbox; cac role staff con lai (pht/ke_toan/admin) ve
 * feed /notifications de it nhat doc duoc noi dung thay vi bi redirect loop.
 */
export function teacherChatLinkForRole(
  roles: (string | null | undefined)[],
  senderId: string,
): string {
  const rs = roles.filter((r): r is string => Boolean(r));
  if (rs.some((r) => TEACHER_CHAT_VIEWER_ROLES.has(r))) {
    return `/academics/teacher-chat?to=${senderId}`;
  }
  if (rs.includes("bgh")) return "/parents/inbox";
  return "/notifications";
}
