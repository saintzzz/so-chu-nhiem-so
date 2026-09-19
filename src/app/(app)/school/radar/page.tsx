import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  CounselingCase,
  Grade,
  Incident,
  Student,
} from "@/types";

type RiskLevel = "low" | "medium" | "high" | "critical";

const LEVEL_META: Record<
  RiskLevel,
  { label: string; tone: "muted" | "warning" | "error"; ring: string }
> = {
  low: {
    label: "Ổn định",
    tone: "muted",
    ring: "border-l-success",
  },
  medium: {
    label: "Cần theo dõi",
    tone: "warning",
    ring: "border-l-warning",
  },
  high: {
    label: "Cảnh báo",
    tone: "error",
    ring: "border-l-error",
  },
  critical: {
    label: "Nghiêm trọng",
    tone: "error",
    ring: "border-l-error",
  },
};

const OPEN_INCIDENT = new Set(["new", "following"]);
const OPEN_CASE = new Set(["new", "assessing", "counseling", "referred"]);

interface ClassRisk {
  classId: string;
  className: string;
  unexcused: number;
  lowGrades: number;
  openIncidents: number;
  pendingCounseling: number;
  score: number;
  level: RiskLevel;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function levelOf(score: number): RiskLevel {
  if (score >= 15) return "critical";
  if (score >= 8) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export default async function SchoolRadarPage() {
  const profile = await requireRoles(["bgh", "admin"]);
  const supabase = await createClient();

  const { data: classRows } = await supabase
    .from("classes")
    .select("id,name")
    .eq("school_id", profile.school_id ?? "")
    .order("name");
  const classes = (classRows ?? []) as Pick<ClassRoom, "id" | "name">[];
  const classIds = classes.map((c) => c.id);

  const { data: studentRows } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id")
        .in("class_id", classIds)
    : { data: [] };
  const students = (studentRows ?? []) as Pick<Student, "id" | "class_id">[];
  const studentIds = students.map((s) => s.id);
  const classOfStudent = new Map(students.map((s) => [s.id, s.class_id]));

  // Anchor the 30-day window to the newest data available.
  const { data: latestAtt } = studentIds.length
    ? await supabase
        .from("attendance_records")
        .select("date")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
        .limit(1)
    : { data: [] };
  const anchor =
    ((latestAtt ?? [])[0] as Pick<AttendanceRecord, "date"> | undefined)
      ?.date ?? new Date().toISOString().slice(0, 10);
  const windowStart = addDays(anchor, -29);

  const [attRes, gradeRes, incidentRes, counselingRes] = await Promise.all([
    studentIds.length
      ? supabase
          .from("attendance_records")
          .select("student_id")
          .in("student_id", studentIds)
          .eq("status", "unexcused")
          .gte("date", windowStart)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase
          .from("grades")
          .select("student_id")
          .in("student_id", studentIds)
          .lt("score", 5)
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase
          .from("incidents")
          .select("id,class_id,status")
          .in("class_id", classIds)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase
          .from("counseling_cases")
          .select("id,student_id,status")
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const unexcused = (attRes.data ?? []) as Pick<
    AttendanceRecord,
    "student_id"
  >[];
  const lowGrades = (gradeRes.data ?? []) as Pick<Grade, "student_id">[];
  const incidents = (incidentRes.data ?? []) as Pick<
    Incident,
    "id" | "class_id" | "status"
  >[];
  const cases = (counselingRes.data ?? []) as Pick<
    CounselingCase,
    "id" | "student_id" | "status"
  >[];

  const countByClass = new Map<
    string,
    { unexcused: number; lowGrades: number; incidents: number; counseling: number }
  >();
  const bucket = (classId: string) => {
    let b = countByClass.get(classId);
    if (!b) {
      b = { unexcused: 0, lowGrades: 0, incidents: 0, counseling: 0 };
      countByClass.set(classId, b);
    }
    return b;
  };

  for (const r of unexcused) {
    const cid = classOfStudent.get(r.student_id);
    if (cid) bucket(cid).unexcused += 1;
  }
  for (const r of lowGrades) {
    const cid = classOfStudent.get(r.student_id);
    if (cid) bucket(cid).lowGrades += 1;
  }
  for (const r of incidents) {
    if (r.class_id && OPEN_INCIDENT.has(r.status)) {
      bucket(r.class_id).incidents += 1;
    }
  }
  for (const r of cases) {
    if (OPEN_CASE.has(r.status)) {
      const cid = classOfStudent.get(r.student_id);
      if (cid) bucket(cid).counseling += 1;
    }
  }

  const risks: ClassRisk[] = classes
    .map((c) => {
      const b = bucket(c.id);
      const score =
        b.unexcused * 2 + b.lowGrades + b.incidents * 4 + b.counseling * 3;
      return {
        classId: c.id,
        className: c.name,
        unexcused: b.unexcused,
        lowGrades: b.lowGrades,
        openIncidents: b.incidents,
        pendingCounseling: b.counseling,
        score,
        level: levelOf(score),
      };
    })
    .sort((a, b) => b.score - a.score);

  const flagged = risks.filter((r) => r.level !== "low");

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Radar cảnh báo sớm"
        description={`Tổng hợp tín hiệu rủi ro theo lớp — 30 ngày tính đến ${anchor
          .split("-")
          .reverse()
          .join("/")}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {risks.map((r) => {
          const meta = LEVEL_META[r.level];
          return (
            <div
              key={r.classId}
              className={cn(
                "rounded-xl border border-l-4 border-border bg-card p-4 shadow-[var(--shadow-sm-token)]",
                meta.ring,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Lớp {r.className}</h3>
                <StatusBadge label={meta.label} tone={meta.tone} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Vắng KP (30n)</dt>
                  <dd className="font-medium">{r.unexcused}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Điểm &lt;5</dt>
                  <dd className="font-medium">{r.lowGrades}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sự cố mở</dt>
                  <dd className="font-medium">{r.openIncidents}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">HS cần tư vấn</dt>
                  <dd className="font-medium">{r.pendingCounseling}</dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                Điểm rủi ro:{" "}
                <span className="font-semibold text-foreground">{r.score}</span>
              </p>
            </div>
          );
        })}
        {risks.length === 0 && (
          <p className="col-span-full rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Chưa có lớp nào trong trường.
          </p>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold">
        Chi tiết theo lớp{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({flagged.length} lớp cần chú ý)
        </span>
      </h2>
      <DataTable
        columns={[
          "Lớp",
          "Vắng không phép (30 ngày)",
          "Số điểm <5",
          "Sự cố đang mở",
          "Ca tư vấn chờ xử lý",
          "Điểm rủi ro",
          "Mức độ",
        ]}
      >
        {risks.map((r) => {
          const meta = LEVEL_META[r.level];
          return (
            <tr key={r.classId}>
              <td className="font-medium">{r.className}</td>
              <td>{r.unexcused}</td>
              <td>{r.lowGrades}</td>
              <td>{r.openIncidents}</td>
              <td>{r.pendingCounseling}</td>
              <td className="font-semibold">{r.score}</td>
              <td>
                <StatusBadge label={meta.label} tone={meta.tone} />
              </td>
            </tr>
          );
        })}
      </DataTable>
    </>
  );
}
