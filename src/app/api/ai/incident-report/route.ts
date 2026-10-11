import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { hasAnyRole } from "@/lib/roles";

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
    !hasAnyRole(profile, ["gvcn", "gvbm", "to_truong", "bgh", "pht"])
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let type = "";
  let severity = "";
  let notes = "";
  try {
    const body = (await req.json()) as {
      type?: string;
      severity?: string;
      notes?: string;
    };
    type = (body.type ?? "").trim();
    severity = (body.severity ?? "").trim();
    notes = (body.notes ?? "").trim();
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
  // CR-049 r6 H5 + r7 H4: ghi chu tu do co the chua ten HS ->
  // pseudonymize theo danh sach HS truong. Lookup fail-closed +
  // paginate day du - roster bi cat/loi de lo ten that.
  const { data: clsRows, error: clsErr } = await supabase
    .from("classes")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("status", "active");
  if (clsErr) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const classIds = (clsRows ?? []).map((c) => c.id as string);
  const stuRes = classIds.length
    ? await fetchAllRows<{ full_name: string }>((f, t) =>
        supabase
          .from("students")
          .select("full_name")
          .in("class_id", classIds)
          .eq("status", "active")
          .order("id")
          .range(f, t),
      )
    : { rows: [] as { full_name: string }[], error: null, truncated: false };
  if (stuRes.error || stuRes.truncated) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const piiNames = stuRes.rows
    .map((s) => s.full_name)
    .filter(Boolean)
    .map((name, i) => ({
      name,
      alias: `HS${String(i + 1).padStart(3, "0")}`,
    }));
  return respondWithAi<IncidentDraft>({
    req,
    supabase,
    profile,
    kind: "incident-report",
    pii: { names: piiNames },
    system:
      "Bạn là cán bộ quản lý học sinh trường phổ thông Việt Nam. Viết hồ sơ sự cố khách quan, đúng quy trình. Chỉ trả về JSON hợp lệ.",
    prompt: `Viết hồ sơ sự cố học sinh từ thông tin thô:
- Loại sự cố: ${type || "Chưa rõ"}
- Mức độ: ${severity || "Chưa rõ"}
- Ghi chú thô của giáo viên: ${notes}

Yêu cầu:
- "description": đoạn mô tả khách quan, đủ các yếu tố (thời gian, địa điểm, diễn biến, người liên quan, xử lý ban đầu nếu có) - viết lại từ ghi chú thô, KHÔNG bịa chi tiết không có trong ghi chú. Gọi người liên quan là "học sinh"/"giáo viên", KHÔNG ghi tên riêng.
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
