import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { generateText } from "@/lib/ai";

interface StudentInput {
  code: string;
  name: string;
  rating: string;
}

const RATING_LABELS: Record<string, string> = {
  tot: "Tốt",
  kha: "Khá",
  trung_binh: "Trung bình",
  yeu: "Yếu",
};

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let classId: string | undefined;
  let term: string | undefined;
  let students: StudentInput[] = [];
  try {
    const body = (await req.json()) as {
      classId?: string;
      term?: string;
      students?: StudentInput[];
    };
    classId = body.classId;
    term = body.term;
    students = Array.isArray(body.students) ? body.students : [];
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!classId || students.length === 0) {
    return NextResponse.json(
      { error: "Thiếu classId hoặc danh sách học sinh" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const codes = students.map((s) => s.code);
  const { data: studentRows } = await supabase
    .from("students")
    .select("id,code")
    .eq("class_id", classId)
    .in("code", codes);
  const idByCode = new Map(
    ((studentRows ?? []) as { id: string; code: string }[]).map((s) => [
      s.code,
      s.id,
    ]),
  );
  const ids = [...idByCode.values()];

  const [violRes, gradeRes, attRes] = ids.length
    ? await Promise.all([
        supabase
          .from("conduct_records")
          .select("student_id,type")
          .in("student_id", ids)
          .limit(5000),
        supabase
          .from("grades")
          .select("student_id,score")
          .in("student_id", ids)
          .limit(10000),
        supabase
          .from("attendance_records")
          .select("student_id,status")
          .in("student_id", ids)
          .limit(10000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const violById = new Map<string, { vi_pham: number; khen_thuong: number }>();
  for (const r of (violRes.data ?? []) as {
    student_id: string;
    type: string;
  }[]) {
    const v = violById.get(r.student_id) ?? { vi_pham: 0, khen_thuong: 0 };
    if (r.type === "vi_pham") v.vi_pham += 1;
    else v.khen_thuong += 1;
    violById.set(r.student_id, v);
  }
  const scoreById = new Map<string, { sum: number; n: number }>();
  for (const g of (gradeRes.data ?? []) as {
    student_id: string;
    score: number;
  }[]) {
    const s = scoreById.get(g.student_id) ?? { sum: 0, n: 0 };
    s.sum += g.score;
    s.n += 1;
    scoreById.set(g.student_id, s);
  }
  const attById = new Map<string, { total: number; absent: number }>();
  for (const a of (attRes.data ?? []) as {
    student_id: string;
    status: string;
  }[]) {
    const s = attById.get(a.student_id) ?? { total: 0, absent: 0 };
    s.total += 1;
    if (a.status === "excused" || a.status === "unexcused") s.absent += 1;
    attById.set(a.student_id, s);
  }

  const payload = students.map((s) => {
    const id = idByCode.get(s.code);
    const viol = id ? violById.get(id) : undefined;
    const score = id ? scoreById.get(id) : undefined;
    const att = id ? attById.get(id) : undefined;
    return {
      code: s.code,
      ten: s.name,
      xep_loai: RATING_LABELS[s.rating] ?? s.rating,
      vi_pham: viol?.vi_pham ?? 0,
      khen_thuong: viol?.khen_thuong ?? 0,
      diem_tb: score && score.n > 0 ? Math.round((score.sum / score.n) * 10) / 10 : null,
      chuyen_can_pct:
        att && att.total > 0
          ? Math.round(((att.total - att.absent) / att.total) * 100)
          : null,
    };
  });

  const prompt = `Viết nhận xét hạnh kiểm ${term === "hk1" ? "học kỳ I" : term === "hk2" ? "học kỳ II" : "cả năm"} cho từng học sinh THCS dưới đây (JSON): ${JSON.stringify(payload)}.

Yêu cầu: mỗi nhận xét 1-2 câu, văn phong giáo viên chủ nhiệm Việt Nam, phù hợp xếp loại, đề cập điểm mạnh và điều cần cố gắng dựa trên số liệu (vi phạm, khen thưởng, điểm TB, chuyên cần). Không emoji, không khô khan lặp mẫu.

Trả về CHỈ JSON object dạng {"MA_HS": "nhận xét"}, không markdown.`;

  const text = await generateText(prompt, {
    system:
      "Bạn là giáo viên chủ nhiệm trường THCS Việt Nam viết nhận xét học sinh. Chỉ trả về JSON hợp lệ.",
    maxTokens: 8000,
    temperature: 0.7,
  });

  if (!text) {
    return NextResponse.json({ comments: null });
  }

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const obj = JSON.parse(cleaned) as Record<string, string>;
    const comments: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.trim()) comments[k] = v.trim();
    }
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ comments: null });
  }
}
