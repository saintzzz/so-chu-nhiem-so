import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateVN } from "@/lib/utils";
import type { ClassRoom } from "@/types";

export default async function ExamAnalyticsPage() {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: examRaw }, { data: clsRaw }] = await Promise.all([
    supabase
      .from("exams")
      .select("id,name,term,start_date,end_date,status")
      .eq("school_id", sid)
      .order("start_date", { ascending: false }),
    supabase
      .from("classes")
      .select("id,name")
      .eq("school_id", sid)
      .eq("status", "active")
      .order("name"),
  ]);
  const exams = (examRaw ?? []) as {
    id: string;
    name: string;
    term: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
  }[];
  const classes = (clsRaw ?? []) as Pick<ClassRoom, "id" | "name">[];
  const classIds = classes.map((c) => c.id);

  const [{ data: sessRaw }, { data: gradeRaw }] = await Promise.all([
    exams.length
      ? supabase
          .from("exam_sessions")
          .select("id,exam_id,class_id,subject_id,date")
          .in("exam_id", exams.map((e) => e.id))
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase
          .from("grades")
          .select("student_id,subject_id,term,assessment_type,score,students!inner(class_id)")
          .in("assessment_type", ["ddg_gk", "ddg_ck"])
          .not("score", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  const sessions = (sessRaw ?? []) as {
    id: string;
    exam_id: string;
    class_id: string;
    subject_id: string;
    date: string;
  }[];
  const grades = (gradeRaw ?? []) as unknown as {
    score: number;
    subject_id: string;
    students: { class_id: string };
  }[];

  // ĐTB thi theo lớp
  const byClass = new Map<string, number[]>();
  for (const g of grades) {
    const cid = g.students.class_id;
    byClass.set(cid, [...(byClass.get(cid) ?? []), g.score]);
  }
  const classRows = classes
    .map((c) => {
      const arr = byClass.get(c.id) ?? [];
      const avg = arr.length
        ? arr.reduce((a, b) => a + b, 0) / arr.length
        : null;
      const sess = sessions.filter((s) => s.class_id === c.id).length;
      return { ...c, avg, n: arr.length, sessions: sess };
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  const schoolAvg =
    grades.length > 0
      ? grades.reduce((a, b) => a + b.score, 0) / grades.length
      : null;

  return (
    <div>
      <PageHeader
        section="Giám sát & báo cáo"
        title="Phân tích điểm thi cấp trường"
        description="Kỳ thi, lịch thi và chất lượng điểm kiểm tra theo lớp."
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Kỳ thi" value={exams.length} />
        <StatCard label="Buổi thi" value={sessions.length} tone="primary" />
        <StatCard
          label="ĐTB thi toàn trường (GK+CK)"
          value={schoolAvg !== null ? schoolAvg.toFixed(1) : "-"}
          tone={schoolAvg !== null && schoolAvg >= 6.5 ? "success" : "warning"}
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Kỳ thi</h2>
      <DataTable columns={["Kỳ thi", "Học kỳ", "Thời gian", "Trạng thái"]}>
        {exams.map((e) => (
          <tr key={e.id}>
            <td className="font-medium">{e.name}</td>
            <td>{e.term === "hk1" ? "Học kỳ I" : "Học kỳ II"}</td>
            <td className="text-muted-foreground">
              {e.start_date ? fmtDateVN(e.start_date) : "-"} - {e.end_date ? fmtDateVN(e.end_date) : "-"}
            </td>
            <td className="text-muted-foreground">{e.status}</td>
          </tr>
        ))}
        {exams.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-muted-foreground">
              Chưa có kỳ thi nào.
            </td>
          </tr>
        )}
      </DataTable>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Chất lượng theo lớp</h2>
      <DataTable columns={["Lớp", "Số buổi thi", "Số điểm GK/CK", "ĐTB thi"]}>
        {classRows.map((c) => (
          <tr key={c.id}>
            <td className="font-medium">{c.name}</td>
            <td>{c.sessions}</td>
            <td>{c.n}</td>
            <td className="font-semibold">
              {c.avg !== null ? c.avg.toFixed(1) : "-"}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
