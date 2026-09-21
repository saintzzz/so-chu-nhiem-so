/**
 * Helper dùng chung cho các route /api/ai/*: gọi LLM (đa provider),
 * nếu hết quota -> giao Devin fallback, trả về chuẩn:
 *   { result } | { pending: true, jobId, devinUrl } | { result: null }
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTextDetailed } from "@/lib/ai";
import { fallbackToDevin } from "@/lib/devin";
import type { Profile } from "@/types";

export interface AiRouteParams<T> {
  req: Request;
  supabase: SupabaseClient;
  profile: Profile;
  kind: string;
  system: string;
  prompt: string;
  expectedShape: string;
  maxTokens?: number;
  temperature?: number;
  /** Biến text thô từ LLM thành payload trả về; null = coi như không có kết quả */
  parse: (text: string) => T | null;
  /** Rule-based fallback khi cả LLM lẫn Devin đều không khả dụng */
  fallback?: () => T;
}

export async function respondWithAi<T>(
  p: AiRouteParams<T>,
): Promise<NextResponse> {
  const aiRes = await generateTextDetailed(p.prompt, {
    system: p.system,
    maxTokens: p.maxTokens ?? 2048,
    temperature: p.temperature ?? 0.7,
  });

  if (aiRes.text) {
    const parsed = p.parse(aiRes.text.replace(/```json|```/g, "").trim());
    if (parsed !== null) {
      return NextResponse.json({ result: parsed });
    }
  }

  // Hết quota / lỗi provider -> fallback Devin bất đồng bộ
  if (aiRes.error === "quota" || aiRes.error === "no_key") {
    const job = await fallbackToDevin({
      supabase: p.supabase,
      kind: p.kind,
      prompt: `${p.system}\n\n${p.prompt}`,
      expectedShape: p.expectedShape,
      createdBy: p.profile.id,
      req: p.req,
    });
    if (job) {
      return NextResponse.json({
        pending: true,
        jobId: job.jobId,
        devinUrl: job.devinUrl,
      });
    }
  }
  const fb = p.fallback?.();
  return NextResponse.json({ result: fb ?? null });
}

/** Parse JSON object từ output LLM; trả null nếu không parse được. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(text) as unknown;
    return obj && typeof obj === "object" && !Array.isArray(obj)
      ? (obj as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Tách output LLM thành danh sách dòng insight (bỏ bullet/đánh số). */
export function parseLines(text: string, max = 8): string[] | null {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s\-*•\d.)\]]+/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, max);
  return lines.length ? lines : null;
}
