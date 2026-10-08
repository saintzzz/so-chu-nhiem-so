import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";
import { khbdHasContent, parseKhbd } from "@/lib/khbd";

/**
 * AI hỗ trợ giáo án:
 *  - mode "outline": GV nhập môn + tên bài -> sinh dàn ý giáo án điền vào form
 *  - mode "review": tổ trưởng/BGH -> gợi ý nhận xét khi duyệt
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !["gvcn", "gvbm", "to_truong", "bgh", "pht"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let mode = "outline";
  let subject = "";
  let title = "";
  let content = "";
  try {
    const body = (await req.json()) as {
      mode?: string;
      subject?: string;
      title?: string;
      content?: string;
    };
    mode = body.mode === "review" ? "review" : "outline";
    subject = (body.subject ?? "").trim();
    title = (body.title ?? "").trim();
    content = (body.content ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json(
      { error: "Cần tên bài dạy trước." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (mode === "outline") {
    return respondWithAi<{ sections: unknown }>({
      req,
      supabase,
      profile,
      kind: "lesson-plan-outline",
      system:
        "Bạn là giáo viên trường phổ thông Việt Nam soạn kế hoạch bài dạy theo Công văn 5512 và CTGDPT 2018 (khởi động - khám phá - luyện tập - vận dụng). Chỉ trả về JSON hợp lệ.",
      prompt: `Soạn giáo án theo biểu mẫu:
- Môn: ${subject || "chưa rõ"}
- Bài: ${title}

Trả về CHỈ JSON đúng schema sau (moi gia tri la chuoi, khong markdown):
{"sections": {
  "muc_tieu_kien_thuc": "...",
  "muc_tieu_nang_luc": "...",
  "muc_tieu_pham_chat": "...",
  "thiet_bi_gv": "...",
  "thiet_bi_hs": "...",
  "khoi_dong": {"muc_tieu":"...","to_chuc":"...","san_pham":"...","danh_gia":"..."},
  "kham_pha": {"muc_tieu":"...","to_chuc":"...","san_pham":"...","danh_gia":"..."},
  "luyen_tap": {"muc_tieu":"...","to_chuc":"...","san_pham":"...","danh_gia":"..."},
  "van_dung": {"muc_tieu":"...","to_chuc":"...","san_pham":"...","danh_gia":"..."},
  "dieu_chinh": "..."
}}

Huong dan: to_chuc viet dang gach dau dong "GV ..." / "HS ..." theo tung buoc. Khong bia noi dung bai hoc ngoai ten bai - neu thieu du kien, viet khung goi y de GV dien.`,
      expectedShape: '{"sections": {"muc_tieu_kien_thuc": "..."}}',
      maxTokens: 3500,
      parse: (text) => {
        const o = parseJsonObject(text);
        const s =
          o && typeof o === "object"
            ? (o as Record<string, unknown>).sections
            : null;
        // Validate dung schema KHBD - {"sections":{}} hoac field sai kieu
        // khong duoc tin la thanh cong (client se tu plan rong).
        const k = parseKhbd(s);
        if (!k || !khbdHasContent(k)) return null;
        return { sections: k };
      },
    });
  }

  // review mode
  if (!content) {
    return NextResponse.json(
      { error: "Giáo án chưa có nội dung để nhận xét." },
      { status: 400 },
    );
  }
  return respondWithAi<{ note: string }>({
    req,
    supabase,
    profile,
    kind: "lesson-plan-review",
    system:
      "Bạn là tổ trưởng chuyên môn nhận xét giáo án đồng nghiệp - góp ý xây dựng, nhắc phần còn thiếu. Chỉ trả về JSON hợp lệ.",
    prompt: `Nhận xét giáo án sau (môn ${subject || "chưa rõ"}, bài "${title}"):
---
${content.slice(0, 4000)}
---

Yêu cầu: 2-4 câu nhận xét - điểm tốt, phần còn thiếu (mục tiêu, hoạt động, đánh giá), gợi ý cải thiện. Nếu giáo án đủ tốt thì ghi nhận và đề xuất duyệt.

Trả về CHỈ JSON {"note": "..."}, không markdown.`,
    expectedShape: '{"note": "Nhận xét duyệt giáo án"}',
    maxTokens: 800,
    parse: (text) => {
      const o = parseJsonObject(text);
      if (!o || typeof o.note !== "string" || !o.note.trim()) return null;
      return { note: o.note.trim() };
    },
  });
}
