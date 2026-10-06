export type Role = "giao_vien" | "kiem_duyet" | "admin";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string | null;
  school_name: string | null;
  subjects: string[];
  grades: number[];
}

export interface Subject {
  code: string;
  name: string;
  grade_min: number;
  grade_max: number;
}

export interface CurriculumStandard {
  id: string;
  code: string;
  subject_code: string;
  grade: number;
  strand: string;
  lesson_ref: string;
  description: string;
  competencies: string[];
  version: string;
  status: "active" | "superseded" | "inactive";
  /** NULL = YCCĐ hệ thống dùng chung; có giá trị = YCCĐ riêng của trường (CR-023). */
  school_id?: string | null;
}

export interface TextbookLesson {
  id: string;
  standard_id: string;
  textbook_set: "ket_noi" | "chan_troi" | "canh_dieu";
  lesson_title: string;
  period_no: number | null;
  week_no: number | null;
}

export type MaterialStatus =
  | "draft"
  | "personal"
  | "pending_review"
  | "in_review"
  | "published"
  | "rejected"
  | "withdrawn";

export type MaterialType =
  | "lesson_plan"
  | "matrix"
  | "exam"
  | "worksheet"
  | "question_set"
  | "reading"
  | "vocab_set"
  | "dialogue"
  | "formula_set"
  | "variants"
  | "slides"
  | "other";

export interface Material {
  id: string;
  author_id: string;
  type: MaterialType;
  tool_code: string | null;
  title: string;
  subject_code: string | null;
  grade: number | null;
  standard_ids: string[];
  content: DocContent;
  ai_content?: DocContent | null;
  status: MaterialStatus;
  license: "private" | "free" | "paid";
  price: number;
  author_score: number;
  version: number;
  ai_usage: "none" | "partial" | "full";
  origin_note: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export type QType = "multiple_choice" | "true_false_4" | "short_answer" | "essay";
export type QLevel = "biet" | "hieu" | "van_dung" | "van_dung_cao";
export type QReviewState = "unreviewed" | "approved" | "flagged";

export interface Question {
  id: string;
  owner_id: string;
  code: string | null;
  stem: string;
  context: string | null;
  qtype: QType;
  level: QLevel;
  points: number;
  answer: Record<string, unknown>;
  solution: string | null;
  standard_ids: string[];
  subject_code: string | null;
  grade: number | null;
  source: "generated" | "manual" | "imported";
  review_state: QReviewState;
  media?: MediaItem[];
  created_at: string;
}

export interface MediaItem {
  kind: "figure" | "image";
  spec?: import("@/lib/tvc/figures").FigureSpec; // figure -> SVG deterministic
  path?: string; // storage path trong bucket tvc-media (<school_id>/...)
  alt?: string;
}

export interface MatrixCell {
  standard_id: string;
  standard_code?: string;
  level: QLevel;
  qtype: QType;
  count: number;
  points: number;
}

export interface Matrix {
  id: string;
  owner_id: string;
  title: string;
  subject_code: string | null;
  grade: number | null;
  framework: string;
  total_points: number;
  duration_min: number;
  cells: MatrixCell[];
  spec: SpecRow[];
  created_at: string;
}

export interface SpecRow {
  standard_id: string;
  standard_code?: string;
  requirement: string;
  level: QLevel;
  qtype: QType;
  count: number;
  points: number;
}

export interface Exam {
  id: string;
  owner_id: string;
  matrix_id: string | null;
  title: string;
  subject_code: string | null;
  grade: number | null;
  total_points: number;
  config: Record<string, unknown>;
  created_at: string;
}

export interface ExamQuestion extends Question {
  position: number;
  needs_review: boolean;
  exam_points: number;
}

export interface LiteratureText {
  id: string;
  title: string;
  author: string | null;
  text_type: string;
  difficulty: number;
  topics: string[];
  standard_ids: string[];
  grade_min: number;
  grade_max: number;
  content: string;
  license_note: string | null;
  source: "public_domain" | "licensed" | "commissioned";
}

// ---- Document model: structured output rendered to preview + docx ----
export type DocBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "formula"; tex: string }
  | { kind: "kv"; pairs: [string, string][] }
  | { kind: "divider" }
  | { kind: "note"; text: string }
  | { kind: "image"; svg?: string; path?: string; caption?: string };

export interface DocSection {
  title: string;
  blocks: DocBlock[];
}

export interface DocContent {
  title: string;
  meta?: [string, string][];
  sections: DocSection[];
  appendix?: DocSection[];
}
