import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireModule } from "@/lib/modules";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { must, mustRows } from "@/lib/supabase/must";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  AdmissionBoard,
  type AppRow,
} from "@/components/school/admissions-board";

const LEVEL_LABEL: Record<string, string> = {
  khoi_6: "Vào lớp 6 - xét tuyển",
  khoi_10: "Vào lớp 10 - thi tuyển",
};

export default async function AdmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRoles(["bgh", "pht", "admin"]);
  await requireModule("tuyen_sinh");
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const { data: camp, error: campErr } = await supabase
    .from("admission_campaigns")
    .select("id,level,name,status,quota,benchmark,exam_subjects,school_id")
    .eq("id", id)
    .single();
  if (campErr || !camp || camp.school_id !== sid) notFound();

  const targetGrade = camp.level === "khoi_10" ? 10 : 6;
  const [apps, { data: classes }] = await Promise.all([
    fetchAllRows<AppRow>((from, to) =>
      supabase
        .from("admission_applications")
        .select(
          "id,full_name,dob,gender,id_number,address,source_school,parent_name,parent_phone,exam_number,exam_scores,total_score,status,student_id",
        )
        .eq("campaign_id", id)
        .order("full_name")
        .range(from, to),
    ).then((r) => mustRows(r, "admission_applications").rows),
    must(
      supabase
        .from("classes")
        .select("id,name")
        .eq("school_id", sid)
        .eq("status", "active")
        .eq("grade", targetGrade)
        .order("name"),
      "classes",
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        section="Tuyển sinh"
        title={camp.name}
        description={`${LEVEL_LABEL[camp.level] ?? camp.level} · ${apps.length} hồ sơ`}
      />
      <AdmissionBoard
        campaign={{
          id: camp.id,
          level: camp.level,
          name: camp.name,
          status: camp.status,
          quota: camp.quota,
          benchmark: camp.benchmark,
          exam_subjects: camp.exam_subjects ?? [],
        }}
        applications={apps}
        classes={classes ?? []}
      />
    </div>
  );
}
