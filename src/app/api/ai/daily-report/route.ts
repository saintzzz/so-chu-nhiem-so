import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateTextDetailed, type AiResult } from "@/lib/ai";
import { takeAiQuota, recordAiUsage } from "@/lib/ai-quota";
import { minimizePrompt, minimizeDeep, deanonymizeNames } from "@/lib/ai-privacy";
import { schoolPiiNames } from "@/lib/ai-pii-roster";
import { fallbackToDevin } from "@/lib/devin";
import type { Student } from "@/types";
import { hasRole, hasAnyRole } from "@/lib/roles";

/**
 * AI soạn nháp báo cáo ngày cho GVCN.
 * Tổng hợp số liệu thật của lớp trong ngày -> model viết 2-3 câu báo cáo.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !hasAnyRole(profile, ["gvcn", "bgh", "pht"])) {
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
  if (hasRole(profile, "gvcn") && cls.gvcn_id !== profile.id) {
    return NextResponse.json({ error: "Bạn không chủ nhiệm lớp này." }, { status: 403 });
  }

  const { data: stu, error: stuErr } = await supabase
    .from("students")
    .select("id,full_name,code")
    .eq("class_id", cls.id)
    .eq("status", "active");
  // CR-049 r6 M10: loi nguon != du lieu rong - fail truoc khi goi AI,
  // neu khong route co the bao cao "lop on dinh" tren nguon chua tai.
  if (stuErr) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const students = (stu ?? []) as Pick<Student, "id" | "full_name" | "code">[];
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
  // CR-049 r6 M10: fail-closed khi nguon su co/chuyen can/hanh kiem loi.
  const srcErr =
    (attRes as { error?: { message?: string } }).error ??
    (conductRes as { error?: { message?: string } }).error ??
    incRes.error;
  if (srcErr) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }

  // gui alias thay ten that ra AI provider (CR-049 P3b+r5: ma so
  // 9-12 chu so bi redact nham la PII, con ten that la PII) - deanon
  // alias -> ten that khi render.
  // r10 H6/H7: noi dung free-text (vi pham, khen thuong) co the nhac ten
  // HS/GV/PH bat ky trong TRUONG, khong chi lop nay - dung roster truong
  // day du (admin client), fail-closed khi thieu coverage.
  const roster = await schoolPiiNames(profile.school_id ?? "");
  if (roster.error) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const piiNames = roster.names;
  const aliasByName = new Map(piiNames.map((n) => [n.name, n.alias]));
  const codeOf = new Map(
    students.map((s) => [s.id, aliasByName.get(s.full_name) ?? "?"]),
  );
  const deanon = (t: string) => deanonymizeNames(t, piiNames);
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
      .map((a) => `${codeOf.get(a.student_id) ?? "?"} (${a.status === "excused" ? "có phép" : "không phép"})`),
    di_muon: att
      .filter((a) => a.status === "late")
      .map((a) => codeOf.get(a.student_id) ?? "?"),
    vi_pham: conduct
      .filter((c) => c.type === "vi_pham")
      .map((c) => `${codeOf.get(c.student_id) ?? "?"}: ${c.content}`),
    khen_thuong: conduct
      .filter((c) => c.type === "khen_thuong")
      .map((c) => `${codeOf.get(c.student_id) ?? "?"}: ${c.content}`),
    su_co_dang_mo: incidents.map((i) => `${i.type} (${i.severity})`),
  };

  // r10 H: minimizeDeep TREN CAU TRUC truoc JSON.stringify - free-text
  // trong facts chua ten that, serialize truoc se lam regex redact
  // khong khop chuoi da escape (\n -> \\n).
  const prompt = `Soạn báo cáo ngày của giáo viên chủ nhiệm gửi Ban Giám Hiệu dựa trên số liệu (JSON): ${JSON.stringify(minimizeDeep(facts, piiNames))}.

Yêu cầu: 2-4 câu, văn phong báo cáo hành chính giáo dục Việt Nam, nêu sĩ số - chuyên cần - tình hình nổi bật - việc đề xuất BGH hỗ trợ (nếu có). Gọi học sinh bằng mã (HS...) đúng như dữ liệu. Không emoji, không liệt kê máy móc, không bịa sự kiện ngoài số liệu. Nếu ngày bình thường không có gì đặc biệt thì báo cáo ngắn gọn "lớp ổn định".

Trả về CHỈ JSON: {"draft": "nội dung báo cáo"}`;

  const safePrompt = minimizePrompt(prompt, piiNames);
  const quotaOk = await takeAiQuota("daily-report", profile.id);
  const aiRes: AiResult = quotaOk
    ? await generateTextDetailed(safePrompt, {
        system:
          "Bạn là trợ lý soạn báo cáo ngày cho giáo viên chủ nhiệm trường phổ thông Việt Nam. Chỉ trả về JSON hợp lệ.",
        maxTokens: 1000,
        temperature: 0.6,
      })
    : { text: null, error: "error", provider: null };
  void recordAiUsage("daily-report", profile.id, aiRes.provider, quotaOk ? (aiRes.text ? "ok" : aiRes.error ?? "error") : "budget_block");

  if (!aiRes.text) {
    if (aiRes.error === "quota") {
      const job = await fallbackToDevin({
        supabase,
        kind: "daily-report",
        prompt: `Bạn là trợ lý soạn báo cáo ngày GVCN.\n\n${safePrompt}`,
        expectedShape: '{"draft": "nội dung báo cáo 2-4 câu"}',
        createdBy: profile.id,
        req,
        piiMap: piiNames,
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
    if (obj.draft?.trim())
      return NextResponse.json({ draft: deanon(obj.draft.trim()) });
  } catch {
    // fallthrough
  }
  return NextResponse.json({ error: "AI trả về định dạng không hợp lệ." });
}
