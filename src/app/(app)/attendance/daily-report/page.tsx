import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DailyReportForm } from "@/components/attendance/daily-report-form";
import { AttendanceDateNav } from "@/components/attendance/date-controls";
import { formatDateOnly, todayVN } from "@/lib/utils";
import type { ClassRoom, DailyReport, Student } from "@/types";
import { must } from "@/lib/supabase/must";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const { class: classParam, date: dateParam } = await searchParams;
  const supabase = await createClient();

  const { data: classData, error: clsErr } = await supabase
    .from("classes")
    .select("*")
    .eq("gvcn_id", profile.id)
    .eq("status", "active")
    .order("name");
  const classes = (classData ?? []) as ClassRoom[];
  const myClass =
    classes.find((c) => c.id === classParam) ?? classes[0] ?? null;

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

  const { data: stuData, error: stuErr } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", myClass.id)
    .eq("status", "active");
  const studentIds = ((stuData ?? []) as Pick<Student, "id">[]).map(
    (s) => s.id,
  );

  // Mặc định: ?date= hoặc ngày có dữ liệu chuyên cần gần nhất của trường
  let today = todayVN();
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    today = dateParam;
  } else {
    const { data: latest } = await must(supabase
      .from("attendance_records")
      .select("date, students!inner(classes!inner(school_id))")
      .eq("students.classes.school_id", profile.school_id ?? "")
      .order("date", { ascending: false })
      .limit(1), "attendance_records");
    const d = (latest ?? []) as { date: string }[];
    if (d[0]?.date) today = d[0].date;
  }

  // r22 M: loi bat ky nguon nao (chuyen can, ren luyen, bao cao cu) PHAI chan
  // form - neu khong, so lieu 0/nhap trong se ghi de bao cao cu va gui sai
  // len lanh dao.
  const [attRes, conductRes, reportRes] = await Promise.all([
    studentIds.length
      ? must(supabase
          .from("attendance_records")
          .select("status")
          .in("student_id", studentIds)
          .eq("date", today), "attendance_records")
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? must(supabase
          .from("conduct_records")
          .select("type")
          .in("student_id", studentIds)
          .eq("date", today), "conduct_records")
      : Promise.resolve({ data: [], error: null }),
    must(supabase
      .from("daily_reports")
      .select("*")
      .eq("class_id", myClass.id)
      .eq("date", today)
      .maybeSingle(), "daily_reports"),
  ]);
  const loadError =
    (clsErr ?? stuErr ?? attRes.error ?? conductRes.error ?? reportRes.error) !=
    null
      ? "Không tải được dữ liệu báo cáo - vui lòng tải lại trang trước khi lưu."
      : null;

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
      <ClassChips
        classes={classes}
        selectedId={myClass.id}
        href="/attendance/daily-report"
        params={{ date: today }}
      />
      <AttendanceDateNav date={today} params={{ class: myClass.id }} />
      <DailyReportForm
        key={`${myClass.id}-${today}`}
        classId={myClass.id}
        className={myClass.name}
        date={today}
        counts={counts}
        report={report}
        loadError={loadError}
      />
    </div>
  );
}
