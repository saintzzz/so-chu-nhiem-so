"use server";

import { revalidatePath } from "next/cache";
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
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.content.trim() && input.submit) {
    return { error: "Vui lòng nhập nội dung báo cáo trước khi gửi." };
  }

  // Chỉ GVCN của đúng lớp mới được báo cáo
  const { data: cls } = await supabase
    .from("classes")
    .select("id,name,gvcn_id")
    .eq("id", input.classId)
    .eq("gvcn_id", profile.id)
    .maybeSingle();
  if (!cls) return { error: "Bạn không chủ nhiệm lớp này." };

  const { error } = await supabase.from("daily_reports").upsert(
    {
      class_id: input.classId,
      date: input.date,
      gvcn_id: profile.id,
      absent_count: input.absentCount,
      late_count: input.lateCount,
      violation_count: input.violationCount,
      commendation_count: input.commendationCount,
      content: input.content.trim(),
      status: input.submit ? "submitted" : "draft",
      submitted_at: input.submit ? new Date().toISOString() : null,
    },
    { onConflict: "class_id,date" },
  );
  if (error) return { error: error.message };

  if (input.submit) {
    const { data: leaders } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["bgh", "pht"])
      .eq("school_id", profile.school_id ?? "");
    const rows = ((leaders ?? []) as { id: string }[])
      .filter((p) => p.id !== profile.id)
      .map((p) => ({
        profile_id: p.id,
        type: "daily_report",
        title: `Báo cáo ngày lớp ${cls.name}`,
        body: `Vắng ${input.absentCount}, muộn ${input.lateCount}, vi phạm ${input.violationCount}, khen thưởng ${input.commendationCount}`,
        link: "/school/daily-reports",
      }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  }

  revalidatePath("/attendance/daily-report");
  revalidatePath("/school/daily-reports");
  return {};
}
