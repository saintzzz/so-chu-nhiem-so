"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";

export async function createSubstituteRequest(input: {
  classId: string;
  subjectId: string;
  date: string;
  period: number;
  absentTeacherId: string;
  substituteTeacherId: string | null;
  reason: string;
}): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.absentTeacherId) return { error: "Thiếu GV vắng." };

  const { data: cls } = await supabase
    .from("classes")
    .select("id,school_id")
    .eq("id", input.classId)
    .maybeSingle();
  if (!cls || cls.school_id !== profile.school_id) {
    return { error: "Lớp không thuộc trường của bạn." };
  }

  const { error } = await supabase.from("substitute_requests").insert({
    school_id: profile.school_id,
    class_id: input.classId,
    subject_id: input.subjectId,
    date: input.date,
    period: input.period,
    absent_teacher_id: input.absentTeacherId,
    substitute_teacher_id: input.substituteTeacherId,
    reason: input.reason.trim() || null,
    status: "pending",
    requested_by: profile.id,
  });
  if (error) return { error: error.message };

  // Thông báo cho GV được đề xuất dạy thay
  const targets = new Set<string>();
  if (input.substituteTeacherId) targets.add(input.substituteTeacherId);
  targets.delete(profile.id);
  if (targets.size) {
    await supabase.from("notifications").insert(
      [...targets].map((id) => ({
        profile_id: id,
        type: "substitute",
        title: "Yêu cầu điều động dạy thay",
        body: `Ngày ${input.date} tiết ${input.period} - chờ phê duyệt`,
        link: "/school/substitutes",
      })),
    );
  }
  revalidatePath("/school/substitutes");
  return {};
}

export async function decideSubstituteRequest(
  requestId: string,
  approve: boolean,
  note?: string,
  substituteTeacherId?: string | null,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: req } = await supabase
    .from("substitute_requests")
    .select("id,school_id,requested_by,absent_teacher_id,substitute_teacher_id,date,period,class_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.school_id !== profile.school_id) {
    return { error: "Yêu cầu không tồn tại." };
  }
  const r = req as {
    id: string;
    requested_by: string;
    absent_teacher_id: string;
    substitute_teacher_id: string | null;
    date: string;
    period: number;
  };

  const { error } = await supabase
    .from("substitute_requests")
    .update({
      status: approve ? "approved" : "rejected",
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
      note: note?.trim() || null,
      // BGH có thể phân công GV dạy thay ngay lúc duyệt nếu yêu cầu chưa có.
      ...(approve && substituteTeacherId
        ? { substitute_teacher_id: substituteTeacherId }
        : {}),
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return { error: error.message };

  const targets = new Set([r.requested_by, r.absent_teacher_id]);
  const effectiveSub = substituteTeacherId ?? r.substitute_teacher_id;
  if (effectiveSub) targets.add(effectiveSub);
  targets.delete(profile.id);
  await supabase.from("notifications").insert(
    [...targets].map((id) => ({
      profile_id: id,
      type: "substitute",
      title: approve
        ? "Điều động dạy thay đã được duyệt"
        : "Điều động dạy thay bị từ chối",
      body: `Ngày ${r.date} tiết ${r.period}`,
      link: "/school/substitutes",
    })),
  );
  revalidatePath("/school/substitutes");
  return {};
}
