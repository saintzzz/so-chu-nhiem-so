import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook Devin POST kết quả sau khi hoàn thành tác vụ AI (fallback khi
 * LLM provider hết quota). Không qua auth user - xác thực bằng callback_token
 * per-job sinh ngẫu nhiên trong ai_jobs. Chỉ được ghi result vào job đó.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    job_id?: string;
    token?: string;
    result?: unknown;
  } | null;

  if (!body?.job_id || !body.token || body.result === undefined) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (
    typeof body.result !== "object" ||
    body.result === null ||
    Array.isArray(body.result) ||
    JSON.stringify(body.result).length > 1_000_000
  ) {
    return NextResponse.json({ error: "bad_result" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  // DB luu sha256(token) - hash token trinh len roi so sanh.
  const { createHash } = await import("node:crypto");
  const presentedHash = createHash("sha256")
    .update(body.token)
    .digest("hex");
  const { data: job } = await admin
    .from("ai_jobs")
    .select("id,callback_token,status")
    .eq("id", body.job_id)
    .single();
  const row = job as { id: string; callback_token: string; status: string } | null;
  // Jobs tao truoc khi doi sang hash van luu plaintext -> chap nhan ca hai.
  const stored = row?.callback_token ?? "";
  const candidate =
    stored.length === presentedHash.length ? presentedHash : body.token;
  const tokenOk =
    !!row &&
    stored.length === candidate.length &&
    timingSafeEqual(Buffer.from(stored), Buffer.from(candidate));
  if (!row || !tokenOk || row.status !== "pending") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Conditional update on status=pending: mot callback duy nhat thang race;
  // callback thu hai tra ve 0 rows -> 409 thay vi ghi de ket qua.
  const { data: updated, error } = await admin
    .from("ai_jobs")
    .update({
      status: "done",
      result: body.result as Record<string, unknown>,
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
