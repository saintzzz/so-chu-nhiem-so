import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";
import { isoDateVN } from "@/lib/utils";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

/**
 * AI báo cáo bằng chữ cho cấp quản lý (Sở/Phòng/UBND) - dùng cho /dept/dashboard.
 * Tổng hợp số liệu các trường trong phạm vi -> nhận xét.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !["so_gd", "ubnd", "admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const supabase = await createClient();
  // R8-01: PostgREST cat ngam ~1000 rows - moi query nguon phan trang het qua
  // fetchAllRows (order on dinh) va bat error/truncated. AI khong duoc phan
  // tich tren du lieu thieu -> tra 500 truoc khi generate.
  const cutoff = isoDateVN(new Date(Date.now() - 30 * 86400000));
  const [schoolRes, classRes, studentRes, attRes] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((f, t) =>
      supabase.from("schools").select("id,name").order("id").range(f, t),
    ),
    fetchAllRows<{ id: string; school_id: string }>((f, t) =>
      supabase
        .from("classes")
        .select("id,school_id")
        .eq("status", "active")
        .order("id")
        .range(f, t),
    ),
    fetchAllRows<{ id: string; class_id: string }>((f, t) =>
      supabase
        .from("students")
        .select("id,class_id")
        .eq("status", "active")
        .order("id")
        .range(f, t),
    ),
    // Tỷ lệ chuyên cần 30 ngày gần theo trường
    fetchAllRows<{
      status: string;
      students: { class_id: string } | { class_id: string }[];
    }>((f, t) =>
      supabase
        .from("attendance_records")
        .select("status, students!inner(class_id)")
        .gte("date", cutoff)
        .order("date")
        .order("id")
        .range(f, t),
    ),
  ]);

  const srcErrors: string[] = [];
  for (const [name, r] of [
    ["schools", schoolRes],
    ["classes", classRes],
    ["students", studentRes],
    ["attendance_records", attRes],
  ] as const) {
    if (r.error || r.truncated) {
      srcErrors.push(`${name}: ${r.error ?? "truncated"}`);
    }
  }
  if (srcErrors.length) {
    console.error("[ai/dept-brief] source queries:", srcErrors.join("; "));
    return NextResponse.json(
      { error: "Không tải đủ dữ liệu nguồn." },
      { status: 500 },
    );
  }

  const schoolList = schoolRes.rows;
  const classList = classRes.rows;
  const studentList = studentRes.rows;
  const classSchool = new Map(classList.map((c) => [c.id, c.school_id]));
  const attRows = attRes.rows;

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
      "Bạn là trợ lý phân tích cho cán bộ quản lý giáo dục (Sở GD&ĐT, UBND cấp xã). Viết báo cáo ngắn gọn, khách quan, theo số liệu. Không emoji.",
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
    fallback: () => {
      const lines: string[] = [];
      const totalCls = perSchool.reduce((s, x) => s + x.so_lop, 0);
      const totalStu = perSchool.reduce((s, x) => s + x.so_hs, 0);
      lines.push(
        `Hệ thống có ${perSchool.length} trường, ${totalCls} lớp, ${totalStu} học sinh.`,
      );
      const withAtt = perSchool.filter((x) => x.chuyen_can_pct !== null);
      const sorted = [...withAtt].sort(
        (a, b) => (b.chuyen_can_pct ?? 0) - (a.chuyen_can_pct ?? 0),
      );
      if (sorted.length) {
        lines.push(
          `Chuyên cần cao nhất: ${sorted[0].truong} (${sorted[0].chuyen_can_pct}%).`,
        );
        const low = sorted[sorted.length - 1];
        if (sorted.length > 1)
          lines.push(
            `Chuyên cần thấp nhất: ${low.truong} (${low.chuyen_can_pct}%) - cần theo dõi.`,
          );
      }
      const noData = perSchool.filter((x) => x.chuyen_can_pct === null);
      if (noData.length) {
        lines.push(
          `${noData.length} trường chưa có dữ liệu điểm danh 30 ngày: ${noData.map((x) => x.truong).join(", ")}.`,
        );
      }
      lines.push(
        "Đề xuất: rà soát trường chuyên cần thấp và trường chưa báo cáo dữ liệu.",
      );
      return { lines };
    },
  });
}
