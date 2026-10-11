import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";
import { hasAnyRole } from "@/lib/roles";
import { writeAudit } from "@/lib/audit";

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
  if (!profile || !hasAnyRole(profile, ["gvcn", "bgh", "admin"])) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let text = "";
  let confirmed = false;
  try {
    const body = (await req.json()) as {
      text?: string;
      confirm_raw_pii?: boolean;
    };
    text = (body.text ?? "").trim();
    confirmed = body.confirm_raw_pii === true;
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
  // CR-049 r11: route gui PII THO (ten/NS/SDT PH) toi provider ben ngoai
  // (allowRawPrompt) - bat buoc xac nhan tuong minh + bang chung audit
  // DURABLE truoc khi goi provider/Devin. Audit fail -> fail-closed.
  if (!confirmed) {
    return NextResponse.json(
      {
        error:
          "Nội dung chứa dữ liệu cá nhân học sinh sẽ được xử lý bởi AI bên ngoài - cần xác nhận.",
        needs_raw_pii_confirm: true,
      },
      { status: 400 },
    );
  }
  const { error: auditErr } = await writeAudit(supabase, {
    action: "ai.extract_records_raw_pii",
    entity: "ai_job",
    payload: { chars: text.length },
  });
  if (auditErr) {
    return NextResponse.json(
      { error: "Không ghi được xác nhận, thử lại sau." },
      { status: 500 },
    );
  }
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
    // CR-049 P3b: PII (ten/NS/SDT PH) la muc tieu trich xuat cua chinh
    // route nay - redact se pha ket qua. Input da gioi han 12k ky tu.
    pii: { allowRawPrompt: true },
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
