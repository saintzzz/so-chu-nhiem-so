"use server";

import { checkActionRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// CR-115: privacy_dsr - so dong thuan + yeu cau quyen chu the. Write bgh|admin.
async function guard() {
  return checkActionRole(["bgh", "admin"]);
}

const mapErr = (m?: string | null) =>
  m?.includes("forbidden") ? "Bạn không có quyền thực hiện thao tác này." :
  m?.includes("invalid_due") ? "Hạn xử lý phải sau ngày tiếp nhận." :
  m?.includes("resolution_required") ? "Cần ghi kết quả xử lý khi đóng hoặc từ chối yêu cầu." :
  m?.includes("invalid_") ? "Dữ liệu không hợp lệ - kiểm tra lại các trường bắt buộc." :
  m?.includes("not_found") ? "Không tìm thấy bản ghi." :
  "Không lưu được - thử lại.";

export async function addConsent(input: {
  studentId: string; subjectLabel: string; purpose: string; channel: string;
  grantedByName: string; note: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  if (!input.subjectLabel.trim()) return "Tên chủ thể là bắt buộc.";
  if (!input.grantedByName.trim()) return "Người cho đồng thuận là bắt buộc.";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pr_consent_add", {
    p_student: input.studentId || null,
    p_subject_label: input.subjectLabel,
    p_purpose: input.purpose,
    p_channel: input.channel,
    p_granted: true,
    p_granted_by_name: input.grantedByName,
    p_note: input.note,
  });
  if (error || !data) return mapErr(error?.message);
  revalidatePath("/school/privacy");
  return null;
}

export async function revokeConsent(id: string): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("pr_consent_revoke", { p_id: id });
  if (error) return mapErr(error.message);
  revalidatePath("/school/privacy");
  return null;
}

export async function createRequest(input: {
  reqType: string; subjectLabel: string; requesterName: string;
  requesterContact: string; detail: string; received: string; due: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  if (!input.subjectLabel.trim()) return "Tên chủ thể là bắt buộc.";
  if (!input.requesterName.trim()) return "Người gửi yêu cầu là bắt buộc.";
  if (!input.received) return "Ngày tiếp nhận là bắt buộc.";
  if (!input.due || input.due <= input.received) return "Hạn xử lý phải sau ngày tiếp nhận.";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pr_dsr_create", {
    p_req_type: input.reqType,
    p_subject_label: input.subjectLabel,
    p_requester_name: input.requesterName,
    p_requester_contact: input.requesterContact,
    p_detail: input.detail,
    p_received: input.received,
    p_due: input.due,
  });
  if (error || !data) return mapErr(error?.message);
  revalidatePath("/school/privacy");
  return null;
}

export async function updateRequest(input: {
  id: string; status: string; resolutionNote: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  if (["done", "rejected"].includes(input.status) && !input.resolutionNote.trim()) {
    return "Cần ghi kết quả xử lý khi đóng hoặc từ chối yêu cầu.";
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("pr_dsr_update", {
    p_id: input.id,
    p_status: input.status,
    p_resolution_note: input.resolutionNote,
  });
  if (error) return mapErr(error.message);
  revalidatePath("/school/privacy");
  return null;
}
