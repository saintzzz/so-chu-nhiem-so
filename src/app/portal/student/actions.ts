"use server";

import { checkActionRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// CR-065: hoc_sinh lam bai qua RPC security-definer - moi check
// (lop, cua so, module) nam trong function, chi map loi o day.
function mapRpcError(message: string): string {
  if (message.includes("module_disabled")) return "Module bài tập trực tuyến đã tắt.";
  if (message.includes("not_student")) return "Tài khoản chưa liên kết hồ sơ học sinh.";
  if (message.includes("not_open")) return "Bài chưa mở hoặc đã hết hạn.";
  if (message.includes("already_submitted")) return "Bạn đã nộp bài này rồi.";
  if (message.includes("not_started")) return "Bạn chưa bắt đầu bài này.";
  if (message.includes("time_expired")) return "Đã hết thời gian làm bài.";
  if (message.includes("forbidden")) return "Bài này không dành cho lớp của bạn.";
  if (message.includes("session_not_found")) return "Không tìm thấy bài.";
  return message;
}

export async function myAssignments() {
  const deny = await checkActionRole(["hoc_sinh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_my_assignments");
  if (error) {
    if (error.message.includes("module_disabled")) return { ok: true, disabled: true, items: [] };
    if (error.message.includes("not_student")) return { ok: true, items: [] };
    return { error: mapRpcError(error.message) };
  }
  return { ok: true, items: (data ?? []) as unknown[] };
}

export async function startAttempt(sessionId: string) {
  const deny = await checkActionRole(["hoc_sinh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_start_attempt", { p_session: sessionId });
  if (error) return { error: mapRpcError(error.message) };
  return { ok: true, data };
}

export async function submitAttempt(sessionId: string, answers: Record<string, unknown>) {
  const deny = await checkActionRole(["hoc_sinh"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_submit_attempt", {
    p_session: sessionId,
    p_answers: answers,
  });
  if (error) return { error: mapRpcError(error.message) };
  return { ok: true, data };
}
