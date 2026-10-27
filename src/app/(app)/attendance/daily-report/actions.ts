"use server";

import { revalidatePath } from "next/cache";
import { assertModule } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";

export async function saveDailyReport(input: {
  classId: string;
  date: string;
  content: string;
  absentCount: number;
  lateCount: number;
  violationCount: number;
  commendationCount: number;
  submit: boolean;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["gvcn"]);
  if (deny) return { error: deny };
  const modErr = await assertModule("chuyen_can");
  if (modErr) return { error: modErr };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.content.trim() && input.submit) {
    return { error: "Vui lòng nhập nội dung báo cáo trước khi gửi." };
  }

  // Chỉ GVCN của đúng lớp mới được báo cáo
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id,name,gvcn_id")
    .eq("id", input.classId)
    .eq("gvcn_id", profile.id)
    .maybeSingle();
  if (clsErr) {
    console.error("[daily-report] class lookup:", clsErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!cls) return { error: "Bạn không chủ nhiệm lớp này." };

  // r26 M: upsert tran cho tab cu ghi de ban da nop (submitted->draft +
  // xoa submitted_at). RPC serialize tren (class_id,date) va chi update
  // khi row hien tai con draft - 'stale' nghia la da nop, bao reload.
  const { data: saveResult, error } = await supabase.rpc(
    "scn_save_daily_report",
    {
      p_class: input.classId,
      p_date: input.date,
      p_absent: input.absentCount,
      p_late: input.lateCount,
      p_violation: input.violationCount,
      p_commend: input.commendationCount,
      p_content: input.content.trim(),
      p_submit: input.submit,
    },
  );
  if (error) {
    console.error("[daily-report] save daily_reports:", error.message);
    return { error: "Không lưu được báo cáo ngày - vui lòng thử lại." };
  }
  if (saveResult === "stale") {
    return {
      error: "Báo cáo ngày này đã được nộp - vui lòng tải lại trang.",
    };
  }

  let notifyWarning: string | undefined;
  if (input.submit) {
    // r21 M: lookup lanh dao + INSERT loi deu khong duoc tra ok gia.
    const { data: leaders, error: ldErr } = await supabase
      .from("profiles")
      .select("id")
      .or("role.in.(bgh,pht),concurrent_roles.ov.{bgh,pht}")
      .eq("school_id", profile.school_id ?? "");
    if (ldErr) {
      console.error("[daily-report] leaders:", ldErr.message);
      notifyWarning = "Đã lưu báo cáo, nhưng chưa thông báo được cho lãnh đạo.";
    } else {
      const rows = ((leaders ?? []) as { id: string }[])
        .filter((p) => p.id !== profile.id)
        .map((p) => ({
          profile_id: p.id,
          type: "daily_report",
          title: `Báo cáo ngày lớp ${cls.name}`,
          body: `Vắng ${input.absentCount}, muộn ${input.lateCount}, vi phạm ${input.violationCount}, khen thưởng ${input.commendationCount}`,
          link: "/school/daily-reports",
        }));
      if (rows.length) {
        const { error: notiErr } = await supabase
          .from("notifications")
          .insert(rows);
        if (notiErr) {
          console.error("[daily-report] notify leaders:", notiErr.message);
          notifyWarning = "Đã lưu báo cáo, nhưng gửi thông báo cho lãnh đạo thất bại.";
        }
      }
    }
  }

  revalidatePath("/attendance/daily-report");
  revalidatePath("/school/daily-reports");
  return notifyWarning ? { error: notifyWarning } : {};
}
