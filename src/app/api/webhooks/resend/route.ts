import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/resend - nhan su kien email tu Resend (svix signature)
 * va cap nhat digest_deliveries.delivery_event theo provider_id.
 *
 * Env: RESEND_WEBHOOK_SECRET (whsec_... tu Resend dashboard -> Webhooks).
 * Thieu secret -> 503 (route tat), KHONG fail-open.
 *
 * Events map:
 *   email.delivered   -> delivery_event='delivered'
 *   email.bounced     -> 'bounced'   (khong retry - dia chi hong)
 *   email.complained  -> 'complained' (khong retry - spam report)
 *   email.failed      -> 'failed'
 *   email.delivery_delayed -> 'delayed'
 * Cac event khac (opened/clicked - tracking dang tat) -> 200, bo qua.
 *
 * Out-of-order safe: chi update khi event moi hon event_at da luu.
 * Idempotent: set lai cung gia tri khong hai; svix-id dung de log.
 */

const EVENT_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.delivery_delayed": "delayed",
};

// svix sign: base64-hmac-sha256(`${svix_id}.${svix_timestamp}.${rawBody}`,
// key = base64-decoded phan sau "whsec_"). Signature header co the chua
// nhieu chu ky dang "v1,<sig> v1,<sig>".
function verifySvix(
  payload: string,
  secret: string,
  headers: { id: string; ts: string; sig: string },
): boolean {
  const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(keyB64, "base64");
  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.ts}.${payload}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);
  for (const part of headers.sig.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook disabled" }, { status: 503 });
  }

  const raw = await req.text();
  const headers = {
    id: req.headers.get("svix-id") ?? "",
    ts: req.headers.get("svix-timestamp") ?? "",
    sig: req.headers.get("svix-signature") ?? "",
  };
  if (!headers.id || !headers.ts || !headers.sig) {
    return NextResponse.json({ error: "missing svix headers" }, { status: 400 });
  }
  // Replay protection: tu choi event cu hon 5 phut.
  const ts = Number(headers.ts);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return NextResponse.json({ error: "stale timestamp" }, { status: 400 });
  }
  if (!verifySvix(raw, secret, headers)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event: { type?: string; created_at?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const mapped = event.type ? EVENT_MAP[event.type] : undefined;
  if (!mapped) {
    return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });
  }
  const providerId = event.data?.email_id;
  if (!providerId) {
    return NextResponse.json({ ok: true, ignored: "no email_id" });
  }

  const supabase = createAdminClient();
  const eventAt = event.created_at ?? new Date(ts * 1000).toISOString();
  // Chi ghi event moi hon event_at hien co (svix co the retry/out-of-order).
  const { data, error } = await supabase
    .from("digest_deliveries")
    .update({ delivery_event: mapped, event_at: eventAt })
    .eq("provider_id", providerId)
    .or(`event_at.is.null,event_at.lt.${eventAt}`)
    .select("id");
  if (error) {
    console.error("[resend-webhook] update failed:", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    event: mapped,
    matched: data?.length ?? 0,
  });
}
