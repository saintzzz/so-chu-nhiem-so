import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
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
// Auto-retry: moi run tu dong gui lai cho PH co delivery failed/skipped
// trong tuan nay (khong can ?retry=), toi da MAX_ATTEMPTS lan/PH/tuan.
// `?retry=<run_id>` van co san de force retry thu cong (bo qua cap).
const MAX_ATTEMPTS = 3;
// CR-049 P3d: durable outbox - enqueue ghi snapshot body vao
// digest_outbox; send claim bang SKIP LOCKED va dung khi gan deadline,
// run sau tiep tuc khong scan lai.
const SEND_DEADLINE_MS = 240_000;
const CLAIM_BATCH = 25;
const SEND_CONCURRENCY = 10;

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

  // CR-049 P3d: ?phase=enqueue (ghi queue) | send (drain queue) |
  // all (mac dinh - enqueue roi send trong cung invocation; cron weekly
  // giu nguyen hanh vi nhung durable).
  const phase = req.nextUrl.searchParams.get("phase") ?? "all";
  const subject = `[Sổ Chủ Nhiệm Số] Báo cáo tuần của con - tuần tới ${fmtDateVN(todayVN())}`;

  if (phase === "send") {
    return sendPhase(supabase, runId, weekStart);
  }

  // CR-021: idempotent - ph da gui thanh cong tuan nay khong gui lai.
  // ?retry=<run_id> chi gui lai cho ph failed/skipped cua run do, tang attempts.
  const retryRun = req.nextUrl.searchParams.get("retry");
  let retryParents: Set<string> | null = null;
  const prevAttempts = new Map<string, number>();
  let sentThisWeek = new Set<string>();
  // fetchAllRows tra error thay vi nuot - query loi phai dung run, khong gui
  // email khi thieu du lieu nguon.
  if (retryRun) {
    const prev = await fetchAllRows<{ parent_id: string; attempts: number }>(
      (f, t) =>
        supabase
          .from("digest_deliveries")
          .select("parent_id, attempts")
          .eq("run_id", retryRun)
          .in("status", ["failed", "skipped"])
          .order("id")
          .range(f, t),
    );
    if (prev.error) {
      console.error("[parent-digest] retry lookup failed:", prev.error);
      return NextResponse.json({ error: "delivery lookup failed" }, { status: 500 });
    }
    retryParents = new Set(prev.rows.map((r) => r.parent_id));
    for (const r of prev.rows) prevAttempts.set(r.parent_id, r.attempts);
  } else {
    // Load tat ca deliveries tuan nay: sent => bo qua; failed/skipped =>
    // auto-retry neu attempts < MAX_ATTEMPTS (cong don attempts tu run truoc).
    const all = await fetchAllRows<{
      parent_id: string;
      status: string;
      attempts: number;
      delivery_event: string | null;
    }>(
      (f, t) =>
        supabase
          .from("digest_deliveries")
          .select("parent_id, status, attempts, delivery_event")
          .eq("week_start", weekStart)
          .order("id")
          .range(f, t),
    );
    if (all.error) {
      console.error("[parent-digest] sent-this-week lookup failed:", all.error);
      return NextResponse.json({ error: "delivery lookup failed" }, { status: 500 });
    }
    // 'sent' hoac event terminal (bounced/complained - webhook Resend)
    // deu khong gui lai. bounced/complained = dia chi hong/spam report,
    // gui tiep chi lam xau sender reputation.
    const TERMINAL_EVENTS = new Set(["bounced", "complained", "delivered"]);
    sentThisWeek = new Set(
      all.rows
        .filter(
          (r) =>
            r.status === "sent" ||
            (r.delivery_event ? TERMINAL_EVENTS.has(r.delivery_event) : false),
        )
        .map((r) => r.parent_id),
    );
    for (const r of all.rows) {
      prevAttempts.set(
        r.parent_id,
        Math.max(prevAttempts.get(r.parent_id) ?? 0, r.attempts),
      );
    }
    // CR-049 P3d: PH da co outbox row tuan nay (queued/sending/sent)
    // khong enqueue lai; 'failed' con han retry duoc requeue o sendPhase.
    const ob = await fetchAllRows<{ parent_id: string; status: string }>(
      (f, t) =>
        supabase
          .from("digest_outbox")
          .select("parent_id, status")
          .eq("week_start", weekStart)
          .in("status", ["queued", "sending", "sent"])
          .order("id")
          .range(f, t),
    );
    if (!ob.error) {
      for (const r of ob.rows) sentThisWeek.add(r.parent_id);
    }
  }

  let parentsTotal = 0, chunks = 0;
  // Loi nguon du lieu / log delivery: run phai tra 5xx de scheduler biet
  // retry - khong tra 200 (scheduler se ghi nhan thanh cong sai).
  let fatalError: string | undefined;
  let lastParentId = "";

  // Keyset paging tren parents.id - khong bi cat 1000, khong offset scan
  for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
    const { data: parents, error: parentsErr } = await supabase
      .from("parents")
      .select("id, full_name, email")
      .not("email", "is", null)
      .not("email", "ilike", "%.scn")
      .gt("id", lastParentId || "00000000-0000-0000-0000-000000000000")
      .order("id")
      .limit(CHUNK);
    if (parentsErr) {
      fatalError = "parents query failed";
      console.error("[parent-digest] parents query failed:", parentsErr);
      break;
    }
    if (!parents?.length) break;
    chunks++;
    lastParentId = parents[parents.length - 1].id;

    const parentIds = (parents as ParentRow[]).map((p) => p.id);
    // 500 PH/chunk co the co >1000 con - phai paginate, khong de PostgREST
    // cat ngam o 1000 (lam email thieu HS). parent_students khong co cot id:
    // order composite (parent_id, student_id) de paging on dinh.
    const linksRes = await fetchAllRows<{
      parent_id: string;
      student_id: string;
    }>((f, t) =>
      supabase
        .from("parent_students")
        .select("parent_id, student_id")
        .in("parent_id", parentIds)
        .order("parent_id")
        .order("student_id")
        .range(f, t),
    );
    if (linksRes.error || linksRes.truncated) {
      fatalError = "parent_students query failed";
      console.error(
        "[parent-digest] parent_students query failed:",
        linksRes.error ?? "truncated at maxRows",
      );
      break;
    }
    const links = linksRes.rows;
    if (!links.length) continue;

    // R2-07: query con cua chunk truoc day khong .range() -> PostgREST cat
    // ngam o 1000 rows va email bao cao thieu du lieu. fetchAllRows doc het;
    // loi/truncate => dung run, khong gui email thieu du lieu.
    const studentIds = [...new Set(links.map((l) => l.student_id as string))];
    const [studentsRes, att, conduct, grades] = await Promise.all([
      fetchAllRows<{ id: string }>((f, t) =>
        supabase.from("students").select("id, full_name, class_id, classes(name)").in("id", studentIds).order("id").range(f, t),
      ),
      fetchAllRows<{ student_id: string; date: string; status: string }>((f, t) =>
        supabase.from("attendance_records").select("student_id, date, status").in("student_id", studentIds).gte("date", sinceDate).order("id").range(f, t),
      ),
      fetchAllRows<{ student_id: string; date: string; type: string; content: string; points: number | null }>((f, t) =>
        supabase.from("conduct_records").select("student_id, date, type, content, points").in("student_id", studentIds).gte("date", sinceDate).order("id").range(f, t),
      ),
      fetchAllRows<{ student_id: string; score: number | null; assessment_type: string; subjects: { name: string }[] | { name: string } | null }>((f, t) =>
        supabase.from("grades").select("student_id, score, assessment_type, subjects(name)").in("student_id", studentIds).gte("created_at", since.toISOString()).order("id").range(f, t),
      ),
    ]);
    const students = studentsRes.rows;
    const chunkError =
      studentsRes.error ??
      att.error ??
      conduct.error ??
      grades.error ??
      (studentsRes.truncated || att.truncated || conduct.truncated || grades.truncated
        ? "query results truncated at maxRows"
        : null);
    if (chunkError) {
      fatalError = "student data query failed";
      console.error("[parent-digest] chunk data query failed:", chunkError);
      break;
    }

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
    const attBySid = bySid(att.rows);
    const condBySid = bySid(conduct.rows);
    const gradeBySid = bySid(grades.rows);

    const outboxRows: {
      week_start: string;
      parent_id: string;
      email: string;
      subject: string;
      body: string;
      status: string;
      attempts: number;
    }[] = [];
    for (const p of parents as ParentRow[]) {
      if (retryParents ? !retryParents.has(p.id) : sentThisWeek.has(p.id)) continue;
      // Auto-retry cap: khong retry qua MAX_ATTEMPTS lan/PH/tuan (tru
      // mode ?retry= thu cong). Dung so lan gui lon nhat da ghi.
      if (!retryParents && (prevAttempts.get(p.id) ?? 0) >= MAX_ATTEMPTS) continue;
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
            "  Rèn luyện/nhận xét: " +
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
      outboxRows.push({
        week_start: weekStart,
        parent_id: p.id,
        email: p.email,
        subject,
        body: text,
        status: "queued",
        // Cong don attempts tu deliveries truoc - cap MAX_ATTEMPTS giu
        // nguyen xuyen retry (claim se +1 moi lan nhan).
        attempts: prevAttempts.get(p.id) ?? 0,
      });
    }

    // CR-049 P3d: enqueue - ghi snapshot vao outbox (idempotent qua
    // unique(week_start,parent_id), retry sau khong dup).
    for (let i = 0; i < outboxRows.length; i += CHUNK) {
      const { error: obErr } = await supabase
        .from("digest_outbox")
        .upsert(outboxRows.slice(i, i + CHUNK), {
          onConflict: "week_start,parent_id",
          ignoreDuplicates: true,
        });
      if (obErr) {
        fatalError = "outbox insert failed";
        console.error("[parent-digest] digest_outbox insert failed:", obErr);
        break;
      }
    }
    if (fatalError) break;
    if (parents.length < CHUNK) break;
  }

  if (fatalError) {
    // 5xx: scheduler/pg_cron ghi nhan loi va retry. Khong echo message DB
    // ra response (co the chua thong tin loc/PII); chi tra nhan loi chung
    // + counters + run_id de doi chieu log server.
    return NextResponse.json(
      {
        run_id: runId,
        error: fatalError,
        enqueued: parentsTotal,
        chunks,
      },
      { status: 500 },
    );
  }

  // phase=all -> drain queue ngay trong cung invocation;
  // phase=enqueue -> chi ghi queue, send chay o invocation rieng.
  if (phase === "enqueue") {
    return NextResponse.json({
      run_id: runId,
      phase: "enqueue",
      enqueued: parentsTotal,
      chunks,
      truncated: chunks >= MAX_CHUNKS,
    });
  }
  const sendRes = await sendPhase(supabase, runId, weekStart);
  const sendBody = (await sendRes.json()) as Record<string, unknown>;
  return NextResponse.json({
    run_id: runId,
    enqueued: parentsTotal,
    chunks,
    truncated: chunks >= MAX_CHUNKS,
    ...sendBody,
  });
}

