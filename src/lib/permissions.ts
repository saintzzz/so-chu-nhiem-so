import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export { FEATURES } from "@/lib/feature-keys";

// CR-030: phan quyen theo chuc nang - uu tien: user deny > user allow >
// role deny > role allow > default matrix (trong ham scn_has_feature).

export async function hasFeature(feature: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scn_has_feature", { f: feature });
  // fail-CLOSED: loi RPC = khong xac dinh duoc quyen -> tu choi (CR-034 fix).
  // Nen mac dinh van nam trong scn_has_feature (SQL), chi khoa khi rpc that su loi.
  if (error) return false;
  return Boolean(data);
}

export async function requireFeature(feature: string) {
  const ok = await hasFeature(feature);
  if (!ok) redirect("/dashboard");
}

// Server action / API route: tra loi neu user bi deny chuc nang.
export async function assertFeature(feature: string): Promise<string | null> {
  return (await hasFeature(feature)) ? null : "Tính năng này đã bị quản trị tắt với tài khoản của bạn.";
}
