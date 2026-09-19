import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, ATT_STATUS, FLOW_STATUS } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalPicker } from "@/components/parents/portal-picker";
import type {
  Announcement,
  Appointment,
  AttendanceRecord,
  ClassRoom,
  Grade,
  Parent,
  Profile,
  Student,
} from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Ngày hiện tại của dữ liệu demo (năm học 2026-2027). */
const TODAY = "2026-09-18";
const MONTH_START = "2026-09-01";
const MONTH_END = "2026-09-30";

async function scopedClasses(
  supabase: Supabase,
  profile: Profile,
): Promise<ClassRoom[]> {
  const wideRoles = ["bgh", "so_gd", "admin", "to_truong"];
  let query = supabase.from("classes").select("*").order("name");
  if (wideRoles.includes(profile.role)) {
    if (profile.school_id) query = query.eq("school_id", profile.school_id);
  } else {
    query = query.eq("gvcn_id", profile.id);
  }
  const { data } = await query;
  return (data ?? []) as ClassRoom[];
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const classes = await scopedClasses(supabase, profile);
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,full_name,class_id,code")
        .in("class_id", classIds)
        .eq("status", "active")
        .order("full_name")
    : { data: [] };
  const students = (studentData ?? []) as Pick<
    Student,
    "id" | "full_name" | "class_id" | "code"
  >[];

  if (students.length === 0) {
    return (
      <div>
        <PageHeader
          section="Phân hệ VI - Phụ huynh"
          title="Cổng thông tin phụ huynh"
          description="Xem trước thông tin mà phụ huynh nhìn thấy về con em mình."
        />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chưa có học sinh nào trong phạm vi quản lý.
        </div>
      </div>
    );
  }

  const selectedId =
    sp.student && students.some((s) => s.id === sp.student)
      ? sp.student
      : students[0].id;
  const student = students.find((s) => s.id === selectedId)!;

  const { data: attData } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", selectedId)
    .gte("date", MONTH_START)
    .lte("date", MONTH_END);
  const monthRecords = (attData ?? []) as AttendanceRecord[];
  const todayRecord = monthRecords.find((r) => r.date === TODAY) ?? null;
  const presentCount = monthRecords.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const monthPct = monthRecords.length
    ? Math.round((presentCount / monthRecords.length) * 100)
    : null;

  const { data: gradeData } = await supabase
    .from("grades")
    .select("score")
    .eq("student_id", selectedId);
  const grades = (gradeData ?? []) as Pick<Grade, "score">[];
  const avgScore = grades.length
    ? (
        grades.reduce((sum, g) => sum + g.score, 0) / grades.length
      ).toFixed(1)
    : null;

  const { data: annData } = await supabase
    .from("announcements")
    .select("*")
    .or(`class_id.eq.${student.class_id},student_id.eq.${selectedId}`)
    .order("created_at", { ascending: false })
    .limit(5);
  const announcements = (annData ?? []) as Announcement[];

  const { data: apptData } = await supabase
    .from("appointments")
    .select("*")
    .eq("student_id", selectedId)
    .order("scheduled_at", { ascending: false })
    .limit(5);
  const appointments = (apptData ?? []) as Appointment[];

  const apptParentIds = [...new Set(appointments.map((a) => a.parent_id))];
  const { data: parentData } = apptParentIds.length
    ? await supabase
        .from("parents")
        .select("id,full_name")
        .in("id", apptParentIds)
    : { data: [] };
  const parentName = new Map(
    ((parentData ?? []) as Pick<Parent, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  const todayStatus = todayRecord ? ATT_STATUS[todayRecord.status] : null;

  return (
    <div>
      <PageHeader
        section="Phân hệ VI - Phụ huynh"
        title="Cổng thông tin phụ huynh"
        description="Xem trước giao diện thông tin mà phụ huynh nhìn thấy về con em mình."
        actions={
          <PortalPicker
            students={students.map((s) => ({
              id: s.id,
              label: `${s.full_name} — ${className.get(s.class_id) ?? ""}`,
            }))}
            selectedId={selectedId}
          />
        }
      />

      <div className="overflow-hidden rounded-xl border-2 border-primary/30 bg-card shadow-[var(--shadow-sm-token)]">
        <div className="border-b border-border bg-primary-bg px-5 py-3">
          <p className="text-sm font-semibold text-primary">
            Cổng thông tin Phụ huynh — Bản xem trước
          </p>
          <p className="text-xs text-muted-foreground">
            {student.full_name} · Lớp {className.get(student.class_id)} · Mã HS:{" "}
            {student.code}
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Điểm danh hôm nay ({TODAY.split("-").reverse().join("/")})
              </p>
              <p className="mt-1 text-lg font-semibold">
                {todayStatus ? (
                  <StatusBadge
                    label={todayStatus.label}
                    tone={todayStatus.tone}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Chưa có dữ liệu
                  </span>
                )}
              </p>
            </div>
            <StatCard
              label="Chuyên cần tháng 9"
              value={monthPct !== null ? `${monthPct}%` : "—"}
              tone={
                monthPct !== null && monthPct < 80 ? "warning" : "success"
              }
            />
            <StatCard
              label="Điểm trung bình"
              value={avgScore ?? "—"}
              tone="primary"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4">
              <h3 className="mb-3 text-sm font-semibold">
                Thông báo mới nhất từ GVCN
              </h3>
              {announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có thông báo.
                </p>
              ) : (
                <ul className="space-y-3">
                  {announcements.map((a) => (
                    <li
                      key={a.id}
                      className="border-b border-border pb-2 last:border-0 last:pb-0"
                    >
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {a.content}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {fmtDateTime(a.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <h3 className="mb-3 text-sm font-semibold">
                Lịch hẹn trao đổi với GVCN
              </h3>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có lịch hẹn.
                </p>
              ) : (
                <ul className="space-y-3">
                  {appointments.map((a) => {
                    const st = FLOW_STATUS[a.status];
                    return (
                      <li
                        key={a.id}
                        className="flex items-start justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {fmtDateTime(a.scheduled_at)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {a.purpose ?? "Trao đổi"} · PH:{" "}
                            {parentName.get(a.parent_id) ?? "—"}
                          </p>
                        </div>
                        <StatusBadge label={st.label} tone={st.tone} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
