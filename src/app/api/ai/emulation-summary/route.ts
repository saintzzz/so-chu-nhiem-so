import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";

/**
 * AI tóm tắt tuần/kỳ thi đua giữa các lớp - dùng cho /emulation/ranking.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh", "pht"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let period = "";
  try {
    const body = (await req.json()) as { period?: string };
    period = (body.period ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const supabase = await createClient();
  const sid = profile.school_id ?? "";
  const [{ data: critRaw }, { data: classesRaw }, { data: scoresRaw }] =
    await Promise.all([
      supabase.from("emulation_criteria").select("id,name,max_score"),
      supabase
        .from("classes")
        .select("id,name")
        .eq("school_id", sid)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("emulation_scores")
        .select("class_id,criterion_id,score")
        .eq("period", period),
    ]);
  const criteria = (critRaw ?? []) as { id: string; name: string; max_score: number }[];
  const classes = (classesRaw ?? []) as { id: string; name: string }[];
  const scores = (scoresRaw ?? []) as {
    class_id: string;
    criterion_id: string;
    score: number;
  }[];
  if (!classes.length || !scores.length) {
    return NextResponse.json({
      result: { lines: ["Chưa có dữ liệu thi đua kỳ này."] },
    });
  }

  const critName = new Map(criteria.map((c) => [c.id, c.name]));
  const perClass = classes.map((c) => {
    const rows = scores.filter((s) => s.class_id === c.id);
    return {
      lop: c.name,
      tong: rows.reduce((a, s) => a + s.score, 0),
      theo_tieu_chi: rows.map((s) => ({
        tieu_chi: critName.get(s.criterion_id) ?? "-",
        diem: s.score,
      })),
    };
  });
  perClass.sort((a, b) => b.tong - a.tong);

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "emulation-summary",
    system:
      "Bạn là trợ lý tổng hợp thi đua cho ban giám hiệu trường THCS. Nhận xét ngắn, theo số liệu. Không emoji.",
    prompt: `Tóm tắt kết quả thi đua kỳ ${period} giữa các lớp (JSON): ${JSON.stringify(perClass)}.

Viết 3-5 nhận xét: lớp dẫn đầu và điểm mạnh, lớp tụt hạng/tiêu chí nào kéo xuống, tiêu chí toàn trường đang yếu, 1-2 đề xuất. Mỗi nhận xét 1 dòng, không đánh số.`,
    expectedShape: '{"lines": ["nhận xét 1", "nhận xét 2"]}',
    maxTokens: 1000,
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
