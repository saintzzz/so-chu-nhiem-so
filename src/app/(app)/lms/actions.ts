"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole } from "@/lib/auth";
import type { Role } from "@/types";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

// CR-065: lms-lite - GV/gvcn/to_truong/bgh/admin giao bai; so_gd chi xem.
const ROLES: Role[] = ["gvbm", "gvcn", "to_truong", "bgh", "admin"];

async function guard() {
  const deny = await checkActionRole(ROLES);
  if (deny) return deny;
  return assertModule("lms_lite");
}

function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module bài tập trực tuyến đã tắt.";
  if (message.includes("school_mismatch")) return "Lớp hoặc bài không thuộc trường.";
  if (message.includes("not_exam_owner")) return "Bạn chỉ giao được đề do mình tạo.";
  if (message.includes("exam_empty")) return "Đề thi chưa có câu hỏi nào.";
  if (message.includes("exam_not_found")) return "Không tìm thấy đề thi.";
  if (message.includes("class_not_found")) return "Không tìm thấy lớp.";
  if (message.includes("invalid_window")) return "Khoảng thời gian không hợp lệ.";
  if (message.includes("forbidden")) return "Bạn không có quyền thực hiện thao tác này.";
  return message;
}

export async function assignSession(input: {
  exam_id: string;
  class_id: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  title?: string;
}) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_assign", {
    p_exam: input.exam_id,
    p_class: input.class_id,
    p_opens: new Date(input.opens_at).toISOString(),
    p_closes: new Date(input.closes_at).toISOString(),
    p_duration: input.duration_minutes,
    p_title: input.title ?? null,
  });
  if (error) return { error: mapRpcError(error.message) };
  revalidatePath("/lms");
  const d = data as { session_id?: string; question_count?: number } | null;
  return { ok: true, sessionId: d?.session_id, questionCount: d?.question_count ?? 0 };
}

export async function closeSession(sessionId: string) {
  const deny = await guard();
  if (deny) return { error: deny };
  const supabase = await createClient();
  // CAS: chi dong khi con mo - tab cu khong mo lai session da dong.
  const { data: updated, error } = await supabase
    .from("lms_sessions")
    .update({ status: "closed" })
    .eq("id", sessionId)
    .eq("status", "open")
    .select("id");
  if (error) return { error: error.message };
  if (!updated?.length) return { error: "Bài đã đóng hoặc không tồn tại." };
  revalidatePath("/lms");
  return { ok: true };
}
