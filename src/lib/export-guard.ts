import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";

/**
 * CR-054 lop 1 - export velocity cap.
 *
 * Moi file export duoc audit vao `audit_logs` (action="export") va moi
 * uid chi duoc EXPORT_CAP file / gio truot. Vuot nguong -> 429 + log
 * action="export_throttled" de BGH/so truy vet. Nguong 20/h du rong cho
 * nghiep vu that (gvcn xuat hoc ba ca lop van la 1 request), nhung chan
 * duoc script cao hang tram file bang session hop le.
 *
 * Fail-open khi dem loi (RLS/DB): van ghi audit export, khong lam dut
 * nghiep vu vi tang giam sat.
 */
export const EXPORT_CAP = 20;

export async function guardExport(
  supabase: SupabaseClient,
  input: { entity: string; entityId?: string | null },
): Promise<{ ok: boolean }> {
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (!uid) return { ok: false };

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", uid)
    .eq("action", "export")
    .gte("created_at", since);

  if (!error && (count ?? 0) >= EXPORT_CAP) {
    await writeAudit(supabase, {
      action: "export_throttled",
      entity: input.entity,
      entityId: input.entityId,
      payload: { cap: EXPORT_CAP },
    });
    return { ok: false };
  }

  await writeAudit(supabase, {
    action: "export",
    entity: input.entity,
    entityId: input.entityId,
  });
  return { ok: true };
}

/** 429 body chuan cho cac route export bi throttle. */
export function exportThrottledBody() {
  return {
    error:
      "Bạn đã xuất quá nhiều tệp trong giờ qua - vui lòng thử lại sau hoặc liên hệ BGH nếu cần xuất số lượng lớn.",
  };
}
