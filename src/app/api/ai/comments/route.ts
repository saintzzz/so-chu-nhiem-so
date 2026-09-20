import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { generateTextDetailed } from "@/lib/ai";
import { fallbackToDevin } from "@/lib/devin";
import { averageByStudent, semesterAverage, yearAverage } from "@/lib/tt22";
import { NLPC_ATTRIBUTES } from "@/lib/nlpc";

interface StudentInput {
  code: string;
  name: string;
  rating: string;
}

const RATING_LABELS: Record<string, string> = {
  tot: "Tốt",
  kha: "Khá",
  dat: "Đạt",
  chua_dat: "Chưa đạt",
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

  const [violRes, gradeRes, attRes, incRes, compRes, actRes, counselRes, nlpcRes] =
    ids.length
      ? await Promise.all([
          supabase
            .from("conduct_records")
            .select("student_id,type")
            .in("student_id", ids)
            .limit(5000),
          supabase
            .from("grades")
            .select("student_id,subject_id,term,assessment_type,score")
            .in("student_id", ids)
            .limit(20000),
          supabase
            .from("attendance_records")
            .select("student_id,status")
            .in("student_id", ids)
            .limit(10000),
          supabase
            .from("incidents")
            .select("student_id,type,severity,status,occurred_at")
            .in("student_id", ids)
            .order("occurred_at", { ascending: false })
            .limit(5000),
          supabase
            .from("competency_evaluations")
            .select("student_id,attribute_code,level")
            .in("student_id", ids)
            .limit(10000),
          supabase
            .from("activity_attendance")
            .select("student_id,status")
            .in("student_id", ids)
            .limit(10000),
          supabase
            .from("counseling_cases")
            .select("student_id,status")
            .in("student_id", ids)
            .in("status", ["new", "assessing", "counseling"])
            .limit(2000),
          supabase
            .from("nlpc_comments")
            .select("student_id,comment,created_at")
            .in("student_id", ids)
            .order("created_at", { ascending: false })
            .limit(2000),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ];

  // Subject names for weakest/strongest-subject hints (id lookup only)
  const gradeRows = (gradeRes.data ?? []) as {
    student_id: string;
    subject_id: string;
    term: string;
    assessment_type: string;
    score: number | null;
  }[];
  const subjectIds = [...new Set(gradeRows.map((g) => g.subject_id))];
  const { data: subjectRows } = subjectIds.length
    ? await supabase.from("subjects").select("id,name").in("id", subjectIds)
    : { data: [] };
  const subjectName = new Map(
    ((subjectRows ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name,
    ]),
  );
  // Per-student per-subject year average -> strongest/weakest subject
  const subjCell = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    const key = `${g.student_id}|${g.subject_id}`;
    const arr = subjCell.get(key) ?? [];
    arr.push(g);
    subjCell.set(key, arr);
  }
  const subjAvg = new Map<string, { sid: string; subjectId: string; avg: number }>();
  for (const [key, rows] of subjCell) {
    const [sid, subjectId] = key.split("|");
    const hk1 = semesterAverage(rows.filter((r) => r.term === "hk1"));
    const hk2 = semesterAverage(rows.filter((r) => r.term === "hk2"));
    const avg = yearAverage(hk1, hk2);
    if (avg != null) subjAvg.set(key, { sid, subjectId, avg });
  }
  const subjByStudent = new Map<string, { name: string; avg: number }[]>();
  for (const s of subjAvg.values()) {
    const name = subjectName.get(s.subjectId) ?? "Môn";
    const arr = subjByStudent.get(s.sid) ?? [];
    arr.push({ name, avg: s.avg });
    subjByStudent.set(s.sid, arr);
  }

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
  const scoreById = averageByStudent(
    (gradeRes.data ?? []) as {
      student_id: string;
      subject_id: string;
      term: string;
      assessment_type: string;
      score: number | null;
    }[],
  );
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

  // Sự cố: tổng số, số nghiêm trọng, số chưa đóng, loại gần nhất
  const incById = new Map<
    string,
    { tong: number; nghiem_trong: number; chua_xong: number; gan_nhat: string }
  >();
  for (const i of (incRes.data ?? []) as {
    student_id: string;
    type: string;
    severity: string;
    status: string;
  }[]) {
    const cur =
      incById.get(i.student_id) ?? {
        tong: 0,
        nghiem_trong: 0,
        chua_xong: 0,
        gan_nhat: "",
      };
    cur.tong += 1;
    if (i.severity === "high") cur.nghiem_trong += 1;
    if (i.status === "new" || i.status === "following") cur.chua_xong += 1;
    if (!cur.gan_nhat) cur.gan_nhat = i.type;
    incById.set(i.student_id, cur);
  }

  // Năng lực-phẩm chất: phân bố mức T/H/C + các thuộc tính còn yếu (C)
  const attrLabel = new Map<string, string>(
    NLPC_ATTRIBUTES.map((a) => [a.code as string, a.label]),
  );
  const compById = new Map<
    string,
    { T: number; H: number; C: number; yeu: string[] }
  >();
  for (const c of (compRes.data ?? []) as {
    student_id: string;
    attribute_code: string;
    level: string;
  }[]) {
    const cur = compById.get(c.student_id) ?? { T: 0, H: 0, C: 0, yeu: [] };
    if (c.level === "T") cur.T += 1;
    else if (c.level === "H") cur.H += 1;
    else if (c.level === "C") {
      cur.C += 1;
      const label = attrLabel.get(c.attribute_code);
      if (label && !cur.yeu.includes(label)) cur.yeu.push(label);
    }
    compById.set(c.student_id, cur);
  }

  // Hoạt động giáo dục: tỷ lệ tham gia
  const actById = new Map<string, { total: number; joined: number }>();
  for (const a of (actRes.data ?? []) as {
    student_id: string;
    status: string;
  }[]) {
    const cur = actById.get(a.student_id) ?? { total: 0, joined: 0 };
    cur.total += 1;
    if (a.status === "present") cur.joined += 1;
    actById.set(a.student_id, cur);
  }

  // Tư vấn đang mở (chỉ đếm - không đưa chi tiết nhạy cảm vào prompt)
  const counselById = new Map<string, number>();
  for (const c of (counselRes.data ?? []) as {
    student_id: string;
  }[]) {
    counselById.set(c.student_id, (counselById.get(c.student_id) ?? 0) + 1);
  }

  // Nhận xét NLPC gần nhất (đã rút gọn - giữ ngữ cảnh cho AI)
  const nlpcById = new Map<string, string>();
  for (const n of (nlpcRes.data ?? []) as {
    student_id: string;
    comment: string | null;
  }[]) {
    if (!nlpcById.has(n.student_id) && n.comment?.trim()) {
      nlpcById.set(n.student_id, n.comment.trim().slice(0, 160));
    }
  }

  const payload = students.map((s) => {
    const id = idByCode.get(s.code);
    const viol = id ? violById.get(id) : undefined;
    const score = id ? scoreById.get(id) : undefined;
    const att = id ? attById.get(id) : undefined;
    const inc = id ? incById.get(id) : undefined;
    const comp = id ? compById.get(id) : undefined;
    const act = id ? actById.get(id) : undefined;
    const subs = id ? subjByStudent.get(id) : undefined;
    const sorted = subs ? [...subs].sort((a, b) => b.avg - a.avg) : [];
    return {
      code: s.code,
      ten: s.name,
      xep_loai: RATING_LABELS[s.rating] ?? s.rating,
      vi_pham: viol?.vi_pham ?? 0,
      khen_thuong: viol?.khen_thuong ?? 0,
      diem_tb: score ?? null,
      mon_manh: sorted[0] ?? null,
      mon_yeu: sorted.length > 1 ? sorted[sorted.length - 1] : null,
      chuyen_can_pct:
        att && att.total > 0
          ? Math.round(((att.total - att.absent) / att.total) * 100)
          : null,
      su_co: inc ?? null,
      nang_luc: comp ?? null,
      hoat_dong_pct:
        act && act.total > 0
          ? Math.round((act.joined / act.total) * 100)
          : null,
      tu_van_dang_mo: id ? (counselById.get(id) ?? 0) : 0,
      nhan_xet_nlpc_gan_nhat: id ? (nlpcById.get(id) ?? null) : null,
    };
  });

  const prompt = `Viết nhận xét hạnh kiểm ${term === "hk1" ? "học kỳ I" : term === "hk2" ? "học kỳ II" : "cả năm"} cho từng học sinh THCS dưới đây (JSON): ${JSON.stringify(payload)}.

Yêu cầu: mỗi nhận xét 1-2 câu, văn phong giáo viên chủ nhiệm Việt Nam, phù hợp xếp loại, đề cập điểm mạnh và điều cần cố gắng dựa trên số liệu (vi phạm, khen thưởng, điểm TB, môn mạnh/yếu, chuyên cần, sự cố, năng lực-phẩm chất, tham gia hoạt động). Nếu tu_van_dang_mo>0 thì viết nhẹ nhàng, tập trung động viên. Không emoji, không khô khan lặp mẫu.

Trả về CHỈ JSON object dạng {"MA_HS": "nhận xét"}, không markdown.`;

  const aiRes = await generateTextDetailed(prompt, {
    system:
      "Bạn là giáo viên chủ nhiệm trường phổ thông Việt Nam viết nhận xét học sinh. Chỉ trả về JSON hợp lệ.",
    maxTokens: 8000,
    temperature: 0.7,
  });
  const text = aiRes.text;

  if (!text) {
    if (aiRes.error === "quota") {
      const job = await fallbackToDevin({
        supabase,
        kind: "comments",
        prompt: `Bạn là giáo viên chủ nhiệm trường phổ thông Việt Nam viết nhận xét học sinh.\n\n${prompt}`,
        expectedShape: '{"MA_HS": "nhận xét 1-2 câu"}',
        createdBy: profile.id,
        req,
      });
      if (job) {
        return NextResponse.json({
          pending: true,
          jobId: job.jobId,
          devinUrl: job.devinUrl,
        });
      }
    }
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
