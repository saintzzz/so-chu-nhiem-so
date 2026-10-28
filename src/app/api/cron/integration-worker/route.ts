import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEvent } from "@/lib/integrations/dispatch";
import type { Connector, OutboxEvent } from "@/lib/integrations/dispatch";

// CR-072: drain int_outbox -> dispatch theo connector.
// Auth: header "authorization: Bearer <CRON_SECRET>".
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const ok =
    bearer &&
    bearer.length === secret.length &&
    timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: events, error } = await supabase.rpc("int_dequeue", { p_batch: 20 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events?.length) return NextResponse.json({ processed: 0 });

  const connIds = [...new Set((events as OutboxEvent[]).map((e) => e.connector_id).filter(Boolean))];
  const { data: conns, error: connErr } = connIds.length
    ? await supabase.from("int_connectors").select("*").in("id", connIds)
    : { data: [], error: null };
  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 });
  const connMap = new Map((conns ?? []).map((c) => [c.id, c]));

  let sent = 0;
  let failed = 0;
  for (const ev of events as OutboxEvent[]) {
    const conn = connMap.get(ev.connector_id as string) as Connector | undefined;
    const result = conn
      ? await dispatchEvent(conn, ev)
      : { ok: false, error: "connector_missing" };
    const { error: markErr } = await supabase.rpc("int_mark", {
      p_id: ev.id,
      p_ok: result.ok,
      p_error: result.error ?? null,
    });
    if (markErr) console.error("[int-worker] mark failed", ev.id, markErr.message);
    if (result.ok) sent++;
    else failed++;
  }
  return NextResponse.json({ processed: events.length, sent, failed });
}
