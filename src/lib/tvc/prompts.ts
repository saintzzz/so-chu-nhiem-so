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
Biên soạn KẾ HOẠCH BÀI DẠY cho bài "${input.lesson || "theo YCCĐ trên"}" theo đúng khung Công văn 5512.
Biểu mẫu hoạt động: ${
      (ctx.extra?.khbdTemplate as { name?: string; activities?: { name: string; minutes?: number; hint?: string }[]; include_review?: boolean; include_signoff?: boolean } | undefined)
        ?.activities?.map((a) => a.name)
        .join(" - ") || "Khởi động - Khám phá - Luyện tập - Vận dụng"
    }. Thời lượng: ${input.duration || "1 tiết"}.

CẤU TRÚC BẮT BUỘC của sections (đúng thứ tự, đúng tiêu đề):
1. "I. MỤC TIÊU" - heading con "1. Kiến thức" (list bám sát YCCĐ đã chọn), "2. Năng lực" (năng lực chung + năng lực đặc thù CỤ THỂ của môn, viết đầy đủ - ví dụ môn Toán: "năng lực tư duy và lập luận toán học, năng lực giải quyết vấn đề toán học" kèm biểu hiện cụ thể trong bài), "3. Phẩm chất".
2. "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU" - liệt kê đồ dùng/học liệu cho GV và HS, cụ thể theo bài (không ghi chung chung).
3. "III. TIẾN TRÌNH DẠY HỌC" - sau đó MỖI hoạt động của biểu mẫu là MỘT section riêng, tiêu đề "Hoạt động <n>. <Tên hoạt động> (<số phút> phút)". Trong mỗi section hoạt động BẮT BUỘC đủ 5 nhãn theo thứ tự:
   a) Mục tiêu (heading level 3)
   b) Nội dung (heading level 3) - THEO CV 5512 phần này phải NÊU RÕ nội dung yêu cầu/nhiệm vụ cụ thể mà HS phải thực hiện: viết sẵn nguyên văn câu hỏi, bài tập, tình huống (ví dụ "Câu hỏi: Cho P(x) = 3x^2 + 2x - 5 và Q(x) = x^2 - 4x + 1. Tính P(x) + Q(x)?"). KHÔNG được ghi "Nội dung hoạt động X của bài" hay nói chung chung.
   c) Tổ chức hoạt động - BẮT BUỘC dạng table gồm 2 cột ["Hoạt động của giáo viên và học sinh", "Nội dung"], mỗi bước 1 dòng. Cột 1 nêu rõ hành động GV và HS. Cột 2 BẮT BUỘC viết nguyên văn sản phẩm: câu hỏi GV đặt + đáp án/kết quả dự kiến của HS (ví dụ "P(x) + Q(x) = 4x^2 - 2x - 4"), kiến thức cần chốt ghi đầy đủ (định nghĩa, công thức, quy tắc - không ghi "kiến thức trọng tâm").
   d) Sản phẩm (heading level 3 - sản phẩm HS phải đạt sau hoạt động, nêu cụ thể: đáp án câu hỏi/bài tập, nội dung cần ghi vở)
   đ) Đánh giá (heading level 3 - cách GV đánh giá/quan sát sản phẩm, theo tiêu chí nào)
4. "IV. ĐIỀU CHỈNH SAU BÀI DẠY" - để trống, một para duy nhất ghi đúng "................................................" (khoảng 50 dấu chấm, KHÔNG viết chuỗi dài hơn).
5. "KÝ DUYỆT" - table 2 cột ["TỔ TRƯỞNG KIỂM TRA", "NGƯỜI SOẠN"], 1 dòng "(Ký và ghi rõ họ tên)".
appendix CHỈ 1 section: "PHỤ LỤC: DỰ KIẾN SẢN PHẨM VÀ ĐÁNH GIÁ" - table ["Hoạt động", "Sản phẩm học sinh", "Phương án đánh giá"], cột sản phẩm ghi cụ thể (không ghi "bài làm cá nhân").

