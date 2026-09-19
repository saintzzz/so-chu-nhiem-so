import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { LockRecordsClient } from "@/components/register/lock-records-client";
import { getAccessibleClasses } from "@/components/register/server-utils";
import type { Signoff } from "@/components/register/types";

export default async function LockRecordsPage() {
  const profile = await requireRoles(["bgh"]);
  const supabase = await createClient();

  const classes = await getAccessibleClasses(profile);
  const classIds = classes.map((c) => c.id);
  const classNames = new Map(classes.map((c) => [c.id, c.name]));

  const { data } =
    classIds.length > 0
      ? await supabase
          .from("register_signoffs")
          .select("*")
          .eq("type", "so_hoc_ba")
          .in("class_id", classIds)
          .order("period", { ascending: false })
      : { data: [] };

  const signoffs = (data ?? []) as Signoff[];

  return (
    <>
      <PageHeader
        section="Phân hệ IX - Sổ chủ nhiệm"
        title="Duyệt & khóa sổ học bạ"
        description="Duyệt và khóa sổ học bạ theo kỳ - sau khi khóa, dữ liệu không thể chỉnh sửa."
      />
      <LockRecordsClient
        signoffs={signoffs}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        classNames={Object.fromEntries(classNames)}
        profileId={profile.id}
      />
    </>
  );
}
