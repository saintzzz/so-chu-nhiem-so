import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { FilterSelect } from "@/components/academics/filter-select";
import { ConductRecordForm } from "@/components/conduct/record-form";

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  code: string;
  full_name: string;
}
interface RecordRow {
  id: string;
  student_id: string;
  type: "vi_pham" | "khen_thuong" | "nhan_xet";
  content: string;
  points: number;
  date: string;
}

const TYPE_BADGE = {
  khen_thuong: { label: "Khen thưởng", tone: "success" as const },
  vi_pham: { label: "Vi phạm", tone: "error" as const },
  nhan_xet: { label: "Nhận xét", tone: "primary" as const },
};

function toParams(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export default async function ConductRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const sp = await searchParams;
  const params = toParams(sp);
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("id,name")
    .eq("status", "active");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  }
  const { data: classData } = await classQuery.order("name");
  const classes = (classData ?? []) as ClassRow[];

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  const { data: studentData } = classId
    ? await supabase
        .from("students")
        .select("id,code,full_name")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("full_name")
    : { data: [] };
  const students = (studentData ?? []) as StudentRow[];
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const studentIds = students.map((s) => s.id);

  const { data: recordData } = studentIds.length
    ? await supabase
        .from("conduct_records")
        .select("id,student_id,type,content,points,date")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
        .limit(100)
    : { data: [] };
  const records = (recordData ?? []) as RecordRow[];

  const khenThuong = records.filter((r) => r.type === "khen_thuong").length;
  const viPham = records.filter((r) => r.type === "vi_pham").length;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ IV - Rèn luyện"
        title="Nhận xét & vi phạm/khen thưởng"
        description="Ghi nhận nhận xét, vi phạm và khen thưởng của học sinh trong lớp."
      />

      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <FilterSelect
          name="class"
          label="Lớp"
          value={classId}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
          params={params}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Tổng ghi nhận" value={records.length} />
        <StatCard label="Khen thưởng" value={khenThuong} tone="success" />
        <StatCard label="Vi phạm" value={viPham} tone="error" />
      </div>

      <ConductRecordForm students={students} meId={profile.id} />

      <DataTable
        columns={["Ngày", "Học sinh", "Loại", "Nội dung", "Điểm"]}
        footer={<span>{records.length} ghi nhận gần nhất</span>}
      >
        {records.map((r) => {
          const badge = TYPE_BADGE[r.type] ?? {
            label: r.type,
            tone: "muted" as const,
          };
          const student = studentMap.get(r.student_id);
          return (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-muted-foreground">
                {new Date(r.date).toLocaleDateString("vi-VN")}
              </td>
              <td>
                <div className="font-medium">{student?.full_name ?? "-"}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {student?.code}
                </div>
              </td>
              <td>
                <StatusBadge label={badge.label} tone={badge.tone} />
              </td>
              <td className="max-w-96">{r.content}</td>
              <td
                className={
                  r.points > 0
                    ? "font-semibold text-success"
                    : r.points < 0
                      ? "font-semibold text-error"
                      : "text-muted-foreground"
                }
              >
                {r.points > 0 ? `+${r.points}` : r.points}
              </td>
            </tr>
          );
        })}
        {records.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Chưa có ghi nhận nào cho lớp này.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
