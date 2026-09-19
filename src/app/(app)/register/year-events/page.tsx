import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { YearEventsClient } from "@/components/register/year-events-client";
import type { SchoolYearEvent } from "@/components/register/types";

export default async function YearEventsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("school_year_events")
    .select("*")
    .order("event_date");

  const events = (data ?? []) as SchoolYearEvent[];

  return (
    <>
      <PageHeader
        section="Phân hệ IX - Sổ chủ nhiệm"
        title="Lịch năm học"
        description="Quản lý sự kiện năm học — nguồn dữ liệu cho gợi ý công việc AI."
      />
      <YearEventsClient events={events} schoolId={profile.school_id} />
    </>
  );
}
