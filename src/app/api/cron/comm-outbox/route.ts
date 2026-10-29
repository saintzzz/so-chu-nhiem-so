import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { adapterFor } from "@/lib/comm/providers";

/**
 * GET/POST /api/cron/comm-outbox - drain der kanalneutralen PH-Outbox
 * (CR-069). Auth: "authorization: Bearer <CRON_SECRET>".
 *
 * Ablauf: requeue stuck -> claim SKIP LOCKED -> Adapter send ->
 * sent | retry mit Backoff (2^attempts min) | dead nach MAX_ATTEMPTS |
 * blocked_no_config wenn Provider nicht konfiguriert (kein Fake!).
 */
const CLAIM_BATCH = 50;
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "disabled" }, { status: 503 });
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (
    !bearer ||
    bearer.length !== secret.length ||
    !timingSafeEqual(Buffer.from(bearer), Buffer.from(secret))
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { error: rqErr } = await supabase.rpc("comm_outbox_requeue_stuck", {
    p_older_than: "15 minutes",
  });
  if (rqErr) console.error("[comm-outbox] requeue:", rqErr.message);
  const { data: rows, error } = await supabase.rpc("comm_outbox_claim", {
    p_limit: CLAIM_BATCH,
  });
  if (error) {
    console.error("[comm-outbox] claim:", error.message);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }
  const stats = { claimed: rows?.length ?? 0, sent: 0, failed: 0, blocked: 0, dead: 0 };

  for (const row of rows ?? []) {
    const adapter = adapterFor(row.channel);
    const { _providerTemplateId, ...tplData } = (row.payload ?? {}) as Record<string, unknown>;
    const result = adapter
      ? await adapter({
          channel: row.channel,
          recipientRef: row.recipient_ref,
          templateName: row.template_name,
          providerTemplateId: (_providerTemplateId as string) ?? null,
          payload: tplData,
        })
      : { failKind: "no_config" as const, errorLabel: "channel email" };

    // CAS: nur solange die Row noch 'sending' ist umschreiben - ein
    // zwischenzeitlich gecanceltes/requeued row bleibt unberuehrt.
    const settle = async (patch: Record<string, unknown>) => {
      const { error: upErr, data: upd } = await supabase
        .from("comm_outbox")
        .update(patch)
        .eq("id", row.id)
        .eq("status", "sending")
        .select("id");
      if (upErr) {
        console.error("[comm-outbox] settle:", upErr.message);
        return { error: "settle failed", rows: 0 };
      }
      return { error: null, rows: upd?.length ?? 0 };
    };
    if (result.ok) {
      stats.sent++;
      const { error: sErr } = await settle({ status: "sent", provider_msg_id: result.providerMsgId, updated_at: new Date().toISOString() });
      if (sErr) stats.failed++;
      continue;
    }
    if (result.failKind === "no_config") {
      stats.blocked++;
      const { error: sErr } = await settle({ status: "blocked_no_config", last_error: result.errorLabel, updated_at: new Date().toISOString() });
      if (sErr) stats.failed++;
      continue;
    }
    if (result.failKind === "perm" || row.attempts >= MAX_ATTEMPTS) {
      stats.dead++;
      const { error: sErr } = await settle({ status: "dead", last_error: result.errorLabel, updated_at: new Date().toISOString() });
      if (sErr) stats.failed++;
      continue;
    }
    // temp fail -> backoff 2^attempts Minuten.
    stats.failed++;
    const backoff = new Date(Date.now() + 2 ** row.attempts * 60_000).toISOString();
    const { error: sErr } = await settle({ status: "queued", next_attempt_at: backoff, last_error: result.errorLabel, updated_at: new Date().toISOString() });
    if (sErr) console.error("[comm-outbox] requeue:", sErr);
  }
  return NextResponse.json({ ok: true, ...stats });
}
export const GET = POST;
