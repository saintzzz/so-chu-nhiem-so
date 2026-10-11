/**
 * Devin API fallback: khi LLM provider (Gemini/OpenAI/Anthropic) hết quota,
 * giao tác vụ cho Devin session chạy bất đồng bộ. Devin POST kết quả về
 * /api/ai/devin-callback kèm per-job token để app lưu vào ai_jobs.
 *
 * Server-only: DEVIN_API_KEY không được expose ra client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { aiProviderAllowed, aiEndpointAllowed } from "@/lib/ai";

const DEVIN_API_BASE = "https://api.devin.ai/v1";

export interface DevinSession {
  sessionId: string;
  url: string;
}

export function devinEnabled(): boolean {
  // Devin la processor thu 4 (DPIA) - AI_ALLOW_DEVIN_FALLBACK=false de tat
  // kenh fallback nay du co DEVIN_API_KEY. R16: dat AI_ALLOWED_PROVIDERS ma
  // khong co 'devin' trong list cung la cam processor nay.
  if (process.env.AI_ALLOW_DEVIN_FALLBACK === "false") return false;
  if (!aiProviderAllowed("devin")) return false;
  // R4: devin session API cung la endpoint ngoai - tuan theo allowlist.
  if (!aiEndpointAllowed(DEVIN_API_BASE)) return false;
  return Boolean(process.env.DEVIN_API_KEY);
}

export async function createDevinSession(
  prompt: string,
  timeoutMs = 20_000,
): Promise<DevinSession | null> {
  const key = process.env.DEVIN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${DEVIN_API_BASE}/sessions`, {
      method: "POST",
      signal: AbortSignal.timeout(Math.min(20_000, Math.max(1_000, timeoutMs))),
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
  // R16: callback destination di vao prompt + nhan ket qua xu ly ben ngoai -
  // khong duoc phep suy ra tu forwarded headers (attacker-controlled).
  // Chi env cau hinh san (DEVIN_CALLBACK_URL / NEXT_PUBLIC_APP_URL) la hop
  // le, va bat buoc https ngoai moi truong local dev.
  const env =
    process.env.DEVIN_CALLBACK_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (env) {
    try {
      const u = new URL(env);
      const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if (u.protocol !== "https:" && !local) return null;
      return env.replace(/\/$/, "");
    } catch {
      return null;
    }
  }
  // Dev local: van can callback -> chi cho localhost tu header (khong the
  // bi tan cong tu xa vi chi dan toi loopback).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    return `http://${host}`;
  }
  return null;
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
  /** R4: budget con lai cua route - session-create khong vuot deadline. */
  timeoutMs?: number;
  /** CR-049 F18: alias->name map tren prompt da minimize - callback
   *  deanonymize output truoc khi luu result. */
  piiMap?: { name: string; alias: string }[];
}): Promise<{ jobId: string; devinUrl: string } | null> {
  if (!devinEnabled()) return null;
  const { supabase, kind, prompt, expectedShape, createdBy, req } = params;

  // Token plaintext gui cho engine; DB chi luu sha256 - ai_jobs readable boi
  // BGH/dept qua RLS nen luu plaintext la cho phep gia mao callback.
  const { createHash, randomUUID } = await import("node:crypto");
  const token = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: job } = await supabase
    .from("ai_jobs")
    .insert({
      kind,
      created_by: createdBy,
      callback_token: tokenHash,
      // F18: map nam tren job (staff doc duoc qua RLS nhung chi la
      // alias->name cua nguoi trong pham vi ho da thay).
      pii_map: params.piiMap?.length ? params.piiMap : null,
    })
    .select("id")
    .single();
  const row = job as { id?: string } | null;
  if (!row?.id) return null;

  const session = await createDevinSession(
    buildDevinPrompt({
      originalPrompt: prompt,
      jobId: row.id,
      callbackToken: token,
      expectedShape,
      callbackBase: devinCallbackBase(req),
    }),
    params.timeoutMs,
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
