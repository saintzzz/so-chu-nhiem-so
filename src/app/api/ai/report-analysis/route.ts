import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";

/**
 * AI phân tích báo cáo tổng hợp nhiều lớp - dùng cho /records/report.
 * Client gửi stats đã tính sẵn; route chỉ gọi LLM khi user bấm "Phân tích".
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let stats: {
    name: string;
    size: number;
    attendancePct: number | null;
    avgScore: number | null;
    violations: number;
  }[] = [];
  try {
    const body = (await req.json()) as { stats?: typeof stats };
    stats = Array.isArray(body.stats) ? body.stats : [];
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (stats.length === 0) {
    return NextResponse.json({ result: { lines: ["Chưa đủ dữ liệu để phân tích."] } });
  }

  const supabase = await createClient();
  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "class-analysis",
    system:
      "Bạn là trợ lý phân tích dữ liệu giáo dục cho trường phổ thông Việt Nam. Trả lời ngắn gọn, thực tế, không emoji.",
    prompt: `Dữ liệu tổng hợp các lớp (JSON): ${JSON.stringify(
      stats.map((s) => ({
        lop: s.name,
        si_so: s.size,
        chuyen_can_pct: s.attendancePct,
        diem_tb: s.avgScore,
        vi_pham: s.violations,
      })),
    )}. Hãy viết 3-5 nhận xét phân tích ngắn gọn bằng tiếng Việt cho giáo viên chủ nhiệm/ban giám hiệu: lớp nổi bật, lớp cần chú ý, xu hướng và 1-2 đề xuất hành động cụ thể. Mỗi nhận xét một dòng, không đánh số, không ký tự đầu dòng, không markdown.`,
    expectedShape: '{"lines": ["nhận xét 1", "nhận xét 2"]}',
    maxTokens: 1024,
    parse: (text) => {
      try {
        const o = JSON.parse(text) as { lines?: string[] };
        if (Array.isArray(o.lines) && o.lines.length) {
          return { lines: o.lines.filter((l) => typeof l === "string") };
        }
      } catch {
        /* fallthrough */
      }
      const lines = parseLines(text);
      return lines ? { lines } : null;
    },
  });
}
