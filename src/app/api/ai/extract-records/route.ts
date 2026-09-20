import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";

interface ExtractedRow {
  name: string;
  dob?: string;
  gender?: string;
  parent_name?: string;
  phone?: string;
}

/**
 * AI trích xuất danh sách học sinh từ văn bản dán vào (copy từ Excel/giấy tờ).
 * Dùng cho /records/upload - GV dán text, AI trả về bảng cấu trúc để review.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!text || text.length < 10) {
    return NextResponse.json(
      { error: "Dán nội dung danh sách học sinh trước." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  return respondWithAi<{ rows: ExtractedRow[] }>({
    req,
    supabase,
    profile,
    kind: "extract-records",
    system:
      "Bạn là bộ trích xuất dữ liệu danh sách học sinh. Chỉ trả về JSON hợp lệ, không suy diễn dữ liệu không có trong văn bản.",
    prompt: `Trích xuất danh sách học sinh từ văn bản sau (có thể copy từ Excel/giấy tờ, định dạng tự do):
---
${text.slice(0, 12000)}
---

Trả về CHỈ JSON {"rows": [{"name":"Họ tên","dob":"dd/mm/yyyy hoặc null","gender":"Nam|Nữ hoặc null","parent_name":"...hoặc null","phone":"...hoặc null"}]}.
Không markdown. Bỏ qua dòng tiêu đề/ghi chú không phải học sinh.`,
    expectedShape:
      '{"rows":[{"name":"Nguyễn Văn A","dob":"01/01/2012","gender":"Nam","parent_name":"...","phone":"..."}]}',
    maxTokens: 4000,
    parse: (t) => {
      const o = parseJsonObject(t);
      const rows = o?.rows;
      if (!Array.isArray(rows)) return null;
      const cleaned = rows
        .filter(
          (r): r is ExtractedRow =>
            typeof r === "object" && r !== null && typeof (r as ExtractedRow).name === "string",
        )
        .slice(0, 100);
      return cleaned.length ? { rows: cleaned } : null;
    },
  });
}
