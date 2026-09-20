import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";

/**
 * AI báo cáo bằng chữ cho cấp quản lý (Sở/Phòng/UBND) - dùng cho /dept/dashboard.
 * Tổng hợp số liệu các trường trong phạm vi -> nhận xét.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !["so_gd", "phong_gd", "ubnd", "admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const supabase = await createClient();
  const [{ data: schools }, { data: classes }, { data: students }] =
    await Promise.all([
      supabase.from("schools").select("id,name"),
      supabase.from("classes").select("id,school_id").eq("status", "active"),
      supabase.from("students").select("id,class_id").eq("status", "active"),
    ]);
  const schoolList = (schools ?? []) as { id: string; name: string }[];
  const classList = (classes ?? []) as { id: string; school_id: string }[];
  const studentList = (students ?? []) as { id: string; class_id: string }[];
  const classSchool = new Map(classList.map((c) => [c.id, c.school_id]));

  // Tỷ lệ chuyên cần 30 ngày gần theo trường
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: att } = await supabase
    .from("attendance_records")
    .select("status, students!inner(class_id)")
    .gte("date", cutoff)
    .limit(50000);
  const attRows = (att ?? []) as unknown as {
    status: string;
    students: { class_id: string } | { class_id: string }[];
  }[];

  const perSchool = schoolList.map((s) => {
    const cls = classList.filter((c) => c.school_id === s.id);
    const clsIds = new Set(cls.map((c) => c.id));
    const stu = studentList.filter((st) => clsIds.has(st.class_id));
    const attMy = attRows.filter((a) => {
      const st = Array.isArray(a.students) ? a.students[0] : a.students;
      return st && classSchool.get(st.class_id) === s.id;
    });
    const absent = attMy.filter((a) => a.status !== "present").length;
    return {
      truong: s.name,
      so_lop: cls.length,
      so_hs: stu.length,
      chuyen_can_pct:
        attMy.length > 0
          ? Math.round(((attMy.length - absent) / attMy.length) * 100)
          : null,
    };
  });

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "dept-brief",
    system:
      "Bạn là trợ lý phân tích cho cán bộ quản lý giáo dục (Sở/Phòng GD&ĐT, UBND). Viết báo cáo ngắn gọn, khách quan, theo số liệu. Không emoji.",
    prompt: `Viết bản tin tổng hợp cho cán bộ quản lý giáo dục từ số liệu các trường (JSON): ${JSON.stringify(perSchool)}.

Viết 4-6 nhận xét: tổng quan quy mô, trường có chuyên cần tốt/kém nhất (nêu tên + %), trường cần hỗ trợ, 1-2 đề xuất hành động cho cấp quản lý. Mỗi nhận xét 1 dòng, không đánh số.`,
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
