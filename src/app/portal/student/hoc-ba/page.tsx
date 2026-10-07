import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal/portal-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge, ATT_STATUS } from "@/components/status-badge";
import { semesterAverage, yearAverage } from "@/lib/tt22";
import { fmtDateVN } from "@/lib/utils";
import type { AttendanceRecord, ClassRoom, Student } from "@/types";

const SUBTYPE_LABELS: Record<string, string> = {
  mieng: "Miệng",
  kt15: "15 phút",
  kt1t: "1 tiết",
};
const TYPE_LABELS: Record<string, string> = {
  ddg_tx: "ĐĐGtx",
  ddg_gk: "ĐĐGgk",
  ddg_ck: "ĐĐGck",
};
const RATING_LABELS: Record<string, string> = {
  tot: "Tốt",
  kha: "Khá",
  dat: "Đạt",
  chua_dat: "Chưa đạt",
};

export default async function StudentTranscriptPage() {
  const profile = await requireRoles(["hoc_sinh"]);
  const supabase = await createClient();

  // maybeSingle: 0 row la hop le, chi loi query moi tinh la loadError.
  const { data: studentRow, error: stuErr } = await supabase
    .from("students")
    .select("id,class_id,full_name,code,dob,gender,national_id")
    .eq("profile_id", profile.id)
    .limit(1)
    .maybeSingle();
  const student = studentRow as Pick<
    Student,
    "id" | "class_id" | "full_name" | "code" | "dob" | "gender" | "national_id"
  > | null;

  const { data: classRow, error: clsErr } = student
    ? await supabase
        .from("classes")
        .select("id,name,school_id,grade")
        .eq("id", student.class_id)
        .maybeSingle()
    : { data: null, error: null };
  const classroom = classRow as Pick<
    ClassRoom,
    "id" | "name" | "school_id" | "grade"
  > | null;

  const [gradeRes, subjectRes, conductRes, attRes] = student
    ? await Promise.all([
        supabase
          .from("grades")
          .select("id,subject_id,term,assessment_type,subtype,seq,score,result")
          .eq("student_id", student.id)
          .order("created_at"),
        supabase
          .from("subjects")
          .select("id,name,assessment_method")
          .eq("school_id", classroom?.school_id ?? ""),
        supabase
          .from("conduct_evaluations")
          .select("id,term,rating,comment")
          .eq("student_id", student.id),
        supabase
          .from("attendance_records")
          .select("id,status")
          .eq("student_id", student.id),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const subjects = (subjectRes.data ?? []) as {
    id: string;
    name: string;
    assessment_method: string | null;
  }[];
  const subjectOf = new Map(subjects.map((s) => [s.id, s]));
  const gradeRows = (gradeRes.data ?? []) as {
    id: string;
    subject_id: string;
    term: string;
    assessment_type: string;
    subtype: string;
    seq: number;
    score: number | null;
    result: string | null;
  }[];
  const conductRows = (conductRes.data ?? []) as {
    id: string;
    term: string;
    rating: string;
    comment: string | null;
  }[];
  const attRows = (attRes.data ?? []) as Pick<AttendanceRecord, "id" | "status">[];

  const bySubject = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    const arr = bySubject.get(g.subject_id) ?? [];
    arr.push(g);
    bySubject.set(g.subject_id, arr);
  }

  const terms = ["hk1", "hk2"] as const;
  const subjectRows = [...bySubject.entries()]
    .map(([subjectId, rows]) => {
      const sub = subjectOf.get(subjectId);
      const hk1 = semesterAverage(rows.filter((r) => r.term === "hk1"));
      const hk2 = semesterAverage(rows.filter((r) => r.term === "hk2"));
      const resultHk1 = rows.find((r) => r.term === "hk1" && r.result != null)?.result ?? null;
      const resultHk2 = rows.find((r) => r.term === "hk2" && r.result != null)?.result ?? null;
      return {
        subjectId,
        name: sub?.name ?? "Môn học",
        method: sub?.assessment_method ?? "diem",
        hk1,
        hk2,
        year: yearAverage(hk1, hk2),
        resultHk1,
        resultHk2,
        // Ket qua ca nam chi tu HK2 - HK1 khong duoc hien thi nhu ket qua nam.
        resultYear: resultHk2,
        rows,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const attCount = { present: 0, late: 0, excused: 0, unexcused: 0 };
  for (const a of attRows) {
    if (a.status in attCount) attCount[a.status as keyof typeof attCount]++;
  }

  // Moi query nguon loi -> hien notice thay vi bang/empty-state gia.
  // "Chua co ..." chi render khi query THANH CONG va tra ve 0 row.
  const srcErrors = Object.entries({
    students: stuErr,
    classes: clsErr,
    grades: gradeRes.error,
    subjects: subjectRes.error,
    conduct_evaluations: conductRes.error,
    attendance_records: attRes.error,
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[portal/hoc-ba] load:",
      srcErrors.map(([k, e]) => `${k}: ${e?.message}`).join("; "),
    );
  }

  return (
    <div className="theme-fluent min-h-screen bg-background">
      <PortalHeader title="Học bạ điện tử" userName={profile.full_name} />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <a href="/portal/student" className="text-sm text-primary hover:underline">
          Về cổng học sinh
        </a>

        {loadError ? (
          <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Không tải được dữ liệu. Vui lòng thử lại.
          </p>
        ) : (
          <>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h1 className="text-lg font-semibold">{student?.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lớp {classroom?.name ?? "-"} · Mã HS: {student?.code ?? "-"} · Mã định danh:{" "}
            {student?.national_id ?? "-"}
          </p>
          <p className="text-sm text-muted-foreground">
            Ngày sinh: {student?.dob ? fmtDateVN(student.dob) : "-"} · Giới tính:{" "}
            {student?.gender === "nam" ? "Nam" : student?.gender === "nu" ? "Nữ" : "-"}
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold">Bảng điểm theo Thông tư 22</h2>
          <DataTable
            columns={["Môn học", "ĐTBm HK1", "ĐTBm HK2", "ĐTBm cả năm"]}
            footer={<span>{subjectRows.length} môn</span>}
          >
            {subjectRows.map((s) => (
              <tr key={s.subjectId}>
                <td className="font-medium">{s.name}</td>
                {s.method === "nhan_xet" || s.resultHk1 != null || s.resultHk2 != null ? (
                  <>
                    <td>{s.resultHk1 === "dat" ? "Đạt" : s.resultHk1 === "chua_dat" ? "Chưa đạt" : "-"}</td>
                    <td>{s.resultHk2 === "dat" ? "Đạt" : s.resultHk2 === "chua_dat" ? "Chưa đạt" : "-"}</td>
                    <td className="font-semibold">{s.resultYear === "dat" ? "Đạt" : s.resultYear === "chua_dat" ? "Chưa đạt" : "-"}</td>
                  </>
                ) : (
                  <>
                    <td>{s.hk1 != null ? s.hk1.toFixed(1) : "-"}</td>
                    <td>{s.hk2 != null ? s.hk2.toFixed(1) : "-"}</td>
                    <td className="font-semibold">
                      {s.year != null ? s.year.toFixed(1) : "-"}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {subjectRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  Chưa có điểm nào được ghi nhận.
                </td>
              </tr>
            )}
          </DataTable>
        </div>

        {subjectRows.some((s) => s.rows.length > 0 && s.method !== "nhan_xet") && (
          <div>
            <h2 className="mb-3 text-base font-semibold">Chi tiết điểm thành phần</h2>
            <DataTable columns={["Môn", "Học kỳ", "Điểm thành phần"]}>
              {subjectRows
                .filter((s) => s.method !== "nhan_xet" && s.rows.length > 0)
                .map((s) =>
                  terms.map((t) => {
                    const rows = s.rows
                      .filter((r) => r.term === t)
                      .sort(
                        (a, b) =>
                          a.assessment_type.localeCompare(b.assessment_type) ||
                          (a.subtype ?? "").localeCompare(b.subtype ?? "") ||
                          a.seq - b.seq,
                      );
                    if (!rows.length) return null;
                    return (
                      <tr key={`${s.subjectId}-${t}`}>
                        <td className="font-medium">{s.name}</td>
                        <td className="whitespace-nowrap text-muted-foreground">
                          {t === "hk1" ? "Học kỳ I" : "Học kỳ II"}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {rows.map((r) => (
                              <span key={r.id}>
                                <span className="text-muted-foreground">
                                  {r.assessment_type === "ddg_tx"
                                    ? `${SUBTYPE_LABELS[r.subtype] ?? "TX"}${r.seq > 0 ? ` ${r.seq}` : ""}`
                                    : (TYPE_LABELS[r.assessment_type] ?? r.assessment_type)}
                                  :
                                </span>{" "}
                                <span className="font-medium">
                                  {r.score != null ? r.score : "-"}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  }),
                )}
            </DataTable>
          </div>
        )}

        <div>
          <h2 className="mb-3 text-base font-semibold">Kết quả rèn luyện</h2>
          <DataTable columns={["Học kỳ", "Xếp loại", "Nhận xét"]}>
            {conductRows.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap">
                  {c.term === "hk1" ? "Học kỳ I" : c.term === "hk2" ? "Học kỳ II" : c.term}
                </td>
                <td>
                  <StatusBadge
                    label={RATING_LABELS[c.rating] ?? c.rating}
                    tone={c.rating === "tot" || c.rating === "kha" ? "success" : c.rating === "dat" ? "primary" : "warning"}
                  />
                </td>
                <td className="max-w-md text-sm text-muted-foreground">
                  {c.comment ?? "-"}
                </td>
              </tr>
            ))}
            {conductRows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-muted-foreground">
                  Chưa có đánh giá rèn luyện.
                </td>
              </tr>
            )}
          </DataTable>
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold">Tổng hợp chuyên cần</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(attCount) as (keyof typeof attCount)[]).map((k) => (
              <div
                key={k}
                className="rounded-xl border border-border bg-card p-3 text-center shadow-[var(--shadow-sm-token)]"
              >
                <p className="text-2xl font-semibold">{attCount[k]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ATT_STATUS[k]?.label ?? k}
                </p>
              </div>
            ))}
          </div>
        </div>
          </>
        )}
      </main>
    </div>
  );
}
