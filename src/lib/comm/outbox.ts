import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// CR-069: enqueue - kanalneutraler Einstieg fuer alle PH-Nachrichten.
// Deduped ueber dedupe_key (school_id+key unique); consent+phone Gate
// laeuft in der Action, die dies aufruft (scn_parent_channel_ok).
export interface EnqueueInput {
  schoolId: string;
  parentId: string;
  channel: "zalo" | "sms" | "email";
  templateName: string;
  recipientRef: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  providerTemplateId?: string | null;
}

export async function enqueueComm(
  supabase: SupabaseClient,
  input: EnqueueInput,
): Promise<{ queued?: boolean; reason?: string }> {
  const { error } = await supabase.from("comm_outbox").upsert(
    {
      school_id: input.schoolId,
      parent_id: input.parentId,
      channel: input.channel,
      template_name: input.templateName,
      recipient_ref: input.recipientRef,
      payload: input.providerTemplateId
        ? { ...input.payload, _providerTemplateId: input.providerTemplateId }
        : input.payload,
      dedupe_key: input.dedupeKey,
    },
    { onConflict: "school_id,dedupe_key", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[comm] enqueue:", error.message);
    return { reason: "enqueue failed" };
  }
  return { queued: true };
}

// Fan-out fuer Klassen-Announcements: enqueued zalo fuer alle PH der
// Klasse mit phone + consent, wenn das Template + Integration enabled.
// Credential-free: ohne Integration/Consent -> einfach keine rows.
export async function enqueueClassComm(
  supabase: SupabaseClient,
  input: {
    schoolId: string;
    classId: string;
    channel: "zalo" | "sms";
    templateName: string;
    payload: Record<string, unknown>;
    dedupePrefix: string;
  },
): Promise<{ enqueued: number }> {
  // Integration enabled?
  const { data: integ, error: integErr } = await supabase
    .from("school_integrations")
    .select("enabled, config")
    .eq("school_id", input.schoolId)
    .eq("provider", input.channel === "zalo" ? "zalo_oa" : "sms")
    .maybeSingle();
  if (integErr) console.error("[comm] integrations:", integErr.message);
  if (!integ?.enabled) return { enqueued: 0 };

  // Template vorhanden + approved?
  const { data: tpl, error: tplErr } = await supabase
    .from("comm_templates")
    .select("provider_template_id, enabled")
    .eq("school_id", input.schoolId)
    .eq("channel", input.channel)
    .eq("name", input.templateName)
    .maybeSingle();
  if (tplErr) console.error("[comm] template:", tplErr.message);
  if (!tpl?.enabled) return { enqueued: 0 };

  // PH der Klasse mit consent + phone (scn_parent_channel_ok filtert).
  const { data: students, error: stuErr } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", input.classId)
    .eq("status", "active");
  if (stuErr) {
    console.error("[comm] students:", stuErr.message);
    return { enqueued: 0 };
  }
  const stuIds = (students ?? []).map((s) => s.id);
  if (!stuIds.length) return { enqueued: 0 };
  // bounded-ok: stuIds = HS cua 1 lop (~60) -> parent_students khop <= ~120
  const { data: links, error: linkErr } = await supabase
    .from("parent_students")
    .select("parent_id")
    .in("student_id", stuIds);
  if (linkErr) {
    console.error("[comm] parent_students:", linkErr.message);
    return { enqueued: 0 };
  }
  const parentIds = [...new Set((links ?? []).map((l) => l.parent_id))];
  let enqueued = 0;
  for (const pid of parentIds) {
    const { data: ok, error: okErr } = await supabase.rpc("scn_parent_channel_ok", {
      p_parent: pid,
      p_channel: input.channel,
    });
    if (okErr) {
      console.error("[comm] channel_ok:", okErr.message);
      continue;
    }
    if (!ok) continue;
    const { data: par, error: parErr } = await supabase
      .from("parents")
      .select("phone")
      .eq("id", pid)
      .single();
    if (parErr) {
      console.error("[comm] parents:", parErr.message);
      continue;
    }
    if (!par?.phone) continue;
    const r = await enqueueComm(supabase, {
      schoolId: input.schoolId,
      parentId: pid,
      channel: input.channel,
      templateName: input.templateName,
      recipientRef: par.phone,
      payload: input.payload,
      dedupeKey: `${input.dedupePrefix}:${pid}`,
      providerTemplateId: tpl.provider_template_id,
    });
    if (r.queued) enqueued++;
  }
  return { enqueued };
}
