import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";

interface MeetingDraft {
  content: string;
}

/**
 * AI soạn nội dung/biên bản buổi sinh hoạt chuyên môn từ tiêu đề + ý chính.
 * Dùng cho /team/meetings.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["to_truong", "bgh"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let title = "";
  let notes = "";
  try {
    const body = (await req.json()) as { title?: string; notes?: string };
    title = (body.title ?? "").trim();
    notes = (body.notes ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!title && !notes) {
    return NextResponse.json(
      { error: "Nhập tiêu đề hoặc vài ý chính trước." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  return respondWithAi<MeetingDraft>({
    req,
    supabase,
    profile,
    kind: "meeting-notes",
    system:
      "Bạn là tổ trưởng chuyên môn trường phổ thông Việt Nam soạn biên bản sinh hoạt tổ. Chỉ trả về JSON hợp lệ.",
    prompt: `Soạn nội dung/biên bản buổi sinh hoạt chuyên môn:
- Tiêu đề: ${title || "Sinh hoạt chuyên môn"}
- Ý chính ghi nhanh: ${notes || "(chưa có - tự đề xuất nội dung phù hợp tiêu đề)"}

Yêu cầu: biên bản có cấu trúc (nội dung trao đổi, ý kiến/thảo luận, kết luận, phân công công việc). Nếu chỉ có tiêu đề thì tạo khung chương trình hợp lý để tổ trưởng điền sau. Văn phong nhà trường, không emoji.

Trả về CHỈ JSON {"content": "..."}, không markdown.`,
    expectedShape: '{"content": "Nội dung biên bản nhiều dòng"}',
    maxTokens: 2000,
    parse: (text) => {
      const o = parseJsonObject(text);
      if (!o || typeof o.content !== "string" || !o.content.trim()) return null;
      return { content: o.content.trim() };
    },
  });
}
