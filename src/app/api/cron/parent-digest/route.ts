import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { fmtDateVN, isoDateVN, todayVN } from "@/lib/utils";

/**
 * GET/POST /api/cron/parent-digest - gui email tong hop tuan cho phu huynh.
 * Goi boi pg_cron (supabase) hoac Vercel Cron moi thu 2 sang.
 * Auth: header "authorization: Bearer <CRON_SECRET>" (header-only - khong nhan
 * ?secret= vi query string rot vao access log / proxy log).
 * Neu CRON_SECRET chua dat -> 503 (route tat).
 *
 * CR-034: keyset paging tren parents.id - PostgREST cat ngam o 1000 rows,
 * chunk 500 PH/lan de .in(student_id) khong vuot gioi han URL; lookup Map
 * thay filter O(P*K*N).
 */
const CHUNK = 500;
const MAX_CHUNKS = 40; // 20k PH/lan chay - du margin; cron goi lai neu can

const ATT_LABEL: Record<string, string> = {
  excused: "vắng có phép",
  unexcused: "vắng không phép",
  late: "đi muộn",
};

interface ParentRow { id: string; full_name: string; email: string | null }
interface StudentRow {
  id: string;
  full_name: string;
  classes: { name: string }[] | { name: string } | null;
}

type Admin = ReturnType<typeof createAdminClient>;
type FilterQ = ReturnType<ReturnType<Admin["from"]>["select"]>;

