import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal/portal-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, ATT_STATUS, FLOW_STATUS } from "@/components/status-badge";
import { Bell, CalendarClock } from "lucide-react";
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
import { semesterAverage } from "@/lib/tt22";

interface ParentStudentLink {
  parent_id: string;
  student_id: string;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = iso.slice(0, 10).split("-").reverse().join("/");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${date}`;
}

const APPT_STATUS: Record<
  Appointment["status"],
  { label: string; tone: "primary" | "success" | "muted" }
> = {
  proposed: { label: "Đề xuất", tone: "primary" },
  confirmed: { label: "Đã xác nhận", tone: "success" },
  done: { label: "Hoàn thành", tone: "muted" },
  cancelled: { label: "Đã hủy", tone: "muted" },
};

export default async function ParentPortalPage() {
  const profile = await requireRoles(["phu_huynh"]);
  const supabase = await createClient();

  const { data: parentRow } = await supabase
    .from("parents")
    .select("id,full_name,relationship")
    .eq("profile_id", profile.id)
    .limit(1)
    .single();
  const parent = parentRow as Pick<
    Parent,
    "id" | "full_name" | "relationship"
  > | null;

  const { data: linkRows } = parent
    ? await supabase
        .from("parent_students")
        .select("parent_id,student_id")
        .eq("parent_id", parent.id)
        .limit(1)
    : { data: [] };
  const link = ((linkRows ?? []) as ParentStudentLink[])[0] ?? null;

  const { data: studentRow } = link
    ? await supabase
        .from("students")
        .select("id,class_id,full_name,code")
        .eq("id", link.student_id)
        .single()
    : { data: null };
  const student = studentRow as Pick<
    Student,
    "id" | "class_id" | "full_name" | "code"
  > | null;

  const { data: classRow } = student
    ? await supabase
        .from("classes")
        .select("id,name")
        .eq("id", student.class_id)
        .single()
    : { data: null };
  const classroom = classRow as Pick<ClassRoom, "id" | "name"> | null;

  const [attRes, gradeRes, annRes, apptRes] = student
    ? await Promise.all([
        supabase
          .from("attendance_records")
          .select("id,date,status,note")
          .eq("student_id", student.id)
          .order("date", { ascending: false })
          .limit(40),
        supabase
          .from("grades")
          .select("id,subject_id,term,assessment_type,score")
          .eq("student_id", student.id),
        supabase
          .from("announcements")
          .select("id,title,content,created_at")
          .or(`class_id.eq.${student.class_id},student_id.eq.${student.id}`)
          .order("created_at", { ascending: false })
          .limit(8),
        parent
          ? supabase
              .from("appointments")
              .select("id,teacher_id,scheduled_at,purpose,status")
              .eq("parent_id", parent.id)
              .order("scheduled_at", { ascending: false })
              .limit(8)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const attRows = (attRes.data ?? []) as Pick<
    AttendanceRecord,
    "id" | "date" | "status" | "note"
  >[];
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayRec = attRows.find((r) => r.date === todayIso);
  const latestRec = attRows[0];
  const shownRec = todayRec ?? latestRec;

  const anchor = latestRec?.date ?? todayIso;
  const monthPrefix = anchor.slice(0, 7);
  const monthRows = attRows.filter((r) => r.date.startsWith(monthPrefix));
  const attended = monthRows.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const monthRate = monthRows.length
    ? ((attended / monthRows.length) * 100).toFixed(0) + "%"
    : "-";

  const gradeRows = (gradeRes.data ?? []) as Pick<
    Grade,
    "id" | "subject_id" | "term" | "assessment_type" | "score"
  >[];
  const bySubjectTerm = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    const key = `${g.subject_id}|${g.term}`;
    const arr = bySubjectTerm.get(key) ?? [];
    arr.push(g);
    bySubjectTerm.set(key, arr);
  }
  const subjectAvgs: number[] = [];
  for (const rows of bySubjectTerm.values()) {
    const a = semesterAverage(rows);
    if (a != null) subjectAvgs.push(a);
  }
  const avgScore = subjectAvgs.length
    ? (
        subjectAvgs.reduce((x, y) => x + y, 0) / subjectAvgs.length
      ).toFixed(1)
    : "-";

  const announcements = (annRes.data ?? []) as Pick<
    Announcement,
    "id" | "title" | "content" | "created_at"
  >[];
  const appointments = (apptRes.data ?? []) as Pick<
    Appointment,
    "id" | "teacher_id" | "scheduled_at" | "purpose" | "status"
  >[];

  const teacherIds = [...new Set(appointments.map((a) => a.teacher_id))];
  const { data: teacherRows } = teacherIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", teacherIds)
    : { data: [] };
  const teacherNameOf = new Map(
    ((teacherRows ?? []) as Pick<Profile, "id" | "full_name">[]).map((t) => [
      t.id,
      t.full_name,
    ]),
  );

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader title="Cổng phụ huynh" userName={profile.full_name} />

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          {student ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Con em
              </p>
              <h1 className="mt-1 text-xl font-semibold">
                Con em: {student.full_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Lớp {classroom?.name ?? "-"} - Năm học 2026-2027 · Mã HS:{" "}
                {student.code}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa có học sinh nào được liên kết với tài khoản này.
            </p>
          )}
        </div>

        {student && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label={`Chuyên cần ${todayRec ? "hôm nay" : latestRec ? `ngày ${formatDate(latestRec.date)}` : "hôm nay"}`}
                value={
                  shownRec ? (
                    <StatusBadge
                      label={ATT_STATUS[shownRec.status].label}
                      tone={ATT_STATUS[shownRec.status].tone}
                    />
                  ) : (
                    "-"
                  )
                }
              />
              <StatCard
                label="Tỷ lệ chuyên cần tháng này"
                value={monthRate}
                tone="success"
              />
              <StatCard
                label="Điểm trung bình gần nhất"
                value={avgScore}
                tone="primary"
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Bell className="size-4 text-muted-foreground" />
                Thông báo gần đây
              </h2>
              {announcements.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Chưa có thông báo nào.
                </p>
              ) : (
                <ul className="space-y-3">
                  {announcements.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{a.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(a.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                        {a.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <CalendarClock className="size-4 text-muted-foreground" />
                Lịch hẹn với giáo viên
              </h2>
              {appointments.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Chưa có lịch hẹn nào.
                </p>
              ) : (
                <ul className="space-y-3">
                  {appointments.map((a) => {
                    const st = APPT_STATUS[a.status] ?? FLOW_STATUS.proposed;
                    return (
                      <li
                        key={a.id}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            {formatDateTime(a.scheduled_at)}
                          </p>
                          <StatusBadge label={st.label} tone={st.tone} />
                          <span className="ml-auto text-xs text-muted-foreground">
                            GV: {teacherNameOf.get(a.teacher_id) ?? "-"}
                          </span>
                        </div>
                        {a.purpose && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {a.purpose}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
