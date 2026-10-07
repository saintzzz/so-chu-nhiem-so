// Helpers dung chung cho 3 trang chat (teacher/parent/student) + hop thu -
// tach thuan de unit-test cursor paging va merge ma khong can component
// harness. Khong import alias @/ de node --test import truc tiep duoc.

/**
 * Role nhan vien duoc phep nhan tin noi bo cung truong - khop nhanh
 * staff-staff cua scn_can_message (supabase/migrations/20261105_r2_security_fixes.sql).
 * teacher-chat dung de resolve `?to=` peer ngoai danh sach mac dinh.
 */
export const STAFF_CHAT_ROLES = [
  "gvcn",
  "gvbm",
  "to_truong",
  "bgh",
  "pht",
  "ke_toan",
  "admin",
] as const;

/**
 * Predicate PostgREST .or() cho cursor "trang cu hon" tren khoa sap xep
 * (created_at desc, id desc):
 *   created_at < X OR (created_at = X AND id < Y)
 * Tie-break id can thiet vi created_at co the trung (bulk insert / seed cung
 * transaction) - chi lt(created_at) se bo sot hoac lap tin o bien trang.
 * Gia tri duoc double-quote vi timestamptz chua ky tu reserved cua or()
 * (dau . trong fractional seconds) - PostgREST yeu cau quote cho chung.
 */
export function olderMessagesPredicate(createdAt: string, id: string): string {
  return (
    `created_at.lt."${createdAt}",` +
    `and(created_at.eq."${createdAt}",id.lt."${id}")`
  );
}

export interface ChatRowLike {
  id: string;
  created_at: string;
}

/**
 * Gop cac dot tin nhan vao mot danh sach duy nhat: prepend trang cu
 * (loadOlder), append tin vua gui. Dedupe theo id va sort chronological
 * (created_at asc, id asc - dao nguoc khoa cursor desc) nen caller khong can
 * tu reverse. Bat vien: moi id chi xuat hien mot lan, ket qua khong phu
 * thuoc thu tu truyen cac trang.
 */
export function mergeChatMessages<T extends ChatRowLike>(
  current: T[],
  ...incoming: T[][]
): T[] {
  const byId = new Map<string, T>();
  for (const list of incoming) {
    for (const m of list) byId.set(m.id, m);
  }
  for (const m of current) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
