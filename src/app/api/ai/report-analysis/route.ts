import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";
import { hasAnyRole } from "@/lib/roles";
import { minimizeDeep } from "@/lib/ai-privacy";
import { schoolPiiNames } from "@/lib/ai-pii-roster";

/**
 * AI phân tích báo cáo tổng hợp nhiều lớp - dùng cho /records/report.
 * Client gửi stats đã tính sẵn; route chỉ gọi LLM khi user bấm "Phân tích".
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !hasAnyRole(profile, ["gvcn", "bgh"])) {
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
    const body = (await req.json()) as { stats?: unknown };
    if (!Array.isArray(body.stats)) {
      return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
    }
    // R16: validate runtime shape - tranh 500 khi field sai kieu va gioi
    // han kich thuoc prompt (phi token).
    stats = body.stats
      .filter(
        (s): s is Record<string, unknown> =>
          typeof s === "object" && s !== null && typeof s.name === "string",
      )
      .slice(0, 100)
      .map((s) => ({
        name: String(s.name).slice(0, 100),
        size: Math.min(Math.max(Number(s.size) || 0, 0), 5000),
        attendancePct:
          s.attendancePct === null || s.attendancePct === undefined
            ? null
            : Math.min(Math.max(Number(s.attendancePct) || 0, 0), 100),
        avgScore:
          s.avgScore === null || s.avgScore === undefined
            ? null
            : Math.min(Math.max(Number(s.avgScore) || 0, 0), 10),
        violations: Math.min(Math.max(Number(s.violations) || 0, 0), 100000),
      }));
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (stats.length === 0) {
    return NextResponse.json({ result: { lines: ["Chưa đủ dữ liệu để phân tích."] } });
  }

  const supabase = await createClient();
  // CR-049 r13 M: stats[].name la chuoi tuy y do caller gui - co the chua
  // ten HS/GV/PH va PII co newline. Minimize theo roster TRUOC khi
  // JSON.stringify (serialize truoc se escape va bo sot redact); source la
  // stats tho de deanon pham vi caller.
  const roster = await schoolPiiNames(profile.school_id ?? "");
  if (roster.error) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const minStats = minimizeDeep(stats, roster.names);
  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "class-analysis",
    system:
      "Bạn là trợ lý phân tích dữ liệu giáo dục cho trường phổ thông Việt Nam. Trả lời ngắn gọn, thực tế, không emoji.",
    prompt: `Dữ liệu tổng hợp các lớp (JSON): ${JSON.stringify(
      minStats.map((s) => ({
        lop: s.name,
        si_so: s.size,
        chuyen_can_pct: s.attendancePct,
        diem_tb: s.avgScore,
        vi_pham: s.violations,
      })),
    )}. Hãy viết 3-5 nhận xét phân tích ngắn gọn bằng tiếng Việt cho giáo viên chủ nhiệm/ban giám hiệu: lớp nổi bật, lớp cần chú ý, xu hướng và 1-2 đề xuất hành động cụ thể. Mỗi nhận xét một dòng, không đánh số, không ký tự đầu dòng, không markdown.`,
    expectedShape: '{"lines": ["nhận xét 1", "nhận xét 2"]}',
    maxTokens: 1024,
    pii: { names: roster.names, source: stats },
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
