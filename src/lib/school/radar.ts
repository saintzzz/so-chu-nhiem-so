import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { lowGradeStudentIds } from "@/lib/tt22";
import type { GradeComponent } from "@/lib/tt22";
import { isoDateVN, todayVN } from "@/lib/utils";
import type {
  AttendanceRecord,
  ClassRoom,
  CounselingCase,
  Incident,
  Profile,
  Student,
} from "@/types";
import { hasRole } from "@/lib/roles";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ClassRisk {
  classId: string;
  className: string;
  unexcused: number;
  lowGrades: number;
  openIncidents: number;
  pendingCounseling: number;
  score: number;
  level: RiskLevel;
}

export interface WarningCandidate {
  class_id: string;
  category: string;
  severity: "medium" | "high";
  title: string;
  detail: string;
  suggestion: string;
  dedupe_key: string;
}

const OPEN_INCIDENT = new Set(["new", "following"]);
const OPEN_CASE = new Set(["new", "assessing", "counseling", "referred"]);

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoDateVN(d);
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

export interface RadarData {
  classes: Pick<ClassRoom, "id" | "name" | "campus_id">[];
  classIds: string[];
  anchor: string;
  risks: ClassRisk[];
  candidates: WarningCandidate[];
  /** Nhan loi ngan gon theo nguon du lieu ("grades: <err>", "students truncated") - khong chua PII. */
  errors: string[];
}

type RadarGradeRow = GradeComponent & {
  student_id: string;
  subject_id: string;
  term: string;
};

/**
 * Tinh toan radar canh bao som - THUAN doc. Viec persist vao early_warnings
 * nam trong server action refreshRadarWarnings de trang GET khong gay
 * mutation khi render.
 */
export async function buildRadarData(
  supabase: SupabaseClient,
  profile: Profile,
): Promise<RadarData> {
  const errors: string[] = [];
  // errors chi giu nhan co dinh - chi tiet DB log server-side, khong lo ra response.
  const fail = (label: string, detail?: string | null) => {
    errors.push(label);
    console.error(`[radar] ${label} query failed:`, detail ?? "unknown");
  };
  const { data: classRows, error: classErr } = await supabase
    .from("classes")
    .select("id,name,campus_id")
    .eq("school_id", profile.school_id ?? "")
    .order("name");
  if (classErr) fail("classes", classErr.message);
  let classes = (classRows ?? []) as Pick<
    ClassRoom,
    "id" | "name" | "campus_id"
  >[];
  // PHT chưa phân công campus -> fail-closed, không đọc toàn trường.
  if (hasRole(profile, "pht")) {
    classes = profile.campus_id
      ? classes.filter((c) => c.campus_id === profile.campus_id)
      : [];
  }
  const classIds = classes.map((c) => c.id);

  const studentsRes = classIds.length
    ? await fetchAllRows<Pick<Student, "id" | "class_id">>((f, t) =>
        supabase
          .from("students")
          .select("id,class_id")
          .in("class_id", classIds)
          .order("id")
          .range(f, t),
      )
    : {
        rows: [] as Pick<Student, "id" | "class_id">[],
        error: null,
        truncated: false,
      };
  if (studentsRes.error) fail("students", studentsRes.error);
  else if (studentsRes.truncated) errors.push("students truncated");
  const students = studentsRes.rows;
  const studentIds = students.map((s) => s.id);
  const classOfStudent = new Map(students.map((s) => [s.id, s.class_id]));

  // Anchor the 30-day window to the newest data available.
  const { data: latestAtt, error: anchorErr } = classIds.length
    ? await supabase
        .from("attendance_records")
        .select("date,students!inner(class_id)")
        .in("students.class_id", classIds)
        .order("date", { ascending: false })
        .limit(1)
    : { data: [] as Pick<AttendanceRecord, "date">[], error: null };
  if (anchorErr) fail("attendance", anchorErr.message);
  const anchor =
    ((latestAtt ?? [])[0] as Pick<AttendanceRecord, "date"> | undefined)
      ?.date ?? todayVN();
  const windowStart = addDays(anchor, -29);

  const [attRes, gradeRes, incidentRes, counselingRes] = await Promise.all([
    classIds.length
      ? fetchAllRows<{ student_id: string }>((f, t) =>
          supabase
            .from("attendance_records")
            .select("student_id,students!inner(class_id)")
            .eq("status", "unexcused")
            .gte("date", windowStart)
            .in("students.class_id", classIds)
            .order("id")
            .range(f, t),
        )
      : Promise.resolve({
          rows: [] as { student_id: string }[],
          error: null,
          truncated: false,
        }),
    classIds.length
      ? fetchAllRows<RadarGradeRow>((f, t) =>
          supabase
            .from("grades")
            .select("student_id,subject_id,term,assessment_type,score,students!inner(class_id)")
            .in("students.class_id", classIds)
            .order("id")
            .range(f, t),
        )
      : Promise.resolve({
          rows: [] as RadarGradeRow[],
          error: null,
          truncated: false,
        }),
    classIds.length
      ? supabase
          .from("incidents")
          .select("id,class_id,status")
          .in("class_id", classIds)
      : Promise.resolve({
          data: [] as Pick<Incident, "id" | "class_id" | "status">[],
          error: null,
        }),
    studentIds.length
      ? supabase
          .from("counseling_cases")
          .select("id,student_id,status")
          .in("student_id", studentIds)
      : Promise.resolve({
          data: [] as Pick<CounselingCase, "id" | "student_id" | "status">[],
          error: null,
        }),
  ]);

  if (attRes.error) fail("attendance", attRes.error);
  else if (attRes.truncated) errors.push("attendance truncated");
  if (gradeRes.error) fail("grades", gradeRes.error);
  else if (gradeRes.truncated) errors.push("grades truncated");
  if (incidentRes.error) fail("incidents", incidentRes.error.message);
  if (counselingRes.error) fail("counseling", counselingRes.error.message);

  const unexcused = attRes.rows;
  // Nhom diem theo (HS, mon, ky) - ky moi nhat quyet dinh, bat bien thu tu hang.
  const lowGradeStudents = lowGradeStudentIds(gradeRes.rows);
  const incidents = incidentRes.data ?? [];
  const cases = counselingRes.data ?? [];

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

  const candidates: WarningCandidate[] = [];
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

  return { classes, classIds, anchor, risks, candidates, errors };
}
