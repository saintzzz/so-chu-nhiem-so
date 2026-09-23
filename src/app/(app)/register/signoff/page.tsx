import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SignoffClient } from "@/components/register/signoff-client";
import { getAccessibleClasses } from "@/components/register/server-utils";
import type { Signoff } from "@/components/register/types";
import type { Profile } from "@/types";

export default async function SignoffPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  // Chi lop chu nhiem moi duoc nop so - lop dang day khong nam trong pham vi.
  const classes = (await getAccessibleClasses(profile)).filter(
    (c) => profile.role !== "gvcn" || c.gvcn_id === profile.id,
  );
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

  // Resolve names for the "Người nộp / ký" column (submitted_by + signed_by).
  const signerIds = [
    ...new Set(
      signoffs
        .flatMap((s) => [s.signed_by, s.submitted_by])
        .filter((x): x is string => Boolean(x)),
    ),
  ];
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
        section="Sổ chủ nhiệm"
        title={profile.role === "bgh" ? "Ký duyệt sổ chủ nhiệm" : "Nộp sổ chủ nhiệm"}
        description={
          profile.role === "bgh"
            ? "Xem và ký duyệt sổ chủ nhiệm các lớp đã nộp theo kỳ."
            : "Nộp sổ chủ nhiệm lớp mình lên Ban Giám Hiệu để ký duyệt theo kỳ."
        }
      />
      <SignoffClient
        signoffs={signoffs}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        classNames={Object.fromEntries(classNames)}
        signerNames={Object.fromEntries(signers)}
        profileId={profile.id}
        profileName={profile.full_name}
        role={profile.role === "bgh" ? "bgh" : "gvcn"}
      />
    </>
  );
}