async function pageTable<T>(
  supabase: Admin,
  table: string,
  select: string,
  apply?: (q: FilterQ) => FilterQ,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select) as unknown as FilterQ;
    if (apply) q = apply(q);
    const { data, error } = await q.range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron disabled" }, { status: 503 });
  }
  const match = (v: string | null | undefined) =>
    v?.length === secret.length && timingSafeEqual(Buffer.from(v), Buffer.from(secret));
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!match(bearer)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceDate = isoDateVN(since);

  const runId = crypto.randomUUID();
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoDateVN(d);
  })();

  // CR-021: idempotent - ph da gui thanh cong tuan nay khong gui lai.
  // ?retry=<run_id> chi gui lai cho ph failed/skipped cua run do, tang attempts.
  const retryRun = req.nextUrl.searchParams.get("retry");
  let retryParents: Set<string> | null = null;
  const prevAttempts = new Map<string, number>();
  let sentThisWeek = new Set<string>();
  if (retryRun) {
    const prev = await pageTable<{ parent_id: string; attempts: number }>(
      supabase, "digest_deliveries", "parent_id, attempts",
      (q) => q.eq("run_id", retryRun).in("status", ["failed", "skipped"]),
    );
    retryParents = new Set(prev.map((r) => r.parent_id));
    for (const r of prev) prevAttempts.set(r.parent_id, r.attempts);
  } else {
    const done = await pageTable<{ parent_id: string }>(
      supabase, "digest_deliveries", "parent_id",
      (q) => q.eq("week_start", weekStart).eq("status", "sent"),
    );
    sentThisWeek = new Set(done.map((r) => r.parent_id));
  }

  const subject = `[Sổ Chủ Nhiệm Số] Báo cáo tuần của con - tuần tới ${fmtDateVN(todayVN())}`;
  let sent = 0, skipped = 0, failed = 0, parentsTotal = 0, chunks = 0;
  let lastError: string | undefined;
  let lastParentId = "";

  // Keyset paging tren parents.id - khong bi cat 1000, khong offset scan
  for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
    const { data: parents } = await supabase
      .from("parents")
      .select("id, full_name, email")
      .not("email", "is", null)
      .not("email", "ilike", "%@demo.scn")
      .gt("id", lastParentId || "00000000-0000-0000-0000-000000000000")
      .order("id")
      .limit(CHUNK);
    if (!parents?.length) break;
    chunks++;
    lastParentId = parents[parents.length - 1].id;

    const parentIds = (parents as ParentRow[]).map((p) => p.id);
    const { data: links } = await supabase
      .from("parent_students")
      .select("parent_id, student_id")
      .in("parent_id", parentIds);
    if (!links?.length) continue;

    const studentIds = [...new Set(links.map((l) => l.student_id as string))];
    const [{ data: students }, att, conduct, grades] = await Promise.all([
      supabase.from("students").select("id, full_name, class_id, classes(name)").in("id", studentIds),
      supabase.from("attendance_records").select("student_id, date, status").in("student_id", studentIds).gte("date", sinceDate),
      supabase.from("conduct_records").select("student_id, date, type, content, points").in("student_id", studentIds).gte("date", sinceDate),
      supabase.from("grades").select("student_id, score, assessment_type, subjects(name)").in("student_id", studentIds).gte("created_at", since.toISOString()),
    ]);

    // Map thay filter long nhau (O(N) thay vi O(P*K*N))
    const studentById = new Map<string, StudentRow>(
      (students ?? []).map((s) => [s.id as string, s as unknown as StudentRow]),
    );
    const childrenOf = new Map<string, string[]>();
    for (const l of links) {
      const a = childrenOf.get(l.parent_id) ?? [];
      a.push(l.student_id);
      childrenOf.set(l.parent_id, a);
    }
    const bySid = <T extends { student_id: string }>(rows: T[] | null) => {
      const m = new Map<string, T[]>();
      for (const r of rows ?? []) {
        const a = m.get(r.student_id) ?? [];
        a.push(r);
        m.set(r.student_id, a);
      }
      return m;
    };
    const attBySid = bySid(att.data);
    const condBySid = bySid(conduct.data);
    const gradeBySid = bySid(grades.data);

    const jobs: { parentId: string; email: string; text: string }[] = [];
    for (const p of parents as ParentRow[]) {
      if (retryParents ? !retryParents.has(p.id) : sentThisWeek.has(p.id)) continue;
      if (!p.email?.trim()) continue;
      const kids = childrenOf.get(p.id) ?? [];
      if (!kids.length) continue;
      parentsTotal++;
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
        const abs = (attBySid.get(sid) ?? []).filter((r) => r.status !== "present");
        if (abs.length) {
          lines.push(
            "  Điểm danh: " +
              abs.map((r) => `${fmtDateVN(r.date)} ${ATT_LABEL[r.status] ?? r.status}`).join("; "),
          );
        } else {
          lines.push("  Điểm danh: đi học đầy đủ.");
        }
        const cds = condBySid.get(sid) ?? [];
        if (cds.length) {
          lines.push(
            "  Hạnh kiểm/nhận xét: " +
              cds.map((r) => `${fmtDateVN(r.date)} ${r.content}${r.points ? ` (${r.points}đ)` : ""}`).join("; "),
          );
        }
        const gr = (gradeBySid.get(sid) ?? []).filter((r) => r.score != null) as
          unknown as { score: number; subjects: { name: string }[] | { name: string } | null }[];
        if (gr.length) {
          const subj = (s: { name: string }[] | { name: string } | null) =>
            Array.isArray(s) ? s[0]?.name : s?.name;
          lines.push("  Điểm mới: " + gr.map((r) => `${subj(r.subjects) ?? "môn"}: ${r.score}`).join("; "));
        }
        sections.push(lines.join("\n"));
      }
      if (!sections.length) continue;

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
      jobs.push({ parentId: p.id, email: p.email, text });
    }

    const CONCURRENCY = 10;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      const batch = jobs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((j) => sendEmail({ to: [j.email], subject, text: j.text })),
      );
      const deliveries = batch.map((j, k) => {
        const r = results[k];
        const status = r.skipped ? "skipped" : r.error ? "failed" : "sent";
        if (r.skipped) skipped++;
        else if (r.error) failed++;
        else sent += r.sent;
        if (r.error) lastError = r.error;
        return {
          run_id: runId,
          parent_id: j.parentId,
          email: j.email,
          week_start: weekStart,
          status,
          error: r.error?.slice(0, 500) ?? null,
          attempts: (prevAttempts.get(j.parentId) ?? 0) + 1,
        };
      });
      await supabase.from("digest_deliveries").insert(deliveries);
    }
    if (parents.length < CHUNK) break;
  }

  return NextResponse.json({
    run_id: runId,
    sent,
    failed,
    skipped,
    parents: parentsTotal,
    chunks,
    truncated: chunks >= MAX_CHUNKS,
    error: lastError,
  });
}

export const GET = run;
export const POST = run;
export const maxDuration = 300;
