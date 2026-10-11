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

  const data = await buildRadarData(supabase, profile);
  // Nguon du lieu loi/truncated -> khong ghi canh bao tu du lieu thieu.
  if (data.errors.length) {
    console.error("[radar] buildRadarData errors:", data.errors.join("; "));
    return {
      error: "Không tải đủ dữ liệu nguồn để tính radar - vui lòng thử lại sau.",
    };
  }
  const { candidates } = data;
  if (!candidates.length) {
    revalidatePath("/school/radar");
    return { inserted: 0 };
  }

  // r21 M: lookup dedupe loi -> have rong -> INSERT trung canh bao.
  const { data: existing, error: dedupeErr } = await supabase
    .from("early_warnings")
    .select("dedupe_key")
    .eq("school_id", profile.school_id ?? "")
    .in(
      "dedupe_key",
      candidates.map((c) => c.dedupe_key),
    );
  if (dedupeErr) {
    console.error("[radar] dedupe lookup:", dedupeErr.message);
    return { error: "Không tải được cảnh báo hiện có để chống trùng - vui lòng thử lại." };
  }
  const have = new Set(
    ((existing ?? []) as { dedupe_key: string }[]).map((e) => e.dedupe_key),
  );
  const fresh = candidates
    .filter((c) => !have.has(c.dedupe_key))
    .map((c) => ({ ...c, school_id: profile.school_id }));
  if (fresh.length) {
    const { error } = await supabase.from("early_warnings").insert(fresh);
    if (error) {
      console.error("[radar] insert early_warnings:", error.message);
      return { error: "Không lưu được cảnh báo - vui lòng thử lại." };
    }
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
  if (error) {
    console.error("[radar] update early_warnings:", error.message);
    return { error: "Không cập nhật được cảnh báo - vui lòng thử lại." };
  }

  // Báo cho GVCN của lớp biết BGH đã tiếp nhận/xử lý - r21 M: ca
  // lookup lop lan INSERT notification deu khong duoc bo error roi
  // tra ok gia (GVCN khong biet canh bao da duoc xu ly).
  if (w.class_id) {
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("gvcn_id,name")
      .eq("id", w.class_id)
      .maybeSingle();
    if (clsErr) {
      console.error("[radar] class lookup:", clsErr.message);
      revalidatePath("/school/radar");
      return { error: "Đã cập nhật cảnh báo, nhưng chưa thông báo được cho GVCN." };
    }
    if (cls?.gvcn_id) {
      const { error: notiErr } = await supabase.from("notifications").insert({
        profile_id: cls.gvcn_id,
        type: "warning",
        title: status === "acknowledged" ? "BGH đã tiếp nhận cảnh báo" : "Cảnh báo đã đóng",
        body: `Lớp ${cls.name}: ${w.title}`,
        link: "/dashboard",
      });
      if (notiErr) {
        console.error("[radar] notify gvcn:", notiErr.message);
        revalidatePath("/school/radar");
        return { error: "Đã cập nhật cảnh báo, nhưng gửi thông báo cho GVCN thất bại." };
      }
    }
  }
  revalidatePath("/school/radar");
  return {};
}
