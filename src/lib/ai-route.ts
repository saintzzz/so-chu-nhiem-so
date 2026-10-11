/**
 * Helper dùng chung cho các route /api/ai/*: gọi LLM (đa provider),
 * nếu hết quota -> giao Devin fallback, trả về chuẩn:
 *   { result } | { pending: true, jobId, devinUrl } | { result: null }
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTextDetailed, type AiResult } from "@/lib/ai";
import { fallbackToDevin } from "@/lib/devin";
import { takeAiQuota, recordAiUsage } from "@/lib/ai-quota";
import {
  redactPiiText,
  pseudonymizeNames,
  deanonymizeNames,
  deanonymizeDeep,
  collectUsedNames,
  type PiiName,
} from "@/lib/ai-privacy";
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
  /**
   * CR-049 P3b: danh sach ten rieng can an danh hoa truoc khi gui AI
   * (name -> alias trong prompt, alias -> name trong output). Neu khong
   * truyen, lop redactPiiText van cat email/SDT/so dinh danh.
   * allowRawPrompt: bo redact - CHI cho route ma PII la muc tieu trich
   * xuat (extract-records); prompt van duoc minimize thu cong.
   * source: noi dung THO cua caller khi prompt da embed du lieu da
   * minimizeDeep san (JSON alias); r12 H3 - deanon/pii_map chi gioi
   * han trong cac ten thuc su co trong input caller.
   */
  pii?: { names?: PiiName[]; allowRawPrompt?: boolean; source?: unknown };
}

export async function respondWithAi<T>(
  p: AiRouteParams<T>,
): Promise<NextResponse> {
  // CR-049 P3b: an danh hoa ten + cat PII cau truc truoc khi gui provider.
  // Devin fallback dung lai cung prompt da minimize -> khong co duong tat.
  const names = p.pii?.names ?? [];
  const raw = p.pii?.allowRawPrompt === true;
  // CR-049 r12 H3: deanon/pii_map chi pham vi ten caller da co trong
  // input (prompt tho + payload tho neu prompt da duoc minimize san).
  // Chan vec inject alias "HS001..." vao free-text de LLM echo lo ten.
  const usedNames = raw
    ? []
    : collectUsedNames({ prompt: p.prompt, source: p.pii?.source }, names);
  const safePrompt = raw ? p.prompt : redactPiiText(pseudonymizeNames(p.prompt, names));
  const safeSystem = raw ? p.system : redactPiiText(p.system);
  // CR-049 P3c+r5: het budget ngay -> KHONG goi provider VA khong tao
  // Devin fallback tra phi (budget_block khac provider quota). Chi tra
  // rule-based fallback. Over-count theo chieu an toan.
  const quotaOk = await takeAiQuota(p.kind, p.profile.id);
  if (!quotaOk) {
    void recordAiUsage(p.kind, p.profile.id, null, "budget_block");
    const fb = p.fallback?.();
    return NextResponse.json({ result: fb ?? null });
  }
  const aiRes: AiResult = await generateTextDetailed(safePrompt, {
    system: safeSystem,
    maxTokens: p.maxTokens ?? 2048,
    temperature: p.temperature ?? 0.7,
    skipPiiRedact: raw,
  });
  void recordAiUsage(
    p.kind,
    p.profile.id,
    aiRes.provider,
    aiRes.text ? "ok" : (aiRes.error ?? "error"),
  );

  if (aiRes.text) {
    const clean = aiRes.text.replace(/```json|```/g, "").trim();
    // CR-049 r10 M: neu output la JSON thi deanon TREN CAU TRUC da parse
    // (ten that co the chua ky tu pha JSON - dau ngoac kep, backslash);
    // fallback deanon text cho output khong phai JSON.
    let restored = deanonymizeNames(clean, usedNames);
    if (usedNames.length) {
      try {
        restored = JSON.stringify(deanonymizeDeep(JSON.parse(clean), usedNames));
      } catch {
        /* output khong phai JSON thuan - giu deanon text */
      }
    }
    const parsed = p.parse(restored);
    if (parsed !== null) {
      return NextResponse.json({ result: parsed });
    }
  }

  // Hết quota / lỗi provider -> fallback Devin bất đồng bộ
  if (aiRes.error === "quota" || aiRes.error === "no_key") {
    const job = await fallbackToDevin({
      supabase: p.supabase,
      kind: p.kind,
      prompt: `${safeSystem}\n\n${safePrompt}`,
      expectedShape: p.expectedShape,
      createdBy: p.profile.id,
      req: p.req,
      // F18: alias map luu tren job - devin-callback deanonymize output.
      // r12 H3: chi luu ten caller da co trong input - pii_map nam trong
      // ai_jobs (BGH/dept-scope doc duoc), luu nguyen roster la lo PII.
      piiMap: usedNames.length ? usedNames : undefined,
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
