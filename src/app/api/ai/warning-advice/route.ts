import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateTextDetailed } from "@/lib/ai";
import { fallbackToDevin } from "@/lib/devin";

/** AI đề xuất xử lý cho một cảnh báo sớm - ghi lại vào early_warnings.suggestion */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["bgh", "pht"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  const body = (await req.json()) as { warningId?: string };
  if (!body.warningId) {
    return NextResponse.json({ error: "Thiếu warningId." }, { status: 400 });
  }
  const supabase = await createClient();

  const { data: w } = await supabase
    .from("early_warnings")
    .select("*")
    .eq("id", body.warningId)
    .eq("school_id", profile.school_id ?? "")
    .maybeSingle();
  if (!w) return NextResponse.json({ error: "Cảnh báo không tồn tại." }, { status: 404 });

  const warn = w as {
    id: string;
    class_id: string | null;
    category: string;
    severity: string;
    title: string;
    detail: string | null;
  };
  const { data: cls } = warn.class_id
    ? await supabase
        .from("classes")
        .select("name")
        .eq("id", warn.class_id)
        .maybeSingle()
    : { data: null };

  const prompt = `Bạn là cố vấn quản lý cho Ban Giám Hiệu trường phổ thông Việt Nam. Cảnh báo sớm sau cần phương án xử lý:

Lớp: ${cls?.name ?? "-"}
Nhóm: ${warn.category} | Mức: ${warn.severity}
Vấn đề: ${warn.title}
Chi tiết: ${warn.detail ?? "-"}

Đề xuất 2-3 việc xử lý cụ thể, khả thi trong trường phổ thông Việt Nam (phân công ai, làm gì, bao lâu). Trả về CHỈ JSON: {"suggestion": "..."}`;

  const aiRes = await generateTextDetailed(prompt, {
    system: "Bạn là cố vấn quản lý giáo dục. Chỉ trả về JSON hợp lệ.",
    maxTokens: 800,
    temperature: 0.6,
  });

  if (!aiRes.text) {
    if (aiRes.error === "quota") {
      const job = await fallbackToDevin({
        supabase,
        kind: "warning-advice",
        prompt,
        expectedShape: '{"suggestion": "2-3 việc xử lý cụ thể"}',
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
    const advice: Record<string, string> = {
      hoc_tap:
        "GVCN rà soát điểm các môn yếu, lập kế hoạch hỗ trợ trong 1 tuần; phối hợp GVBM phụ đạo; thông báo phụ huynh cùng theo dõi.",
      chuyen_can:
        "GVCN liên hệ phụ huynh trong ngày để nắm lý do vắng; giao tổ trưởng/nhóm trưởng nhắc lịch; BGH theo dõi lại sau 1 tuần.",
      bo_hoc:
        "GVCN xác minh tình trạng bỏ học ngay, báo BGH và phối hợp địa phương vận động học sinh quay lại lớp trong tuần.",
      tam_ly:
        "Chuyển ngay ca sang luồng tư vấn tâm lý; GVCN trao đổi riêng với học sinh; mời phụ huynh phối hợp trong tuần này.",
      an_toan:
        "GVCN kiểm tra và xử lý sự cố đang mở theo quy trình an toàn; cập nhật trạng thái; BGH giám sát đến khi đóng.",
    };
    const suggestion =
      advice[warn.category] ??
      "GVCN xác minh nguyên nhân, trao đổi với học sinh và phụ huynh; lập kế hoạch theo dõi 1-2 tuần; báo cáo BGH kết quả.";
    await supabase
      .from("early_warnings")
      .update({ suggestion })
      .eq("id", warn.id);
    return NextResponse.json({ suggestion });
  }

  try {
    const obj = JSON.parse(
      aiRes.text.replace(/```json|```/g, "").trim(),
    ) as { suggestion?: string };
    if (obj.suggestion?.trim()) {
      await supabase
        .from("early_warnings")
        .update({ suggestion: obj.suggestion.trim() })
        .eq("id", warn.id);
      return NextResponse.json({ suggestion: obj.suggestion.trim() });
    }
  } catch {
    // fallthrough
  }
  return NextResponse.json({ error: "AI trả về định dạng không hợp lệ." });
}
