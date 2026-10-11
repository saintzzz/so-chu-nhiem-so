/**
 * CR-049 P3c: quota/budget AI - kiem tra ngan sach truoc khi goi provider
 * + ghi usage sau call. Backend: ai_budgets / ai_usage_counters /
 * ai_usage + RPC scn_ai_quota_take / scn_ai_record_usage (atomic).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** true = con quota, provider duoc goi. false = het budget ngay. */
export async function takeAiQuota(
  supabase: SupabaseClient,
  kind: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("scn_ai_quota_take", {
      p_kind: kind,
    });
    if (error) return true; // RPC loi -> khong chan user (fail-open co kiem soat)
    return data === true;
  } catch {
    return true;
  }
}

export async function recordAiUsage(
  supabase: SupabaseClient,
  kind: string,
  provider: string | null,
  outcome: "ok" | "quota" | "error" | "no_key",
): Promise<void> {
  try {
    await supabase.rpc("scn_ai_record_usage", {
      p_kind: kind,
      p_provider: provider,
      p_outcome: outcome,
    });
  } catch {
    /* best-effort audit */
  }
}
