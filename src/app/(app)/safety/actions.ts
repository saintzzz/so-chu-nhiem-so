"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";

export async function createIncident(input: {
  studentId: string | null;
  classId: string | null;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  occurredAt: string;
}): Promise<{error?: string }> {
  const deny = await checkActionRole(["gvcn", "gvbm", "to_truong", "bgh"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  if (!input.description.trim()) {
    return { error: "Vui lòng mô tả sự cố." };
  }
  const { error } = await supabase.from("incidents").insert({
    student_id: input.studentId,
    class_id: input.classId,
    type: input.type,
    severity: input.severity,
    status: "new",
    description: input.description.trim(),
    reported_to_bgh: false,
    occurred_at: input.occurredAt || new Date().toISOString(),
  });
  if (error) {
    console.error("[safety] insert incidents:", error.message);
    return { error: "Không ghi được sự cố - vui lòng thử lại." };
  }
  // Chỉ báo lãnh đạo cùng trường; PHT chỉ nhận nếu sự cố thuộc cơ sở mình phụ trách.
  const { data: leaderProfiles } = await supabase
    .from("profiles")
    .select("id,role,campus_id")
    .eq("school_id", profile.school_id ?? "")
    .or("role.in.(bgh,pht),concurrent_roles.ov.{bgh,pht}");
  let incidentCampusId: string | null = null;
  if (input.classId) {
    const { data: cls } = await supabase
      .from("classes")
      .select("campus_id")
      .eq("id", input.classId)
      .single();
    incidentCampusId =
      (cls as Pick<{ campus_id: string | null }, "campus_id"> | null)
        ?.campus_id ?? null;
  }
  const notifRows = (
    (leaderProfiles ?? []) as {
      id: string;
      role: string;
      campus_id: string | null;
    }[]
  )
    .filter(
      (p) =>
        p.id !== profile.id &&
        (p.role === "bgh" ||
          !incidentCampusId ||
          p.campus_id === incidentCampusId),
    )
    .map((p) => ({
      profile_id: p.id,
      type: "incident",
      title: "Sự cố mới cần xử lý",
      body: input.description.trim().slice(0, 120),
      link: "/safety/bgh",
    }));
  if (notifRows.length) {
    await supabase.from("notifications").insert(notifRows);
  }
  revalidatePath("/safety/report");
  revalidatePath("/safety/bgh");
  revalidatePath("/safety/followup");
  return {};
}

export async function toggleReportedToBgh(
  incidentId: string,
  reported: boolean,
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["bgh"]);
  if (deny) return { error: deny };
  if (!(await getProfile())) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("incidents")
    .update({ reported_to_bgh: reported })
    .eq("id", incidentId);
  if (error) {
    console.error("[safety] update reported_to_bgh:", error.message);
    return { error: "Không cập nhật được trạng thái báo BGH - vui lòng thử lại." };
  }
  revalidatePath("/safety/bgh");
  return {};
}

export async function followupIncident(
  incidentId: string,
  input: {
    status: "new" | "following" | "resolved" | "archived";
    note: string;
  },
): Promise<{ error?: string }> {
  const deny = await checkActionRole(["gvcn", "bgh"]);
  if (deny) return { error: deny };
  if (!(await getProfile())) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();

  // R11-01: append ghi chu + doi status trong 1 UPDATE nguyen tu phia DB
  // (rpc scn_incident_followup, SECURITY INVOKER) - tranh lost update khi 2
  // GV submit theo doi dong thoi. Stamp ngay duoc tao trong function theo
  // gio VN. id khong khop/bi RLS chan thi update 0 row (chap nhan duoc).
  const { error } = await supabase.rpc("scn_incident_followup", {
    p_incident: incidentId,
    p_status: input.status,
    p_note: input.note.trim() || null,
  });
  if (error) {
    console.error("[safety] followup incident:", error.message);
    return { error: "Không cập nhật được theo dõi sự cố - vui lòng thử lại." };
  }
  revalidatePath("/safety/followup");
  revalidatePath("/safety/archive");
  revalidatePath("/safety/bgh");
  return {};
}
