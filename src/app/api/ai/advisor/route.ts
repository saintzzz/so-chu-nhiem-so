import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateTextDetailed } from "@/lib/ai";
import { fallbackToDevin } from "@/lib/devin";

/**
 * Trợ lý AI cho Ban Giám Hiệu - trả lời dựa trên số liệu thật của trường.
 * Context: sĩ số, chuyên cần, sự cố, phê duyệt chờ, cảnh báo sớm.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["bgh", "pht", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  const body = (await req.json()) as { question?: string };
  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Thiếu câu hỏi." }, { status: 400 });
  }
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const { data: classes } = await supabase
    .from("classes")
    .select("id,name")
    .eq("school_id", sid)
    .eq("status", "active");
  const cls = (classes ?? []) as { id: string; name: string }[];
  const classIds = cls.map((c) => c.id);

  const { data: students } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id")
        .in("class_id", classIds)
        .eq("status", "active")
    : { data: [] };
  const studentIds = ((students ?? []) as { id: string }[]).map((s) => s.id);

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: att },
    { data: incidents },
    { data: reports },
    { count: pendingPlans },
    { count: pendingSubs },
    { count: pendingActs },
    { data: warnings },
    { data: teachers },
  ] = await Promise.all([
    studentIds.length
      ? supabase
          .from("attendance_records")
          .select("status")
          .in("student_id", studentIds)
          .eq("date", today)
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase
          .from("incidents")
          .select("type,severity,status,class_id")
          .in("class_id", classIds)
          .in("status", ["new", "following"])
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase
          .from("daily_reports")
          .select("class_id,status")
          .in("class_id", classIds)
          .eq("date", today)
      : Promise.resolve({ data: [] }),
    supabase
      .from("lesson_plans")
      .select("id", { count: "exact", head: true })
      .eq("school_id", sid)
      .in("status", ["submitted", "team_approved"]),
    supabase
      .from("substitute_requests")
      .select("id", { count: "exact", head: true })
      .eq("school_id", sid)
      .eq("status", "pending"),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("early_warnings")
      .select("category,severity,title,class_id")
      .eq("school_id", sid)
      .eq("status", "open")
      .limit(10),
    supabase
      .from("profiles")
      .select("id")
      .eq("school_id", sid)
      .in("role", ["gvcn", "gvbm", "to_truong"]),
  ]);

  const attRows = (att ?? []) as { status: string }[];
  const attTotal = attRows.length;
  const attPresent = attRows.filter((a) => a.status === "present").length;
  const className = new Map(cls.map((c) => [c.id, c.name]));

  const context = {
    truong: { so_lop: cls.length, so_hoc_sinh: studentIds.length, so_giao_vien: (teachers ?? []).length },
    hom_nay: {
      ngay: today,
      chuyen_can_pct: attTotal ? Math.round((attPresent / attTotal) * 100) : null,
      lop_da_nop_bao_cao: ((reports ?? []) as { status: string }[]).filter(
        (r) => r.status === "submitted",
      ).length,
      tong_lop: cls.length,
    },
    su_co_dang_mo: ((incidents ?? []) as { type: string; severity: string; class_id: string }[]).map(
      (i) => `${i.type} (${i.severity}) - lớp ${className.get(i.class_id) ?? "?"}`,
    ),
    cho_phe_duyet: {
      giao_an: pendingPlans ?? 0,
      dieu_dong_day_thay: pendingSubs ?? 0,
      ke_hoach_hoat_dong: pendingActs ?? 0,
    },
    canh_bao_dang_mo: ((warnings ?? []) as {
      category: string;
      severity: string;
      title: string;
      class_id: string | null;
    }[]).map(
      (w) => `[${w.category}/${w.severity}] ${w.title}${w.class_id ? ` - lớp ${className.get(w.class_id) ?? "?"}` : ""}`,
    ),
  };

  const prompt = `Bạn là trợ lý điều hành cho Ban Giám Hiệu trường phổ thông Việt Nam. Dưới đây là số liệu thật của trường (JSON):

${JSON.stringify(context)}

Câu hỏi của BGH: "${question}"

Trả lời ngắn gọn 2-5 câu bằng tiếng Việt, dựa đúng vào số liệu trên, không bịa số liệu. Nếu câu hỏi ngoài phạm vi dữ liệu thì nói rõ và gợi ý số liệu liên quan đang có. Trả về CHỈ JSON: {"answer": "..."}`;

  const aiRes = await generateTextDetailed(prompt, {
    system:
      "Bạn là trợ lý điều hành nhà trường. Chỉ trả về JSON hợp lệ, tiếng Việt.",
    maxTokens: 1200,
    temperature: 0.4,
  });

  if (!aiRes.text) {
    if (aiRes.error === "quota") {
      const job = await fallbackToDevin({
        supabase,
        kind: "advisor",
        prompt,
        expectedShape: '{"answer": "trả lời ngắn gọn"}',
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
    const q = question.toLowerCase();
    const c = context;
    const answers: [RegExp, () => string][] = [
      [
        /báo cáo|chưa nộp/,
        () =>
          `Hôm nay (${c.hom_nay.ngay}) có ${c.hom_nay.lop_da_nop_bao_cao}/${c.hom_nay.tong_lop} lớp đã nộp báo cáo ngày.`,
      ],
      [
        /sự cố/,
        () =>
          c.su_co_dang_mo.length
            ? `Đang mở ${c.su_co_dang_mo.length} sự cố: ${c.su_co_dang_mo.join("; ")}.`
            : "Hiện không có sự cố nào đang mở.",
      ],
      [
        /phê duyệt|chờ duyệt/,
        () => {
          const p = c.cho_phe_duyet;
          const total =
            p.giao_an + p.dieu_dong_day_thay + p.ke_hoach_hoat_dong;
          return `Có ${total} mục chờ phê duyệt: ${p.giao_an} giáo án, ${p.dieu_dong_day_thay} yêu cầu điều động, ${p.ke_hoach_hoat_dong} kế hoạch hoạt động.`;
        },
      ],
      [
        /chuyên cần|điểm danh|vắng/,
        () =>
          c.hom_nay.chuyen_can_pct === null
            ? `Hôm nay chưa có dữ liệu điểm danh. Trường có ${c.truong.so_lop} lớp, ${c.truong.so_hoc_sinh} học sinh.`
            : `Tỷ lệ chuyên cần hôm nay: ${c.hom_nay.chuyen_can_pct}% (${c.hom_nay.lop_da_nop_bao_cao}/${c.hom_nay.tong_lop} lớp đã báo cáo).`,
      ],
      [
        /cảnh báo/,
        () =>
          c.canh_bao_dang_mo.length
            ? `Có ${c.canh_bao_dang_mo.length} cảnh báo đang mở: ${c.canh_bao_dang_mo.join("; ")}.`
            : "Không có cảnh báo sớm nào đang mở.",
      ],
    ];
    const hit = answers.find(([re]) => re.test(q));
    const answer = hit
      ? hit[1]()
      : `Trường có ${c.truong.so_lop} lớp, ${c.truong.so_hoc_sinh} học sinh, ${c.truong.so_giao_vien} giáo viên. Chuyên cần hôm nay ${c.hom_nay.chuyen_can_pct ?? "chưa có"}%. Sự cố mở ${c.su_co_dang_mo.length}, cảnh báo ${c.canh_bao_dang_mo.length}, chờ duyệt ${c.cho_phe_duyet.giao_an + c.cho_phe_duyet.dieu_dong_day_thay + c.cho_phe_duyet.ke_hoach_hoat_dong} mục.`;
    return NextResponse.json({ answer });
  }

  try {
    const obj = JSON.parse(
      aiRes.text.replace(/```json|```/g, "").trim(),
    ) as { answer?: string };
    if (obj.answer?.trim()) return NextResponse.json({ answer: obj.answer.trim() });
  } catch {
    // fallthrough
  }
  return NextResponse.json({ error: "AI trả về định dạng không hợp lệ." });
}
