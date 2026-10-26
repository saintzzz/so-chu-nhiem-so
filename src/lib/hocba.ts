import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows, fetchAllRowsIn } from "@/lib/supabase/fetch-all";
import { must, mustRows } from "@/lib/supabase/must";
import { gradeYearOr } from "@/lib/grades-year";
import {
  semesterAssessment,
  yearAverage,
  requiredTxCount,
  hocLucYear,
  renLuyenYear,
  danhHieu,
  xetLenLop,
} from "@/lib/tt22";
import type { YearRating, Promotion } from "@/lib/tt22";

export interface SubjectDef {
  id: string;
  name: string;
  assessment_method: string | null; // 'score' | 'comment'
  weekly_periods: number | null;
}

export interface GradeRow {
  student_id: string;
  subject_id: string;
  term: string;
  assessment_type: string;
  subtype: string;
  seq: number;
  score: number | null;
  result: string | null;
}

export interface SubjectYearRow {
  subjectId: string;
  name: string;
  isComment: boolean;
  hk1: number | null;
  hk1Final: boolean;
  hk2: number | null;
  hk2Final: boolean;
  cn: number | null;
  yearFinal: boolean;
  resultHk1: string | null;
  resultHk2: string | null;
  resultYear: string | null;
  isExempt: boolean;
}

export interface YearEndBundle {
  student: {
    id: string;
    full_name: string;
    code: string | null;
    dob: string | null;
    gender: string | null;
    national_id: string | null;
    class_id: string;
  };
  subjectRows: SubjectYearRow[];
  conductHk1: YearRating | null;
  conductHk2: YearRating | null;
  conductComment: string | null;
  nlpcEvals: { attribute_code: string; level: string }[];
  nlpcComments: { grp: string; comment: string }[];
  absentExcused: number; // buổi
  absentUnexcused: number;
  absentTotal: number;
  decisions: YearEndDecision[];
  computed: {
    kqht: { value: YearRating | null; missing: string | null };
    kqrl: { value: YearRating | null; missing: string | null };
    danhHieu: "xuat_sac" | "gioi" | null;
    promotion: { value: Promotion | null; missing: string | null };
  };
}

