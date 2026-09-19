import { NextRequest, NextResponse } from "next/server";
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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const { data: job } = await admin
    .from("ai_jobs")
    .select("id,callback_token,status")
    .eq("id", body.job_id)
    .single();
  const row = job as { id: string; callback_token: string; status: string } | null;
  if (!row || row.callback_token !== body.token || row.status !== "pending") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await admin
    .from("ai_jobs")
    .update({
      status: "done",
      result: body.result as Record<string, unknown>,
    })
    .eq("id", row.id);

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
