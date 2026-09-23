import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ClipboardCheck,
  FileText,
  Megaphone,
  Star,
} from "lucide-react";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { DashboardDateBar } from "@/components/attendance/date-controls";
import { semesterAverage } from "@/lib/tt22";
import { StatCard } from "@/components/stat-card";
import { ChartCard, LineChart } from "@/components/charts";
import {
  cn,
  formatDate as formatDateVN,
  formatDateOnly,
  todayVN,
  currentPeriodVN,
} from "@/lib/utils";



interface ClassRow {
  id: string;
  name: string;
}

interface StudentRow {
  id: string;
  dob: string | null;
  address: string | null;
  gender: string | null;
}

interface FeedItem {
  id: string;
  kind: "notification" | "announcement";
  title: string;
  sub: string | null;
  at: string | null;
}

const TERM_LABELS: Record<string, string> = {
  hk1: "Học kỳ I",
  hk2: "Học kỳ II",
};
const TERM_ORDER = ["hk1", "hk2"];

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDateVN(iso);
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return formatDateVN(iso + "T00:00:00");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    from?: string;
    to?: string;
    class?: string;
  }>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const supabase = await createClient();
  const sp = await searchParams;
  const TODAY = todayVN();
  const EMULATION_PERIOD = currentPeriodVN();
  const dateParam = sp.date && ISO_DATE.test(sp.date) ? sp.date : null;
  const fromParam = sp.from && ISO_DATE.test(sp.from) ? sp.from : null;
  const toParam = sp.to && ISO_DATE.test(sp.to) ? sp.to : null;
  const classParam = sp.class ?? null;
  const rangeMode =
    fromParam !== null && toParam !== null && fromParam <= toParam;

  const [{ data: clsRaw }, { data: schoolRaw }, { data: taughtRaw }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id,name")
        .eq("gvcn_id", profile.id)
        .order("name"),
      profile.school_id
        ? supabase
            .from("schools")
            .select("name")
            .eq("id", profile.school_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("timetable_entries")
        .select("class_id")
        .eq("teacher_id", profile.id),
    ]);
  const homeroomClasses = (clsRaw ?? []) as ClassRow[];
  const homeroomIds = new Set(homeroomClasses.map((c) => c.id));
  const taughtIds = [
    ...new Set(
      ((taughtRaw ?? []) as { class_id: string }[])
        .map((t) => t.class_id)
        .filter((id) => !homeroomIds.has(id)),
    ),
  ];
  const { data: taughtClsRaw } =
    taughtIds.length > 0
      ? await supabase.from("classes").select("id,name").in("id", taughtIds)
      : { data: [] };
  // Lớp chủ nhiệm trước, lớp đang dạy sau (đánh dấu "(dạy)")
  const allClasses: ClassRow[] = [
    ...homeroomClasses,
    ...((taughtClsRaw ?? []) as ClassRow[])
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((c) => ({ ...c, name: `${c.name} (dạy)` })),
  ];
  const cls =
    allClasses.find((c) => c.id === classParam) ?? allClasses[0] ?? null;
  const school = (schoolRaw ?? null) as { name: string } | null;
  const classId = cls?.id ?? null;
  const isHomeroomClass = classId !== null && homeroomIds.has(classId);

  const { data: studentsRaw } = classId
    ? await supabase
        .from("students")
        .select("id,dob,address,gender")
        .eq("class_id", classId)
    : { data: [] };
  const students = (studentsRaw ?? []) as StudentRow[];
  const studentIds = students.map((s) => s.id);
  const hasStudents = studentIds.length > 0;

  // Thẻ chuyên cần: ?date= xem 1 ngày (mặc định ngày có data gần nhất),
  // ?from=&to= xem tổng hợp theo khoảng ngày.
  let attDate = TODAY;
  if (hasStudents && !dateParam && !rangeMode) {
    const { data: latestAtt } = await supabase
      .from("attendance_records")
      .select("date")
      .in("student_id", studentIds)
      .order("date", { ascending: false })
      .limit(1);
    if (latestAtt?.[0]?.date) attDate = latestAtt[0].date;
  }
  if (dateParam) attDate = dateParam;
  const rangeFrom = fromParam ?? attDate;
  const rangeTo = toParam ?? attDate;
  const attDateLabel = rangeMode
    ? `${formatDateOnly(rangeFrom, { day: "numeric", month: "numeric" })} - ${formatDateOnly(rangeTo, { day: "numeric", month: "numeric" })}`
    : formatDateOnly(attDate, { day: "numeric", month: "numeric" });

  // All remaining queries only depend on studentIds/classId/profile - run in one batch.
  const since30 = addDaysIso(TODAY, -30);
  const [
    { data: todayAttRaw },
    { count: attTotal },
    { count: attPresent },
    { data: gradeRaw },
    { data: conductRaw },
    { data: casesRaw },
    { count: unreadCount },
    { data: tasksRaw },
    { data: incidentsRaw },
    { data: emuRaw },
    { data: notifRaw },
    { data: annRaw },
    { data: reportRaw },
    { data: evalRaw },
  ] = await Promise.all([
    hasStudents
      ? (() => {
          let q = supabase
            .from("attendance_records")
            .select("student_id,status")
            .in("student_id", studentIds);
          q = rangeMode
            ? q.gte("date", rangeFrom).lte("date", rangeTo)
            : q.eq("date", attDate);
          return q;
        })()
      : Promise.resolve({ data: [] }),
    hasStudents && !rangeMode
      ? supabase
          .from("attendance_records")
          .select("id", { count: "exact", head: true })
          .in("student_id", studentIds)
      : Promise.resolve({ count: 0 }),
    hasStudents && !rangeMode
      ? supabase
          .from("attendance_records")
          .select("id", { count: "exact", head: true })
          .in("status", ["present", "late"])
          .in("student_id", studentIds)
      : Promise.resolve({ count: 0 }),
    hasStudents
      ? supabase
          .from("grades")
          .select("student_id,subject_id,term,assessment_type,score")
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    hasStudents
      ? supabase
          .from("conduct_records")
          .select("student_id")
          .eq("type", "vi_pham")
          .gte("date", since30)
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    hasStudents
      ? supabase
          .from("counseling_cases")
          .select("id")
          .in("student_id", studentIds)
          .neq("status", "resolved")
      : Promise.resolve({ data: [] }),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
    supabase
      .from("tasks")
      .select("id,title,due_date,status,class_id")
      .in("status", ["pending", "approved"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    classId
      ? supabase
          .from("incidents")
          .select("id,type,severity,status,occurred_at")
          .eq("class_id", classId)
          .in("status", ["new", "following"])
      : Promise.resolve({ data: [] }),
    supabase
      .from("emulation_scores")
      .select("class_id,score")
      .eq("period", EMULATION_PERIOD),
    supabase
      .from("notifications")
      .select("id,type,title,body,created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(6),
    classId
      ? supabase
          .from("announcements")
          .select("id,title,content,created_at")
          .eq("class_id", classId)
          .order("created_at", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] }),
    classId
      ? supabase
          .from("daily_reports")
          .select("id,status")
          .eq("class_id", classId)
          .eq("date", rangeMode ? rangeTo : attDate)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    hasStudents
      ? supabase
          .from("conduct_evaluations")
          .select("student_id,comment,rating")
          .in("student_id", studentIds)
          .eq("term", "hk1")
      : Promise.resolve({ data: [] }),
  ]);
  const todayAtt = (todayAttRaw ?? []) as {
    student_id: string;
    status: string;
  }[];
  const presentToday = todayAtt.filter((r) => r.status === "present").length;
  const absentToday = todayAtt.filter(
    (r) => r.status === "excused" || r.status === "unexcused",
  ).length;
  const lateToday = todayAtt.filter((r) => r.status === "late").length;
  const attRate = rangeMode
    ? todayAtt.length > 0
      ? Math.round(
          ((presentToday + lateToday) / todayAtt.length) * 1000,
        ) / 10
      : null
    : attTotal && attTotal > 0
      ? Math.round(((attPresent ?? 0) / attTotal) * 1000) / 10
      : null;

  // Grades: ĐTBm theo TT22 cho từng cặp (học sinh, môn, kỳ) rồi tổng hợp
  const grades = (gradeRaw ?? []) as {
    student_id: string;
    subject_id: string;
    term: string;
    assessment_type: string;
    score: number | null;
  }[];
  const cellRows = new Map<string, typeof grades>();
  for (const g of grades) {
    const key = `${g.student_id}|${g.subject_id}|${g.term}`;
    const arr = cellRows.get(key) ?? [];
    arr.push(g);
    cellRows.set(key, arr);
  }
  const studentAvgs = new Map<string, number[]>();
  const termAvgs = new Map<string, number[]>();
  for (const [key, rows] of cellRows) {
    const a = semesterAverage(rows);
    if (a == null) continue;
    const [sid, , t] = key.split("|");
    studentAvgs.set(sid, [...(studentAvgs.get(sid) ?? []), a]);
    termAvgs.set(t, [...(termAvgs.get(t) ?? []), a]);
  }
  const weakStudents = [...studentAvgs.values()].filter(
    (v) => v.length > 0 && v.reduce((x, y) => x + y, 0) / v.length < 5,
  ).length;
  const chartData = TERM_ORDER.filter((t) => termAvgs.has(t)).map((t) => {
    const vals = termAvgs.get(t) ?? [];
    return {
      label: TERM_LABELS[t] ?? t,
      value:
        Math.round(
          (vals.reduce((x, y) => x + y, 0) / Math.max(vals.length, 1)) * 10,
        ) / 10,
    };
  });

  // Conduct risk: students with a violation in last 30 days
  const conductRisk = new Set(
    ((conductRaw ?? []) as { student_id: string }[]).map((r) => r.student_id),
  ).size;

  const counselingOpen = (casesRaw ?? []).length;

  const allTasks = (tasksRaw ?? []) as {
    id: string;
    title: string;
    due_date: string | null;
    status: string;
    class_id: string | null;
  }[];
  const tasks = allTasks.filter(
    (t) => t.class_id === null || t.class_id === classId,
  );
  const upcomingLimit = addDaysIso(TODAY, 14);
  const upcomingTasks = tasks.filter(
    (t) => t.due_date !== null && t.due_date <= upcomingLimit,
  );
  const openIncidents = (incidentsRaw ?? []) as {
    id: string;
    type: string;
    severity: string;
    status: string;
    occurred_at: string;
  }[];

  // Emulation rank of own class
  const emuTotals = new Map<string, number>();
  for (const r of (emuRaw ?? []) as { class_id: string; score: number }[]) {
    emuTotals.set(r.class_id, (emuTotals.get(r.class_id) ?? 0) + r.score);
  }
  const ownTotal = classId ? (emuTotals.get(classId) ?? 0) : 0;
  const emuRank =
    emuTotals.size > 0 && classId
      ? 1 + [...emuTotals.values()].filter((v) => v > ownTotal).length
      : null;

  // Incomplete student records (missing dob / address / gender)
  const missingFields = { dob: 0, address: 0, gender: 0 };
  const incompleteRecords = students.filter((s) => {
    if (!s.dob) missingFields.dob += 1;
    if (!s.address) missingFields.address += 1;
    if (!s.gender) missingFields.gender += 1;
    return !s.dob || !s.address || !s.gender;
  }).length;
  const missingSummary = (
    [
      [missingFields.dob, "ngày sinh"],
      [missingFields.address, "địa chỉ"],
      [missingFields.gender, "giới tính"],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} thiếu ${label}`)
    .join(", ");

  // Tác vụ nghiệp vụ bắt buộc hôm nay (giống mô hình "chưa điểm danh / chưa
  // nộp báo cáo / chưa đánh giá" của hệ thống tham chiếu)
  const todayReport = (reportRaw ?? null) as {
    id: string;
    status: string;
  } | null;
  const evalRows = (evalRaw ?? []) as {
    student_id: string;
    comment: string | null;
    rating: string | null;
  }[];
  const evaluatedIds = new Set(
    evalRows.filter((e) => e.rating && e.comment).map((e) => e.student_id),
  );
  const missingEvaluations = hasStudents
    ? studentIds.filter((id) => !evaluatedIds.has(id)).length
    : 0;
  const notMarkedToday = hasStudents && !rangeMode && attDate !== todayVN();
  const reportNotSubmitted = todayReport?.status !== "submitted";
  const clsQ = classId ? `&class=${classId}` : "";

  // Activity feed: notifications + announcements
  const feed: FeedItem[] = [
    ...((notifRaw ?? []) as {
      id: string;
      type: string;
      title: string;
      body: string | null;
      created_at: string | null;
    }[]).map((n) => ({
      id: n.id,
      kind: "notification" as const,
      title: n.title,
      sub: n.body,
      at: n.created_at,
    })),
    ...((annRaw ?? []) as {
      id: string;
      title: string;
      content: string | null;
      created_at: string | null;
    }[]).map((a) => ({
      id: a.id,
      kind: "announcement" as const,
      title: a.title,
      sub: a.content,
      at: a.created_at,
    })),
  ]
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${profile.full_name}`}
        description={
          cls
            ? `${isHomeroomClass ? "Lớp chủ nhiệm" : "Lớp đang dạy"} ${cls.name.replace(" (dạy)", "")} - ${school?.name ?? ""}`
            : "Chưa được phân công lớp chủ nhiệm"
        }
        actions={
          <>
            <Link prefetch={false}
              href={classId ? `/attendance/daily?class=${classId}` : "/attendance/daily"}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <ClipboardCheck className="size-4" />
              Điểm danh lớp
            </Link>
            <Link prefetch={false}
              href="/conduct/records"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Star className="size-4" />
              Ghi nhận tuyên dương
            </Link>
          </>
        }
      />

      <ClassChips
        classes={allClasses}
        selectedId={classId ?? ""}
        href="/dashboard"
        params={
          rangeMode
            ? { from: rangeFrom, to: rangeTo }
            : { date: attDate }
        }
      />

      <DashboardDateBar
        mode={rangeMode ? "range" : "day"}
        date={attDate}
        from={rangeFrom}
        to={rangeTo}
        params={classId ? { class: classId } : {}}
      />

      {/* 10 KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label={`${rangeMode ? "Lượt có mặt" : "Học sinh có mặt"} (${attDateLabel})`}
          value={presentToday}
          href={
            rangeMode
              ? `/attendance/history?from=${rangeFrom}&to=${rangeTo}${clsQ}`
              : `/attendance/daily?date=${attDate}${clsQ}`
          }
          tone="success"
        />
        <StatCard
          label={`${rangeMode ? "Lượt vắng" : "Học sinh nghỉ học"} (${attDateLabel})`}
          value={absentToday}
          href={
            rangeMode
              ? `/attendance/history?from=${rangeFrom}&to=${rangeTo}${clsQ}`
              : `/attendance/daily?date=${attDate}${clsQ}`
          }
          tone={absentToday > 0 ? "warning" : "success"}
        />
        <StatCard
          label={`${rangeMode ? "Lượt đi muộn" : "Học sinh đi muộn"} (${attDateLabel})`}
          value={lateToday}
          href={
            rangeMode
              ? `/attendance/leaves?from=${rangeFrom}&to=${rangeTo}${clsQ}`
              : `/attendance/leaves?from=${attDate}&to=${attDate}${clsQ}`
          }
          tone={lateToday > 0 ? "warning" : "default"}
        />
        <StatCard
          label={`Tỷ lệ chuyên cần${rangeMode ? ` (${attDateLabel})` : ""}`}
          value={attRate !== null ? `${attRate}%` : "-"}
          href={
            rangeMode
              ? `/attendance/tracking?to=${rangeTo}`
              : "/attendance/tracking"
          }
          tone="primary"
        />
        <StatCard
          label="Nguy cơ học lực yếu"
          value={weakStudents}
          href="/academics/support"
          tone={weakStudents > 0 ? "error" : "success"}
        />
        <StatCard
          label="Nguy cơ vi phạm"
          value={conductRisk}
          href="/conduct/evaluation"
          tone={conductRisk > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Cần tư vấn"
          value={counselingOpen}
          href="/counseling/intake"
          tone={counselingOpen > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Thông báo chưa đọc"
          value={unreadCount ?? 0}
          href="/notifications"
          tone={(unreadCount ?? 0) > 0 ? "primary" : "default"}
        />
        <StatCard
          label="Công việc sắp đến hạn"
          value={upcomingTasks.length}
          href="/register/plans"
          tone={upcomingTasks.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Thi đua lớp"
          value={emuRank !== null ? `Hạng ${emuRank}` : "-"}
          href="/emulation/ranking"
          tone={emuRank === 1 ? "success" : "primary"}
        />
        <StatCard
          label={`Hồ sơ chưa hoàn thành${missingSummary ? ` (${missingSummary})` : ""}`}
          value={incompleteRecords}
          href="/records/students"
          tone={incompleteRecords > 0 ? "error" : "success"}
        />
      </div>

      {/* Việc cần làm hôm nay */}
      <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-3 text-base font-semibold">Việc cần làm hôm nay</h2>
        {tasks.length === 0 &&
        (unreadCount ?? 0) === 0 &&
        openIncidents.length === 0 &&
        !notMarkedToday &&
        !reportNotSubmitted &&
        missingEvaluations === 0 ? (
          <p className="text-sm text-muted-foreground">
            Không có việc nào cần xử lý. Mọi thứ đều ổn!
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {notMarkedToday && (
              <li>
                <Link prefetch={false}
                  href={classId ? `/attendance/daily?class=${classId}` : "/attendance/daily"}
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error">
                    <ClipboardCheck className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      Chưa điểm danh hôm nay
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Lớp {cls?.name} chưa có dữ liệu chuyên cần ngày hôm nay
                    </span>
                  </span>
                  <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs font-medium text-error">
                    Cần làm ngay
                  </span>
                </Link>
              </li>
            )}
            {reportNotSubmitted && (
              <li>
                <Link prefetch={false}
                  href="/attendance/daily-report"
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning">
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      Chưa nộp báo cáo ngày cho Ban Giám Hiệu
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {todayReport
                        ? "Báo cáo đang ở trạng thái nháp"
                        : "Chưa tạo báo cáo hôm nay"}
                    </span>
                  </span>
                  <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
                    Cần làm ngay
                  </span>
                </Link>
              </li>
            )}
            {missingEvaluations > 0 && (
              <li>
                <Link prefetch={false}
                  href="/conduct/evaluation"
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-primary">
                    <Star className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {missingEvaluations} học sinh chưa có đánh giá học kỳ I
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Hoàn thiện nhận xét và xếp loại rèn luyện
                    </span>
                  </span>
                </Link>
              </li>
            )}
            {tasks.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link prefetch={false}
                  href="/register/plans"
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning">
                    <CalendarClock className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {t.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Hạn: {formatDate(t.due_date)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      t.due_date !== null && t.due_date <= TODAY
                        ? "bg-error-bg text-error"
                        : "bg-warning-bg text-warning",
                    )}
                  >
                    {t.due_date !== null && t.due_date <= TODAY
                      ? "Quá hạn"
                      : "Sắp đến hạn"}
                  </span>
                </Link>
              </li>
            ))}
            {(unreadCount ?? 0) > 0 && (
              <li>
                <Link prefetch={false}
                  href="/parents/inbox"
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-primary">
                    <Bell className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {unreadCount} thông báo chưa đọc
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Kiểm tra hộp thư và thông báo hệ thống
                    </span>
                  </span>
                </Link>
              </li>
            )}
            {openIncidents.length > 0 && (
              <li>
                <Link prefetch={false}
                  href="/safety/followup"
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error">
                    <AlertTriangle className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {openIncidents.length} sự cố chưa xử lý xong
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Theo dõi và cập nhật tiến độ xử lý sự cố
                    </span>
                  </span>
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Chart + activity feed */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Biểu đồ điểm trung bình lớp theo tháng"
          ariaDescription="Biểu đồ đường thể hiện điểm trung bình của lớp theo từng tháng trong năm học"
          tableContent={
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Tháng</th>
                  <th className="py-2 font-medium">Điểm TB lớp</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((d) => (
                  <tr key={d.label} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">{d.label}</td>
                    <td className="py-2 font-medium">{d.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          {chartData.length > 0 ? (
            <LineChart data={chartData} yMax={10} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu điểm
            </p>
          )}
        </ChartCard>

        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h3 className="mb-3 text-base font-semibold">Hoạt động gần đây</h3>
          {feed.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Chưa có hoạt động nào
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {feed.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex gap-3 py-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      item.kind === "announcement"
                        ? "bg-primary-bg text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.kind === "announcement" ? (
                      <Megaphone className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    {item.sub && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.sub}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relTime(item.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
