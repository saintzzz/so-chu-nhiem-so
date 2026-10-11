"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emailClassParents } from "@/lib/parent-email";
import { checkActionRole, getProfile } from "@/lib/auth";
import type { Activity } from "@/types";
import { hasAnyRole } from "@/lib/roles";

// getClaims qua getProfile (local JWT, cached) - getUser() goi Auth server
// co the timeout im lang trong server action.
async function getContext() {
  const supabase = await createClient();
  const profile = await getProfile();
  return { supabase, user: profile ? { id: profile.id } : null, profile };
}

export async function createActivity(input: {
  classId: string;
  title: string;
  description: string;
  activityDate: string | null;
}): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!input.title.trim()) return { error: "Vui lòng nhập tên hoạt động." };
  const { error } = await supabase.from("activities").insert({
    class_id: input.classId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    activity_date: input.activityDate || null,
    status: "draft",
  });
  if (error) {
    console.error("[activities] insert failed:", error.message);
    return { error: "Không tạo được hoạt động. Vui lòng thử lại." };
  }
  revalidatePath("/activities/plan");
  return {};
}

export async function submitActivity(
  activityId: string,
): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("activities")
    .update({ status: "pending" })
    .eq("id", activityId)
    .eq("status", "draft");
  if (error) {
    console.error("[activities] submit failed:", error.message);
    return { error: "Không gửi duyệt được hoạt động. Vui lòng thử lại." };
  }
  revalidatePath("/activities/plan");
  return {};
}

export async function reviewActivity(
  activityId: string,
  approve: boolean,
): Promise<{ error?: string }> {
  const { supabase, user, profile } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  if (!profile || !hasAnyRole(profile, ["bgh", "pht", "admin"])) {
    return { error: "Chỉ Ban Giám Hiệu mới có quyền phê duyệt." };
  }
  // R2-09: conditional update phai kiem rows affected - nguoi thua trong
  // duyet dong thoi khong duoc nhan thanh cong.
  const { data: updated, error } = await supabase
    .from("activities")
    .update({ status: approve ? "approved" : "draft" })
    .eq("id", activityId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    console.error("[activities] review failed:", error.message);
    return { error: "Không cập nhật được quyết định. Vui lòng thử lại." };
  }
  if (updated?.length !== 1) {
    return { error: "Hoạt động đã được xử lý. Vui lòng tải lại trang." };
  }
  revalidatePath("/activities/plan");
  revalidatePath("/school/approvals");
  return {};
}

