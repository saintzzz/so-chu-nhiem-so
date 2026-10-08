import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseJsonObject } from "@/lib/ai-route";
import { hasAnyRole } from "@/lib/roles";

/**
 * AI sinh cau hoi theo mon + khoi + chu de - CR-041: tra ve dang AiRow
 * cua ngan hang cau hoi (/studio/questions) de chay qua pipeline chuan
 * (preview -> gan YCCD -> duyet). Khong tu ghi DB.
 */

interface RawQuestion {
  question: string;
  options?: string[];
  answer: string;
  solution?: string;
}

interface GenRow {
  stem: string;
  qtype: string;
  level: string;
  points: number;
  answer: string;
  solution: string;
  topic: string;
  subject: string;
  grade: number | null;
  standard_code: string;
}

const LEVEL_MAP: Record<string, string> = {
  "nhận biết": "biet",
  "trung bình": "hieu",
  "thông hiểu": "hieu",
  "vận dụng": "van_dung",
  "vận dụng cao": "van_dung_cao",
  biet: "biet",
  hieu: "hieu",
  van_dung: "van_dung",
  van_dung_cao: "van_dung_cao",
};

export async function POST(req: Request) {
  const profile = await getProfile();
  if (
    !profile ||
    !hasAnyRole(profile, ["gvcn", "gvbm", "to_truong", "bgh"])
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  let subject = "";
  let grade = 0;
  let topic = "";
  let count = 5;
  let level = "hieu";
  let kind = "trac_nghiem";
  try {
    const body = (await req.json()) as {
      subject?: string;
      grade?: number | string;
      topic?: string;
      count?: number;
      level?: string;
      kind?: string;
    };
    subject = (body.subject ?? "").trim();
    grade = Math.min(Math.max(Number(body.grade) || 0, 1), 12);
    topic = (body.topic ?? "").trim();
    count = Math.min(Math.max(Number(body.count) || 5, 1), 15);
    level = LEVEL_MAP[(body.level ?? "").trim().toLowerCase()] ?? "hieu";
    kind = body.kind === "tu_luan" ? "tu_luan" : "trac_nghiem";
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }
  if (!subject || !topic || !grade) {
    return NextResponse.json(
      { error: "Cần chọn môn, khối lớp và nhập chủ đề." },
      { status: 400 },
    );
  }

  const qtype = kind === "trac_nghiem" ? "multiple_choice" : "essay";
  const supabase = await createClient();
  return respondWithAi<{ rows: GenRow[] }>({
    req,
    supabase,
    profile,
    kind: "gen-questions",
    system:
      "Bạn là giáo viên trường phổ thông Việt Nam ra đề theo chương trình GDPT 2018. Câu hỏi rõ ràng, có đáp án đúng. Chỉ trả về JSON hợp lệ.",
    prompt: `Sinh ${count} câu hỏi ${kind === "trac_nghiem" ? "trắc nghiệm 4 phương án (A-D)" : "tự luận"} môn ${subject} lớp ${grade}, chủ đề "${topic}", mức độ ${level}.

Trả về CHỈ JSON {"questions": [{"question": "...", ${kind === "trac_nghiem" ? '"options": ["A. ...","B. ...","C. ...","D. ..."], ' : '"solution": "loi giai chi tiet, huong dan cham", '}"answer": "..."${kind === "trac_nghiem" ? ' (chi la "A"/"B"/"C"/"D")' : ""}, "standard_code": "ma YCCD chuong trinh GDPT2018 neu biet, vi du TOAN6.1.1 - de "" neu khong chac"}], không markdown.`,
    expectedShape:
      '{"questions":[{"question":"...","options":["A.","B.","C.","D."],"answer":"A","standard_code":""}]}',
    maxTokens: 4000,
    parse: (text) => {
      const o = parseJsonObject(text);
      const qs = o?.questions;
      if (!Array.isArray(qs) || !qs.length) return null;
      const rows = qs
        .filter(
          (q): q is RawQuestion =>
            typeof q === "object" &&
            q !== null &&
            typeof (q as RawQuestion).question === "string" &&
            typeof (q as RawQuestion).answer === "string",
        )
        .slice(0, count)
        .map((q) => {
          const stem =
            kind === "trac_nghiem" && Array.isArray(q.options) && q.options.length
              ? `${q.question}\n${q.options.join("\n")}`
              : q.question;
          return {
            stem,
            qtype,
            level,
            points: 1,
            // validator ngan hang yeu cau dap an MC la 1 chu A-D -
            // AI doi khi tra "A. ..." -> cat con 1 ky tu
            answer:
              kind === "trac_nghiem"
                ? (q.answer.trim().match(/^[A-Da-d]/)?.[0].toUpperCase() ?? q.answer.trim())
                : q.answer.trim(),
            solution: (q.solution ?? (kind === "tu_luan" ? q.answer : "")).trim(),
            topic,
            subject,
            grade,
            standard_code:
              typeof (q as RawQuestion & { standard_code?: string }).standard_code === "string"
                ? (q as RawQuestion & { standard_code: string }).standard_code.trim()
                : "",
          };
        });
      return rows.length ? { rows } : null;
    },
  });
}
