import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/**
 * AI phát hiện pattern vắng/muộn bất thường - dùng cho /attendance/tracking.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh", "pht"].includes(profile.role)) {
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

  const { data: studentData } = await supabase
    .from("students")
    .select("id,full_name")
    .eq("class_id", classId)
    .eq("status", "active");
  const students = (studentData ?? []) as { id: string; full_name: string }[];
  const nameOf = new Map(students.map((s) => [s.id, s.full_name]));
  const ids = students.map((s) => s.id);
  if (!ids.length) {
    return NextResponse.json({ result: { lines: ["Lớp chưa có học sinh."] } });
  }

  const { data: attData } = await supabase
    .from("attendance_records")
    .select("student_id,date,status")
    .in("student_id", ids)
    .in("status", ["unexcused", "excused", "late"])
    .limit(20000);
  const rows = (attData ?? []) as {
    student_id: string;
    date: string;
    status: string;
  }[];

  // Pattern theo HS: ngày trong tuần hay vắng, chuỗi liên tiếp
  const perStudent = new Map<string, { dow: number[]; statuses: Record<string, number> }>();
  for (const r of rows) {
    const cur = perStudent.get(r.student_id) ?? { dow: [], statuses: {} };
    cur.dow.push(new Date(`${r.date}T00:00:00`).getDay());
    cur.statuses[r.status] = (cur.statuses[r.status] ?? 0) + 1;
    perStudent.set(r.student_id, cur);
  }
  const facts = [...perStudent.entries()]
    .map(([sid, v]) => {
      const dowCount = new Map<number, number>();
      for (const d of v.dow) dowCount.set(d, (dowCount.get(d) ?? 0) + 1);
      const topDow = [...dowCount.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        ten: nameOf.get(sid) ?? "-",
        vang_kp: v.statuses.unexcused ?? 0,
        vang_cp: v.statuses.excused ?? 0,
        muon: v.statuses.late ?? 0,
        ngay_hay_vang:
          topDow && topDow[1] >= 2 ? `${WEEKDAY[topDow[0]]} (${topDow[1]} lượt)` : null,
      };
    })
    .filter((s) => s.vang_kp + s.vang_cp + s.muon >= 2)
    .sort((a, b) => b.vang_kp - a.vang_kp)
    .slice(0, 20);

  if (!facts.length) {
    return NextResponse.json({
      result: { lines: ["Không có học sinh nào có pattern vắng/muộn đáng chú ý."] },
    });
  }

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "attendance-insight",
    system:
      "Bạn là trợ lý phân tích chuyên cần cho GVCN trường THCS. Chỉ ra pattern cụ thể theo số liệu, không suy đoán nguyên nhân y khoa. Không emoji.",
    prompt: `Phân tích dữ liệu vắng/muộn của học sinh lớp ${(cls as { name?: string }).name} (JSON): ${JSON.stringify(facts)}.

Viết 3-5 nhận xét: ai vắng nhiều nhất, ai có pattern theo ngày trong tuần (VD hay vắng thứ 2), nhóm cần liên hệ phụ huynh ngay, 1-2 đề xuất. Mỗi nhận xét 1 dòng, nêu tên học sinh, không đánh số.`,
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
