import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { hasFeature } from "@/lib/permissions";
import { getAiConfig, generateTextDetailed } from "@/lib/ai";
import { extractJson } from "@/lib/tvc/ai-json";
import { createClient } from "@/lib/supabase/server";
import { fallbackToDevin } from "@/lib/devin";
import { hasAnyRole } from "@/lib/roles";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_TEXT = 200_000;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const SCHEMA = `Moi phan tu cua JSON array:
{
  "stem": "noi dung cau hoi day du, cong thuc toan viet bang LaTeX dung cu phap $...$ (vi du $\\\\frac{1}{2}$, $x^2$); cac phuong an A B C D viet lien trong stem",
  "context": "doan van/bai doc ma cau hoi tham chieu den, chi dien khi cau hoi bat buoc doc noi dung do moi tra loi duoc - neu khong co thi de chuoi rong",
  "qtype": "multiple_choice | true_false_4 | short_answer | essay",
  "level": "biet | hieu | van_dung",
  "points": so diem (mac dinh 0.25 TN nhieu lua chon, 1.0 dung-sai 4 y, 0.5 tra loi ngan, tu luan theo de),
  "answer": "dap an dung, vi du 'B' hoac 'a)D b)S c)D d)S' hoac dap so",
  "solution": "huong dan giai ngan gon neu co",
  "topic": "chu de/don vi kien thuc cua cau hoi - neu khong xac dinh duoc thi de chuoi rong",
  "subject": "mon hoc: toan | ngu_van | tieng_viet | tieng_anh - doan tu noi dung cau hoi",
  "grade": khoi lop 1-12 - doan tu do kho va chu de cua cau hoi,
  "standard_code": "ma yeu cau can dat phu hop nhat - dung danh sach chuan duoc cung cap o cuoi prompt, de chuoi rong neu khong chac"
}
Chi tra ve JSON array thuan, khong giai thich. Neu khong co cau hoi nao tra ve [].`;

/**
 * POST /api/studio/questions/extract - AI trich xuat cau hoi tu anh/PDF/docx-text.
 * Body: { data: base64, mime } hoac { text } (docx da trich client-side).
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!hasAnyRole(profile, ["gvcn", "gvbm", "to_truong", "bgh", "admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await hasFeature("studio.ai")) || !(await hasFeature("studio.questions"))) {
    return NextResponse.json({ error: "Tính năng đã bị quản trị tắt." }, { status: 403 });
  }

  const cfg = getAiConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Chua cau hinh AI - them key vao env." },
      { status: 503 },
    );
  }

  let body: { data?: string; mime?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body khong hop le." }, { status: 400 });
  }

  let prompt: string;
  const inline =
    body.data && body.mime && ALLOWED.has(body.mime)
      ? { data: body.data, mimeType: body.mime }
      : null;

  if (inline) {
    if (cfg.provider !== "gemini") {
      return NextResponse.json(
        { error: "Doc anh/PDF can provider ho tro file dinh kem." },
        { status: 503 },
      );
    }
    if (body.data!.length > MAX_BYTES * 1.4) {
      return NextResponse.json(
        { error: "File qua lon (toi da 8MB)." },
        { status: 400 },
      );
    }
    prompt = `Day la anh/scan mot de thi hoac trang bai tap. Hay trich xuat TAT CA cau hoi thanh JSON array.\n${SCHEMA}`;
  } else if (typeof body.text === "string" && body.text.trim()) {
    if (body.text.length > MAX_TEXT) {
      return NextResponse.json({ error: "Noi dung qua dai." }, { status: 400 });
    }
    prompt = `Van ban sau duoc trich tu file Word (.docx) cua mot de thi/bai tap - cong thuc toan da o dang LaTeX $...$. Hay tach TUNG cau hoi thanh JSON array (bo qua tieu de truong, huong dan lam bai, phan dap an cuoi de nhung dung no de dien truong answer neu co).\n${SCHEMA}\n\nVAN BAN:\n${body.text.slice(0, MAX_TEXT)}`;
  } else {
    return NextResponse.json(
      { error: "Chi ho tro PNG/JPG/WEBP/PDF/DOCX." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: stds } = await supabase
    .from("tvc_curriculum_standards")
    .select("code, subject_code, grade, description")
    .eq("status", "active");
  const stdList = (stds ?? [])
    .map((s) => `${s.code} [${s.subject_code} lop ${s.grade}]: ${s.description}`)
    .join("\n");
  const promptFull = `${prompt}\n\nDANH SACH MA YEU CAU CAN DAT (chon ma gan nhat cho moi cau, de rong neu khong chac):\n${stdList}`;

  const r = await generateTextDetailed(promptFull, {
    inline: inline ?? undefined,
    maxTokens: 16384,
    temperature: 0.2,
  });
  if (!r.text) {
    if (r.error === "quota" && !inline) {
      const job = await fallbackToDevin({
        supabase,
        kind: "tvc-question-extract",
        prompt: promptFull,
        expectedShape:
          '[{"stem":"...","context":"","qtype":"multiple_choice|true_false_4|short_answer|essay","level":"biet|hieu|van_dung","points":0.25,"answer":"...","solution":"...","topic":"...","subject":"toan|tieng_viet|tieng_anh","grade":3,"standard_code":"TOAN3.1.2"}]',
        createdBy: profile.id,
        req,
      });
      if (job) {
        return NextResponse.json({
          pending: true,
          jobId: job.jobId,
          sessionUrl: job.devinUrl,
        });
      }
      return NextResponse.json(
        { error: "AI het han muc - thu lai sau." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "AI khong doc duoc file." },
      { status: 502 },
    );
  }
  let parsed = extractJson<unknown>(r.text);
  if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
    parsed =
      Object.values(parsed as Record<string, unknown>).find(Array.isArray) ??
      parsed;
  }
  if (!Array.isArray(parsed)) {
    return NextResponse.json(
      { error: "AI tra ve du lieu khong dung dinh dang." },
      { status: 502 },
    );
  }
  const unesc = (s: string) => s.replace(/\\\\(?=[a-zA-Z{(\[,;:])/g, "\\");
  const rows = parsed
    .filter((q) => q && typeof q.stem === "string" && String(q.stem).trim())
    .map((q) => ({
      stem: unesc(String(q.stem).trim()),
      context: unesc(String(q.context ?? "")),
      qtype: ["multiple_choice", "true_false_4", "short_answer", "essay"].includes(
        String(q.qtype ?? ""),
      )
        ? String(q.qtype)
        : "multiple_choice",
      level: ["biet", "hieu", "van_dung", "van_dung_cao"].includes(
        String(q.level ?? ""),
      )
        ? String(q.level)
        : "biet",
      points: Number(q.points) > 0 ? Number(q.points) : 1,
      answer: unesc(String(q.answer ?? "")),
      solution: unesc(String(q.solution ?? "")),
      topic: String(q.topic ?? ""),
      subject: ["toan", "ngu_van", "tieng_viet", "tieng_anh"].includes(
        String(q.subject ?? ""),
      )
        ? String(q.subject)
        : "",
      grade: Number(q.grade) >= 1 && Number(q.grade) <= 12 ? Number(q.grade) : null,
      standard_code: String(q.standard_code ?? ""),
    }));
  return NextResponse.json({ rows });
}
