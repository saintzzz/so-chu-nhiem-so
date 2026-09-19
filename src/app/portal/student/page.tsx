import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal/portal-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, ATT_STATUS } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { Bell } from "lucide-react";
import { semesterAverage, yearAverage } from "@/lib/tt22";
import type {
  Announcement,
  AttendanceRecord,
  ClassRoom,
  Grade,
  Student,
  Subject,
} from "@/types";

function formatDate(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
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
    .select("id,class_id,full_name,code,positive_points")
    .eq("profile_id", profile.id)
    .limit(1)
    .single();
  const student = studentRow as Pick<
    Student,
    "id" | "class_id" | "full_name" | "code" | "positive_points"
  > | null;

  const { data: classRow } = student
    ? await supabase
        .from("classes")
        .select("id,name")
        .eq("id", student.class_id)
        .single()
    : { data: null };
  const classroom = classRow as Pick<ClassRoom, "id" | "name"> | null;

  const [attRes, gradeRes, subjectRes, conductRes, annRes, examRes] = student
    ? await Promise.all([
        supabase
          .from("attendance_records")
          .select("id,date,status")
          .eq("student_id", student.id)
          .order("date", { ascending: false })
          .limit(30),
        supabase
          .from("grades")
          .select("id,subject_id,term,assessment_type,score,result")
          .eq("student_id", student.id),
        supabase.from("subjects").select("id,name"),
        supabase
          .from("conduct_evaluations")
          .select("*")
          .eq("student_id", student.id)
          .limit(5),
        supabase
          .from("announcements")
          .select("id,title,content,created_at")
          .or(`class_id.eq.${student.class_id},student_id.eq.${student.id}`)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("exam_sessions")
          .select("id,date,start_time,room,subject_id,exams!inner(name,status)")
          .eq("class_id", student.class_id)
          .gte("date", new Date().toISOString().slice(0, 10))
          .order("date")
          .limit(10),
      ])
    : [
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

  const examSessions = ((examRes.data ?? []) as unknown as {
    id: string;
    date: string;
    start_time: string;
    room: string | null;
    subject_id: string;
    exams: { name: string; status: string };
  }[]).filter((s) => s.exams.status === "published");

  return (
    <div className="min-h-screen bg-background">
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
                Lớp {classroom?.name ?? "-"} - Năm học 2026-2027 · Mã HS:{" "}
                {student.code}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tài khoản chưa được liên kết với hồ sơ học sinh.
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
                label="Điểm trung bình"
                value={overallAvg}
                tone="primary"
              />
              <StatCard
                label="Hạnh kiểm"
                value={conductRating ?? "-"}
                tone={conductRating ? "success" : "default"}
              />
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold">
                Điểm trung bình theo môn
              </h2>
              <DataTable columns={["Môn học", "Số điểm", "Điểm TB / Kết quả"]}>
                {subjectAverages.map((s) => (
                  <tr key={s.name}>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.count}</td>
                    <td className="font-semibold">
                      {s.result != null
                        ? s.result === "dat"
                          ? "Đạt"
                          : "Chưa đạt"
                        : s.avg != null
                          ? s.avg.toFixed(1)
                          : "-"}
                    </td>
                  </tr>
                ))}
                {subjectAverages.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
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
