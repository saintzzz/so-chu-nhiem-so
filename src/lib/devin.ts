/**
 * Devin API fallback: khi LLM provider (Gemini/OpenAI/Anthropic) hết quota,
 * giao tác vụ cho Devin session chạy bất đồng bộ. Devin POST kết quả về
 * /api/ai/devin-callback kèm per-job token để app lưu vào ai_jobs.
 *
 * Server-only: DEVIN_API_KEY không được expose ra client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const DEVIN_API_BASE = "https://api.devin.ai/v1";

export interface DevinSession {
  sessionId: string;
  url: string;
}

export function devinEnabled(): boolean {
  return Boolean(process.env.DEVIN_API_KEY);
}

export async function createDevinSession(
  prompt: string,
): Promise<DevinSession | null> {
  const key = process.env.DEVIN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${DEVIN_API_BASE}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { session_id?: string; url?: string };
    if (!json.session_id || !json.url) return null;
    return { sessionId: json.session_id, url: json.url };
  } catch {
    return null;
  }
}

/**
 * Callback base URL Devin can reach: explicit DEVIN_CALLBACK_URL wins,
 * otherwise derive from the incoming request (forwarded host on Vercel).
 */
export function devinCallbackBase(req: Request): string | null {
  const env =
    process.env.DEVIN_CALLBACK_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return null;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Bọc prompt gốc với hướng dẫn Devin gửi kết quả JSON về callback endpoint.
 */
export function buildDevinPrompt(params: {
  originalPrompt: string;
  jobId: string;
  callbackToken: string;
  expectedShape: string;
  callbackBase: string | null;
}): string {
  const { originalPrompt, jobId, callbackToken, expectedShape, callbackBase } =
    params;
  const callbackUrl = callbackBase
    ? `${callbackBase}/api/ai/devin-callback`
    : null;

  const parts = [
    `You are completing an async content-generation task for a Vietnamese school-management web app. Produce the result as JSON only.`,
    ``,
    `TASK:`,
    originalPrompt,
    ``,
    `Expected JSON shape: ${expectedShape}`,
    ``,
  ];
  if (callbackUrl) {
    parts.push(
      `When done, POST the JSON result back by running exactly:`,
      `curl -s -X POST '${callbackUrl}' -H 'Content-Type: application/json' -d '{"job_id":"${jobId}","token":"${callbackToken}","result":<YOUR_JSON>}'`,
      `Verify the response is {"ok":true}. Do not include anything else in the result field.`,
    );
  } else {
    parts.push(
      `When done, output the JSON result as your final message (no extra prose).`,
    );
  }
  return parts.join("\n");
}

/**
 * Tạo ai_jobs row + Devin session cho tác vụ AI khi provider hết quota.
 * Trả về jobId + devinUrl để route báo cho client poll kết quả.
 */
export async function fallbackToDevin(params: {
  supabase: SupabaseClient;
  kind: string;
  prompt: string;
  expectedShape: string;
  createdBy: string;
  req: Request;
}): Promise<{ jobId: string; devinUrl: string } | null> {
  if (!devinEnabled()) return null;
  const { supabase, kind, prompt, expectedShape, createdBy, req } = params;

  const { data: job } = await supabase
    .from("ai_jobs")
    .insert({ kind, created_by: createdBy })
    .select("id,callback_token")
    .single();
  const row = job as { id?: string; callback_token?: string } | null;
  if (!row?.id || !row.callback_token) return null;

  const session = await createDevinSession(
    buildDevinPrompt({
      originalPrompt: prompt,
      jobId: row.id,
      callbackToken: row.callback_token,
      expectedShape,
      callbackBase: devinCallbackBase(req),
    }),
  );
  if (!session) {
    await supabase.from("ai_jobs").update({ status: "failed" }).eq("id", row.id);
    return null;
  }
  await supabase
    .from("ai_jobs")
    .update({ session_url: session.url })
    .eq("id", row.id);
  return { jobId: row.id, devinUrl: session.url };
}
