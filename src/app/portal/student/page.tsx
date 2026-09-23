import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal/portal-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, ATT_STATUS } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { Bell, CalendarDays } from "lucide-react";
import { semesterAverage, yearAverage } from "@/lib/tt22";
import { currentSchoolYearVN, fmtDateVN } from "@/lib/utils";
import type {
  Announcement,
  AttendanceRecord,
  ClassRoom,
  Grade,
  Student,
  Subject,
} from "@/types";

function formatDate(iso: string): string {
  return fmtDateVN(iso);
}

function pickString(row: Record<string, unknown>, key: string): string | null {
  const v = row[key];
  return typeof v === "string" ? v : null;
}

export default async function StudentPortalPage() {
  const profile = await requireRoles(["hoc_sinh"]);
  const supabase = await createClient();

  const { data: studentRow } = await supabase
    .from("students")
    .select("id,class_id,full_name,code,positive_points,dob,gender,address,national_id")
    .eq("profile_id", profile.id)
    .limit(1)
    .single();
  const student = studentRow as Pick<
    Student,
    | "id"
    | "class_id"
    | "full_name"
    | "code"
    | "positive_points"
    | "dob"
    | "gender"
    | "address"
    | "national_id"
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

  const [attRes, gradeRes, subjectRes, conductRes, annRes, examRes, evRes, ttRes] =
    student ? await Promise.all([
        supabase
          .from("attendance_records")
          .select("id,date,status")
          .eq("student_id", student.id)
          .order("date", { ascending: false })
          .limit(120),
        supabase
          .from("grades")
          .select("id,subject_id,term,assessment_type,score,result")
          .eq("student_id", student.id),
        supabase
          .from("subjects")
          .select("id,name")
          .eq("school_id", classroom?.school_id ?? ""),
        supabase
          .from("conduct_evaluations")
          .select("*")
          .eq("student_id", student.id)
          .limit(5),
        supabase
          .from("announcements")
          .select("id,title,content,created_at")
          .or(
            `class_id.eq.${student.class_id},student_id.eq.${student.id},and(class_id.is.null,school_id.eq.${classroom?.school_id ?? "none"})`,
          )
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("exam_sessions")
          .select("id,date,start_time,room,subject_id,exams!inner(name,status)")
          .eq("class_id", student.class_id)
          .gte("date", new Date().toISOString().slice(0, 10))
          .order("date")
          .limit(10),
        supabase
          .from("school_year_events")
          .select("id,title,event_date,category")
          .eq("school_id", classroom?.school_id ?? "")
          .gte("event_date", new Date().toISOString().slice(0, 10))
          .order("event_date")
          .limit(12),
        supabase
          .from("timetable_entries")
          .select("id,subject_id,teacher_id,weekday,period,room")
          .eq("class_id", student.class_id)
          .order("weekday")
          .order("period"),
      ])
    : [
        { data: [] },
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
    "id" | "date" | "status"
  >[];
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayRec = attRows.find((r) => r.date === todayIso);
  const latestRec = attRows[0];
  const shownRec = todayRec ?? latestRec;

  // Streak: số ngày có điểm danh liên tiếp đi học (có mặt/đi muộn), tính từ
  // ngày gần nhất lùi về - ngày không có bản ghi (cuối tuần/nghỉ) không ngắt streak.
  let streak = 0;
  for (const r of attRows) {
    if (r.status === "present" || r.status === "late") streak++;
    else break;
  }

  const ttEntries = (ttRes.data ?? []) as {
    id: string;
    subject_id: string;
    teacher_id: string | null;
    weekday: number;
    period: number;
    room: string | null;
  }[];
  const ttTeacherIds = [
    ...new Set(ttEntries.map((e) => e.teacher_id).filter(Boolean) as string[]),
  ];
  const { data: ttTeacherRows } = ttTeacherIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", ttTeacherIds)
    : { data: [] };
  const ttTeacherName = new Map(
    ((ttTeacherRows ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );
  const WEEKDAYS = [2, 3, 4, 5, 6, 7] as const;
  const PERIODS = [1, 2, 3, 4, 5] as const;
  const ttGrid = new Map(ttEntries.map((e) => [`${e.weekday}-${e.period}`, e]));

  const subjectNameOf = new Map(
    ((subjectRes.data ?? []) as Pick<Subject, "id" | "name">[]).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const gradeRows = (gradeRes.data ?? []) as Pick<
    Grade,
    "id" | "subject_id" | "term" | "assessment_type" | "score" | "result"
  >[];
  // ĐTBm cả năm theo TT22 cho từng môn; môn nhận xét hiển thị Đạt/Chưa đạt
  const bySubject = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    const arr = bySubject.get(g.subject_id) ?? [];
    arr.push(g);
    bySubject.set(g.subject_id, arr);
  }
  const subjectAverages = [...bySubject.entries()]
    .map(([subjectId, rows]) => {
      const commentRow = rows.find((r) => r.result != null);
      const hk1 = semesterAverage(
        rows.filter((r) => r.term === "hk1"),
      );
      const hk2 = semesterAverage(
        rows.filter((r) => r.term === "hk2"),
      );
      return {
        name: subjectNameOf.get(subjectId) ?? "Môn học",
        hk1,
        hk2,
        avg: yearAverage(hk1, hk2),
        result: commentRow?.result ?? null,
        count: rows.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const scoredAvgs = subjectAverages
    .map((s) => s.avg)
    .filter((a): a is number => a != null);
  const overallAvg = scoredAvgs.length
    ? (
        scoredAvgs.reduce((x, y) => x + y, 0) / scoredAvgs.length
      ).toFixed(1)
    : "-";

  const conductRows = (conductRes.data ?? []) as Record<string, unknown>[];
  const latestConduct = conductRows[0];
  const RATING_LABELS: Record<string, string> = {
    tot: "Tốt",
    kha: "Khá",
    dat: "Đạt",
    chua_dat: "Chưa đạt",
  };
  const rawRating = latestConduct
    ? (pickString(latestConduct, "rating") ??
      pickString(latestConduct, "level") ??
      pickString(latestConduct, "classification") ??
      pickString(latestConduct, "grade"))
    : null;
  const conductRating = rawRating
    ? (RATING_LABELS[rawRating] ?? rawRating)
    : latestConduct
      ? "Đã đánh giá"
      : null;

  const announcements = (annRes.data ?? []) as Pick<
    Announcement,
    "id" | "title" | "content" | "created_at"
  >[];

  const yearEvents = (evRes.data ?? []) as {
    id: string;
    title: string;
    event_date: string;
    category: string | null;
  }[];

  const examSessions = ((examRes.data ?? []) as unknown as {
    id: string;
    date: string;
    start_time: string;
    room: string | null;
    subject_id: string;
    exams: { name: string; status: string };
  }[]).filter((s) => s.exams.status === "published");

  return (
    <div className="theme-fluent min-h-screen bg-background">
      <PortalHeader title="Cổng học sinh" userName={profile.full_name} />

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          {student ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Học sinh
              </p>
              <h1 className="mt-1 text-xl font-semibold">
                {student.full_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Lớp {classroom?.name ?? "-"} - Năm học {currentSchoolYearVN()} · Mã HS:{" "}
                {student.code}
              </p>
              <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Ngày sinh: </span>
                  {student.dob ? formatDate(student.dob) : "-"}
                </p>
                <p>
                  <span className="text-muted-foreground">Giới tính: </span>
                  {student.gender === "nam"
                    ? "Nam"
                    : student.gender === "nu"
                      ? "Nữ"
                      : "-"}
                </p>
                <p>
                  <span className="text-muted-foreground">Mã định danh: </span>
                  {student.national_id ?? "-"}
                </p>
                <p>
                  <span className="text-muted-foreground">Địa chỉ: </span>
                  {student.address ?? "-"}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tài khoản chưa được liên kết với hồ sơ học sinh.
            </p>
          )}
        </div>

        {student && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                label="Điểm trung bình"
                value={overallAvg}
                tone="primary"
              />
              <StatCard
                label="Hạnh kiểm"
                value={conductRating ?? "-"}
                tone={conductRating ? "success" : "default"}
              />
              <StatCard
                label="Đi học liên tiếp"
                value={streak > 0 ? `${streak} ngày` : "-"}
                tone={streak >= 10 ? "success" : streak > 0 ? "primary" : "default"}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Lịch học tuần</h2>
                <a
                  href="/portal/student/hoc-ba"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Xem học bạ chi tiết
                </a>
              </div>
              {ttEntries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Lớp chưa có thời khóa biểu.
                </p>
              ) : (
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
                          Tiết
                        </th>
                        {WEEKDAYS.map((d) => (
                          <th
                            key={d}
                            className="px-2 py-1.5 text-left text-xs font-medium"
                          >
                            Thứ {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map((p) => (
                        <tr key={p} className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">
                            {p}
                          </td>
                          {WEEKDAYS.map((d) => {
                            const e = ttGrid.get(`${d}-${p}`);
                            return (
                              <td key={d} className="px-1 py-1">
                                {e && (
                                  <div className="rounded-md bg-primary-bg px-2 py-1">
                                    <p className="text-xs font-medium leading-tight">
                                      {subjectNameOf.get(e.subject_id) ?? "?"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {e.teacher_id
                                        ? (ttTeacherName.get(e.teacher_id) ?? "")
                                        : ""}
                                      {e.room ? ` - ${e.room}` : ""}
                                    </p>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold">
                Điểm trung bình theo môn
              </h2>
              <DataTable
                columns={[
                  "Môn học",
                  "ĐTBm HK1",
                  "ĐTBm HK2",
                  "ĐTBm cả năm",
                ]}
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

            {examSessions.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
                <h2 className="mb-3 text-base font-semibold">Lịch thi sắp tới</h2>
                <DataTable columns={["Kỳ thi", "Môn", "Ngày", "Giờ", "Phòng"]}>
                  {examSessions.map((s) => (
                    <tr key={s.id}>
                      <td className="text-muted-foreground">{s.exams.name}</td>
                      <td className="font-medium">
                        {subjectNameOf.get(s.subject_id) ?? "-"}
                      </td>
                      <td>{formatDate(s.date)}</td>
                      <td>{s.start_time?.slice(0, 5)}</td>
                      <td>{s.room ?? "-"}</td>
                    </tr>
                  ))}
                </DataTable>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <CalendarDays className="size-4 text-muted-foreground" />
                Sự kiện năm học
              </h2>
              {yearEvents.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Chưa có sự kiện nào sắp diễn ra.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {yearEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="w-12 shrink-0 rounded-lg bg-primary-bg px-2 py-1 text-center text-xs font-semibold text-primary">
                        {formatDate(e.event_date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {e.title}
                      </span>
                      {e.category && (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          {e.category}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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
          </>
        )}
      </main>
    </div>
  );
}