/**
 * Drain digest_outbox theo deadline: claim batch (SKIP LOCKED), gui,
 * update status tung row + ghi digest_deliveries (audit + webhook
 * provider_id chain giu nguyen). Het deadline -> done:false, run sau
 * tiep tuc khong scan lai (starvation-free).
 */
async function sendPhase(
  supabase: ReturnType<typeof createAdminClient>,
  runId: string,
  weekStart: string,
) {
  const deadline = Date.now() + SEND_DEADLINE_MS;
  let sent = 0, failed = 0, skipped = 0, batches = 0;

  // Requeue: 'sending' cu (worker chet giua chung) + 'failed' con han.
  const { data: requeued } = await supabase.rpc("scn_digest_outbox_requeue", {
    p_week_start: weekStart,
    p_max_attempts: MAX_ATTEMPTS,
  });

  while (Date.now() < deadline) {
    const { data: claimed, error: claimErr } = await supabase.rpc(
      "scn_digest_outbox_claim",
      { p_limit: CLAIM_BATCH },
    );
    if (claimErr) {
      console.error("[parent-digest] outbox claim failed:", claimErr);
      return NextResponse.json(
        { error: "outbox claim failed", sent, failed, skipped },
        { status: 500 },
      );
    }
    if (!claimed?.length) {
      return NextResponse.json({
        run_id: runId,
        done: true,
        sent,
        failed,
        skipped,
        batches,
        requeued: requeued ?? 0,
        delivery_errors: failed || undefined,
      });
    }
    batches++;

    for (let i = 0; i < claimed.length; i += SEND_CONCURRENCY) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      const batch = claimed.slice(i, i + SEND_CONCURRENCY) as {
        id: string;
        parent_id: string;
        email: string;
        subject: string;
        body: string;
        attempts: number;
      }[];
      const results = await Promise.all(
        batch.map((j) => sendEmail({ to: [j.email], subject: j.subject, text: j.body })),
      );
      const deliveries: Record<string, unknown>[] = [];
      for (let k = 0; k < batch.length; k++) {
        const j = batch[k];
        const r = results[k];
        const status = r.skipped ? "skipped" : r.error ? "failed" : "sent";
        if (r.skipped) skipped++;
        else if (r.error) failed++;
        else sent += r.sent;
        if (r.error) {
          console.error("[parent-digest] send failed for parent:", j.parent_id, r.error);
        }
        deliveries.push({
          run_id: runId,
          parent_id: j.parent_id,
          email: j.email,
          week_start: weekStart,
          status,
          error: r.error?.slice(0, 500) ?? null,
          attempts: j.attempts,
          provider_id: r.ids?.[j.email] ?? null,
        });
        const { error: updErr } = await supabase
          .from("digest_outbox")
          .update({
            status,
            last_error: r.error?.slice(0, 500) ?? null,
            provider_id: r.ids?.[j.email] ?? null,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", j.id);
        if (updErr) {
          console.error("[parent-digest] outbox status update failed:", updErr);
        }
      }
      // Khong ghi duoc delivery log => lan chay sau se gui trung email.
      // Dung run ngay, tra 5xx de scheduler retry thay vi tiep tuc gui
      // khong tracking.
      const { error: delErr } = await supabase
        .from("digest_deliveries")
        .insert(deliveries);
      if (delErr) {
        console.error("[parent-digest] digest_deliveries insert failed:", delErr);
        return NextResponse.json(
          { error: "delivery log insert failed", sent, failed, skipped },
          { status: 500 },
        );
      }
    }
  }

  // Het deadline - queue con lai, run sau tiep tuc (durable).
  return NextResponse.json({
    run_id: runId,
    done: false,
    sent,
    failed,
    skipped,
    batches,
    requeued: requeued ?? 0,
    delivery_errors: failed || undefined,
  });
}

export const GET = run;
export const POST = run;
export const maxDuration = 300;
