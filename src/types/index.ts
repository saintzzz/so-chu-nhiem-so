export type Role =
  | "gvcn"
  | "gvbm"
  | "to_truong"
  | "bgh"
  | "pht"
  | "ke_toan"
  | "so_gd"
  | "phong_gd"
  | "ubnd"
  | "phu_huynh"
  | "hoc_sinh"
  | "admin";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string | null;
  school_id: string | null;
  department_id: string | null;
  campus_id: string | null;
  org_unit_id: string | null;
  avatar_url: string | null;
}

export interface School {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  level: "th" | "thcs" | "thpt" | "lien_cap";
  org_unit_id: string | null;
}

export interface OrgUnit {
  id: string;
  type: "so" | "phong" | "ubnd";
  name: string;
  parent_id: string | null;
  province: string | null;
}

export interface Campus {
  id: string;
  school_id: string;
  name: string;
  kind: "main" | "phan_hieu" | "diem_truong";
  distance_km: number | null;
  address: string | null;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface ClassRoom {
  id: string;
  school_id: string;
  academic_year_id: string;
  campus_id: string | null;
  name: string;
  grade: number;
  gvcn_id: string | null;
  status: "pending" | "active" | "archived";
}

export interface Student {
  id: string;
  class_id: string;
  group_id: string | null;
  profile_id: string | null;
  code: string;
  national_id: string | null;
  full_name: string;
  dob: string | null;
  gender: "nam" | "nu" | "khac" | null;
  address: string | null;
  status: "active" | "transferred" | "graduated" | "suspended";
  positive_points: number;
}

export interface StudentGroup {
  id: string;
  class_id: string;
  name: string;
  leader_id: string | null;
}

export type AttendanceStatus = "present" | "excused" | "unexcused" | "late";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  source: "manual" | "period_log" | "parent";
  note: string | null;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
}

export interface TimetableEntry {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  weekday: number;
  period: number;
  room: string | null;
  subject?: Subject;
}

export interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  term: "hk1" | "hk2";
  assessment_type: "ddg_tx" | "ddg_gk" | "ddg_ck";
  score: number | null;
  result: "dat" | "chua_dat" | null;
  comment: string | null;
  level: "T" | "H" | "C" | null;
}

/** Đánh giá NLPC tiểu học - 15 thuộc tính theo mẫu CSDL ngành. */
export type NlpcAttribute =
  | "nlc_tuchu"
  | "nlc_giaotiep"
  | "nlc_gqvd"
  | "nldt_ngonngu"
  | "nldt_tinhtoan"
  | "nldt_khoahoc"
  | "nldt_congnghe"
  | "nldt_tinhoc"
  | "nldt_thammi"
  | "nldt_thechat"
  | "pc_yenuoc"
  | "pc_nhanai"
  | "pc_chamchi"
  | "pc_trungthuc"
  | "pc_trachnhiem";

export interface CompetencyEvaluation {
  id: string;
  student_id: string;
  term: string;
  attribute_code: NlpcAttribute;
  level: "T" | "H" | "C" | null;
}

export interface ConductRecord {
  id: string;
  student_id: string;
  type: "vi_pham" | "khen_thuong" | "nhan_xet";
  content: string;
  points: number;
  date: string;
}

export interface Incident {
  id: string;
  student_id: string | null;
  class_id: string | null;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "following" | "resolved" | "archived";
  description: string;
  reported_to_bgh: boolean;
  occurred_at: string;
}

export interface Announcement {
  id: string;
  sender_id: string;
  class_id: string | null;
  student_id: string | null;
  title: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  plan: string | null;
  activity_date: string | null;
  status: "draft" | "pending" | "approved" | "done" | "cancelled";
}

export interface CounselingCase {
  id: string;
  student_id: string;
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "assessing" | "counseling" | "referred" | "resolved";
  referral: string | null;
  notes: string | null;
}

export interface SeatingSeat {
  x: number;
  y: number;
  student_id: string | null;
}

export interface SeatingLayout {
  cols: number;
  rows: number;
  seats: SeatingSeat[];
}

export interface SeatingChart {
  id: string;
  class_id: string;
  month: string;
  version: number;
  layout: SeatingLayout;
  is_current: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  source: "manual" | "suggested";
  status: "pending" | "approved" | "done" | "dismissed";
}

export interface Parent {
  id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
}

export interface Appointment {
  id: string;
  parent_id: string;
  teacher_id: string;
  student_id: string | null;
  scheduled_at: string;
  purpose: string | null;
  status: "proposed" | "confirmed" | "done" | "cancelled";
}

export interface EmulationScore {
  id: string;
  class_id: string;
  criterion_id: string;
  period: string;
  score: number;
}

export interface DailyReport {
  id: string;
  class_id: string;
  date: string;
  gvcn_id: string;
  absent_count: number;
  late_count: number;
  violation_count: number;
  commendation_count: number;
  content: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
}

export interface SubstituteRequest {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  date: string;
  period: number;
  absent_teacher_id: string;
  substitute_teacher_id: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
}

export type LessonPlanStatus =
  | "draft"
  | "submitted"
  | "team_approved"
  | "approved"
  | "rejected";

export interface LessonPlan {
  id: string;
  school_id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string | null;
  week: number | null;
  periods: string | null;
  title: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  status: LessonPlanStatus;
  team_reviewed_by: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
}

export interface SupportStaff {
  id: string;
  school_id: string;
  campus_id: string | null;
  full_name: string;
  position: string;
  qualification: string | null;
  standardized: boolean;
  note: string | null;
}

export interface EarlyWarning {
  id: string;
  school_id: string;
  class_id: string | null;
  student_id: string | null;
  category: "chuyen_can" | "hoc_tap" | "an_toan" | "bo_hoc" | "tam_ly";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string | null;
  suggestion: string | null;
  status: "open" | "acknowledged" | "resolved";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  dedupe_key: string | null;
  created_at: string;
}

export interface Tt15Evaluation {
  id: string;
  school_id: string;
  campus_id: string | null;
  term: string;
  evaluator_id: string | null;
  scores: Record<string, number>;
  total: number | null;
  rating: string | null;
  status: "draft" | "submitted" | "verified";
  created_at: string;
}
