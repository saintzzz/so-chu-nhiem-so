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
    // Round-3: /school/substitutes chi mo duoc cho bgh/pht - GV bi redirect.
    // Link GV toi trang so dau bai dung ngay duoc phan cong thay the.
    const { data: targetProfiles } = await supabase
      .from("profiles")
      .select("id,role")
      .in("id", [...targets]);
    const roleOf = new Map(
      ((targetProfiles ?? []) as { id: string; role: string }[]).map((p) => [
        p.id,
        p.role,
      ]),
    );
    await supabase.from("notifications").insert(
      [...targets].map((id) => ({
        profile_id: id,
        type: "substitute",
        title: "Yêu cầu điều động dạy thay",
        body: `Ngày ${input.date} tiết ${input.period} - chờ phê duyệt`,
        link: subNotificationLink(roleOf.get(id), input.date),
      })),
    );
  }
  revalidatePath("/school/substitutes");
  return {};
}

// Role nao vao duoc /schedule/period-log (page requireRoles gvcn/gvbm/to_truong)
// thi link toi ngay duoc day thay; approver giu link trang dieu dong.
const TEACHER_LINK_ROLES = new Set(["gvcn", "gvbm", "to_truong"]);
function subNotificationLink(role: string | undefined, date: string): string {
  return role && TEACHER_LINK_ROLES.has(role)
    ? `/schedule/period-log?date=${date}`
    : "/school/substitutes";
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

  const { data: updated, error } = await supabase
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
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (updated?.length !== 1) return { error: "Yêu cầu đã được xử lý. Vui lòng tải lại trang." };

  const targets = new Set([r.requested_by, r.absent_teacher_id]);
  const effectiveSub = substituteTeacherId ?? r.substitute_teacher_id;
  if (effectiveSub) targets.add(effectiveSub);
  targets.delete(profile.id);
  if (targets.size) {
    const { data: targetProfiles } = await supabase
      .from("profiles")
      .select("id,role")
      .in("id", [...targets]);
    const roleOf = new Map(
      ((targetProfiles ?? []) as { id: string; role: string }[]).map((p) => [
        p.id,
        p.role,
      ]),
    );
    await supabase.from("notifications").insert(
      [...targets].map((id) => ({
        profile_id: id,
        type: "substitute",
        title: approve
          ? "Điều động dạy thay đã được duyệt"
          : "Điều động dạy thay bị từ chối",
        body: `Ngày ${r.date} tiết ${r.period}`,
        link: subNotificationLink(roleOf.get(id), r.date),
      })),
    );
  }
  revalidatePath("/school/substitutes");
  return {};
}

/**
 * Round-3 FIX: request da duyet nhung chua co GV day thay (duyet "phan cong
 * sau") truoc day khong bao gio phan cong duoc - UI chi hien control cho
 * pending va decideSubstituteRequest chi update pending. Action nay cho
 * bgh/pht gan GV vao request approved con trong.
 * Luu y trigger scn_subr_update_guard (prod): UPDATE tren row approved bat
 * buoc decided_by = auth.uid() - nguoi phan cong tro thanh nguoi ra quyet
 * dinh gan nhat (decided_at cap nhat theo), giu nguyen nguyen nay.
 */
export async function assignSubstitute(
  requestId: string,
  teacherId: string,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh", "pht"]);
  if (deny) return { error: deny };
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!teacherId) return { error: "Chọn giáo viên dạy thay." };

  const { data: req } = await supabase
    .from("substitute_requests")
    .select("id,school_id,date,period")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.school_id !== profile.school_id) {
    return { error: "Yêu cầu không tồn tại." };
  }

  // GV duoc phan cong phai thuoc cung truong (RLS scn_subr_refs_in_school
  // cung chan, check som de bao loi ro rang).
  const { data: teacher } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", teacherId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!teacher) return { error: "Giáo viên không thuộc trường của bạn." };
  // Cung danh sach role voi picker o page.tsx - khong gan ke toan/nhan vien
  // khac lam GV day thay.
  if (!TEACHER_LINK_ROLES.has((teacher as { role: string }).role)) {
    return { error: "Người được phân công phải là giáo viên." };
  }

  const { data: updated, error } = await supabase
    .from("substitute_requests")
    .update({
      substitute_teacher_id: teacherId,
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "approved")
    .is("substitute_teacher_id", null)
    .select("id");
  if (error) return { error: error.message };
  if (updated?.length !== 1) {
    return {
      error:
        "Yêu cầu đã được phân công hoặc không còn ở trạng thái đã duyệt. Vui lòng tải lại trang.",
    };
  }

  // Thong bao cho GV vua duoc phan cong - link toi so dau bai dung ngay.
  await supabase.from("notifications").insert({
    profile_id: teacherId,
    type: "substitute",
    title: "Bạn được phân công dạy thay",
    body: `Ngày ${req.date} tiết ${req.period}`,
    link: subNotificationLink(
      (teacher as { role: string }).role,
      req.date as string,
    ),
  });
  revalidatePath("/school/substitutes");
  return {};
}
