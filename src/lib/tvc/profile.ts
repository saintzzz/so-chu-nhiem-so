import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

/**
 * Le tabelle tvc.* con owner/author hanno FK verso tvc.profiles, che gli
 * utenti SCN non hanno. La creiamo lazy al primo uso (RLS consente solo
 * self-upsert con role='giao_vien'). ignoreDuplicates per non sovrascrivere
 * il profilo di chi usa anche l'app TVC360.
 */
export async function ensureTvcProfile() {
  const profile = await getProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("tvc_profiles").upsert(
    {
      id: profile.id,
      role: "giao_vien",
      full_name: profile.full_name ?? "",
      email: profile.email,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
}
