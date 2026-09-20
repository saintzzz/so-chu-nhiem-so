import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";

interface GenQuestion {
  question: string;
  options?: string[];
  answer: string;
}

/**
 * AI sinh câu hỏi theo môn + chủ đề + mức độ - dùng cho /academics/exams.
 * Kết quả trả về để GV xem/copy, không tự ghi vào ngân hàng.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !["gvcn", "gvbm", "to_truong", "bgh"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let subject = "";
  let topic = "";
  let count = 5;
  let level = "trung bình";
  let kind = "trac_nghiem";
  try {
    const body = (await req.json()) as {
      subject?: string;
      topic?: string;
      count?: number;
      level?: string;
      kind?: string;
    };
    subject = (body.subject ?? "").trim();
    topic = (body.topic ?? "").trim();
    count = Math.min(Math.max(Number(body.count) || 5, 1), 15);
    level = (body.level ?? level).trim();
    kind = body.kind === "tu_luan" ? "tu_luan" : "trac_nghiem";
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!subject || !topic) {
    return NextResponse.json(
      { error: "Cần chọn môn và nhập chủ đề." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  return respondWithAi<{ questions: GenQuestion[] }>({
    req,
    supabase,
    profile,
    kind: "gen-questions",
    system:
      "Bạn là giáo viên trường phổ thông Việt Nam ra đề theo chương trình GDPT 2018. Câu hỏi rõ ràng, có đáp án đúng. Chỉ trả về JSON hợp lệ.",
    prompt: `Sinh ${count} câu hỏi ${kind === "trac_nghiem" ? "trắc nghiệm 4 phương án (A-D)" : "tự luận"} môn ${subject}, chủ đề "${topic}", mức độ ${level}.

Trả về CHỈ JSON {"questions": [{"question": "...", ${kind === "trac_nghiem" ? '"options": ["A. ...","B. ...","C. ...","D. ..."], ' : ""}"answer": "..."}]}, không markdown.`,
    expectedShape:
      '{"questions":[{"question":"...","options":["A.","B.","C.","D."],"answer":"A"}]}',
    maxTokens: 4000,
    parse: (text) => {
      const o = parseJsonObject(text);
      const qs = o?.questions;
      if (!Array.isArray(qs) || !qs.length) return null;
      const cleaned = qs
        .filter(
          (q): q is GenQuestion =>
            typeof q === "object" &&
            q !== null &&
            typeof (q as GenQuestion).question === "string" &&
            typeof (q as GenQuestion).answer === "string",
        )
        .slice(0, count);
      return cleaned.length ? { questions: cleaned } : null;
    },
  });
}
