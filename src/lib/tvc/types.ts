import type {
  CurriculumStandard,
  DocContent,
  MaterialType,
  Subject,
} from "@/types/tvc";

export type ToolGroup = "core" | "toan" | "van" | "anh";

export interface ToolField {
  key: string;
  label: string;
  type:
    | "subject" // chọn môn -> load grade/standard cascade
    | "grade" // chọn khối lớp theo môn
    | "standard" // chọn bài học/YCCĐ theo môn+khối
    | "select"
    | "text"
    | "textarea"
    | "number"
    | "words"; // danh sách từ (A-02)
  options?: { value: string; label: string }[];
  required?: boolean;
  default?: string | number;
  placeholder?: string;
  help?: string;
}

/** Dữ liệu ngữ cảnh server nạp sẵn cho tool */
export interface ToolContext {
  subject: Subject | null;
  grade: number | null;
  standards: CurriculumStandard[]; // các YCCĐ đã chọn
  extra?: Record<string, unknown>;
}

export interface ToolDef {
  code: string;
  name: string;
  description: string;
  group: ToolGroup;
  materialType: MaterialType;
  /** tool kiểu trang riêng (ngân hàng câu hỏi, kho ngữ liệu) - link thẳng, không chạy generator */
  href?: string;
  /** các trường nhập - tối đa 3 bắt buộc đầu tiên */
  fields: ToolField[];
  /** câu hỏi chế độ "Cùng soạn" (không bắt buộc) */
  coDraftFields?: ToolField[];
  buildPrompt: (
    input: Record<string, string>,
    ctx: ToolContext,
  ) => { system: string; prompt: string };
  /** fallback rule-based - luôn trả về được DocContent */
  fallback: (input: Record<string, string>, ctx: ToolContext) => DocContent;
}

/** Bản serializable truyền sang client component (bỏ functions). */
export type ToolClientDef = Omit<ToolDef, "buildPrompt" | "fallback">;

export function toClientTool(t: ToolDef): ToolClientDef {
  const { code, name, description, group, materialType, href, fields, coDraftFields } = t;
  return { code, name, description, group, materialType, href, fields, coDraftFields };
}

export const GROUP_LABEL: Record<ToolGroup, string> = {
  core: "Dùng chung",
  toan: "Môn Toán",
  van: "Ngữ văn / Tiếng Việt",
  anh: "Môn Tiếng Anh",
};

export const GROUP_COLOR: Record<ToolGroup, string> = {
  core: "bg-secondary text-indigo-300 border-primary/40",
  toan: "bg-blue-400/15 text-blue-300 border-blue-400/40",
  van: "bg-rose-400/15 text-rose-300 border-rose-400/40",
  anh: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
};

export const LEVEL_LABEL: Record<string, string> = {
  biet: "Biết",
  hieu: "Hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
};

export const QTYPE_LABEL: Record<string, string> = {
  multiple_choice: "Trắc nghiệm nhiều lựa chọn",
  true_false_4: "Đúng - Sai (4 ý)",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};

/** Tỷ lệ điểm theo CV 7991: TN 3.0 - Đ/S 2.0 - TL ngắn 2.0 - Tự luận 3.0 */
export const QTYPE_POINTS: Record<string, number> = {
  multiple_choice: 3,
  true_false_4: 2,
  short_answer: 2,
  essay: 3,
};
