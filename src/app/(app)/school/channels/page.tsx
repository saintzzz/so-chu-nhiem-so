import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { ChannelsBoard } from "@/components/school/channels-board";

export default async function ChannelsPage() {
  const profile = await requireRoles(["bgh", "admin"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: integs }, { data: templates }, { data: outboxStats }, { data: consents }] =
    await Promise.all([
      must(supabase
        .from("school_integrations")
        .select("provider, enabled")
        .eq("school_id", sid)
        .in("provider", ["zalo_oa", "sms"]), "integrations"),
      must(supabase
        .from("comm_templates")
        .select("id, channel, name, provider_template_id, body, enabled")
        .eq("school_id", sid)
        .order("channel"), "templates"),
      must(supabase
        .from("comm_outbox")
        .select("channel, status")
        .eq("school_id", sid)
        .limit(2000), "outbox"),
      must(supabase
        .from("parent_channel_consents")
        .select("channel, consented")
        .eq("school_id", sid)
        .limit(2000), "consents"),
    ]);

  const flag = (p: string) =>
    (integs ?? []).find((i) => i.provider === p)?.enabled ?? false;
  const stats = (outboxStats ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[`${r.channel}:${r.status}`] = (acc[`${r.channel}:${r.status}`] ?? 0) + 1;
    return acc;
  }, {});
  const consentStats = (consents ?? []).reduce<Record<string, number>>((acc, c) => {
    if (c.consented) acc[c.channel] = (acc[c.channel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Kênh liên hệ phụ huynh"
        description="Cấu hình kênh thông báo (email mặc định; Zalo ZNS/SMS cần credentials + consent). Cron: /api/cron/comm-outbox."
      />
      <ChannelsBoard
        zaloEnabled={flag("zalo_oa")}
        smsEnabled={flag("sms")}
        templates={(templates ?? []) as never[]}
        outboxStats={stats}
        consentStats={consentStats}
      />
    </div>
  );
}
