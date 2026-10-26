import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

// CR-060: registry module ban kem theo truong. Mac dinh BAT; admin/so_gd
// tat trong school_features. Module moi: them key + gan vao nav/route guard.
export const MODULES = [
  { key: "studio", label: "Công cụ soạn học liệu & ngân hàng câu hỏi" },
  { key: "hoc_ba", label: "Sổ học bạ số" },
  { key: "tu_van_an_toan", label: "Tư vấn & an toàn học đường" },
  { key: "thi_dua", label: "Thi đua & năng lực giáo viên" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

// Set cac module bi TAT cua truong hien tai. Dedupe theo request.
export const disabledModules = cache(async (): Promise<Set<string>> => {
  const profile = await getProfile();
  if (!profile?.school_id) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_features")
    .select("module")
    .eq("school_id", profile.school_id)
    .eq("enabled", false);
  if (error) throw new Error(`school_features failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.module as string));
});

export async function requireModule(key: ModuleKey) {
  if ((await disabledModules()).has(key)) redirect("/dashboard");
}

export async function assertModule(key: ModuleKey): Promise<string | null> {
  return (await disabledModules()).has(key)
    ? "Trường chưa kích hoạt module này."
    : null;
}
