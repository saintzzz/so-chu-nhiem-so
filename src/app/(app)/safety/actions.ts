"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkActionRole, getProfile } from "@/lib/auth";
import type { Incident } from "@/types";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
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
  if (error) return { error: error.message };
  // Chỉ báo lãnh đạo cùng trường; PHT chỉ nhận nếu sự cố thuộc cơ sở mình phụ trách.
  const { data: leaderProfiles } = await supabase
    .from("profiles")
    .select("id,role,campus_id")
    .eq("school_id", profile.school_id ?? "")
    .in("role", ["bgh", "pht"]);
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
        p.id !== user.id &&
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };
  const { error } = await supabase
    .from("incidents")
    .update({ reported_to_bgh: reported })
    .eq("id", incidentId);
  if (error) return { error: error.message };
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn." };

  let description: string | undefined;
  if (input.note.trim()) {
    const { data: incData } = await supabase
      .from("incidents")
      .select("description")
      .eq("id", incidentId)
      .single();
    const incident = (incData ?? null) as Pick<
      Incident,
      "description"
    > | null;
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}/${now.getFullYear()}`;
    description = `${incident?.description ?? ""}\n\n[Theo dõi ${stamp}] ${input.note.trim()}`;
  }

  const { error } = await supabase
    .from("incidents")
    .update({
      status: input.status,
      ...(description !== undefined ? { description } : {}),
    })
    .eq("id", incidentId);
  if (error) return { error: error.message };
  revalidatePath("/safety/followup");
  revalidatePath("/safety/archive");
  revalidatePath("/safety/bgh");
  return {};
}
