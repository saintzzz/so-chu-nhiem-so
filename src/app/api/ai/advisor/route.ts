import { NextResponse } from "next/server";
import { assertModule } from "@/lib/modules";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateTextDetailed, type AiResult } from "@/lib/ai";
import { takeAiQuota, recordAiUsage } from "@/lib/ai-quota";
import { minimizePrompt, minimizeDeep, deanonymizeNames, collectUsedNames } from "@/lib/ai-privacy";
import { schoolPiiNames } from "@/lib/ai-pii-roster";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { fallbackToDevin } from "@/lib/devin";
import { todayVN } from "@/lib/utils";
import { hasAnyRole } from "@/lib/roles";

/**
 * Trợ lý AI cho Ban Giám Hiệu - trả lời dựa trên số liệu thật của trường.
 * Context: sĩ số, chuyên cần, sự cố, phê duyệt chờ, cảnh báo sớm.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !hasAnyRole(profile, ["bgh", "pht", "admin"])) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const modErr = await assertModule("van_hanh_nang_cao");
  if (modErr) return NextResponse.json({ error: modErr }, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    question?: unknown;
  } | null;
  // R16: validate runtime - question phai la string va gioi han do dai
  // (free text vo han thoi phong prompt + phi token).
  const question =
    typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";
  if (!question) {
    return NextResponse.json({ error: "Thiếu câu hỏi." }, { status: 400 });
  }
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  // CR-049 r8 H3: ca 2 lookup ban dau phai fail-closed + paginate -
  // classIds rong ao se tat roster lookup (piiNames trong -> lo ten)
  // va tra so lieu "0" co that quyen.
  const { data: classes, error: clsErr } = await supabase
    .from("classes")
    .select("id,name")
    .eq("school_id", sid)
    .eq("status", "active");
  if (clsErr) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const cls = (classes ?? []) as { id: string; name: string }[];
  const classIds = cls.map((c) => c.id);

  const stuInit = classIds.length
    ? await fetchAllRows<{ id: string; class_id: string }>((f, t) =>
        supabase
          .from("students")
          .select("id,class_id")
          .in("class_id", classIds)
          .eq("status", "active")
          .order("id")
          .range(f, t),
      )
    : { rows: [] as { id: string; class_id: string }[], error: null, truncated: false };
  if (stuInit.error || stuInit.truncated) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const students = stuInit.rows;
  const studentIds = students.map((s) => s.id);

  const today = todayVN();
  const [
    attRes,
    incRes,
    repRes,
    plansRes,
    subsRes,
    actsRes,
    warnRes,
    teachRes,
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
      .or("role.in.(gvcn,gvbm,to_truong),concurrent_roles.ov.{gvcn,gvbm,to_truong}"),
  ]);

  // CR-049 r7 M10: loi nguon != du lieu rong - fail truoc AI call,
  // neu khong route tra cau tra loi tren so lieu ao "0" co that quyen.
  const srcErr = [
    attRes,
    incRes,
    repRes,
    plansRes,
    subsRes,
    actsRes,
    warnRes,
    teachRes,
  ]
    .map((r) => (r as { error?: { message?: string } | null }).error)
    .find(Boolean);
  if (srcErr) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const { data: att } = attRes;
  const { data: incidents } = incRes;
  const { data: reports } = repRes;
  const { count: pendingPlans } = plansRes;
  const { count: pendingSubs } = subsRes;
  const { count: pendingActs } = actsRes;
  const { data: warnings } = warnRes;
  const { data: teachers } = teachRes;

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

  // CR-049 r7 H5 + r9 H9: cau hoi BGH + tieu de canh bao co the chua
  // ten HS -> pseudonymize theo roster TRUONG (tat ca lop/HS ke ca da
  // nghi hoc - free text lich su van nhac ten ho).
  const roster = await schoolPiiNames(sid);
  if (roster.error) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const piiNames = roster.names;
  // CR-049 r12 H3: deanon/pii_map chi pham vi ten co trong du lieu BGH
  // nhin thay (context + cau hoi) - chan inject alias de echo lo ten
  // ngoai pham vi.
  const usedNames = collectUsedNames({ context, question }, piiNames);

  // r9 H10: context serialize SAU khi co roster - minimizeDeep tung
  // string truoc JSON.stringify de ten co whitespace khong thoat qua
  // JSON-escape.
  const prompt = `Bạn là trợ lý điều hành cho Ban Giám Hiệu trường phổ thông Việt Nam. Dưới đây là số liệu thật của trường (JSON):

${JSON.stringify(minimizeDeep(context, piiNames))}

Câu hỏi của BGH: "${question}"

Trả lời ngắn gọn 2-5 câu bằng tiếng Việt, dựa đúng vào số liệu trên, không bịa số liệu. Nếu câu hỏi ngoài phạm vi dữ liệu thì nói rõ và gợi ý số liệu liên quan đang có. Trả về CHỈ JSON: {"answer": "..."}`;

  const safePrompt = minimizePrompt(prompt, piiNames);

  const quotaOk = await takeAiQuota("advisor", profile.id);
  const aiRes: AiResult = quotaOk
    ? await generateTextDetailed(safePrompt, {
        system:
          "Bạn là trợ lý điều hành nhà trường. Chỉ trả về JSON hợp lệ, tiếng Việt.",
        maxTokens: 1200,
        temperature: 0.4,
      })
    : { text: null, error: "error", provider: null };
  void recordAiUsage("advisor", profile.id, aiRes.provider, quotaOk ? (aiRes.text ? "ok" : aiRes.error ?? "error") : "budget_block");

  if (!aiRes.text) {
    if (aiRes.error === "quota") {
      const job = await fallbackToDevin({
        supabase,
        kind: "advisor",
        prompt: safePrompt,
        piiMap: usedNames,
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

  const cleaned = aiRes.text.replace(/```json|```/g, "").trim();
  const toText = (v: unknown): string | null => {
    if (typeof v === "string") return v.trim() || null;
    if (Array.isArray(v)) {
      const lines = v
        .map((item) =>
          typeof item === "string"
            ? item
            : item && typeof item === "object"
              ? Object.values(item as Record<string, unknown>)
                  .filter((x) => typeof x === "string")
                  .join(" - ")
              : "",
        )
        .filter(Boolean);
      return lines.length ? lines.join("\n") : null;
    }
    if (v && typeof v === "object") {
      const parts = Object.values(v as Record<string, unknown>).filter(
        (x): x is string => typeof x === "string",
      );
      return parts.length ? parts.join(" - ") : null;
    }
    return null;
  };
  try {
    const answer = toText(
      (JSON.parse(cleaned) as Record<string, unknown>).answer,
    );
    if (answer) {
      return NextResponse.json({ answer: deanonymizeNames(answer, usedNames) });
    }
  } catch {
    // LLM trả text thuần thay vì JSON - dùng trực tiếp nếu hợp lệ
    if (cleaned.length > 20) {
      return NextResponse.json({ answer: deanonymizeNames(cleaned, usedNames) });
    }
  }
  return NextResponse.json({ error: "AI trả về định dạng không hợp lệ." });
}
