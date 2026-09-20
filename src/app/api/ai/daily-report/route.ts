import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateTextDetailed } from "@/lib/ai";
import { fallbackToDevin } from "@/lib/devin";
import type { Student } from "@/types";

/**
 * AI soạn nháp báo cáo ngày cho GVCN.
 * Tổng hợp số liệu thật của lớp trong ngày -> model viết 2-3 câu báo cáo.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh", "pht"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  const body = (await req.json()) as { classId?: string; date?: string };
  if (!body.classId || !body.date) {
    return NextResponse.json({ error: "Thiếu tham số." }, { status: 400 });
  }
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id,name,gvcn_id")
    .eq("id", body.classId)
    .maybeSingle();
  if (!cls) return NextResponse.json({ error: "Lớp không tồn tại." }, { status: 404 });
  if (profile.role === "gvcn" && cls.gvcn_id !== profile.id) {
    return NextResponse.json({ error: "Bạn không chủ nhiệm lớp này." }, { status: 403 });
  }

  const { data: stu } = await supabase
    .from("students")
    .select("id,full_name")
    .eq("class_id", cls.id)
    .eq("status", "active");
  const students = (stu ?? []) as Pick<Student, "id" | "full_name">[];
  const ids = students.map((s) => s.id);

  const [attRes, conductRes, incRes] = await Promise.all([
    ids.length
      ? supabase
          .from("attendance_records")
          .select("student_id,status,note")
          .in("student_id", ids)
          .eq("date", body.date)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("conduct_records")
          .select("student_id,type,content")
          .in("student_id", ids)
          .eq("date", body.date)
      : Promise.resolve({ data: [] }),
    supabase
      .from("incidents")
      .select("type,severity,status")
      .eq("class_id", cls.id)
      .in("status", ["new", "following"]),
  ]);

  const nameOf = new Map(students.map((s) => [s.id, s.full_name]));
  const att = (attRes.data ?? []) as {
    student_id: string;
    status: string;
    note: string | null;
  }[];
  const conduct = (conductRes.data ?? []) as {
    student_id: string;
    type: string;
    content: string;
  }[];
  const incidents = (incRes.data ?? []) as {
    type: string;
    severity: string;
    status: string;
  }[];

  const facts = {
    lop: cls.name,
    ngay: body.date,
    si_so: students.length,
    vang: att
      .filter((a) => a.status === "excused" || a.status === "unexcused")
      .map((a) => `${nameOf.get(a.student_id) ?? "?"} (${a.status === "excused" ? "có phép" : "không phép"})`),
    di_muon: att
      .filter((a) => a.status === "late")
      .map((a) => nameOf.get(a.student_id) ?? "?"),
    vi_pham: conduct
      .filter((c) => c.type === "vi_pham")
      .map((c) => `${nameOf.get(c.student_id) ?? "?"}: ${c.content}`),
    khen_thuong: conduct
      .filter((c) => c.type === "khen_thuong")
      .map((c) => `${nameOf.get(c.student_id) ?? "?"}: ${c.content}`),
    su_co_dang_mo: incidents.map((i) => `${i.type} (${i.severity})`),
  };

  const prompt = `Soạn báo cáo ngày của giáo viên chủ nhiệm gửi Ban Giám Hiệu dựa trên số liệu (JSON): ${JSON.stringify(facts)}.

Yêu cầu: 2-4 câu, văn phong báo cáo hành chính giáo dục Việt Nam, nêu sĩ số - chuyên cần - tình hình nổi bật - việc đề xuất BGH hỗ trợ (nếu có). Không emoji, không liệt kê máy móc, không bịa sự kiện ngoài số liệu. Nếu ngày bình thường không có gì đặc biệt thì báo cáo ngắn gọn "lớp ổn định".

Trả về CHỈ JSON: {"draft": "nội dung báo cáo"}`;

  const aiRes = await generateTextDetailed(prompt, {
    system:
      "Bạn là trợ lý soạn báo cáo ngày cho giáo viên chủ nhiệm trường THCS Việt Nam. Chỉ trả về JSON hợp lệ.",
    maxTokens: 1000,
    temperature: 0.6,
  });

  if (!aiRes.text) {
    if (aiRes.error === "quota") {
      const job = await fallbackToDevin({
        supabase,
        kind: "daily-report",
        prompt: `Bạn là trợ lý soạn báo cáo ngày GVCN.\n\n${prompt}`,
        expectedShape: '{"draft": "nội dung báo cáo 2-4 câu"}',
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
    return NextResponse.json({ error: "AI chưa phản hồi." });
  }

  try {
    const cleaned = aiRes.text.replace(/```json|```/g, "").trim();
    const obj = JSON.parse(cleaned) as { draft?: string };
    if (obj.draft?.trim()) return NextResponse.json({ draft: obj.draft.trim() });
  } catch {
    // fallthrough
  }
  return NextResponse.json({ error: "AI trả về định dạng không hợp lệ." });
}
