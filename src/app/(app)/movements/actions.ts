"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole } from "@/lib/auth";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

// CR-067: bien dong hoc sinh - workflow request -> approve.
const CREATE_ROLES: Role[] = ["gvcn", "bgh", "admin"];
const DECIDE_ROLES: Role[] = ["bgh", "admin"];

async function guardCreate() {
  const deny = await checkActionRole(CREATE_ROLES);
  if (deny) return deny;
  return assertModule("bien_dong_hs");
}

async function guardDecide() {
  const deny = await checkActionRole(DECIDE_ROLES);
  if (deny) return deny;
  return assertModule("bien_dong_hs");
}

function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module biến động học sinh đã tắt.";
  if (message.includes("invalid_type")) return "Loại biến động không hợp lệ.";
  if (message.includes("effective_required")) return "Chọn ngày hiệu lực.";
  if (message.includes("counterpart_required")) return "Nhập tên trường chuyển đến/chuyển từ.";
  if (message.includes("class_required")) return "Chọn lớp nhận học sinh.";
  if (message.includes("class_not_found")) return "Lớp nhận không thuộc trường.";
  if (message.includes("payload_incomplete")) return "Nhập đủ họ tên và ngày sinh học sinh chuyển đến.";
  if (message.includes("invalid_dob")) return "Ngày sinh không hợp lệ.";
  if (message.includes("invalid_gender")) return "Giới tính không hợp lệ.";
  if (message.includes("student_required")) return "Chọn học sinh.";
  if (message.includes("student_not_found")) return "Học sinh không thuộc trường.";
  if (message.includes("invalid_state")) return "Trạng thái học sinh không phù hợp với loại biến động.";
  if (message.includes("pending_exists")) return "Học sinh đã có yêu cầu biến động đang chờ duyệt.";
  if (message.includes("request_not_found")) return "Không tìm thấy yêu cầu.";
  if (message.includes("not_pending")) return "Yêu cầu đã được xử lý.";
  if (message.includes("state_conflict")) return "Trạng thái học sinh đã thay đổi - tải lại trang.";
  if (message.includes("invalid_decision")) return "Quyết định không hợp lệ.";
  if (message.includes("forbidden")) return "Bạn không có quyền thực hiện thao tác này.";
  return message;
}

export async function createRequest(input: {
  type: "transfer_out" | "transfer_in" | "reserve" | "return";
  studentId?: string | null;
  effectiveDate: string;
  counterpart?: string;
  toClassId?: string | null;
  reason?: string;
  payload?: Record<string, string>;
}) {
  const deny = await guardCreate();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("sm_create", {
    p_type: input.type,
    p_student: input.studentId ?? null,
    p_effective: input.effectiveDate,
    p_counterpart: input.counterpart ?? null,
    p_to_class: input.toClassId ?? null,
    p_reason: input.reason ?? null,
    p_payload: input.payload ?? {},
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/movements");
  return null;
}

export async function decideRequest(requestId: string, decision: "approved" | "rejected", note?: string) {
  const deny = await guardDecide();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("sm_decide", {
    p_id: requestId,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/movements");
  return null;
}

export async function cancelRequest(requestId: string) {
  const deny = await guardCreate();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc("sm_cancel", { p_id: requestId });
  if (error) return mapRpcError(error.message);
  revalidatePath("/movements");
  return null;
}
