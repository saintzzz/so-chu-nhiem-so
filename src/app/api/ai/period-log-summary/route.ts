import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";

/**
 * AI tóm tắt sổ đầu bài - dùng cho /schedule/period-log.
 * Gộp các tiết đã ghi của lớp gần nhất thành nhận xét.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !["gvcn", "gvbm", "to_truong", "bgh", "pht"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let classId = "";
  try {
    const body = (await req.json()) as { classId?: string };
    classId = body.classId ?? "";
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!classId) {
    return NextResponse.json({ error: "Thiếu lớp." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id,name,school_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || cls.school_id !== profile.school_id) {
    return NextResponse.json(
      { error: "Lớp không thuộc trường của bạn." },
      { status: 403 },
    );
  }

  // period_logs liên kết lớp qua timetable_entries
  const { data: entryData } = await supabase
    .from("timetable_entries")
    .select("id,period,subject_id")
    .eq("class_id", classId);
  const entries = (entryData ?? []) as {
    id: string;
    period: number;
    subject_id: string;
  }[];
  const entryById = new Map(entries.map((e) => [e.id, e]));
  if (!entries.length) {
    return NextResponse.json({
      result: { lines: ["Lớp chưa có thời khóa biểu."] },
    });
  }

  const { data: logData } = await supabase
    .from("period_logs")
    .select(
      "id,date,timetable_entry_id,present_count,note,lesson_title,lesson_content,teacher_comment",
    )
    .in("timetable_entry_id", entries.map((e) => e.id))
    .order("date", { ascending: false })
    .limit(60);
  const logs = (logData ?? []) as {
    id: string;
    date: string;
    timetable_entry_id: string;
    present_count: number | null;
    note: string | null;
    lesson_title: string | null;
    lesson_content: string | null;
    teacher_comment: string | null;
  }[];
  if (!logs.length) {
    return NextResponse.json({
      result: { lines: ["Chưa có tiết nào được ghi trong sổ đầu bài."] },
    });
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id,name")
    .eq("school_id", profile.school_id ?? "");
  const subjName = new Map(
    ((subjects ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name,
    ]),
  );

  const facts = {
    lop: (cls as { name?: string }).name,
    tiet_da_ghi: logs.map((l) => {
      const e = entryById.get(l.timetable_entry_id);
      return {
        ngay: l.date,
        tiet: e?.period ?? null,
        mon: e?.subject_id ? (subjName.get(e.subject_id) ?? "-") : null,
        si_so_co_mat: l.present_count,
        bai_hoc: [l.lesson_title, l.lesson_content]
          .filter(Boolean)
          .join(" - ")
          .slice(0, 150),
        ghi_chu: (l.teacher_comment ?? l.note ?? "").slice(0, 150),
      };
    }),
  };

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "period-log-summary",
    system:
      "Bạn là trợ lý tổng hợp sổ đầu bài cho GVCN/BGH trường THCS. Tóm tắt ngắn gọn theo số liệu. Không emoji.",
    prompt: `Tóm tắt sổ đầu bài gần nhất của lớp (JSON): ${JSON.stringify(facts)}.

Viết 3-5 nhận xét: số tiết đã ghi và môn nào nhiều/ít, tiết có ghi chú đáng chú ý (vi phạm, chưa hoàn thành), sĩ số có mặt trung bình, môn nào chưa được ghi. Mỗi nhận xét 1 dòng, không đánh số.`,
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
