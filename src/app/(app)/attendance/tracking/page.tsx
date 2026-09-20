import { requireRoles } from "@/lib/auth";
import { formatDateOnly } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, ClassRoom, Student } from "@/types";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { AiInsightCard } from "@/components/ai/ai-insight-card";

interface AttRow {
  student_id: string;
  date: string;
  status: AttendanceStatus;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AttendanceTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];
  const selected = classes.find((c) => c.id === classParam) ?? classes[0];

  if (!selected) {
    return (
      <div>
        <PageHeader
          section="Chuyên cần"
          title="Theo dõi tình trạng"
        />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Bạn chưa được phân công lớp nào.
        </p>
      </div>
    );
  }

  const { data: studentData } = await supabase
    .from("students")
    .select("id,code,full_name")
    .eq("class_id", selected.id)
    .eq("status", "active")
    .order("code");
  const students = (studentData ?? []) as Pick<
    Student,
    "id" | "code" | "full_name"
  >[];
  const ids = students.map((s) => s.id);
  const studentById = new Map(students.map((s) => [s.id, s]));

  // Ngày mốc = ngày có dữ liệu chuyên cần gần nhất
  let anchor = new Date().toISOString().slice(0, 10);
  if (ids.length > 0) {
    const { data: latest } = await supabase
      .from("attendance_records")
      .select("date")
      .in("student_id", ids)
      .order("date", { ascending: false })
      .limit(1);
    const latestDate = (latest ?? []) as { date: string }[];
    if (latestDate[0]?.date) anchor = latestDate[0].date;
  }
  const windowStart = addDays(anchor, -29);
  const prevStart = addDays(anchor, -59);

  const { data: attData } = ids.length
    ? await supabase
        .from("attendance_records")
        .select("student_id,date,status")
        .in("student_id", ids)
        .in("status", ["unexcused", "late"])
        .gte("date", prevStart)
        .lte("date", anchor)
        .limit(5000)
    : { data: [] };
  const records = (attData ?? []) as AttRow[];

  interface Count {
    unexcused: number;
    late: number;
  }
  const current = new Map<string, Count>();
  const previous = new Map<string, Count>();
  for (const r of records) {
    const bucket = r.date >= windowStart ? current : previous;
    const c = bucket.get(r.student_id) ?? { unexcused: 0, late: 0 };
    if (r.status === "unexcused") c.unexcused += 1;
    else c.late += 1;
    bucket.set(r.student_id, c);
  }

  const tracked = [...current.entries()]
    .map(([sid, c]) => {
      const total = c.unexcused + c.late;
      const prev = previous.get(sid);
      const prevTotal = prev ? prev.unexcused + prev.late : 0;
      return { sid, ...c, total, prevTotal };
    })
    .filter((t) => t.total >= 3)
    .sort((a, b) => b.total - a.total || b.unexcused - a.unexcused);

  const totalUnexcused = [...current.values()].reduce(
    (a, c) => a + c.unexcused,
    0,
  );
  const totalLate = [...current.values()].reduce((a, c) => a + c.late, 0);

  return (
    <div>
      <PageHeader
        section="Chuyên cần"
        title="Theo dõi tình trạng"
        description={`Học sinh lớp ${selected.name} có từ 3 lượt vắng không phép / đi muộn trong 30 ngày gần nhất (đến ${formatDateOnly(anchor)}).`}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard
          label="HS cần theo dõi"
          value={tracked.length}
          tone={tracked.length > 0 ? "warning" : "success"}
        />
        <StatCard label="Lượt vắng KP (30 ngày)" value={totalUnexcused} tone="error" />
        <StatCard label="Lượt đi muộn (30 ngày)" value={totalLate} tone="warning" />
      </div>

      <div className="mb-4">
        <AiInsightCard
          endpoint="/api/ai/attendance-insight"
          payload={() => ({ classId: selected.id })}
          title={`AI phân tích pattern vắng/muộn - lớp ${selected.name}`}
          buttonLabel="Phân tích pattern"
        />
      </div>

      <DataTable
        columns={[
          "Học sinh",
          "Vắng không phép",
          "Đi muộn",
          "Tổng (30 ngày)",
          "So với 30 ngày trước",
          "Mức độ",
        ]}
        footer={
          <span>
            Ngưỡng cảnh báo: ≥3 lượt vắng không phép / đi muộn trong 30 ngày
          </span>
        }
      >
        {tracked.map((t) => {
          const st = studentById.get(t.sid);
          const diff = t.total - t.prevTotal;
          const severe = t.total >= 6 || t.unexcused >= 4;
          return (
            <tr key={t.sid}>
              <td>
                <span className="font-medium">{st?.full_name ?? "-"}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {st?.code}
                </span>
              </td>
              <td className="text-error">{t.unexcused}</td>
              <td className="text-warning">{t.late}</td>
              <td className="font-semibold">{t.total}</td>
              <td className="text-muted-foreground">
                {diff > 0
                  ? `Tăng ${diff} lượt`
                  : diff < 0
                    ? `Giảm ${-diff} lượt`
                    : "Không đổi"}
                {t.prevTotal > 0 ? ` (trước: ${t.prevTotal})` : ""}
              </td>
              <td>
                <StatusBadge
                  label={severe ? "Cần can thiệp" : "Theo dõi"}
                  tone={severe ? "error" : "warning"}
                />
              </td>
            </tr>
          );
        })}
        {tracked.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Không có học sinh nào vượt ngưỡng cảnh báo trong 30 ngày qua.
            </td>
          </tr>
        )}
      </DataTable>

      <p className="mt-4 rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
        Gợi ý: với các em mức &quot;Cần can thiệp&quot;, GVCN nên liên hệ phụ
        huynh qua mục Thông báo và ghi nhận vào hồ sơ rèn luyện của em.
      </p>
    </div>
  );
}
