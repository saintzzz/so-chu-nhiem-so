import type { Task } from "@/types";

/** Rows for tables that are not yet declared in src/types/index.ts */

export interface ClassRoleRow {
  student_id: string;
  role: string;
}

export interface SchoolYearEvent {
  id: string;
  title: string;
  event_date: string;
  month: number | null;
  category: string | null;
}

export interface TaskRow extends Task {
  month: number | null;
}

export interface Kpi {
  id: string;
  class_id: string;
  period: string;
  content: Record<string, unknown>;
  status: "registered" | "approved" | "rejected";
}

export interface Signoff {
  id: string;
  class_id: string;
  period: string;
  type: "so_chu_nhiem" | "so_hoc_ba";
  status: "pending" | "submitted" | "signed" | "locked" | "rejected";
  submitted_by: string | null;
  submitted_at: string | null;
  signed_by: string | null;
  signed_at: string | null;
  reject_reason: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: unknown;
  created_at: string;
}

export const ROLE_LABELS_BCS: Record<string, string> = {
  lop_truong: "Lớp trưởng",
  lop_pho_hoc_tap: "Lớp phó học tập",
  lop_pho_van_nghe: "Lớp phó văn nghệ",
  to_truong: "Tổ trưởng",
};

export const EVENT_CATEGORIES: Record<string, string> = {
  le_hoi: "Lễ hội",
  kiem_tra: "Kiểm tra / Thi",
  hoat_dong: "Hoạt động",
  hanh_chinh: "Hành chính",
  khac: "Khác",
};

import { prevMonthOf, todayVN } from "@/lib/utils";

// R12-02: thang/ky danh gia TAI THOI DIEM GOI - hang module-level bi dong
// bang luc import, sai qua ranh gioi thang trong session dai.
/** "YYYY-MM" tháng hiện tại theo giờ VN. */
export function currentMonthVN(): string {
  return todayVN().slice(0, 7);
}

/** "YYYY-MM" tháng trước theo giờ VN. */
export function prevMonthVN(): string {
  return prevMonthOf(todayVN());
}

/** "Tháng M/YYYY" kỳ hiện tại (nhãn sổ học bạ) theo giờ VN. */
export function currentPeriodVN(): string {
  const t = todayVN();
  return `Tháng ${Number(t.slice(5, 7))}/${t.slice(0, 4)}`;
}
