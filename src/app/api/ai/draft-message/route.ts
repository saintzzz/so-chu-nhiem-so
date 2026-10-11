import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";
import { schoolPiiNames } from "@/lib/ai-pii-roster";
import { hasAnyRole } from "@/lib/roles";

interface DraftResult {
  title: string;
  content: string;
}

/**
 * AI soạn thông báo gửi phụ huynh từ gạch đầu dòng / ý chính.
 * Dùng cho /parents/compose và /activities/announce.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !hasAnyRole(profile, ["gvcn", "bgh", "pht", "to_truong"])) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let bullets = "";
  let audience = "phụ huynh cả lớp";
  let context = "";
  try {
    const body = (await req.json()) as {
      bullets?: string;
      audience?: string;
      context?: string;
    };
    bullets = (body.bullets ?? "").trim();
    audience = (body.audience ?? audience).trim();
    context = (body.context ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!bullets) {
    return NextResponse.json({ error: "Nhập vài ý chính trước." }, { status: 400 });
  }

  const supabase = await createClient();
  // CR-049 r9 H8: bullets/context la free-text co the chua ten HS.
  const roster = await schoolPiiNames(profile.school_id ?? "");
  if (roster.error) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  return respondWithAi<DraftResult>({
    req,
    supabase,
    profile,
    kind: "draft-message",
    pii: { names: roster.names },
    system:
      "Bạn là giáo viên trường phổ thông Việt Nam soạn thông báo gửi phụ huynh. Chỉ trả về JSON hợp lệ.",
    prompt: `Soạn thông báo gửi ${audience} từ các ý chính sau (mỗi dòng một ý):
${bullets}
${context ? `Bối cảnh thêm: ${context}` : ""}

Yêu cầu: tiêu đề ngắn gọn rõ nội dung; nội dung lịch sự, đủ ý (thời gian/địa điểm/việc cần làm nếu có), văn phong nhà trường Việt Nam, không emoji.

Trả về CHỈ JSON {"title": "...", "content": "..."}, không markdown.`,
    expectedShape: '{"title": "Tiêu đề", "content": "Nội dung thông báo"}',
    maxTokens: 1200,
    parse: (text) => {
      const o = parseJsonObject(text);
      if (!o || typeof o.title !== "string" || typeof o.content !== "string") {
        return null;
      }
      return { title: o.title.trim(), content: o.content.trim() };
    },
  });
}
