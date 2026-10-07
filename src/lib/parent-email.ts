// Resolve va gui email thong bao cho phu huynh cua mot lop (hoac 1 HS).
// Dung chung cho sendAnnouncement (parents) va announceActivity (activities)
// de hai duong gui co cung hanh vi: loc @demo.scn o sendEmail, dem so email
// loi rieng (emailFailed) thay vi nuot partial failure.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export interface ParentEmailResult {
  emailed: number;
  emailFailed: number;
  emailSkipped: boolean;
  // Nhan loi co dinh, an toan de hien thi/log - khong phai raw provider error.
  emailError?: string;
}

export async function emailClassParents(
  supabase: SupabaseClient,
  input: {
    classId: string;
    studentId: string | null;
    title: string;
    content: string;
  },
): Promise<ParentEmailResult> {
  const empty: ParentEmailResult = {
    emailed: 0,
    emailFailed: 0,
    emailSkipped: false,
  };
  // Query nguon loi != khong co nguoi nhan - tra lookup failed de caller
  // bao loi thay vi hien "da gui" tren danh sach rong.
  const lookupFail = (label: string, detail?: string | null) => {
    console.error(`[parent-email] ${label} query failed:`, detail ?? "unknown");
    return { ...empty, emailError: "lookup failed" };
  };
  // Resolve: class -> students -> parent_students -> parents.email
  let studentQ = supabase
    .from("students")
    .select("id")
    .eq("class_id", input.classId)
    .eq("status", "active");
  if (input.studentId) studentQ = studentQ.eq("id", input.studentId);
  const { data: stuRows, error: stuErr } = await studentQ;
  if (stuErr) return lookupFail("students", stuErr.message);
  const stuIds = ((stuRows ?? []) as { id: string }[]).map((s) => s.id);
  if (!stuIds.length) return empty;

  const { data: linkRows, error: linkErr } = await supabase
    .from("parent_students")
    .select("parent_id")
    .in("student_id", stuIds);
  if (linkErr) return lookupFail("parent_students", linkErr.message);
  const parentIds = [
    ...new Set(
      ((linkRows ?? []) as { parent_id: string }[]).map((l) => l.parent_id),
    ),
  ];
  if (!parentIds.length) return empty;

  const { data: parentRows, error: parentErr } = await supabase
    .from("parents")
    .select("email")
    .in("id", parentIds)
    .not("email", "is", null);
  if (parentErr) return lookupFail("parents", parentErr.message);
  const emails = ((parentRows ?? []) as { email: string | null }[])
    .map((p) => p.email)
    .filter((e): e is string => Boolean(e));
  if (!emails.length) return empty;

  const res = await sendEmail({
    to: emails,
    subject: `[Sổ Chủ Nhiệm Số] ${input.title.trim()}`,
    text: input.content.trim(),
  });
  return {
    emailed: res.sent,
    emailFailed: res.failed,
    emailSkipped: Boolean(res.skipped),
    emailError: res.error ? "provider error" : undefined,
  };
}