export interface YearEndDecision {
  id: string;
  student_id: string;
  school_id: string;
  academic_year_id: string;
  stage: "initial" | "after_retest" | "after_summer";
  kqht: YearRating | null;
  kqrl: YearRating | null;
  danh_hieu: "xuat_sac" | "gioi" | null;
  giay_khen_note: string | null;
  promotion: Promotion | null;
  override_legal_ground: string | null;
  override_note: string | null;
  exempt_subject_ids: string[];
  computed_snapshot: ComputedSnapshot | null;
  status: "draft" | "submitted" | "approved" | "rejected" | "locked";
  reject_reason: string | null;
  revision: number;
  decided_by: string | null;
  decided_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

export interface ComputedSnapshot {
  kqht: YearRating | null;
  kqrl: YearRating | null;
  danhHieu: "xuat_sac" | "gioi" | null;
  promotion: Promotion | null;
  absentTotal: number;
}

/**
 * Xây dựng subjectRows từ DANH MỤC môn của trường (không phải môn có điểm)
 * - môn chưa có điểm nào vẫn xuất hiện với 'missing'. exempt_subject_ids
 * loại khỏi tập xếp loại nhưng vẫn hiển thị (isExempt flag).
 * Portal hoc_sinh dùng chung hàm này (pure) - KHÔNG gọi bundle staff.
 */
export function buildSubjectRows(
  subjects: SubjectDef[],
  gradeRows: GradeRow[],
  exemptIds: string[] = [],
): SubjectYearRow[] {
  const exempt = new Set(exemptIds);
  const bySubject = new Map<string, GradeRow[]>();
  for (const g of gradeRows) {
    const arr = bySubject.get(g.subject_id) ?? [];
    arr.push(g);
    bySubject.set(g.subject_id, arr);
  }
  return subjects
    .map((sub) => {
      const rows = bySubject.get(sub.id) ?? [];
      const req = { requiredTx: requiredTxCount(sub.weekly_periods) };
      const a1 = semesterAssessment(
        rows.filter((r) => r.term === "hk1"),
        req,
      );
      const a2 = semesterAssessment(
        rows.filter((r) => r.term === "hk2"),
        req,
      );
      const resultHk1 =
        rows.find((r) => r.term === "hk1" && r.result != null)?.result ?? null;
      const resultHk2 =
        rows.find((r) => r.term === "hk2" && r.result != null)?.result ?? null;
      return {
        subjectId: sub.id,
        name: sub.name,
        isComment: sub.assessment_method === "comment",
        hk1: a1.avg,
        hk1Final: a1.isFinal,
        hk2: a2.avg,
        hk2Final: a2.isFinal,
        cn: yearAverage(a1.avg, a2.avg),
        yearFinal: a1.isFinal && a2.isFinal,
        resultHk1,
        resultHk2,
        resultYear: resultHk2,
        isExempt: exempt.has(sub.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** Tính computed cho 1 HS từ các slice đã group sẵn. */
function computeFor(
  subjectRows: SubjectYearRow[],
  conductHk1: YearRating | null,
  conductHk2: YearRating | null,
  absentTotal: number,
  stage: YearEndDecision["stage"],
  hasPriorRetest: boolean,
): YearEndBundle["computed"] {
  const scored = subjectRows
    .filter((s) => !s.isComment && !s.isExempt)
    .map((s) => ({ subjectId: s.subjectId, dtmCn: s.cn, yearFinal: s.yearFinal }));
  const comments = subjectRows
    .filter((s) => s.isComment && !s.isExempt)
    .map((s): "dat" | "chua_dat" | "missing" =>
      s.resultYear === "dat" || s.resultYear === "chua_dat"
        ? s.resultYear
        : "missing",
    );
  const kqht = hocLucYear(scored, comments);
  const kqrl = renLuyenYear(conductHk1, conductHk2);
  const promotion = xetLenLop({
    stage,
    kqht: kqht.value,
    kqrl: kqrl.value,
    absentSessions: absentTotal,
    hasPriorRetest,
  });
  return {
    kqht,
    kqrl,
    danhHieu: danhHieu(kqht.value, kqrl.value, scored),
    promotion,
  };
}

async function loadBundleShared(opts: {
  studentIds: string[];
  schoolId: string;
  academicYearId: string;
  yearStart: string;
  yearEnd: string;
}): Promise<{
  gradeRows: GradeRow[];
  subjects: SubjectDef[];
  conductRows: { student_id: string; term: string; rating: string; comment: string | null }[];
  nlpcEvals: { student_id: string; attribute_code: string; level: string; term: string }[];
  nlpcComments: { student_id: string; grp: string; comment: string; term: string }[];
  attRows: { student_id: string; status: string }[];
  decisions: YearEndDecision[];
}> {
  const supabase = await createClient();
  const { studentIds, schoolId, academicYearId, yearStart, yearEnd } = opts;

  // r33-7: KHONG await ben trong mang - cac fetch phai chay song song.
  const [grades, subjects, conduct, nlpcE, nlpcC, att, dec] = await Promise.all([
    fetchAllRowsIn<GradeRow>(
      (chunk, f, t) =>
        supabase
          .from("grades")
          .select("student_id,subject_id,term,assessment_type,subtype,seq,score,result")
          .in("student_id", chunk)
          .or(gradeYearOr(academicYearId))
          .order("student_id")
          .order("subject_id")
          .order("term")
          .order("assessment_type")
          .order("seq")
          .range(f, t),
      studentIds,
    ).then((r) => mustRows(r, "hocba/grades")),
    fetchAllRows<SubjectDef>((f, t) =>
      supabase
        .from("subjects")
        .select("id,name,assessment_method,weekly_periods")
        .eq("school_id", schoolId)
        .order("id")
        .range(f, t),
    ).then((r) => mustRows(r, "hocba/subjects")),
    fetchAllRowsIn<{
      student_id: string;
      term: string;
      rating: string;
      comment: string | null;
    }>(
        (chunk, f, t) =>
          supabase
            .from("conduct_evaluations")
            .select("student_id,term,rating,comment")
            .in("student_id", chunk)
            .order("student_id")
            .order("term")
            .range(f, t),
        studentIds,
    ).then((r) => mustRows(r, "hocba/conduct")),
    fetchAllRowsIn<{
      student_id: string;
      attribute_code: string;
      level: string;
      term: string;
    }>(
        (chunk, f, t) =>
          supabase
            .from("competency_evaluations")
            .select("student_id,attribute_code,level,term")
            .in("student_id", chunk)
            .order("student_id")
            .order("term")
            .order("attribute_code")
            .range(f, t),
        studentIds,
    ).then((r) => mustRows(r, "hocba/nlpc_evals")),
    fetchAllRowsIn<{
      student_id: string;
      grp: string;
      comment: string;
      term: string;
    }>(
        (chunk, f, t) =>
          supabase
            .from("nlpc_comments")
            .select("student_id,grp,comment,term")
            .in("student_id", chunk)
            .order("student_id")
            .order("term")
            .order("grp")
            .range(f, t),
        studentIds,
    ).then((r) => mustRows(r, "hocba/nlpc_comments")),
    fetchAllRowsIn<{ student_id: string; status: string }>(
        (chunk, f, t) =>
          supabase
            .from("attendance_records")
            .select("student_id,status,date")
            .in("student_id", chunk)
            .gte("date", yearStart)
            .lte("date", yearEnd)
            .order("student_id")
            .order("date")
            .range(f, t),
        studentIds,
    ).then((r) => mustRows(r, "hocba/attendance")),
    fetchAllRowsIn<YearEndDecision>(
        (chunk, f, t) =>
          supabase
            .from("year_end_decisions")
            .select("*")
            .in("student_id", chunk)
            .eq("academic_year_id", academicYearId)
            .order("student_id")
            .order("stage")
            .range(f, t),
        studentIds,
    ).then((r) => mustRows(r, "hocba/decisions")),
  ]);

  return {
    gradeRows: grades.rows,
    subjects: subjects.rows,
    conductRows: conduct.rows,
    nlpcEvals: nlpcE.rows,
    nlpcComments: nlpcC.rows,
    attRows: att.rows,
    decisions: dec.rows,
  };
}

function bundleFor(
  student: YearEndBundle["student"],
  shared: Awaited<ReturnType<typeof loadBundleShared>>,
  exemptOverride?: string[],
): YearEndBundle {
  const sid = student.id;
  // Thu tu sort deterministic cho 3 stage (doc lap lo trinh, khong the
  // cung ton tai hop le: after_retest can kiem_tra_danh_gia_lai,
  // after_summer can ren_luyen_he). KHONG dung alphabet - 'initial'
  // dung cuoi theo alpha.
  const STAGE_ORDER: Record<string, number> = {
    initial: 0,
    after_summer: 1,
    after_retest: 2,
  };
  const decisions = shared.decisions
    .filter((d) => d.student_id === sid)
    .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]);
  const activeStage = decisions.length
    ? decisions[decisions.length - 1].stage
    : "initial";
  const exempt =
    exemptOverride ??
    decisions
      .slice()
      .reverse()
      .find((d) => d.status === "approved" || d.status === "locked")
      ?.exempt_subject_ids ??
    decisions[decisions.length - 1]?.exempt_subject_ids ??
    [];

  const subjectRows = buildSubjectRows(
    shared.subjects,
    shared.gradeRows.filter((g) => g.student_id === sid),
    exempt,
  );
  const conduct = shared.conductRows.filter((c) => c.student_id === sid);
  const conductHk1 =
    (conduct.find((c) => c.term === "hk1")?.rating as YearRating | undefined) ??
    null;
  const conductHk2 =
    (conduct.find((c) => c.term === "hk2")?.rating as YearRating | undefined) ??
    null;
  const att = shared.attRows.filter((a) => a.student_id === sid);
  const absentExcused = att.filter((a) => a.status === "excused").length;
  const absentUnexcused = att.filter((a) => a.status === "unexcused").length;
  const absentTotal = absentExcused + absentUnexcused;
  const hasPriorRetest = decisions.some(
    (d) =>
      d.stage === "after_retest" &&
      (d.status === "approved" || d.status === "locked"),
  );

  return {
    student,
    subjectRows,
    conductHk1,
    conductHk2,
    conductComment:
      conduct.find((c) => c.term === "hk2")?.comment ??
      conduct.find((c) => c.term === "hk1")?.comment ??
      null,
    nlpcEvals: shared.nlpcEvals
      .filter((e) => e.student_id === sid && e.term === "hk2")
      .map((e) => ({ attribute_code: e.attribute_code, level: e.level })),
    nlpcComments: shared.nlpcComments
      .filter((c) => c.student_id === sid && c.term === "hk2")
      .map((c) => ({ grp: c.grp, comment: c.comment })),
    absentExcused,
    absentUnexcused,
    absentTotal,
    decisions,
    computed: computeFor(
      subjectRows,
      conductHk1,
      conductHk2,
      absentTotal,
      activeStage,
      hasPriorRetest,
    ),
  };
}

/** Bundle cho 1 HS - drill-down + export cá nhân. */
export async function getStudentYearEndBundle(
  studentId: string,
  academicYearId: string,
  exemptOverride?: string[],
): Promise<YearEndBundle | null> {
  const supabase = await createClient();
  const { data: stu } = await must(
    supabase
      .from("students")
      .select("id,full_name,code,dob,gender,national_id,class_id")
      .eq("id", studentId)
      .maybeSingle(),
    "hocba/student",
  );
  if (!stu) return null;
  const { data: yr } = await must(
    supabase
      .from("academic_years")
      .select("id,school_id,start_date,end_date")
      .eq("id", academicYearId)
      .maybeSingle(),
    "hocba/year",
  );
  if (!yr) return null;
  const shared = await loadBundleShared({
    studentIds: [studentId],
    schoolId: yr.school_id,
    academicYearId,
    yearStart: yr.start_date,
    yearEnd: yr.end_date,
  });
  return bundleFor(stu, shared, exemptOverride);
}

/** Bundle cả lớp - list screen + export cả lớp (1 query/bảng). */
export async function getClassYearEndBundles(
  classId: string,
): Promise<{ bundles: YearEndBundle[]; yearId: string | null }> {
  const supabase = await createClient();
  const { data: cls } = await must(
    supabase
      .from("classes")
      .select("id,school_id,academic_year_id")
      .eq("id", classId)
      .maybeSingle(),
    "hocba/class",
  );
  if (!cls) return { bundles: [], yearId: null };
  // Fallback nam hien tai neu lop legacy chua gan (du migration da backfill).
  let yearId = cls.academic_year_id as string | null;
  if (!yearId) {
    const { data: yr, error: yrErr } = await supabase
      .from("academic_years")
      .select("id")
      .eq("school_id", cls.school_id)
      .eq("is_current", true)
      .maybeSingle();
    if (yrErr) throw new Error(`Không tải được dữ liệu nguồn (academic_years).`);
    yearId = yr?.id ?? null;
  }
  if (!yearId) return { bundles: [], yearId: null };

  const { data: yr } = await must(
    supabase
      .from("academic_years")
      .select("id,start_date,end_date")
      .eq("id", yearId)
      .single(),
    "hocba/year",
  );

  const { data: students } = await must(
    supabase
      .from("students")
      .select("id,full_name,code,dob,gender,national_id,class_id")
      .eq("class_id", classId)
      .order("id"),
    "hocba/students",
  );
  const list = (students ?? []) as YearEndBundle["student"][];
  if (!list.length) return { bundles: [], yearId };

  const shared = await loadBundleShared({
    studentIds: list.map((s) => s.id),
    schoolId: cls.school_id,
    academicYearId: yearId,
    yearStart: yr!.start_date,
    yearEnd: yr!.end_date,
  });
  return { bundles: list.map((s) => bundleFor(s, shared)), yearId };
}
