import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { fmtDateVN } from "@/lib/utils";

/**
 * GET/POST /api/cron/parent-digest - gui email tong hop tuan cho phu huynh.
 * Goi boi pg_cron (supabase) hoac Vercel Cron moi thu 2 sang.
 * Auth: header "authorization: Bearer <CRON_SECRET>" hoac ?secret=<CRON_SECRET>.
 * Neu CRON_SECRET chua dat -> 503 (route tat).
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron disabled" }, { status: 503 });
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const q = req.nextUrl.searchParams.get("secret");
  if (bearer !== secret && q !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceDate = since.toISOString().slice(0, 10);

  const [{ data: parents }, { data: links }, { data: students }] =
    await Promise.all([
      supabase.from("parents").select("id, full_name, email").not("email", "is", null),
      supabase.from("parent_students").select("parent_id, student_id"),
      supabase.from("students").select("id, full_name, class_id, classes(name)"),
    ]);

  if (!parents?.length || !links?.length) {
    return NextResponse.json({ sent: 0, reason: "no parents" });
  }

  const studentIds = links.map((l) => l.student_id);
  const [att, conduct, grades] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("student_id, date, status")
      .in("student_id", studentIds)
      .gte("date", sinceDate),
    supabase
      .from("conduct_records")
      .select("student_id, date, type, content, points")
      .in("student_id", studentIds)
      .gte("date", sinceDate),
    supabase
      .from("grades")
      .select("student_id, score, assessment_type, subjects(name)")
      .in("student_id", studentIds)
      .gte("created_at", since.toISOString()),
  ]);

  interface StudentRow {
    id: string;
    full_name: string;
    classes: { name: string }[] | { name: string } | null;
  }
  const studentById = new Map<string, StudentRow>(
    (students ?? []).map((s) => [s.id, s as unknown as StudentRow]),
  );
  const childrenOf = new Map<string, string[]>();
  for (const l of links) {
    childrenOf.set(l.parent_id, [...(childrenOf.get(l.parent_id) ?? []), l.student_id]);
  }
  const ATT_LABEL: Record<string, string> = {
    excused: "vắng có phép",
    unexcused: "vắng không phép",
    late: "đi muộn",
  };

  let sent = 0;
  let skipped = 0;
  let lastError: string | undefined;
  for (const p of parents) {
    if (!p.email?.trim()) continue;
    const kids = childrenOf.get(p.id) ?? [];
    if (!kids.length) continue;
    const sections: string[] = [];
    for (const sid of kids) {
      const st = studentById.get(sid);
      if (!st) continue;
      const className = Array.isArray(st.classes)
        ? st.classes[0]?.name
        : st.classes?.name;
      const lines: string[] = [
        `${st.full_name}${className ? ` - lớp ${className}` : ""}:`,
      ];
      const abs = (att.data ?? []).filter((r) => r.student_id === sid && r.status !== "present");
      if (abs.length) {
        lines.push(
          "  Điểm danh: " +
            abs.map((r) => `${fmtDateVN(r.date)} ${ATT_LABEL[r.status] ?? r.status}`).join("; "),
        );
      } else {
        lines.push("  Điểm danh: đi học đầy đủ.");
      }
      const cds = (conduct.data ?? []).filter((r) => r.student_id === sid);
      if (cds.length) {
        lines.push(
          "  Hạnh kiểm/nhận xét: " +
            cds
              .map((r) => `${fmtDateVN(r.date)} ${r.content}${r.points ? ` (${r.points}đ)` : ""}`)
              .join("; "),
        );
      }
      const gr = (grades.data ?? []).filter(
        (r) => r.student_id === sid && r.score != null,
      ) as unknown as { score: number; subjects: { name: string }[] | { name: string } | null }[];
      if (gr.length) {
        const subj = (s: { name: string }[] | { name: string } | null) =>
          Array.isArray(s) ? s[0]?.name : s?.name;
        lines.push(
          "  Điểm mới: " +
            gr.map((r) => `${subj(r.subjects) ?? "môn"}: ${r.score}`).join("; "),
        );
      }
      sections.push(lines.join("\n"));
    }

    const text = [
      `Kính gửi ${p.full_name},`,
      "",
      "Sổ Chủ Nhiệm Số xin gửi tình hình học tập của con trong 7 ngày qua:",
      "",
      ...sections,
      "",
      "Xem chi tiết và trao đổi với giáo viên tại cổng phụ huynh của nhà trường.",
      "Trân trọng.",
    ].join("\n");

    const r = await sendEmail({
      to: [p.email],
      subject: `[Sổ Chủ Nhiệm Số] Báo cáo tuần của con - tuần tới ${fmtDateVN(new Date().toISOString().slice(0, 10))}`,
      text,
    });
    if (r.skipped) skipped++;
    else sent += r.sent;
    if (r.error) lastError = r.error;
  }

  return NextResponse.json({ sent, skipped, parents: parents.length, error: lastError });
}

export const GET = run;
export const POST = run;
