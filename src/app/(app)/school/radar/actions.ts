"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import { buildRadarData } from "@/lib/school/radar";

/**
 * Dong bo canh bao tinh toan vao early_warnings (dedupe theo lop+nhom).
 * Truoc day trang radar tu insert khi render - mutation trong GET la
 * anti-pattern nen chuyen sang action goi tu nut "Lam moi canh bao".
 */
export async function refreshRadarWarnings(): Promise<{
  inserted?: number;
  error?: string;
}> {
  const deny = await checkActionRole(["bgh", "pht", "admin"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };

  const { candidates } = await buildRadarData(supabase, profile);
  if (!candidates.length) {
    revalidatePath("/school/radar");
    return { inserted: 0 };
  }

  const { data: existing } = await supabase
    .from("early_warnings")
    .select("dedupe_key")
    .eq("school_id", profile.school_id ?? "")
    .in(
      "dedupe_key",
      candidates.map((c) => c.dedupe_key),
    );
  const have = new Set(
    ((existing ?? []) as { dedupe_key: string }[]).map((e) => e.dedupe_key),
  );
  const fresh = candidates
    .filter((c) => !have.has(c.dedupe_key))
    .map((c) => ({ ...c, school_id: profile.school_id }));
  if (fresh.length) {
    const { error } = await supabase.from("early_warnings").insert(fresh);
    if (error) return { error: error.message };
  }
  revalidatePath("/school/radar");
  return { inserted: fresh.length };
}

export async function updateWarningStatus(
  warningId: string,
  status: "acknowledged" | "resolved",
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: w } = await supabase
    .from("early_warnings")
    .select("id,school_id,class_id,title")
    .eq("id", warningId)
    .maybeSingle();
  if (!w || w.school_id !== profile.school_id) {
    return { error: "Cảnh báo không tồn tại." };
  }

  const { error } = await supabase
    .from("early_warnings")
    .update({
      status,
      acknowledged_by: profile.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", warningId);
  if (error) return { error: error.message };

  // Báo cho GVCN của lớp biết BGH đã tiếp nhận/xử lý
  if (w.class_id) {
    const { data: cls } = await supabase
      .from("classes")
      .select("gvcn_id,name")
      .eq("id", w.class_id)
      .maybeSingle();
    if (cls?.gvcn_id) {
      await supabase.from("notifications").insert({
        profile_id: cls.gvcn_id,
        type: "warning",
        title: status === "acknowledged" ? "BGH đã tiếp nhận cảnh báo" : "Cảnh báo đã đóng",
        body: `Lớp ${cls.name}: ${w.title}`,
        link: "/dashboard",
      });
    }
  }
  revalidatePath("/school/radar");
  return {};
}