QUY TẮC NỘI DUNG (quan trọng nhất):
- Mỗi hoạt động phải có ÍT NHẤT 1 câu hỏi/bài tập cụ thể viết nguyên văn, đúng trình độ lớp ${ctx.grade ?? ""}, đúng YCCĐ - và kèm đáp án/kết quả dự kiến trong cột Nội dung hoặc phần Sản phẩm.
- Hoạt động Luyện tập: phải có 2-3 bài tập cụ thể (viết đề bài đầy đủ) bám YCCĐ.
- Hoạt động Vận dụng: tình huống/bài toán thực tiễn cụ thể, kèm hướng giải quyết dự kiến.
- TUYỆT ĐỐI KHÔNG sinh riêng phần: phiếu bài tập, phiếu học tập, hướng dẫn chấm, bài tập về nhà, đề kiểm tra - nhưng câu hỏi và đáp án dự kiến NẰM TRONG bảng tổ chức hoạt động là BẮT BUỘC.
- Mỗi bước tổ chức phải cụ thể, viết được hành động của GV và HS (không ghi "GV tổ chức hoạt động").${input.note ? ` Yêu cầu thêm của giáo viên: ${input.note}` : ""}
Viết đầy đủ, thực tế, dùng được ngay - giáo viên phải đọc được câu hỏi cần hỏi và đáp án cần chốt mà không cần tra thêm tài liệu.`,
  }),

  "DC-05": (input, ctx) => ({
    system: SYS_BASE,
    prompt: `${base(ctx)}
Soạn PHIẾU HỌC TẬP cho bài "${input.lesson || "theo YCCĐ trên"}" gồm 3 phần: Khởi động, Khám phá - Luyện tập, Vận dụng.
Mỗi phần 2-3 câu hỏi/nhiệm vụ cụ thể (không chung chung), có câu phân hoá cho học sinh yếu và giỏi.
Appendix: đáp án/hướng dẫn chấm chi tiết từng câu (phần dành cho giáo viên).`,
  }),

  "DC-06": (input, ctx) => ({
    system: SYS_BASE,
    prompt: `${base(ctx)}
Thiết kế BÀI TRÌNH CHIẾU (slide) cho bài "${input.lesson || "theo YCCĐ trên"}", ${input.slides || 8} slide.${
      ctx.extra?.khbdText
        ? `
BÀI TRÌNH CHIẾU PHẢI BÁM SÁT giáo án (KHBD) đã soạn sau đây - giữ đúng tiến trình hoạt động và dùng lại NGUYÊN VĂN câu hỏi/bài tập của giáo án (không chế lại, không đổi số liệu):
"""
${String(ctx.extra.khbdText)}
"""`
        : ""
    }
Mỗi section = 1 slide: tiêu đề slide ngắn gọn + nội dung trình chiếu.
Cấu trúc bám tiến trình KHBD: mở đầu (slide bìa + mục tiêu), khởi động, khám phá (có thể 2-3 slide), luyện tập, vận dụng, tổng kết.
YÊU CẦU NỘI DUNG:
- Slide dẫn vào mỗi hoạt động phải có CÂU HỎI/NHIỆM VỤ cụ thể chiếu cho học sinh (viết nguyên văn câu hỏi/bài tập dạng list - KHÔNG ghi "GV nêu câu hỏi").
- Slide luyện tập: viết đề bài đầy đủ để chiếu; ĐÁP ÁN/dự kiến trả lời đặt trong block "note", không đưa lên nội dung slide.
- Mỗi slide (trừ slide bìa) kết thúc bằng đúng 1 block "note" = ghi chú thuyết trình cho GV, bắt đầu bằng "Ghi chú GV: " - gồm lời thoại gợi ý, đáp án/dự kiến câu trả lời của HS, lưu ý tổ chức (thời gian, chia nhóm).
- Bullet ngắn gọn, tối đa 15 từ/dòng, KHÔNG viết đoạn văn dài. Có gợi ý hình ảnh/minh họa dạng [Gợi ý hình: ...] ở bullet riêng khi cần.
Nội dung bám YCCĐ đã chọn, phù hợp lứa tuổi học sinh lớp ${ctx.grade ?? ""}.`,
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
