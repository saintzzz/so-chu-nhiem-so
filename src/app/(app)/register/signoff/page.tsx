import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SignoffClient } from "@/components/register/signoff-client";
import { getAccessibleClasses } from "@/components/register/server-utils";
import type { Signoff } from "@/components/register/types";
import type { Profile } from "@/types";

export default async function SignoffPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const classes = await getAccessibleClasses(profile);
  const classIds = classes.map((c) => c.id);
  const classNames = new Map(classes.map((c) => [c.id, c.name]));

  const { data } =
    classIds.length > 0
      ? await supabase
          .from("register_signoffs")
          .select("*")
          .eq("type", "so_chu_nhiem")
          .in("class_id", classIds)
          .order("period", { ascending: false })
      : { data: [] };

  const signoffs = (data ?? []) as Signoff[];

  // Resolve signer names for the "Người ký" column.
  const signerIds = [...new Set(signoffs.map((s) => s.signed_by).filter(Boolean))] as string[];
  const { data: signerData } =
    signerIds.length > 0
      ? await supabase.from("profiles").select("id,full_name").in("id", signerIds)
      : { data: [] };
  const signers = new Map(
    ((signerData ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (
    <>
      <PageHeader
        section="Phân hệ IX - Sổ chủ nhiệm"
        title="Ký duyệt sổ chủ nhiệm"
        description="Ký xác nhận sổ chủ nhiệm theo kỳ. BGH xem và ký cho toàn bộ lớp."
      />
      <SignoffClient
        signoffs={signoffs}
        classNames={Object.fromEntries(classNames)}
        signerNames={Object.fromEntries(signers)}
        profileId={profile.id}
      />
    </>
  );
}
