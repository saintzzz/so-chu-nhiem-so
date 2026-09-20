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
  EarlyWarning,
  Incident,
  Student,
} from "@/types";
import { semesterAverage } from "@/lib/tt22";
import { WarningList } from "@/components/school/warning-list";

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

const CATEGORY_SUGGESTION: Record<string, string> = {
  chuyen_can:
    "GVCN liên hệ gia đình các em vắng không phép trong tuần này, lập phiếu theo dõi chuyên cần, báo lại BGH nếu tái diễn 2 tuần liên tiếp.",
  hoc_tap:
    "Tổ chuyên môn rà soát tiến độ dạy, GVCN lập kế hoạch hỗ trợ cho từng em điểm dưới 5 và phối hợp GVBM theo dõi hàng tuần.",
  an_toan:
    "BGH chỉ đạo đóng sự cố đang mở trong tuần, rà soát quy trình xử lý và thông tin cho phụ huynh liên quan nếu cần.",
  tam_ly:
    "GV tư vấn tiếp nhận ca trong 48 giờ, phân mức độ và chuyển tuyến chuyên gia nếu mức cao/nghiêm trọng.",
};

function warningSeverity(count: number, highAt: number): "medium" | "high" {
  return count >= highAt ? "high" : "medium";
}

export default async function SchoolRadarPage() {
  const profile = await requireRoles(["bgh", "pht", "admin"]);
  const supabase = await createClient();

  const { data: classRows } = await supabase
    .from("classes")
    .select("id,name,campus_id")
    .eq("school_id", profile.school_id ?? "")
    .order("name");
  let classes = (classRows ?? []) as Pick<
    ClassRoom,
    "id" | "name" | "campus_id"
  >[];
  if (profile.role === "pht" && profile.campus_id) {
    classes = classes.filter((c) => c.campus_id === profile.campus_id);
  }
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
          .select("student_id,subject_id,assessment_type,score")
          .in("student_id", studentIds)
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
  const gradeRows = (gradeRes.data ?? []) as {
    student_id: string;
    subject_id: string;
    assessment_type: string;
    score: number | null;
  }[];
  const cellRows = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    const key = `${g.student_id}|${g.subject_id}`;
    const arr = cellRows.get(key) ?? [];
    arr.push(g);
    cellRows.set(key, arr);
  }
  const lowGradeStudents = new Set<string>();
  for (const [key, rows] of cellRows) {
    const a = semesterAverage(rows);
    if (a != null && a < 5) lowGradeStudents.add(key.split("|")[0]);
  }
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
  for (const sid of lowGradeStudents) {
    const cid = classOfStudent.get(sid);
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

  // Persist cảnh báo vào early_warnings (dedupe theo lớp+nhóm) để có
  // workflow tiếp nhận/xử lý - radar computed thuần không giữ được trạng thái.
  const candidates: {
    class_id: string;
    category: string;
    severity: "medium" | "high";
    title: string;
    detail: string;
    suggestion: string;
    dedupe_key: string;
  }[] = [];
  for (const r of risks) {
    if (r.unexcused >= 4) {
      candidates.push({
        class_id: r.classId,
        category: "chuyen_can",
        severity: warningSeverity(r.unexcused, 10),
        title: "Vắng không phép tăng",
        detail: `${r.unexcused} lượt vắng không phép trong 30 ngày`,
        suggestion: CATEGORY_SUGGESTION.chuyen_can,
        dedupe_key: `${r.classId}|chuyen_can`,
      });
    }
    if (r.lowGrades >= 2) {
      candidates.push({
        class_id: r.classId,
        category: "hoc_tap",
        severity: warningSeverity(r.lowGrades, 5),
        title: "Nhiều học sinh điểm dưới 5",
        detail: `${r.lowGrades} em có điểm trung bình môn dưới 5`,
        suggestion: CATEGORY_SUGGESTION.hoc_tap,
        dedupe_key: `${r.classId}|hoc_tap`,
      });
    }
    if (r.openIncidents >= 1) {
      candidates.push({
        class_id: r.classId,
        category: "an_toan",
        severity: warningSeverity(r.openIncidents, 2),
        title: "Sự cố chưa xử lý xong",
        detail: `${r.openIncidents} sự cố đang mở hoặc đang theo dõi`,
        suggestion: CATEGORY_SUGGESTION.an_toan,
        dedupe_key: `${r.classId}|an_toan`,
      });
    }
    if (r.pendingCounseling >= 1) {
      candidates.push({
        class_id: r.classId,
        category: "tam_ly",
        severity: warningSeverity(r.pendingCounseling, 2),
        title: "Ca tư vấn chờ xử lý",
        detail: `${r.pendingCounseling} ca tư vấn chưa đóng`,
        suggestion: CATEGORY_SUGGESTION.tam_ly,
        dedupe_key: `${r.classId}|tam_ly`,
      });
    }
  }

  if (candidates.length) {
    const { data: existing } = await supabase
      .from("early_warnings")
      .select("dedupe_key")
      .eq("school_id", profile.school_id ?? "")
      .in(
        "dedupe_key",
        candidates.map((c) => c.dedupe_key),
      );
    const have = new Set(
      ((existing ?? []) as { dedupe_key: string }[]).map((e) => e.dedupe_key),
    );
    const fresh = candidates
      .filter((c) => !have.has(c.dedupe_key))
      .map((c) => ({ ...c, school_id: profile.school_id }));
    if (fresh.length) {
      await supabase.from("early_warnings").insert(fresh);
    }
  }

  const { data: warnRows } = await supabase
    .from("early_warnings")
    .select("*")
    .eq("school_id", profile.school_id ?? "")
    .in("status", ["open", "acknowledged"])
    .order("created_at", { ascending: false })
    .limit(50);
  const warnings = ((warnRows ?? []) as EarlyWarning[]).filter(
    (w) => !w.class_id || classIds.includes(w.class_id),
  );
  const warnStudentIds = [
    ...new Set(warnings.map((w) => w.student_id).filter((x): x is string => !!x)),
  ];
  const { data: warnStudents } = warnStudentIds.length
    ? await supabase
        .from("students")
        .select("id,full_name")
        .in("id", warnStudentIds)
    : { data: [] };
  const warnStudentName = new Map(
    ((warnStudents ?? []) as { id: string; full_name: string }[]).map((s) => [
      s.id,
      s.full_name,
    ]),
  );
  const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Radar cảnh báo sớm"
        description={`Tổng hợp tín hiệu rủi ro theo lớp - 30 ngày tính đến ${anchor
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

      <h2 className="mb-3 mt-8 text-base font-semibold">
        Cảnh báo cần xử lý{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({warnings.filter((w) => w.status === "open").length} đang mở)
        </span>
      </h2>
      <WarningList
        rows={warnings.map((w) => ({
          id: w.id,
          className: w.class_id ? (classNameMap.get(w.class_id) ?? "-") : "-",
          studentName: w.student_id
            ? (warnStudentName.get(w.student_id) ?? null)
            : null,
          category: w.category,
          severity: w.severity,
          title: w.title,
          detail: w.detail,
          suggestion: w.suggestion,
          status: w.status,
        }))}
      />
    </>
  );
}
