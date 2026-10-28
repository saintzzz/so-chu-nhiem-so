"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole } from "@/lib/auth";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

const ROLES: Role[] = ["bgh", "admin", "pht"];

async function guard() {
  const deny = await checkActionRole(ROLES);
  if (deny) return deny;
  return assertModule("dieu_dong");
}

function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module điều động đã tắt.";
  if (message.includes("overlapping_assignment"))
    return "Tiết này đã có phân công điều động trùng khoảng thời gian.";
  if (message.includes("invalid_date")) return "Khoảng ngày không hợp lệ.";
  if (message.includes("invalid_reason")) return "Thiếu lý do điều động.";
  if (message.includes("invalid_teacher"))
    return "Giáo viên không hợp lệ (khác trường hoặc không phải GV).";
  if (message.includes("cross_school_entry") || message.includes("entry_not_found"))
    return "Tiết TKB không thuộc trường của bạn.";
  if (message.includes("invalid_state")) return "Trạng thái không hợp lệ cho thao tác này.";
  if (message.includes("not_found")) return "Không tìm thấy phân công.";
  if (message.includes("forbidden")) return "Bạn không có quyền thực hiện thao tác này.";
  return message;
}

export async function createAssignment(input: {
  entryId: string;
  teacherId: string;
  from: string;
  to: string | null;
  reason: string;
}): Promise<string | null> {
  const deny = await guard();
  if (deny) return deny;
  if (!input.entryId || !input.teacherId) return "Thiếu tiết TKB hoặc giáo viên.";
  const supabase = await createClient();
  const { error } = await supabase.rpc("dd_create", {
    p_entry: input.entryId,
    p_teacher: input.teacherId,
    p_from: input.from,
    p_to: input.to,
    p_reason: input.reason,
  });
  if (error) return mapRpcError(error.message);
  revalidatePath("/schedule/mobilization");
  return null;
}

async function transition(id: string, rpc: "dd_approve" | "dd_end" | "dd_cancel") {
  const deny = await guard();
  if (deny) return deny;
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_id: id });
  if (error) return mapRpcError(error.message);
  revalidatePath("/schedule/mobilization");
  return null;
}

export async function approveAssignment(id: string) {
  return transition(id, "dd_approve");
}
export async function endAssignment(id: string) {
  return transition(id, "dd_end");
}
export async function cancelAssignment(id: string) {
  return transition(id, "dd_cancel");
}
