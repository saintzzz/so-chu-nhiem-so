import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { SeatingHistoryClient } from "@/components/register/seating-history-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  LoadErrorNotice,
  pickClass,
} from "@/components/register/server-utils";
import type { SeatingChart } from "@/types";

export default async function SeatingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const { classes, error: classesErr } = await getAccessibleClasses(profile);
  const cls = pickClass(classes, classParam);

  if (classesErr) {
    console.error("[register/seating-history] classes:", classesErr);
  }
  if (!cls) {
    return (
      <>
        <PageHeader
          section="Sổ chủ nhiệm"
          title="Lịch sử phiên bản sơ đồ"
        />
        {classesErr ? <LoadErrorNotice /> : <EmptyClassNotice />}
      </>
    );
  }

  const { data, error: chartsErr } = await supabase
    .from("seating_charts")
    .select("*")
    .eq("class_id", cls.id)
    .order("month", { ascending: false })
    .order("version", { ascending: false });

  const charts = (data ?? []) as SeatingChart[];

  // R14-01: scn_restore_seating lat current nguyen tu nhung danh sach phien
  // ban loi/thieu -> hien sai lich su. Loi nguon -> notice thay vi editor.
  const srcErrors = Object.entries({
    classes_source: classesErr,
    seating_charts: chartsErr?.message ?? null,
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[register/seating-history] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Lịch sử phiên bản sơ đồ"
        description={`Lớp ${cls.name} · ${charts.length} phiên bản đã lưu`}
      />
      <ClassChips classes={classes} selectedId={cls.id} href="/register/seating-history" />
      {loadError ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <SeatingHistoryClient key={cls.id} charts={charts} />
      )}
    </>
  );
}
