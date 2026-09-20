import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";

interface IncidentDraft {
  description: string;
  suggestion: string;
}

/**
 * AI soạn mô tả sự cố + đề xuất xử lý ban đầu từ thông tin thô.
 * Dùng cho /safety/report (IncidentForm).
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !["gvcn", "gvbm", "to_truong", "bgh", "pht"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let type = "";
  let severity = "";
  let notes = "";
  let studentName = "";
  try {
    const body = (await req.json()) as {
      type?: string;
      severity?: string;
      notes?: string;
      studentName?: string;
    };
    type = (body.type ?? "").trim();
    severity = (body.severity ?? "").trim();
    notes = (body.notes ?? "").trim();
    studentName = (body.studentName ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!notes) {
    return NextResponse.json(
      { error: "Nhập vài ý về sự cố trước." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  return respondWithAi<IncidentDraft>({
    req,
    supabase,
    profile,
    kind: "incident-report",
    system:
      "Bạn là cán bộ quản lý học sinh trường phổ thông Việt Nam. Viết hồ sơ sự cố khách quan, đúng quy trình. Chỉ trả về JSON hợp lệ.",
    prompt: `Viết hồ sơ sự cố học sinh từ thông tin thô:
- Loại sự cố: ${type || "Chưa rõ"}
- Mức độ: ${severity || "Chưa rõ"}
${studentName ? `- Học sinh: ${studentName}` : ""}
- Ghi chú thô của giáo viên: ${notes}

Yêu cầu:
- "description": đoạn mô tả khách quan, đủ các yếu tố (thời gian, địa điểm, diễn biến, người liên quan, xử lý ban đầu nếu có) - viết lại từ ghi chú thô, KHÔNG bịa chi tiết không có trong ghi chú.
- "suggestion": 2-3 việc cần làm tiếp theo (báo BGH, liên hệ phụ huynh, theo dõi sức khỏe...), mỗi việc 1 câu ngắn.

Trả về CHỈ JSON {"description": "...", "suggestion": "..."}, không markdown.`,
    expectedShape: '{"description": "Mô tả sự cố", "suggestion": "Việc cần làm"}',
    maxTokens: 1200,
    parse: (text) => {
      const o = parseJsonObject(text);
      if (
        !o ||
        typeof o.description !== "string" ||
        typeof o.suggestion !== "string"
      ) {
        return null;
      }
      return {
        description: o.description.trim(),
        suggestion: o.suggestion.trim(),
      };
    },
  });
}
