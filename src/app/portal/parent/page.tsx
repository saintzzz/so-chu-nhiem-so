import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal/portal-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge, ATT_STATUS, FLOW_STATUS } from "@/components/status-badge";
import { Bell, CalendarClock } from "lucide-react";
import { fmtDateVN, fmtTimeDateVN } from "@/lib/utils";
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
import { semesterAverage, yearAverage } from "@/lib/tt22";

interface ParentStudentLink {
  parent_id: string;
  student_id: string;
}

function formatDate(iso: string): string {
  return fmtDateVN(iso);
}

function formatDateTime(iso: string): string {
  return fmtTimeDateVN(iso);
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
        .select("id,name,school_id")
        .eq("id", student.class_id)
        .single()
    : { data: null };
  const classroom = classRow as Pick<
    ClassRoom,
    "id" | "name" | "school_id"
  > | null;

  const [attRes, gradeRes, annRes, apptRes, examRes, cmhsRes, subjectRes] = student
    ? await Promise.all([
        supabase
          .from("attendance_records")
          .select("id,date,status,note")
          .eq("student_id", student.id)
          .order("date", { ascending: false })
          .limit(40),
        supabase
          .from("grades")
          .select("id,subject_id,term,assessment_type,score,result")
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
        supabase
          .from("exam_sessions")
          .select("id,date,start_time,room,subject_id,exams!inner(name,status)")
          .eq("class_id", student.class_id)
          .gte("date", new Date().toISOString().slice(0, 10))
          .order("date")
          .limit(10),
        supabase
          .from("cmhs_members")
          .select("id,role,parents(id,full_name,phone)")
          .eq("class_id", student.class_id)
          .order("role"),
        supabase
          .from("subjects")
          .select("id,name")
          .eq("school_id", classroom?.school_id ?? ""),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

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
    "id" | "subject_id" | "term" | "assessment_type" | "score" | "result"
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

  const subjectNames = new Map(
    ((subjectRes.data ?? []) as { id: string; name: string }[]).map(
      (x) => [x.id, x.name],
    ),
  );

  // ĐTBm HK1/HK2/cả năm theo TT22 cho từng môn; môn nhận xét hiển thị Đạt/Chưa đạt
  const bySubject = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    const arr = bySubject.get(g.subject_id) ?? [];
    arr.push(g);
    bySubject.set(g.subject_id, arr);
  }
  const subjectAverages = [...bySubject.entries()]
    .map(([subjectId, rows]) => {
      const commentRow = rows.find((r) => r.result != null);
      const hk1 = semesterAverage(rows.filter((r) => r.term === "hk1"));
      const hk2 = semesterAverage(rows.filter((r) => r.term === "hk2"));
      return {
        name: subjectNames.get(subjectId) ?? "Môn học",
        hk1,
        hk2,
        avg: yearAverage(hk1, hk2),
        result: commentRow?.result ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const announcements = (annRes.data ?? []) as Pick<
    Announcement,
    "id" | "title" | "content" | "created_at"
  >[];
  const appointments = (apptRes.data ?? []) as Pick<
    Appointment,
    "id" | "teacher_id" | "scheduled_at" | "purpose" | "status"
  >[];

  const examSessions = ((examRes.data ?? []) as unknown as {
    id: string;
    date: string;
    start_time: string;
    room: string | null;
    subject_id: string;
    exams: { name: string; status: string };
  }[]).filter((x) => x.exams.status === "published");
  const cmhsMembers = (cmhsRes.data ?? []) as unknown as {
    id: string;
    role: string;
    parents: { id: string; full_name: string; phone: string | null } | null;
  }[];
  const CMHS_ROLE: Record<string, string> = {
    truong_ban: "Trưởng ban",
    pho_ban: "Phó ban",
    uy_vien: "Ủy viên",
  };

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
    <div className="theme-fluent min-h-screen bg-background">
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

            {examSessions.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
                <h2 className="mb-3 text-base font-semibold">Lịch thi sắp tới</h2>
                <DataTable columns={["Kỳ thi", "Môn", "Ngày", "Giờ", "Phòng"]}>
                  {examSessions.map((x) => (
                    <tr key={x.id}>
                      <td className="text-muted-foreground">{x.exams.name}</td>
                      <td className="font-medium">
                        {subjectNames.get(x.subject_id) ?? "-"}
                      </td>
                      <td>{formatDate(x.date)}</td>
                      <td>{x.start_time?.slice(0, 5)}</td>
                      <td>{x.room ?? "-"}</td>
                    </tr>
                  ))}
                </DataTable>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-base font-semibold">
                Điểm trung bình theo môn
              </h2>
              <DataTable
                columns={["Môn học", "ĐTBm HK1", "ĐTBm HK2", "ĐTBm cả năm"]}
              >
                {subjectAverages.map((s) => (
                  <tr key={s.name}>
                    <td className="font-medium">{s.name}</td>
                    {s.result != null ? (
                      <td colSpan={3} className="font-semibold">
                        {s.result === "dat" ? "Đạt" : "Chưa đạt"}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (môn đánh giá bằng nhận xét)
                        </span>
                      </td>
                    ) : (
                      <>
                        <td>{s.hk1 != null ? s.hk1.toFixed(1) : "-"}</td>
                        <td>{s.hk2 != null ? s.hk2.toFixed(1) : "-"}</td>
                        <td className="font-semibold">
                          {s.avg != null ? s.avg.toFixed(1) : "-"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {subjectAverages.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Chưa có điểm nào.
                    </td>
                  </tr>
                )}
              </DataTable>
            </div>

            {cmhsMembers.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
                <h2 className="mb-3 text-base font-semibold">
                  Ban đại diện cha mẹ học sinh lớp
                </h2>
                <ul className="space-y-2">
                  {cmhsMembers.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {m.parents?.full_name ?? "-"}
                      </span>
                      <span className="text-muted-foreground">
                        {CMHS_ROLE[m.role] ?? m.role}
                        {m.parents?.phone ? ` - ${m.parents.phone}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
