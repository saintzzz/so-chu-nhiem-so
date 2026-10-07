import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ExportClient } from "@/components/register/export-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  LoadErrorNotice,
} from "@/components/register/server-utils";
import { currentMonthVN } from "@/components/register/types";

export default async function ExportPage() {
  const profile = await requireRoles(["gvcn"]);
  // So chu nhiem chi thuoc lop minh chu nhiem - lop dang day khong xuat.
  const { classes: accessibleClasses, error: classesErr } =
    await getAccessibleClasses(profile);
  const classes = accessibleClasses.filter((c) => c.gvcn_id === profile.id);
  if (classesErr) {
    console.error("[register/export] classes:", classesErr);
  }

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Xuất sổ chủ nhiệm"
        description="Xuất dữ liệu sổ chủ nhiệm (học sinh, điểm, chuyên cần) ra Excel hoặc bản in."
      />
      {classesErr ? (
        <LoadErrorNotice />
      ) : classes.length === 0 ? (
        <EmptyClassNotice />
      ) : (
        <ExportClient
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          defaultPeriod={currentMonthVN()}
        />
      )}
    </>
  );
}
