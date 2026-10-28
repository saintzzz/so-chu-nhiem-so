"use server";

import { checkActionRole } from "@/lib/auth";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// CR-076: van_thu - dang ky cong van den/di. Write chi bgh|admin.
async function guard() {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return deny;
  return assertModule("van_thu");
}

const mapErr = (m?: string | null) =>
  m?.includes("forbidden") ? "Bạn không có quyền thực hiện thao tác này." :
  m?.includes("module_disabled") ? "Trường chưa kích hoạt module Văn thư." :
  m?.includes("duplicate") || m?.includes("vt_documents_school_id_direction_doc_no_key")
    ? "Số hiệu công văn đã tồn tại." :
  m?.includes("invalid_deadline") ? "Hạn xử lý phải sau ngày ban hành." :
  m?.includes("invalid_") ? "Dữ liệu không hợp lệ - kiểm tra lại các trường bắt buộc." :
  "Không lưu được - thử lại.";

export async function createDocument(input: {
  direction: string; docNo: string; docType: string; issued: string;
  from: string; to: string; subject: string; note: string;
  handlerId: string; deadline: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  if (!input.docNo.trim()) return "Số hiệu công văn là bắt buộc.";
  if (!input.issued) return "Ngày ban hành là bắt buộc.";
  if (!input.from.trim()) return input.direction === "di" ? "Nơi nhận là bắt buộc." : "Nơi gửi là bắt buộc.";
  if (!input.subject.trim()) return "Trích yếu là bắt buộc.";
  if (input.deadline && input.deadline < input.issued) {
    return "Hạn xử lý phải sau ngày ban hành.";
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vt_create", {
    p_direction: input.direction,
    p_doc_no: input.docNo,
    p_doc_type: input.docType,
    p_issued: input.issued,
    p_from: input.from,
    p_to: input.to,
    p_subject: input.subject,
    p_note: input.note,
    p_handler: input.handlerId || null,
    p_deadline: input.deadline || null,
  });
  if (error || !data) return mapErr(error?.message);
  revalidatePath("/school/documents");
  return null;
}

export async function updateDocument(input: {
  id: string; status: string; handlerId: string; note: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vt_update", {
    p_id: input.id,
    p_status: input.status,
    p_handler: input.handlerId || null,
    p_note: input.note,
  });
  if (error || !data) return mapErr(error?.message);
  revalidatePath("/school/documents");
  return null;
}
