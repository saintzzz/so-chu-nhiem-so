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
  month: string | null;
  category: string | null;
}

export interface TaskRow extends Task {
  month: string | null;
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
  status: "pending" | "signed" | "locked" | "rejected";
  signed_by: string | null;
  signed_at: string | null;
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

export const CURRENT_MONTH = "2026-09";
export const PREV_MONTH = "2026-08";
export const CURRENT_PERIOD = "Tháng 9/2026";
