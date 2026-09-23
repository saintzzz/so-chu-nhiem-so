import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ExportClient } from "@/components/register/export-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
} from "@/components/register/server-utils";
import { CURRENT_MONTH } from "@/components/register/types";

export default async function ExportPage() {
  const profile = await requireRoles(["gvcn"]);
  const classes = await getAccessibleClasses(profile);

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Xuất sổ chủ nhiệm"
        description="Xuất dữ liệu sổ chủ nhiệm (học sinh, điểm, chuyên cần) ra Excel hoặc bản in."
      />
      {classes.length === 0 ? (
        <EmptyClassNotice />
      ) : (
        <ExportClient
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          defaultPeriod={CURRENT_MONTH}
        />
      )}
    </>
  );
}
