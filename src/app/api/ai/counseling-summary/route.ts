import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { hasAnyRole } from "@/lib/roles";

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
  if (!profile || !hasAnyRole(profile, ["gvcn", "bgh"])) {
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
  // CR-049 r6 H5 + r7 H4: free-text co the chua ten HS gan voi thong tin
  // nhay cam -> pseudonymize theo danh sach HS truong. Lookup phai
  // fail-closed + paginate day du - roster bi cat/loi de lo ten that.
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
  return respondWithAi<CounselingDraft>({
    req,
    supabase,
    profile,
    kind: "counseling-summary",
    pii: { names: piiNames },
    system:
      "Bạn là cán bộ tư vấn tâm lý học đường. Phân tích thận trọng, không chẩn đoán y khoa, luôn khuyên tham khảo chuyên gia khi cần. Chỉ trả về JSON hợp lệ.",
    prompt: `Phân tích dấu hiệu học sinh cần tư vấn/hỗ trợ (trường phổ thông Việt Nam):
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
