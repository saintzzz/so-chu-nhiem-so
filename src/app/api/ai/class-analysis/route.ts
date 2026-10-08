import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";
import { semesterAverage } from "@/lib/tt22";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { hasAnyRole } from "@/lib/roles";

/**
 * AI nhận xét kết quả học tập của lớp - dùng cho /academics/analysis.
 * Route tự lấy số liệu từ DB theo classId + term.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !hasAnyRole(profile, ["gvcn", "bgh", "pht"])) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let classId = "";
  let term = "hk1";
  try {
    const body = (await req.json()) as { classId?: string; term?: string };
    classId = body.classId ?? "";
    term = body.term === "hk2" ? "hk2" : "hk1";
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!classId) {
    return NextResponse.json({ error: "Thiếu lớp." }, { status: 400 });
  }

  const supabase = await createClient();
  // R7 re-review: moi query nguon deu phai check error - lookup loi la 500,
  // khong duoc nuot thanh du lieu rong roi tra ket qua AI tu du lieu thieu.
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id,name,school_id")
    .eq("id", classId)
    .maybeSingle();
  if (clsErr) {
    console.error("[ai/class-analysis] classes:", clsErr.message);
    return NextResponse.json(
      { error: "Không tải đủ dữ liệu nguồn." },
      { status: 500 },
    );
  }
  if (!cls || cls.school_id !== profile.school_id) {
    return NextResponse.json(
      { error: "Lớp không thuộc trường của bạn." },
      { status: 403 },
    );
  }

  const { data: studentData, error: stuErr } = await supabase
    .from("students")
    .select("id,code,full_name")
    .eq("class_id", classId)
    .eq("status", "active");
  if (stuErr) {
    console.error("[ai/class-analysis] students:", stuErr.message);
    return NextResponse.json(
      { error: "Không tải đủ dữ liệu nguồn." },
      { status: 500 },
    );
  }
  const students = (studentData ?? []) as { id: string; code: string; full_name: string }[];
  const ids = students.map((s) => s.id);
  if (!ids.length) {
    return NextResponse.json({ result: { lines: ["Lớp chưa có học sinh."] } });
  }

  // R7-02: PostgREST cat ngam ~1000 rows - phan trang het qua fetchAllRows,
  // loi/truncated tra 500 thay vi phan tich tren du lieu thieu.
  const [gradeRes, { data: subjectData, error: subErr }] = await Promise.all([
    fetchAllRows<{
      student_id: string;
      subject_id: string;
      assessment_type: string;
      score: number | null;
    }>((f, t) =>
      supabase
        .from("grades")
        .select("student_id,subject_id,assessment_type,score")
        .in("student_id", ids)
        .eq("term", term)
        .order("id")
        .range(f, t),
    ),
    supabase
      .from("subjects")
      .select("id,name")
      .eq("school_id", profile.school_id ?? ""),
  ]);
  if (gradeRes.error || gradeRes.truncated || subErr) {
    console.error(
      "[ai/class-analysis] sources:",
      gradeRes.error ?? (gradeRes.truncated ? "grades truncated" : subErr?.message),
    );
    return NextResponse.json(
      { error: "Không tải đủ dữ liệu nguồn." },
      { status: 500 },
    );
  }
  const grades = gradeRes.rows;
  const subjectName = new Map(
    ((subjectData ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  // ĐTBm từng môn của từng HS -> TB lớp theo môn + TB tổng theo HS
  const cell = new Map<string, typeof grades>();
  for (const g of grades) {
    const k = `${g.student_id}|${g.subject_id}`;
    const arr = cell.get(k) ?? [];
    arr.push(g);
    cell.set(k, arr);
  }
  const bySubject = new Map<string, number[]>();
  const byStudent = new Map<string, number[]>();
  for (const [k, rows] of cell) {
    const a = semesterAverage(rows);
    if (a == null) continue;
    const [sid, sub] = k.split("|");
    bySubject.set(sub, [...(bySubject.get(sub) ?? []), a]);
    byStudent.set(sid, [...(byStudent.get(sid) ?? []), a]);
  }
  const avg = (ns: number[]) =>
    ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null;
  const subjectStats = [...bySubject.entries()]
    .map(([sid, ns]) => ({ mon: subjectName.get(sid) ?? "-", tb: avg(ns), n: ns.length }))
    .filter((s) => s.tb !== null)
    .sort((a, b) => (b.tb ?? 0) - (a.tb ?? 0));
  const studentAvgs = students
    .map((s) => ({ ma_hs: s.code ?? "HS", tb: avg(byStudent.get(s.id) ?? []) }))
    .filter((s) => s.tb !== null)
    .sort((a, b) => (b.tb ?? 0) - (a.tb ?? 0));
  const weak = studentAvgs.filter((s) => (s.tb ?? 0) < 5);

  const facts = {
    lop: (cls as { name?: string }).name,
    hoc_ky: term === "hk1" ? "Học kỳ I" : "Học kỳ II",
    si_so: students.length,
    diem_tb_lop: avg(studentAvgs.map((s) => s.tb as number)),
    mon_theo_tb: subjectStats.slice(0, 12),
    hs_duoi_5: weak.map((s) => ({ ma_hs: s.ma_hs, tb: s.tb })).slice(0, 10),
    hs_dau_lop: studentAvgs.slice(0, 5).map((s) => ({ ma_hs: s.ma_hs, tb: s.tb })),
  };

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "class-analysis",
    system:
      "Bạn là trợ lý phân tích kết quả học tập cho GVCN/BGH trường THCS. Nhận xét thực tế, cụ thể theo số liệu. Không emoji.",
    prompt: `Phân tích kết quả học tập lớp từ số liệu (JSON): ${JSON.stringify(facts)}.

Viết 4-6 nhận xét ngắn: môn mạnh/môn yếu của lớp, mức độ phân hóa, nhóm HS cần phụ đạo (nêu mã học sinh), 1-2 đề xuất hành động cụ thể cho GVCN. Mỗi nhận xét 1 dòng, không đánh số.`,
    expectedShape: '{"lines": ["nhận xét 1", "nhận xét 2"]}',
    maxTokens: 1200,
    parse: (text) => {
      const deanon = (s: string) => {
        let out = s;
        for (const st of students)
          if (st.code) out = out.split(st.code).join(st.full_name);
        return out;
      };
      try {
        const o = JSON.parse(text) as { lines?: string[] };
        if (Array.isArray(o.lines) && o.lines.length) {
          return {
            lines: o.lines
              .filter((l) => typeof l === "string")
              .map(deanon),
          };
        }
      } catch {
        /* fallthrough */
      }
      const lines = parseLines(text);
      return lines ? { lines: lines.map(deanon) } : null;
    },
  });
}
