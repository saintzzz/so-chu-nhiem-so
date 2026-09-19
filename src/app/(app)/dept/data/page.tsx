import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Database, Download, ShieldCheck } from "lucide-react";
import type { ClassRoom, Student } from "@/types";

const ENTITIES: { table: string; label: string }[] = [
  { table: "schools", label: "Trường học" },
  { table: "departments", label: "Tổ chuyên môn" },
  { table: "profiles", label: "Người dùng (profiles)" },
  { table: "classes", label: "Lớp học" },
  { table: "students", label: "Học sinh" },
  { table: "parents", label: "Phụ huynh" },
  { table: "parent_students", label: "Liên kết PH-HS" },
  { table: "subjects", label: "Môn học" },
  { table: "grades", label: "Điểm số" },
  { table: "attendance_records", label: "Bản ghi chuyên cần" },
  { table: "incidents", label: "Sự cố an toàn" },
  { table: "counseling_cases", label: "Ca tư vấn học sinh" },
  { table: "conduct_evaluations", label: "Đánh giá hạnh kiểm" },
  { table: "emulation_scores", label: "Điểm thi đua" },
  { table: "kpis", label: "KPI lớp" },
  { table: "announcements", label: "Thông báo" },
  { table: "appointments", label: "Lịch hẹn" },
  { table: "teacher_subjects", label: "Phân công GV-môn" },
  { table: "teacher_assessments", label: "Đánh giá năng lực GV" },
  { table: "dept_meetings", label: "Sinh hoạt chuyên môn" },
];

export default async function DeptDataPage() {
  await requireRoles(["so_gd", "admin"]);
  const supabase = await createClient();

  const counts = await Promise.all(
    ENTITIES.map(async (e) => {
      const { count } = await supabase
        .from(e.table)
        .select("id", { count: "exact", head: true });
      return { ...e, count: count ?? 0 };
    }),
  );

  const [noGroupRes, noGvcnRes, studentsRes, linksRes] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .is("group_id", null),
    supabase
      .from("classes")
      .select("id,name")
      .is("gvcn_id", null),
    supabase.from("students").select("id"),
    supabase.from("parent_students").select("student_id"),
  ]);

  const classesNoGvcn = (noGvcnRes.data ?? []) as Pick<
    ClassRoom,
    "id" | "name"
  >[];
  const allStudentIds = new Set(
    ((studentsRes.data ?? []) as Pick<Student, "id">[]).map((s) => s.id),
  );
  const linkedStudentIds = new Set(
    ((linksRes.data ?? []) as { student_id: string }[]).map(
      (l) => l.student_id,
    ),
  );
  const orphans = [...allStudentIds].filter(
    (id) => !linkedStudentIds.has(id),
  ).length;

  const checks: { label: string; value: number; ok: string; bad: string }[] = [
    {
      label: "Học sinh chưa xếp tổ/nhóm",
      value: noGroupRes.count ?? 0,
      ok: "Tất cả học sinh đã có tổ",
      bad: "học sinh chưa thuộc tổ nào",
    },
    {
      label: "Lớp chưa có GVCN",
      value: classesNoGvcn.length,
      ok: "Tất cả lớp đã có GVCN",
      bad: `lớp chưa phân GVCN${
        classesNoGvcn.length
          ? ` (${classesNoGvcn.map((c) => c.name).join(", ")})`
          : ""
      }`,
    },
    {
      label: "Học sinh chưa liên kết phụ huynh",
      value: orphans,
      ok: "Tất cả học sinh đã liên kết phụ huynh",
      bad: "học sinh chưa có liên kết phụ huynh",
    },
  ];

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="XI. Quản trị dữ liệu"
        description="Kiểm soát số lượng bản ghi, tính toàn vẹn và xuất dữ liệu"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Số lượng bản ghi</h2>
          </div>
          <DataTable columns={["Thực thể", "Bảng", "Số bản ghi"]}>
            {counts.map((c) => (
              <tr key={c.table}>
                <td className="font-medium">{c.label}</td>
                <td className="font-mono text-xs text-muted-foreground">
                  {c.table}
                </td>
                <td className="font-semibold tabular-nums">{c.count}</td>
              </tr>
            ))}
          </DataTable>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Kiểm tra toàn vẹn</h2>
            </div>
            <ul className="space-y-3">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.value === 0 ? c.ok : `${c.value} ${c.bad}`}
                    </p>
                  </div>
                  <StatusBadge
                    label={c.value === 0 ? "Đạt" : "Cần xử lý"}
                    tone={c.value === 0 ? "success" : "warning"}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
            <div className="mb-2 flex items-center gap-2">
              <Download className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Xuất dữ liệu</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Dữ liệu được lưu trữ trên Supabase/PostgreSQL. Để xuất dữ liệu:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Supabase Dashboard → Table Editor → Export CSV (từng bảng).
              </li>
              <li>
                <span className="font-mono text-xs">pg_dump</span> cho bản sao
                toàn bộ schema.
              </li>
              <li>
                Tính năng export trong app sẽ được bổ sung ở phiên bản sau.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
