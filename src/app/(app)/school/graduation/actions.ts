"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole } from "@/lib/auth";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

// CR-068: xet tot nghiep - bgh|admin quan ly dot; gvcn nhap diem lop minh.
const ADMIN: Role[] = ["bgh", "admin"];
const SCORER: Role[] = ["bgh", "admin", "gvcn"];

async function guard(roles: Role[]) {
  const deny = await checkActionRole(roles);
  if (deny) return deny;
  return assertModule("xet_tot_nghiep");
}

function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module xét tốt nghiệp đã tắt.";
  if (message.includes("invalid_level")) return "Cấp học không hợp lệ.";
  if (message.includes("invalid_name")) return "Tên đợt xét không được để trống.";
  if (message.includes("invalid_pass_score") || message.includes("invalid_score"))
    return "Điểm không hợp lệ (0-10).";
  if (message.includes("no_current_year")) return "Chưa có năm học hiện tại.";
  if (message.includes("duplicate")) return "Đã có đợt xét cho cấp này trong năm học.";
  if (message.includes("decision_not_found")) return "Không tìm thấy quyết định.";
  if (message.includes("campaign_not_found")) return "Không tìm thấy đợt xét.";
  if (message.includes("campaign_closed")) return "Đợt xét đã chốt.";
  if (message.includes("invalid_decision")) return "Quyết định không hợp lệ.";
  if (message.includes("forbidden")) return "Bạn không có quyền thực hiện thao tác này.";
  return message;
}

export async function openCampaign(input: {
  level: string;
  name: string;
  passScore?: number;
  requireExam?: boolean;
}) {
  const deny = await guard(ADMIN);
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("tn_open_campaign", {
    p_level: input.level,
    p_name: input.name,
    p_pass_score: input.passScore ?? null,
    p_require_exam: input.requireExam ?? null,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/graduation");
  return null;
}

export async function setExamScore(decisionId: string, score: number | null) {
  const deny = await guard(SCORER);
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("tn_set_exam", {
    p_decision: decisionId,
    p_score: score,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/graduation");
  return null;
}

export async function setDecision(decisionId: string, value: string, note?: string) {
  const deny = await guard(ADMIN);
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("tn_set_decision", {
    p_id: decisionId,
    p_value: value,
    p_note: note ?? null,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/graduation");
  return null;
}

export async function finalizeCampaign(campaignId: string) {
  const deny = await guard(ADMIN);
  if (deny) return deny;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tn_finalize", {
    p_campaign: campaignId,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/school/graduation");
  const g = (data as { graduated?: number })?.graduated ?? 0;
  const r = (data as { rejected?: number })?.rejected ?? 0;
  return `Đã chốt: ${g} tốt nghiệp, ${r} chưa đạt.`;
}
