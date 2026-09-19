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
import { semesterAverage } from "@/lib/tt22";
import { StatCard } from "@/components/stat-card";
import { ChartCard, LineChart } from "@/components/charts";
import { cn } from "@/lib/utils";

const TODAY = "2026-09-18";
const EMULATION_PERIOD = "2026-T9";

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
  return new Date(iso).toLocaleDateString("vi-VN");
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso + "T00:00:00").toLocaleDateString("vi-VN");
}

export default async function DashboardPage() {
  const profile = await requireRoles(["gvcn"]);
  const supabase = await createClient();

  const [{ data: clsRaw }, { data: schoolRaw }] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name")
      .eq("gvcn_id", profile.id)
      .order("name")
      .limit(1),
    profile.school_id
      ? supabase
          .from("schools")
          .select("name")
          .eq("id", profile.school_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const cls = ((clsRaw ?? []) as ClassRow[])[0] ?? null;
  const school = (schoolRaw ?? null) as { name: string } | null;
  const classId = cls?.id ?? null;

  const { data: studentsRaw } = classId
    ? await supabase
        .from("students")
        .select("id,dob,address,gender")
        .eq("class_id", classId)
    : { data: [] };
  const students = (studentsRaw ?? []) as StudentRow[];
  const studentIds = students.map((s) => s.id);
  const hasStudents = studentIds.length > 0;

  // Attendance today + overall rate
  const [{ data: todayAttRaw }, { count: attTotal }, { count: attPresent }] =
    await Promise.all([
      hasStudents
        ? supabase
            .from("attendance_records")
            .select("student_id,status")
            .eq("date", TODAY)
            .in("student_id", studentIds)
        : Promise.resolve({ data: [] }),
      hasStudents
        ? supabase
            .from("attendance_records")
            .select("id", { count: "exact", head: true })
            .in("student_id", studentIds)
        : Promise.resolve({ count: 0 }),
      hasStudents
        ? supabase
            .from("attendance_records")
            .select("id", { count: "exact", head: true })
            .eq("status", "present")
            .in("student_id", studentIds)
        : Promise.resolve({ count: 0 }),
    ]);
  const todayAtt = (todayAttRaw ?? []) as {
    student_id: string;
    status: string;
  }[];
  const absentToday = todayAtt.filter(
    (r) => r.status === "excused" || r.status === "unexcused",
  ).length;
  const lateToday = todayAtt.filter((r) => r.status === "late").length;
  const attRate =
    attTotal && attTotal > 0
      ? Math.round(((attPresent ?? 0) / attTotal) * 1000) / 10
      : null;

  // Grades: ĐTBm theo TT22 cho từng cặp (học sinh, môn, kỳ) rồi tổng hợp
  const { data: gradeRaw } = hasStudents
    ? await supabase
        .from("grades")
        .select("student_id,subject_id,term,assessment_type,score")
        .in("student_id", studentIds)
    : { data: [] };
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
  const since30 = "2026-08-19";
  const { data: conductRaw } = hasStudents
    ? await supabase
        .from("conduct_records")
        .select("student_id")
        .eq("type", "vi_pham")
        .gte("date", since30)
        .in("student_id", studentIds)
    : { data: [] };
  const conductRisk = new Set(
    ((conductRaw ?? []) as { student_id: string }[]).map((r) => r.student_id),
  ).size;

  // Counseling open cases
  const { data: casesRaw } = hasStudents
    ? await supabase
        .from("counseling_cases")
        .select("id")
        .in("student_id", studentIds)
        .neq("status", "resolved")
    : { data: [] };
  const counselingOpen = (casesRaw ?? []).length;

  // Unread notifications + upcoming tasks + unhandled incidents
  const [
    { count: unreadCount },
    { data: tasksRaw },
    { data: incidentsRaw },
  ] = await Promise.all([
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
  ]);
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
  const upcomingLimit = "2026-10-02";
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
  const { data: emuRaw } = await supabase
    .from("emulation_scores")
    .select("class_id,score")
    .eq("period", EMULATION_PERIOD);
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
  const incompleteRecords = students.filter(
    (s) => !s.dob || !s.address || !s.gender,
  ).length;

  // Activity feed: notifications + announcements
  const [{ data: notifRaw }, { data: annRaw }] = await Promise.all([
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
  ]);
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
            ? `Lớp chủ nhiệm ${cls.name} - ${school?.name ?? ""}`
            : "Chưa được phân công lớp chủ nhiệm"
        }
        actions={
          <>
            <Link prefetch={false}
              href="/attendance/daily"
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

      {/* 10 KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="Học sinh nghỉ học hôm nay"
          value={absentToday}
          href="/attendance/daily"
          tone={absentToday > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Học sinh đi học muộn"
          value={lateToday}
          href="/attendance/leaves"
          tone={lateToday > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Tỷ lệ chuyên cần"
          value={attRate !== null ? `${attRate}%` : "-"}
          href="/attendance/tracking"
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
          href="/parents/inbox"
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
          label="Hồ sơ chưa hoàn thành"
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
        openIncidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Không có việc nào cần xử lý. Mọi thứ đều ổn!
          </p>
        ) : (
          <ul className="divide-y divide-border">
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
