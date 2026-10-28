"use server";

import { checkActionRole } from "@/lib/auth";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// CR-075: write chi bgh|admin (nhan vien y te = persona quan ly truong).
async function guard() {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return deny;
  return assertModule("y_te_bhyt");
}

const mapErr = (m?: string | null) =>
  m?.includes("forbidden") ? "Bạn không có quyền thực hiện thao tác này." :
  m?.includes("module_disabled") ? "Trường chưa kích hoạt module Y tế & BHYT." :
  m?.includes("invalid_student") ? "Học sinh không thuộc trường." :
  m?.includes("invalid_status") ? "Trạng thái thẻ không hợp lệ." :
  m?.includes("invalid_date") ? "Hạn thẻ không hợp lệ (đến trước từ)." :
  "Không lưu được - thử lại.";

export async function recordHealth(input: {
  studentId: string; checkedAt: string; height: string; weight: string;
  vleft: string; vright: string; dental: string; conclusion: string; note: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const { data, error } = await supabase.rpc("yt_upsert_health", {
    p_student: input.studentId,
    p_checked_at: input.checkedAt || null,
    p_height: num(input.height),
    p_weight: num(input.weight),
    p_vleft: input.vleft, p_vright: input.vright, p_dental: input.dental,
    p_conclusion: input.conclusion, p_note: input.note,
  });
  if (error || !data) return mapErr(error?.message);
  revalidatePath("/school/health");
  return null;
}

export async function upsertBhyt(input: {
  studentId: string; cardNo: string; kcbb: string;
  from: string; to: string; status: string; note: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("yt_upsert_bhyt", {
    p_student: input.studentId,
    p_card_no: input.cardNo, p_kcbb: input.kcbb,
    p_from: input.from || null, p_to: input.to || null,
    p_status: input.status, p_note: input.note,
  });
  if (error || !data) return mapErr(error?.message);
  revalidatePath("/school/health");
  return null;
}