export async function announceActivity(
  activityId: string,
): Promise<{
  error?: string;
  registered?: number;
  emailed?: number;
  emailFailed?: number;
  emailSkipped?: boolean;
  emailError?: string;
}> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };

  const { data: actData, error: actErr } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();
  const activity = (actData ?? null) as Activity | null;
  if (actErr) {
    if (actErr.code === "PGRST116")
      return { error: "Không tìm thấy hoạt động." };
    console.error("[activity-announce] activity:", actErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  if (!activity) return { error: "Không tìm thấy hoạt động." };
  // r24 M: goi truc tiep action tren draft/pending van tao announcement +
  // email - chan som o day, RPC claim kiem lai lan nua server-side.
  if (activity.status !== "approved") {
    return { error: "Chỉ thông báo hoạt động đã được duyệt." };
  }

  // r22 M: doc DU nguon truoc moi side effect - announcement/email la
  // one-shot, retry sau partial commit se insert + gui email lan nua.
  const { data: studentData, error: stuErr } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", activity.class_id)
    .eq("status", "active");
  if (stuErr) {
    console.error("[activity-announce] students:", stuErr.message);
    return { error: "Không tải được danh sách học sinh. Vui lòng thử lại." };
  }
  const studentIds = ((studentData ?? []) as { id: string }[]).map(
    (s) => s.id,
  );

  const { data: existingData, error: exErr } = await supabase
    .from("activity_attendance")
    .select("student_id")
    .eq("activity_id", activityId);
  if (exErr) {
    console.error("[activity-announce] existing:", exErr.message);
    return {
      error: "Không tải được danh sách đăng ký hiện có. Vui lòng thử lại.",
    };
  }
  const existing = new Set(
    ((existingData ?? []) as { student_id: string }[]).map((r) => r.student_id),
  );

  const annTitle = `Thông báo hoạt động: ${activity.title}`;
  const annContent =
    activity.description ??
    `Nhà trường thông báo kế hoạch hoạt động "${activity.title}". Phụ huynh vui lòng theo dõi và nhắc nhở học sinh tham gia đầy đủ.`;

  // r24: moi coordination marker di qua RPC security definer - claim/link/
  // email-claim deu atomic trong DB. RLS marker chi con SELECT nen khong ai
  // ghi truc tiep; quyen announce duoc kiem lai server-side (gvcn lop hoac
  // bgh truong, activity phai approved).
  const { data: claimRows, error: claimErr } = await supabase.rpc(
    "scn_announce_claim",
    { p_activity_id: activityId },
  );
  if (claimErr) {
    console.error("[activity-announce] claim:", claimErr.message);
    return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  }
  const claim = (claimRows ?? [])[0] as
    | {
        state: string;
        announcement_id: string | null;
        email_done: boolean;
        emailed: number;
        email_failed: number;
        email_error: string | null;
        email_skipped: boolean;
      }
    | undefined;
  if (!claim) return { error: "Lỗi hệ thống. Vui lòng thử lại." };
  if (claim.state === "not-found")
    return { error: "Không tìm thấy hoạt động." };
  if (claim.state === "forbidden")
    return { error: "Bạn không có quyền thông báo hoạt động này." };
  if (claim.state === "not-approved")
    return { error: "Chỉ thông báo hoạt động đã được duyệt." };
  if (claim.state === "pending")
    return {
      error:
        "Thông báo đang được tạo ở một phiên khác - vui lòng thử lại sau.",
    };

  if (!claim.announcement_id) {
    // claim state = 'claimed': tao announcement + link trong 1 transaction
    // (RPC) - that bai thi rollback ca hai, khong sinh announcement mo coi.
    const { error: fulErr } = await supabase.rpc("scn_announce_fulfill", {
      p_activity_id: activityId,
      p_title: annTitle,
      p_content: annContent,
    });
    if (fulErr) {
      console.error("[activity-announce] fulfill:", fulErr.message);
      revalidatePath("/activities/announce");
      return { error: "Không lưu được thông báo. Vui lòng thử lại." };
    }
  }

  let mail: {
    emailed: number;
    emailFailed: number;
    emailSkipped?: boolean;
    emailError?: string;
  } = {
    emailed: claim.emailed ?? 0,
    emailFailed: claim.email_failed ?? 0,
    emailSkipped: claim.email_skipped ?? false,
    emailError: claim.email_error ?? undefined,
  };
  if (!claim.email_done) {
    // Chi claim owner gui email - concurrent khong the gui trung batch.
    const { data: emailClaimed, error: eClaimErr } = await supabase.rpc(
      "scn_announce_email_claim",
      { p_activity_id: activityId },
    );
    if (eClaimErr) {
      console.error("[activity-announce] email claim:", eClaimErr.message);
      revalidatePath("/activities/announce");
      revalidatePath("/activities/attendance");
      return {
        error:
          "Đã lưu thông báo nhưng không xác định được trạng thái gửi email - bấm lại sẽ thử gửi nếu cần.",
        emailError: "state-unknown",
      };
    }
    if (emailClaimed === true) {
      // R6-02: email phu huynh cung noi dung thong bao in-app (subject prefix
      // [So Chu Nhiem So] do helper dat).
      mail = await emailClassParents(supabase, {
        classId: activity.class_id,
        studentId: null,
        title: annTitle,
        content: annContent,
      });
      // email_done khi da gui duoc >=1, chua cau hinh, hoac khong co nguoi
      // nhan. Chi retry khi CHUA gui duoc gi (lookup/provider loi) - resend
      // batch khi da gui duoc mot phan se spam nguoi nhan thanh cong.
      const emailDone =
        Boolean(mail.emailSkipped) ||
        (mail.emailed ?? 0) > 0 ||
        (!mail.emailError && (mail.emailFailed ?? 0) === 0);
      const { data: done, error: doneErr } = await supabase.rpc(
        "scn_announce_email_complete",
        {
          p_activity_id: activityId,
          p_done: emailDone,
          p_emailed: mail.emailed ?? 0,
          p_failed: mail.emailFailed ?? 0,
          p_error: mail.emailError ?? null,
          p_skipped: mail.emailSkipped ?? false,
        },
      );
      if (doneErr || done !== true) {
        if (doneErr)
          console.error("[activity-announce] mail state:", doneErr.message);
        revalidatePath("/activities/announce");
        revalidatePath("/activities/attendance");
        return {
          error:
            "Đã lưu thông báo và gửi email, nhưng không ghi được trạng thái gửi - vui lòng báo quản trị viên.",
          emailed: mail.emailed,
          emailFailed: mail.emailFailed,
          emailSkipped: mail.emailSkipped,
          emailError: mail.emailError,
        };
      }
    } else {
      // Thua claim: phien khac dang gui hoac vua ghi xong trang thai -
      // doc lai marker de bao ket qua that thay vi mac dinh (r24 L).
      const { data: m2, error: m2Err } = await supabase
        .from("activity_announcements")
        .select("email_done,emailed,email_failed,email_error,email_skipped")
        .eq("activity_id", activityId)
        .maybeSingle();
      if (m2Err) {
        console.error("[activity-announce] marker reread:", m2Err.message);
        return {
          error:
            "Đã lưu thông báo - không đọc được trạng thái email, bấm lại sẽ thử gửi nếu cần.",
          emailError: "state-unknown",
        };
      }
      mail = {
        emailed: m2?.emailed ?? 0,
        emailFailed: m2?.email_failed ?? 0,
        emailSkipped: m2?.email_skipped ?? false,
        emailError: m2?.email_error ?? undefined,
      };
    }
  }

  const rows = studentIds
    .filter((id) => !existing.has(id))
    .map((id) => ({
      activity_id: activityId,
      student_id: id,
      status: "registered",
    }));
  if (rows.length) {
    const { error: regError } = await supabase
      .from("activity_attendance")
      .insert(rows);
    if (regError) {
      console.error("[activity-announce] register failed:", regError.message);
      // Announcement + email da committed - revalidate va bao committed;
      // retry se thay marker announcement nen chi chay lai phan dang ky.
      revalidatePath("/activities/announce");
      revalidatePath("/activities/attendance");
      // r23 M: phan anh dung ket qua email - khong khang dinh "da gui" khi
      // emailSkipped/emailError.
      const mailNote = mail.emailSkipped
        ? "chưa cấu hình email"
        : (mail.emailed ?? 0) > 0
          ? `đã gửi email đến ${mail.emailed} phụ huynh${(mail.emailFailed ?? 0) > 0 ? ` (${mail.emailFailed} lỗi)` : ""}`
          : mail.emailError
            ? "email chưa gửi được - bấm lại sẽ thử gửi lại"
            : "không có email phụ huynh nào";
      return {
        error:
          `Đã lưu thông báo (${mailNote}), nhưng không đăng ký được danh sách học sinh - vui lòng bấm lại để hoàn tất đăng ký.`,
        emailed: mail.emailed,
        emailFailed: mail.emailFailed,
        emailSkipped: mail.emailSkipped,
        emailError: mail.emailError,
      };
    }
  }

  revalidatePath("/activities/announce");
  revalidatePath("/activities/attendance");
  return {
    registered: rows.length,
    emailed: mail.emailed,
    emailFailed: mail.emailFailed,
    emailSkipped: mail.emailSkipped,
    emailError: mail.emailError,
  };
}

export async function saveActivityAttendance(
  activityId: string,
  rows: {
    studentId: string;
    status: "registered" | "present" | "absent" | "excused";
    evaluation: string;
  }[],
): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  const { supabase, user } = await getContext();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };

  if (rows.length === 0) {
    revalidatePath("/activities/attendance");
    return {};
  }
  // PK (activity_id, student_id) -> 1 upsert thay vi N update/insert tuan tu
  // (lop ~45 HS tung mat ~45 RTT).
  const { error } = await supabase.from("activity_attendance").upsert(
    rows.map((row) => ({
      activity_id: activityId,
      student_id: row.studentId,
      status: row.status,
      evaluation: row.evaluation.trim() || null,
    })),
    { onConflict: "activity_id,student_id" },
  );
  if (error) {
    console.error("[activities] attendance upsert failed:", error.message);
    return { error: "Không lưu được điểm danh. Vui lòng thử lại." };
  }

  revalidatePath("/activities/attendance");
  return {};
}
