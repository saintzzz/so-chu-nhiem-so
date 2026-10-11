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
}): Promise<{ error?: string; committed?: boolean; incidentId?: string }> {
  const deny = await checkActionRole(["gvcn", "gvbm", "to_truong", "bgh"]);
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!profile) return { error: "Phiên đăng nhập đã hết hạn." };
  const supabase = await createClient();
  if (!input.description.trim()) {
    return { error: "Vui lòng mô tả sự cố." };
  }
  const { data: inc, error } = await supabase
    .from("incidents")
    .insert({
      student_id: input.studentId,
      class_id: input.classId,
      type: input.type,
      severity: input.severity,
      status: "new",
      description: input.description.trim(),
      reported_to_bgh: false,
      occurred_at: input.occurredAt || new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[safety] insert incidents:", error.message);
    return { error: "Không ghi được sự cố - vui lòng thử lại." };
  }
  // r23 M: business commit roi - tra committed + incidentId de client
  // reset form va KHONG submit lai (revalidate khong reset local state).
  const committed = { committed: true, incidentId: inc?.id as string };
  // Chỉ báo lãnh đạo cùng trường; PHT chỉ nhận nếu sự cố thuộc cơ sở mình phụ trách.
  const { data: leaderProfiles, error: lpErr } = await supabase
    .from("profiles")
    .select("id,role,campus_id,concurrent_roles")
    .eq("school_id", profile.school_id ?? "")
    .or("role.in.(bgh,pht),concurrent_roles.ov.{bgh,pht}");
  // r21 M: lookup lanh dao loi -> khong ai nhan thong bao - phai bao
  // ro "da ghi, chua thong bao duoc" thay vi tra ok gia.
  if (lpErr) {
    console.error("[safety] leader lookup:", lpErr.message);
    // r22 M: incident da committed - PHAI revalidate truoc khi return de
    // form hien su co moi va retry khong tao ban ghi trung.
    revalidatePath("/safety/report");
    revalidatePath("/safety/bgh");
    revalidatePath("/safety/followup");
    return {
      ...committed,
      error:
        "Đã ghi sự cố, nhưng chưa thông báo được cho lãnh đạo - sự cố đã xuất hiện trong danh sách.",
    };
  }
  let incidentCampusId: string | null = null;
  let campusUnknown = false;
  if (input.classId) {
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("campus_id")
      .eq("id", input.classId)
      .single();
    // r21 M: loi lookup campus -> KHONG duoc suy ra "khong co campus"
    // vi se gui mo ta su co cho moi PHT trong truong (leak campus).
    if (clsErr && clsErr.code !== "PGRST116") {
      console.error("[safety] class campus lookup:", clsErr.message);
      campusUnknown = true;
    } else {
      incidentCampusId =
        (cls as Pick<{ campus_id: string | null }, "campus_id"> | null)
          ?.campus_id ?? null;
    }
  }
  const notifRows = (
    (leaderProfiles ?? []) as {
      id: string;
      role: string;
      campus_id: string | null;
      concurrent_roles: string[] | null;
    }[]
  )
    .filter(
      (p) =>
        p.id !== profile.id &&
        // BGH (primary hoac concurrent) nhan toan truong; PHT chi campus phu trach.
        // r21: campus khong xac dinh duoc (lookup loi) -> chi gui BGH,
        // khong gui PHT tranh leak mo ta su co ra ngoai campus.
        (p.role === "bgh" ||
          (p.concurrent_roles ?? []).includes("bgh") ||
          (!campusUnknown &&
            (!incidentCampusId || p.campus_id === incidentCampusId))),
    )
    .map((p) => ({
      profile_id: p.id,
      type: "incident",
      title: "Sự cố mới cần xử lý",
      body: input.description.trim().slice(0, 120),
      link: "/safety/bgh",
    }));
  if (notifRows.length) {
    const { error: notiErr } = await supabase
      .from("notifications")
      .insert(notifRows);
    if (notiErr) {
      console.error("[safety] notify leaders:", notiErr.message);
      revalidatePath("/safety/report");
      revalidatePath("/safety/bgh");
      revalidatePath("/safety/followup");
      return {
        ...committed,
        error: "Đã ghi sự cố, nhưng gửi thông báo cho lãnh đạo thất bại.",
      };
    }
  }
  revalidatePath("/safety/report");
  revalidatePath("/safety/bgh");
  revalidatePath("/safety/followup");
  return campusUnknown
    ? {
        ...committed,
        error:
          "Đã ghi sự cố và thông báo BGH; không xác định được cơ sở nên chưa báo PHT.",
      }
    : committed;
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
