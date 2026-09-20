import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DailyReportForm } from "@/components/attendance/daily-report-form";
import { formatDateOnly, todayVN } from "@/lib/utils";
import type { ClassRoom, DailyReport, Student } from "@/types";

export default async function DailyReportPage() {
  const profile = await requireRoles(["gvcn"]);
  const supabase = await createClient();

  const { data: classData } = await supabase
    .from("classes")
    .select("*")
    .eq("gvcn_id", profile.id)
    .eq("status", "active")
    .order("name")
    .limit(1);
  const myClass = ((classData ?? []) as ClassRoom[])[0] ?? null;

  if (!myClass) {
    return (
      <div>
        <PageHeader section="Chuyên cần" title="Báo cáo ngày" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Bạn chưa được phân công chủ nhiệm lớp nào.
        </p>
      </div>
    );
  }

  const { data: stuData } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", myClass.id)
    .eq("status", "active");
  const studentIds = ((stuData ?? []) as Pick<Student, "id">[]).map(
    (s) => s.id,
  );

  // "Hôm nay" = ngày có dữ liệu chuyên cần gần nhất của trường (đồng nhất với trang BGH)
  let today = todayVN();
  {
    const { data: latest } = await supabase
      .from("attendance_records")
      .select("date, students!inner(classes!inner(school_id))")
      .eq("students.classes.school_id", profile.school_id ?? "")
      .order("date", { ascending: false })
      .limit(1);
    const d = (latest ?? []) as { date: string }[];
    if (d[0]?.date) today = d[0].date;
  }

  const [attRes, conductRes, reportRes] = await Promise.all([
    studentIds.length
      ? supabase
          .from("attendance_records")
          .select("status")
          .in("student_id", studentIds)
          .eq("date", today)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase
          .from("conduct_records")
          .select("type")
          .in("student_id", studentIds)
          .eq("date", today)
      : Promise.resolve({ data: [] }),
    supabase
      .from("daily_reports")
      .select("*")
      .eq("class_id", myClass.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  const att = (attRes.data ?? []) as { status: string }[];
  const conduct = (conductRes.data ?? []) as { type: string }[];
  const report = (reportRes.data ?? null) as DailyReport | null;

  const counts = {
    total: studentIds.length,
    absent: att.filter((a) => a.status === "excused" || a.status === "unexcused")
      .length,
    late: att.filter((a) => a.status === "late").length,
    violations: conduct.filter((c) => c.type === "vi_pham").length,
    commendations: conduct.filter((c) => c.type === "khen_thuong").length,
  };

  const dateLabel = formatDateOnly(today, {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        section="Chuyên cần"
        title="Báo cáo ngày"
        description={`Lớp ${myClass.name} · ${dateLabel}. Số liệu tự động tổng hợp từ điểm danh và hồ sơ rèn luyện.`}
      />
      <DailyReportForm
        classId={myClass.id}
        className={myClass.name}
        date={today}
        counts={counts}
        report={report}
      />
    </div>
  );
}
