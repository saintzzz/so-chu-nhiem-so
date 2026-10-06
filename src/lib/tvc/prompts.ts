import type { ToolContext } from "./types";

type Input = Record<string, string>;

const DOC_SHAPE = `{
  "title": "tiêu đề tài liệu",
  "meta": [["Nhãn", "giá trị"]],
  "sections": [
    {
      "title": "Tên phần",
      "blocks": [
        {"kind": "heading", "level": 2, "text": "..."},
        {"kind": "para", "text": "..."},
        {"kind": "list", "items": ["..."], "ordered": true},
        {"kind": "table", "header": ["..."], "rows": [["..."]]},
        {"kind": "formula", "tex": "biểu thức LaTeX"},
        {"kind": "note", "text": "lưu ý"}
      ]
    }
  ],
  "appendix": [{"title": "ĐÁP ÁN", "blocks": [...]}]
}`;

const SYS_BASE = `Bạn là trợ lý biên soạn học liệu cho giáo viên phổ thông Việt Nam theo Chương trình GDPT 2018.
Quy tắc BẮT BUỘC:
- Chỉ trả về JSON hợp lệ theo đúng cấu trúc được cho, KHÔNG kèm giải thích hay markdown.
- Nội dung tiếng Việt, thuật ngữ chuẩn ngành giáo dục.
- Không sao chép nội dung sách giáo khoa; mọi văn bản/ngữ liệu đều do bạn tự biên soạn.
- Không dùng dấu gạch dài (em-dash/en-dash), chỉ dùng gạch ngang "-".
Cấu trúc JSON đầu ra:
${DOC_SHAPE}`;

const stdCtx = (ctx: ToolContext) =>
  ctx.standards.length
    ? ctx.standards
        .map((s) => `- ${s.code} (lớp ${s.grade}, mạch "${s.strand}"): ${s.description}`)
        .join("\n")
    : "- (không có mã YCCĐ cụ thể - tự suy ra yêu cầu phù hợp bài học)";

const base = (ctx: ToolContext) =>
  `Môn: ${ctx.subject?.name ?? "chung"} | Khối: ${ctx.grade ?? "?"} | Năm học: 2025-2026
Yêu cầu cần đạt liên quan:
${stdCtx(ctx)}`;

export const PROMPTS: Record<
  string,
  (input: Input, ctx: ToolContext) => { system: string; prompt: string }
> = {
  "DC-01": (input, ctx) => ({
    system: SYS_BASE,
    prompt: `${base(ctx)}
Hãy biên soạn KẾ HOẠCH BÀI DẠY cho bài "${input.lesson || "theo YCCĐ trên"}" theo khung 4 hoạt động:
1. Mục tiêu (kiến thức bám YCCĐ, năng lực chung + đặc thù, phẩm chất)
2. Thiết bị dạy học và học liệu
3. Tiến trình: Hoạt động Khởi động - Khám phá - Luyện tập - Vận dụng, mỗi hoạt động gồm mục tiêu + các bước tổ chức cụ thể có vai trò GV/HS rõ ràng
4. Phụ lục: bảng dự kiến sản phẩm và phương án đánh giá từng hoạt động
Thời lượng: ${input.duration || "1 tiết"}. ${input.note ? `Yêu cầu thêm: ${input.note}` : ""}
Viết đầy đủ, thực tế, dùng được ngay - không viết khung trống.`,
  }),

  "DC-05": (input, ctx) => ({
    system: SYS_BASE,
    prompt: `${base(ctx)}
Soạn PHIẾU HỌC TẬP cho bài "${input.lesson || "theo YCCĐ trên"}" gồm 3 phần: Khởi động, Khám phá - Luyện tập, Vận dụng.
Mỗi phần 2-3 câu hỏi/nhiệm vụ cụ thể (không chung chung), có câu phân hoá cho học sinh yếu và giỏi.
Appendix: đáp án/hướng dẫn chấm chi tiết từng câu (phần dành cho giáo viên).`,
  }),

  "T-01": (input, ctx) => ({
    system: SYS_BASE,
    prompt: `${base(ctx)}
Bài toán gốc: "${input.problem}"
Sinh ${input.count || 10} biến thể: đổi số liệu/bối cảnh nhưng GIỮ NGUYÊN cấu trúc toán học và mức độ nhận thức.
Mỗi biến thể là một mục list "Bài n: nội dung". Section "LỜI GIẢI": giải từng biến thể tương ứng (ngắn gọn, đúng cách trình bày của cấp học).`,
  }),

  "V-02": (input, ctx) => ({
    system: SYS_BASE,
    prompt: `${base(ctx)}
Văn bản: """${input.text}"""
Sinh bộ câu hỏi đọc hiểu theo CV 7991: đủ 3 mức độ Biết - Hiểu - Vận dụng, đủ 4 dạng thức (TN nhiều lựa chọn với 4 phương án A-D hoàn chỉnh, Đúng-Sai 4 ý, Trả lời ngắn, Tự luận).
Bám đặc trưng thể loại của văn bản. Appendix: đáp án đầy đủ + hướng dẫn chấm từng câu.`,
  }),

  "A-01": (input, ctx) => ({
    system: SYS_BASE + "\n- Bài đọc và câu hỏi viết bằng tiếng Anh; phần hướng dẫn/từ vựng có nghĩa tiếng Việt.",
    prompt: `Cấp độ: Khung năng lực ngoại ngữ 6 bậc - ${input.cefr || "A2"} | Chủ đề: ${input.topic || "daily life"} | Khối: ${ctx.grade ?? "?"}
Viết một bài đọc tiếng Anh NGUYÊN GỐC (120-180 từ) kiểm soát từ vựng và cấu trúc đúng bậc, chủ đề gần gũi học sinh Việt Nam.
Kèm: bảng 5-8 từ vựng trọng tâm (từ - nghĩa - ví dụ trong bài), 5 câu hỏi đọc hiểu đủ dạng (MC 4 options, True/False, short answer). Appendix: answer key.`,
  }),

  "A-02": (input, ctx) => ({
    system: SYS_BASE + "\n- Bài tập viết bằng tiếng Anh, hướng dẫn bằng tiếng Việt.",
    prompt: `Danh sách từ vựng: ${input.words}
Chủ đề: ${input.topic || "theo từ vựng"} | Khối: ${ctx.grade ?? "?"}
Sinh bài tập từ vựng đủ các dạng: điền khuyết (câu có nghĩa), nối từ - nghĩa, chọn dạng đúng của từ, đặt câu, ô chữ gợi ý (definition -> word), thẻ ghi nhớ. Appendix: đáp án đầy đủ.`,
  }),

  "A-03": (input, ctx) => ({
    system: SYS_BASE + "\n- Hội thoại và bài tập viết bằng tiếng Anh tự nhiên, đúng bậc.",
    prompt: `Chủ đề: ${input.topic || "everyday conversation"} | Cấp độ: ${input.cefr || "A2"} | Khối: ${ctx.grade ?? "?"}
Viết hội thoại 8-12 lượt lời giữa 2 người (đặt tên), tự nhiên, đúng cấp độ, chủ đề gần gũi học sinh Việt Nam.
Kèm: transcript liền mạch, 4 bài tập nghe (MC, True/False, điền từ, role-play). Appendix: answer key.`,
  }),
};

export function buildGenericPrompt(toolName: string, desc: string) {
  return (input: Input, ctx: ToolContext) => ({
    system: SYS_BASE,
    prompt: `${base(ctx)}\nCông cụ: ${toolName}. ${desc}\nĐầu vào: ${JSON.stringify(input)}`,
  });
}
