import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ghi nhật ký kiểm toán cho mutation quan trọng.
 * Fire-and-forget: lỗi audit không làm fail business action.
 */
export function logAudit(
  supabase: SupabaseClient,
  input: {
    action: string;
    entity: string;
    entityId?: string | null;
    payload?: Record<string, unknown>;
  },
): void {
  void (async () => {
    try {
      const { data: claimsData } = await supabase.auth.getClaims();
      await supabase.from("audit_logs").insert({
        actor_id: (claimsData?.claims?.sub as string | undefined) ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        payload: input.payload ?? null,
      });
    } catch {
      // audit chỉ ghi nhận, không chặn luồng chính
    }
  })();
}
