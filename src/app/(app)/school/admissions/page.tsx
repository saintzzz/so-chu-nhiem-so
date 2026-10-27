import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireModule } from "@/lib/modules";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { NewCampaignForm } from "@/components/school/admissions-board";

const LEVEL_LABEL: Record<string, string> = {
  khoi_6: "Vào lớp 6 - xét tuyển",
  khoi_10: "Vào lớp 10 - thi tuyển",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  open: "Đang nhận hồ sơ",
  closed: "Đã đóng",
};

export default async function AdmissionsPage() {
  const profile = await requireRoles(["bgh", "pht", "admin"]);
  await requireModule("tuyen_sinh");
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: campaigns }, { data: years }, { data: counts }] =
    await Promise.all([
      must(
        supabase
          .from("admission_campaigns")
          .select("id,level,name,quota,benchmark,status,academic_year_id,created_at")
          .eq("school_id", sid)
          .order("created_at", { ascending: false }),
        "admission_campaigns",
      ),
      must(
        supabase
          .from("academic_years")
          .select("id,name,is_current")
          .eq("school_id", sid)
          .order("start_date", { ascending: false }),
        "academic_years",
      ),
      must(
        supabase
          .from("admission_applications")
          .select("campaign_id")
          .eq("school_id", sid),
        "admission_applications",
      ),
    ]);

  const countBy: Record<string, number> = {};
  for (const c of counts ?? []) {
    countBy[c.campaign_id] = (countBy[c.campaign_id] ?? 0) + 1;
  }
  const yearName: Record<string, string> = {};
  for (const y of years ?? []) yearName[y.id] = y.name;

  return (
    <div className="space-y-6">
      <PageHeader
        section="Tuyển sinh"
        title="Tuyển sinh đầu cấp"
        description="Đợt tuyển vào lớp 6 (xét tuyển) và lớp 10 (thi tuyển) - nhận hồ sơ, duyệt, thi, nhập học."
      />
      <NewCampaignForm years={years ?? []} />
      <div className="space-y-3">
        {(campaigns ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">
            Chưa có đợt tuyển nào. Tạo đợt tuyển ở trên.
          </p>
        )}
        {(campaigns ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/school/admissions/${c.id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400"
          >
            <div>
              <p className="font-medium text-zinc-900">{c.name}</p>
              <p className="text-sm text-zinc-500">
                {LEVEL_LABEL[c.level] ?? c.level}
                {c.academic_year_id ? ` · ${yearName[c.academic_year_id]}` : ""}
                {c.quota != null ? ` · Chỉ tiêu ${c.quota}` : ""}
                {c.benchmark != null ? ` · Điểm chuẩn ${c.benchmark}` : ""}
              </p>
            </div>
            <div className="text-right text-sm">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
              <p className="mt-1 text-zinc-500">
                {countBy[c.id] ?? 0} hồ sơ
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
