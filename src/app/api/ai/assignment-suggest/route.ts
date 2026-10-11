import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { respondWithAi, parseLines } from "@/lib/ai-route";
import { minimizeDeep, mergePiiNames } from "@/lib/ai-privacy";
import { schoolPiiNames } from "@/lib/ai-pii-roster";
import { hasAnyRole } from "@/lib/roles";

/**
 * AI gợi ý phân công giảng dạy - dùng cho /school/assignments.
 * Tổng hợp GV theo môn + số lớp theo khối -> đề xuất phân bổ.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || !hasAnyRole(profile, ["bgh", "pht"])) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  // r14 M: loi nguon KHONG duoc bien thanh du lieu rong - AI chay tren
  // facts thieu se de xuat sai (mat mon day, mat lop).
  const [
    { data: teachers, error: tErr },
    { data: teacherSubjects, error: tsErr },
    { data: subjects, error: sjErr },
    { data: classes, error: cErr },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("school_id", sid)
      .or("role.in.(gvcn,gvbm),concurrent_roles.ov.{gvcn,gvbm}"),
    supabase.from("teacher_subjects").select("teacher_id,subject_id"),
    supabase.from("subjects").select("id,name").eq("school_id", sid),
    supabase
      .from("classes")
      .select("id,name")
      .eq("school_id", sid)
      .eq("status", "active"),
  ]);
  if (tErr || tsErr || sjErr || cErr) {
    console.error(
      "[ai/assignment-suggest] sources:",
      (tErr ?? tsErr ?? sjErr ?? cErr)?.message,
    );
    return NextResponse.json(
      { error: "Không tải đủ dữ liệu nguồn." },
      { status: 500 },
    );
  }

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
  // CR-049 P3b: an danh hoa ten GV bang alias GVxx - provider khong
  // thay ten that; output duoc deanonymizeNames khoi phuc trong
  // respondWithAi truoc khi parse.
  const names = ((teachers ?? []) as { id: string; full_name: string }[]).map(
    (t, i) => ({ name: t.full_name, alias: `GV${String(i + 1).padStart(2, "0")}` }),
  );
  const facts = {
    giao_vien: ((teachers ?? []) as { id: string; full_name: string }[]).map(
      (t, i) => ({ ten: `GV${String(i + 1).padStart(2, "0")}`, mon_day: subjOf.get(t.id) ?? [] }),
    ),
    lop: ((classes ?? []) as { name: string }[]).map((c) => c.name),
    mon_hoc: [...subjName.values()],
  };

  // r15 M: ten lop/mon la chuoi DB tuy y - co the chua ten nguoi NGOAI
  // map GV (vd ten HS trong ten lop). Minimize theo roster truong day
  // du; alias nghiep vu GVxx giu nguyen de deanon dung.
  const roster = await schoolPiiNames(sid);
  if (roster.error) {
    return NextResponse.json(
      { error: "Không tải được dữ liệu nguồn, thử lại sau." },
      { status: 500 },
    );
  }
  const allNames = mergePiiNames(names, roster.names);

  return respondWithAi<{ lines: string[] }>({
    req,
    supabase,
    profile,
    kind: "assignment-suggest",
    system:
      "Bạn là trợ lý điều hành phân công giảng dạy cho BGH trường THCS. Đề xuất thực tế theo đội ngũ hiện có. Không emoji.",
    prompt: `Đề xuất phân công giảng dạy năm học từ số liệu (JSON): ${JSON.stringify(minimizeDeep(facts, allNames))}.

Viết 4-6 đề xuất: môn nào thừa/thiếu GV, phân bổ GV theo khối lớp hợp lý, GV kiêm nhiệm cần cân đối, lưu ý cho BGH. Mỗi đề xuất 1 dòng, dùng mã GV (GV01, GV02...), không đánh số.`,
    expectedShape: '{"lines": ["đề xuất 1", "đề xuất 2"]}',
    maxTokens: 1200,
    // r12 H3: facts embed alias GVxx san -> ten that chi co trong
    // teachers, phai khai bao source de usedNames bat duoc (deanon
    // dung pham vi, chan inject alias).
    pii: { names: allNames, source: { teachers, facts } },
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
