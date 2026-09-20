import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";

/**
 * AI gợi ý phân công giảng dạy - dùng cho /school/assignments.
 * Tổng hợp GV theo môn + số lớp theo khối -> đề xuất phân bổ.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !["bgh", "pht"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [
    { data: teachers },
    { data: teacherSubjects },
    { data: subjects },
    { data: classes },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("school_id", sid)
      .in("role", ["gvcn", "gvbm"]),
    supabase.from("teacher_subjects").select("teacher_id,subject_id"),
    supabase.from("subjects").select("id,name").eq("school_id", sid),
    supabase
      .from("classes")
      .select("id,name")
      .eq("school_id", sid)
      .eq("status", "active"),
  ]);

  const subjName = new Map(
    ((subjects ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );
  const teacherIds = new Set(
    ((teachers ?? []) as { id: string }[]).map((t) => t.id),
  );
  const subjOf = new Map<string, string[]>();
  for (const ts of (teacherSubjects ?? []) as {
    teacher_id: string;
    subject_id: string;
  }[]) {
    if (!teacherIds.has(ts.teacher_id)) continue;
    const n = subjName.get(ts.subject_id);
    if (!n) continue;
    subjOf.set(ts.teacher_id, [...(subjOf.get(ts.teacher_id) ?? []), n]);
  }
  const facts = {
    giao_vien: ((teachers ?? []) as { id: string; full_name: string }[]).map(
      (t) => ({ ten: t.full_name, mon_day: subjOf.get(t.id) ?? [] }),
    ),
    lop: ((classes ?? []) as { name: string }[]).map((c) => c.name),
    mon_hoc: [...subjName.values()],
  };

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "assignment-suggest",
    system:
      "Bạn là trợ lý điều hành phân công giảng dạy cho BGH trường THCS. Đề xuất thực tế theo đội ngũ hiện có. Không emoji.",
    prompt: `Đề xuất phân công giảng dạy năm học từ số liệu (JSON): ${JSON.stringify(facts)}.

Viết 4-6 đề xuất: môn nào thừa/thiếu GV, phân bổ GV theo khối lớp hợp lý, GV kiêm nhiệm cần cân đối, lưu ý cho BGH. Mỗi đề xuất 1 dòng, nêu tên cụ thể, không đánh số.`,
    expectedShape: '{"lines": ["đề xuất 1", "đề xuất 2"]}',
    maxTokens: 1200,
    parse: (text) => {
      try {
        const o = JSON.parse(text) as { lines?: string[] };
        if (Array.isArray(o.lines) && o.lines.length) {
          return { lines: o.lines.filter((l) => typeof l === "string") };
        }
      } catch {
        /* fallthrough */
      }
      const lines = parseLines(text);
      return lines ? { lines } : null;
    },
  });
}
