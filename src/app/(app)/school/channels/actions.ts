"use server";

import { revalidatePath } from "next/cache";
import { checkActionRole, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adapterFor } from "@/lib/comm/providers";

async function guard() {
  const deny = await checkActionRole(["bgh", "admin"]);
  if (deny) return deny;
  const profile = await getProfile();
  if (!profile?.school_id) return "Phiên đăng nhập đã hết hạn.";
  return null;
}
const fail = (tag: string, e: { message?: string }) => {
  console.error(`[channels] ${tag}:`, e.message);
  return { error: "Lỗi hệ thống. Vui lòng thử lại." };
};

export async function saveChannelIntegration(input: {
  provider: "zalo_oa" | "sms";
  enabled: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("school_integrations").upsert({
    school_id: profile!.school_id,
    provider: input.provider,
    enabled: input.enabled,
    config: {},
    updated_by: profile!.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "school_id,provider" });
  if (error) return fail("integration", error);
  revalidatePath("/school/channels");
  return { ok: true };
}

export async function saveCommTemplate(input: {
  channel: "zalo" | "sms";
  name: string;
  providerTemplateId?: string;
  body: string;
  requiredParams?: string[];
  enabled?: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  const profile = await getProfile();
  if (!input.name.trim() || !input.body.trim())
    return { error: "Tên và nội dung template bắt buộc." };
  if (input.channel === "zalo" && !input.providerTemplateId?.trim())
    return { error: "Zalo ZNS cần template_id đã được duyệt." };
  const supabase = await createClient();
  const { error } = await supabase.from("comm_templates").upsert({
    school_id: profile!.school_id,
    channel: input.channel,
    name: input.name.trim(),
    provider_template_id: input.providerTemplateId?.trim() || null,
    body: input.body.trim(),
    required_params: input.requiredParams ?? [],
    enabled: input.enabled ?? true,
  }, { onConflict: "school_id,channel,name" });
  if (error) return fail("template", error);
  revalidatePath("/school/channels");
  return { ok: true };
}

export async function testCommChannel(
  channel: "zalo" | "sms",
  phone: string,
): Promise<{ ok?: boolean; msg?: string; error?: string }> {
  const deny = await guard();
  if (deny) return { error: deny };
  if (!phone.trim()) return { error: "Số điện thoại bắt buộc." };
  const adapter = adapterFor(channel);
  if (!adapter) return { error: "Kênh không hỗ trợ." };
  // Admin-Client + direkter Adapter-Call: Test geht nicht ueber Outbox
  // (kein parent record noetig) - Ergebnis label kommt vom Provider.
  const res = await adapter({
    channel,
    recipientRef: phone.trim(),
    templateName: "test",
    providerTemplateId: null,
    payload: { text: "SCN test message" },
  });
  if (res.ok) return { ok: true, msg: `Đã gửi (${res.providerMsgId ?? "ok"})` };
  if (res.failKind === "no_config")
    return { error: "Chưa cấu hình credentials - xem BACKLOG-CREDENTIALS." };
  return { error: "Gửi thử thất bại - chi tiết trong server log." };
}
