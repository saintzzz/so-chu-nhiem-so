import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";
import { todayVN } from "@/lib/utils";

/**
 * AI gộp báo cáo ngày của tất cả lớp thành 1 bản tin cho BGH/PHT.
 * Dùng cho /school/daily-reports.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["bgh", "pht"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let date = todayVN();
  try {
    const body = (await req.json()) as { date?: string };
    if (body.date) date = body.date;
  } catch {
    /* dùng ngày mặc định */
  }

  const supabase = await createClient();
  const { data: classData } = await supabase
    .from("classes")
    .select("id,name,campus_id")
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "active");
  let classes = (classData ?? []) as {
    id: string;
    name: string;
    campus_id: string | null;
  }[];
  if (profile.role === "pht" && profile.campus_id) {
    classes = classes.filter((c) => c.campus_id === profile.campus_id);
  }
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const { data: repData } = classes.length
    ? await supabase
        .from("daily_reports")
        .select("class_id,content,absent_count,late_count,violation_count,commendation_count,status")
        .in("class_id", classes.map((c) => c.id))
        .eq("date", date)
    : { data: [] };
  const reports = ((repData ?? []) as {
    class_id: string;
    content: string | null;
    absent_count: number;
    late_count: number;
    violation_count: number;
    commendation_count: number;
    status: string;
  }[]).filter((r) => r.status === "submitted");

  if (!reports.length) {
    return NextResponse.json({
      result: { lines: [`Chưa có lớp nào nộp báo cáo ngày ${date}.`] },
    });
  }

  const facts = {
    ngay: date,
    so_lop_da_nop: reports.length,
    so_lop_chua_nop: classes.length - reports.length,
    bao_cao: reports.map((r) => ({
      lop: className.get(r.class_id) ?? "-",
      vang: r.absent_count,
      muon: r.late_count,
      vi_pham: r.violation_count,
      khen_thuong: r.commendation_count,
      noi_dung: (r.content ?? "").slice(0, 400),
    })),
  };

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "daily-digest",
    system:
      "Bạn là trợ lý tổng hợp báo cáo ngày cho Ban Giám Hiệu trường THCS. Gộp các báo cáo lớp thành bản tin ngắn cho lãnh đạo đọc nhanh. Không emoji.",
    prompt: `Gộp báo cáo ngày của các lớp thành bản tin cho BGH (JSON): ${JSON.stringify(facts)}.

Viết 4-6 dòng: tổng quan tình hình chung (số lớp nộp, tổng vắng/vi phạm), lớp có việc đáng chú ý (nêu tên lớp), lớp được khen, việc cần BGH can thiệp/hỗ trợ nếu có. Mỗi ý 1 dòng, không đánh số.`,
    expectedShape: '{"lines": ["dòng 1", "dòng 2"]}',
    maxTokens: 1200,
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
