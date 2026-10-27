"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole, getProfile } from "@/lib/auth";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

// CR-064: khoan thu - ke_toan/bgh/admin thao tac, so_gd chi xem.
const ROLES: Role[] = ["ke_toan", "bgh", "admin"];

async function guard() {
  const deny = await checkActionRole(ROLES);
  if (deny) return deny;
  return assertModule("khoan_thu");
}

export async function saveFeeItem(input: {
  id?: string;
  name: string;
  kind: "mandatory" | "voluntary";
  unit_price: number;
  unit?: string;
  applies_to?: "all" | "grade" | "class";
  grade?: number | null;
  class_id?: string | null;
  active?: boolean;
}) {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  const supabase = await createClient();
  const row = {
    name: input.name.trim(),
    kind: input.kind,
    unit_price: input.unit_price,
    unit: input.unit ?? "thang",
    applies_to: input.applies_to ?? "all",
    grade: input.applies_to === "grade" ? (input.grade ?? null) : null,
    class_id: input.applies_to === "class" ? (input.class_id ?? null) : null,
    active: input.active ?? true,
  };
  if (!row.name || row.unit_price < 0) return { error: "Dữ liệu không hợp lệ." };
  const q = input.id
    ? supabase.from("fee_items").update(row).eq("id", input.id)
    : supabase.from("fee_items").insert({ ...row, school_id: profile!.school_id });
  const { error } = await q;
  if (error) return { error: error.message };
  revalidatePath("/finance/items");
  return { ok: true };
}

export async function registerVoluntary(feeItemId: string, studentIds: string[], register: boolean) {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  const supabase = await createClient();
  if (register) {
    const rows = studentIds.map((sid) => ({
      fee_item_id: feeItemId,
      student_id: sid,
      school_id: profile!.school_id,
    }));
    const { error } = await supabase
      .from("fee_registrations")
      .upsert(rows, { onConflict: "fee_item_id,student_id" });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("fee_registrations")
      .delete()
      .eq("fee_item_id", feeItemId)
      .in("student_id", studentIds);
    if (error) return { error: error.message };
  }
  revalidatePath("/finance/items");
  return { ok: true };
}

export async function saveExemption(input: {
  student_id: string;
  fee_item_id?: string | null;
  percent: number;
  reason?: string;
}) {
  const deny = await guard();
  if (deny) return { error: deny };
  if (input.percent <= 0 || input.percent > 100) return { error: "Tỉ lệ miễn giảm phải trong (0-100]." };
  const profile = await getProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("fee_exemptions").insert({
    student_id: input.student_id,
    fee_item_id: input.fee_item_id ?? null,
    percent: input.percent,
    reason: input.reason ?? null,
    school_id: profile!.school_id,
  });
  if (error) return { error: error.message };
  revalidatePath("/finance/items");
  return { ok: true };
}

export async function savePeriod(input: { id?: string; name: string; due_date?: string }) {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  const supabase = await createClient();
  if (!input.name.trim()) return { error: "Tên đợt thu bắt buộc." };
  if (input.id) {
    // CAS: chi sua khi con nhap - tab cu khong ghi de dot da phat hanh.
    const { data: updated, error } = await supabase
      .from("fee_periods")
      .update({ name: input.name.trim(), due_date: input.due_date || null })
      .eq("id", input.id)
      .eq("status", "draft")
      .select("id");
    if (error) return { error: error.message };
    if (!updated?.length) return { error: "Đợt thu đã phát hành - không sửa được." };
  } else {
    const { data: year, error: yearErr } = await supabase
      .from("academic_years")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();
    if (yearErr) return { error: yearErr.message };
    const { error } = await supabase.from("fee_periods").insert({
      name: input.name.trim(),
      due_date: input.due_date || null,
      academic_year_id: year?.id ?? null,
      school_id: profile!.school_id,
      created_by: profile!.id,
    });
    if (error) return { error: error.message };
  }
  revalidatePath("/finance/periods");
  return { ok: true };
}

export async function issuePeriod(periodId: string) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fee_issue_period", { p_period: periodId });
  if (error) {
    if (error.message.includes("already_issued")) return { error: "Đợt thu đã phát hành." };
    return { error: error.message };
  }
  revalidatePath("/finance/periods");
  revalidatePath("/finance/invoices");
  return { ok: true, issued: (data as { issued?: number })?.issued ?? 0 };
}

export async function collectPayment(invoiceId: string, amount: number, method: string, note?: string) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fee_collect", {
    p_invoice: invoiceId,
    p_amount: amount,
    p_method: method,
    p_note: note ?? null,
  });
  if (error) {
    if (error.message.includes("already_settled")) return { error: "Hóa đơn đã thanh toán đủ." };
    if (error.message.includes("invalid_amount")) return { error: "Số tiền không hợp lệ (vượt công nợ hoặc <= 0)." };
    if (error.message.includes("school_mismatch")) return { error: "Hóa đơn không thuộc trường." };
    return { error: error.message };
  }
  revalidatePath("/finance/invoices");
  return { ok: true, receipt: (data as { receipt_no?: string })?.receipt_no };
}
