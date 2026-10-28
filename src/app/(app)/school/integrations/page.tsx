import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import IntegrationsBoard from "@/components/integrations/board";

export const dynamic = "force-dynamic";

// CR-072: tich hop - connectors + outbox monitor (bgh|admin).
export default async function IntegrationsPage() {
  const profile = await requireRoles(["bgh", "admin"]);
  await requireModule("tich_hop");
  const supabase = await createClient();

  const [connRes, outRes] = await Promise.all([
    supabase
      .from("int_connectors")
      .select("id,type,name,endpoint_url,auth_type,secret_name,enabled,created_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("int_outbox")
      .select("id,connector_id,event_type,status,attempts,next_retry_at,last_error,created_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <IntegrationsBoard
      connectors={connRes.data ?? []}
      events={outRes.data ?? []}
      loadError={connRes.error?.message ?? outRes.error?.message ?? null}
    />
  );
}
