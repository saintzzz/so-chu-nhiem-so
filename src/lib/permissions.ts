import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export { FEATURES } from "@/lib/feature-keys";

// CR-030: phan quyen theo chuc nang - uu tien: user deny > user allow >
// role deny > role allow > default matrix (trong ham scn_has_feature).

export async function hasFeature(feature: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scn_has_feature", { f: feature });
  if (error) return true; // fail-open khi loi tam thoi (tranh khoa toan bo)
  return Boolean(data);
}

export async function requireFeature(feature: string) {
  const ok = await hasFeature(feature);
  if (!ok) redirect("/dashboard");
}
