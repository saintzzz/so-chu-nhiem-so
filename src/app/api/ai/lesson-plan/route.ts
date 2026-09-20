import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";

/**
 * AI hỗ trợ giáo án:
 *  - mode "outline": GV nhập môn + tên bài -> sinh dàn ý giáo án điền vào form
 *  - mode "review": tổ trưởng/BGH -> gợi ý nhận xét khi duyệt
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !["gvcn", "gvbm", "to_truong", "bgh", "pht"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let mode = "outline";
  let subject = "";
  let title = "";
  let content = "";
  try {
    const body = (await req.json()) as {
      mode?: string;
      subject?: string;
      title?: string;
      content?: string;
    };
    mode = body.mode === "review" ? "review" : "outline";
    subject = (body.subject ?? "").trim();
    title = (body.title ?? "").trim();
    content = (body.content ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json(
      { error: "Cần tên bài dạy trước." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (mode === "outline") {
    return respondWithAi<{ content: string }>({
      req,
      supabase,
      profile,
      kind: "lesson-plan-outline",
      system:
        "Bạn là giáo viên trường phổ thông Việt Nam soạn giáo án theo mô hình hoạt động trải nghiệm (khởi động - khám phá - luyện tập - vận dụng). Chỉ trả về JSON hợp lệ.",
      prompt: `Soạn dàn ý giáo án:
- Môn: ${subject || "chưa rõ"}
- Bài: ${title}

Yêu cầu: khung giáo án gồm Mục tiêu (kiến thức/năng lực/phẩm chất), Đồ dùng, Hoạt động 4 bước (Khởi động, Khám phá, Luyện tập, Vận dụng) - mỗi phần 2-4 gạch đầu dòng để GV điền chi tiết. Không bịa nội dung bài học cụ thể ngoài tên bài.

Trả về CHỈ JSON {"content": "..."} (content là văn bản nhiều dòng), không markdown.`,
      expectedShape: '{"content": "Dàn ý giáo án nhiều dòng"}',
      maxTokens: 2500,
      parse: (text) => {
        const o = parseJsonObject(text);
        if (!o || typeof o.content !== "string" || !o.content.trim()) {
          return null;
        }
        return { content: o.content.trim() };
      },
    });
  }

  // review mode
  if (!content) {
    return NextResponse.json(
      { error: "Giáo án chưa có nội dung để nhận xét." },
      { status: 400 },
    );
  }
  return respondWithAi<{ note: string }>({
    req,
    supabase,
    profile,
    kind: "lesson-plan-review",
    system:
      "Bạn là tổ trưởng chuyên môn nhận xét giáo án đồng nghiệp - góp ý xây dựng, nhắc phần còn thiếu. Chỉ trả về JSON hợp lệ.",
    prompt: `Nhận xét giáo án sau (môn ${subject || "chưa rõ"}, bài "${title}"):
---
${content.slice(0, 4000)}
---

Yêu cầu: 2-4 câu nhận xét - điểm tốt, phần còn thiếu (mục tiêu, hoạt động, đánh giá), gợi ý cải thiện. Nếu giáo án đủ tốt thì ghi nhận và đề xuất duyệt.

Trả về CHỈ JSON {"note": "..."}, không markdown.`,
    expectedShape: '{"note": "Nhận xét duyệt giáo án"}',
    maxTokens: 800,
    parse: (text) => {
      const o = parseJsonObject(text);
      if (!o || typeof o.note !== "string" || !o.note.trim()) return null;
      return { note: o.note.trim() };
    },
  });
}
