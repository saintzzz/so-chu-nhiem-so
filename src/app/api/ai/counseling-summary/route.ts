import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";

interface CounselingDraft {
  summary: string;
  suggestion: string;
  suggestedSeverity: string;
}

/**
 * AI tóm tắt ca tư vấn + gợi ý mức độ và hướng xử lý.
 * Dùng cho /counseling/intake - chỉ gợi ý, GVCN quyết định cuối.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let issue = "";
  try {
    const body = (await req.json()) as { issue?: string };
    issue = (body.issue ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!issue) {
    return NextResponse.json(
      { error: "Nhập mô tả dấu hiệu/vấn đề trước." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  return respondWithAi<CounselingDraft>({
    req,
    supabase,
    profile,
    kind: "counseling-summary",
    system:
      "Bạn là cán bộ tư vấn tâm lý học đường. Phân tích thận trọng, không chẩn đoán y khoa, luôn khuyên tham khảo chuyên gia khi cần. Chỉ trả về JSON hợp lệ.",
    prompt: `Phân tích dấu hiệu học sinh cần tư vấn/hỗ trợ (trường THCS Việt Nam):
"${issue}"

Trả về:
- "summary": tóm tắt vấn đề 1 câu, ngôn ngữ chuyên môn nhẹ nhàng
- "suggestedSeverity": một trong "low" | "medium" | "high" | "critical"
- "suggestion": 2-3 hướng xử lý ban đầu cho GVCN (quan sát thêm, trao đổi riêng, liên hệ PH, chuyển cán bộ tư vấn...), mỗi ý 1 câu

Chỉ trả về JSON {"summary":"...","suggestedSeverity":"...","suggestion":"..."}, không markdown.`,
    expectedShape:
      '{"summary":"Tóm tắt","suggestedSeverity":"low|medium|high|critical","suggestion":"Hướng xử lý"}',
    maxTokens: 1000,
    parse: (text) => {
      const o = parseJsonObject(text);
      if (!o || typeof o.summary !== "string") return null;
      const sev = typeof o.suggestedSeverity === "string" ? o.suggestedSeverity : "low";
      return {
        summary: o.summary.trim(),
        suggestedSeverity: ["low", "medium", "high", "critical"].includes(sev)
          ? sev
          : "low",
        suggestion:
          typeof o.suggestion === "string" ? o.suggestion.trim() : "",
      };
    },
  });
}
