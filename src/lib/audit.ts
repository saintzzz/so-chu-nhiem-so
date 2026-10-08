import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ghi nhật ký kiểm toán cho mutation quan trọng.
 *
 * Chạy ở 2 ngu cảnh:
 * - client components (browser supabase client): fire-and-forget la du -
 *   trinh duyet giu fetch song, khong bi cat.
 * - server actions (server supabase client): can after() cua next/server
 *   de serverless giu insert song sau khi response gui di - CR-041 sua
 *   lai void-async tho bi runtime cat som.
 *
 * next/server chi import dong o server de file van nam trong client bundle.
 * Loi audit chi log console, khong lam fail business action.
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
  const work = (async () => {
    try {
      const { data: claimsData } = await supabase.auth.getClaims();
      const { error } = await supabase.from("audit_logs").insert({
        actor_id: (claimsData?.claims?.sub as string | undefined) ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        payload: input.payload ?? null,
      });
      if (error) console.error("[audit] insert:", error.message);
    } catch (e) {
      console.error("[audit]", e);
    }
  });

  if (typeof window === "undefined") {
    // server action / route handler: len lich qua after() trong request scope;
    // ngoai request scope (script/test) after() nem loi -> chay truc tiep.
    void import("next/server")
      .then(({ after }) => {
        try {
          after(() => work());
        } catch {
          void work();
        }
      })
      .catch(() => void work());
  } else {
    void work();
  }
}
