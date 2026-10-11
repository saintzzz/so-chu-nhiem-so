/**
 * CR-049 P3c + r5: quota/budget AI - kiem tra ngan sach truoc khi goi
 * provider + ghi usage sau call. Backend: ai_budgets / ai_usage_counters /
 * ai_usage + RPC scn_ai_quota_take / scn_ai_record_usage (atomic).
 *
 * r5: RPCs la service_role-only (client khong tu dot counter duoc) -
 * helpers dung admin client + truyen actor tu profile da auth o route.
 * Fail CLOSED: RPC loi -> chan AI (mat tinh kha dung hon mat tien).
 */
import { createAdminClient } from "@/lib/supabase/admin";

/** true = con quota, provider duoc goi. false = het budget hoac RPC loi. */
export async function takeAiQuota(
  kind: string,
  actorId: string,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("scn_ai_quota_take", {
      p_kind: kind,
      p_actor: actorId,
    });
    if (error) {
      console.error("[ai-quota] take failed:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[ai-quota] take exception:", e);
    return false;
  }
}

export async function recordAiUsage(
  kind: string,
  actorId: string,
  provider: string | null,
  outcome: "ok" | "quota" | "error" | "no_key" | "budget_block",
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("scn_ai_record_usage", {
      p_kind: kind,
      p_provider: provider,
      p_outcome: outcome,
      p_actor: actorId,
    });
    if (error) console.error("[ai-quota] record usage:", error.message);
  } catch {
    /* best-effort audit */
  }
}
