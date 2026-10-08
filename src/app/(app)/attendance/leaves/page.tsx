import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { AttendanceRecord, ClassRoom, Student } from "@/types";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { StatCard } from "@/components/stat-card";
import {
  LeavesTable,
  type LeaveRow,
} from "@/components/attendance/leaves-table";
import { AttendanceRangeNav } from "@/components/attendance/date-controls";
import { hasRole } from "@/lib/roles";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AttendanceLeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; from?: string; to?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const {
    class: classParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (hasRole(profile, "gvcn")) {
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
          title="Nghỉ học / đi muộn"
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
    .eq("class_id", selected.id);
  const students = (studentData ?? []) as Pick<
    Student,
    "id" | "code" | "full_name"
  >[];
  const studentById = new Map(students.map((s) => [s.id, s]));
  const ids = students.map((s) => s.id);

  const from = fromParam && DATE_RE.test(fromParam) ? fromParam : "";
  const to = toParam && DATE_RE.test(toParam) ? toParam : "";

  // R8-03: cap 500 rows truoc day cat ngam du lieu -> stats + bang sai lech. Doc
  // het qua fetchAllRows (order date desc + tie-break id); loi/truncated
  // hien notice thay vi render so lieu thieu.
  const emptyAtt = { rows: [] as AttendanceRecord[], error: null, truncated: false };
  const attRes = ids.length
    ? await fetchAllRows<AttendanceRecord>((f, t) => {
        let q = supabase
          .from("attendance_records")
          .select("*")
          .in("student_id", ids)
          .in("status", ["excused", "unexcused", "late"])
          .order("date", { ascending: false })
          .order("id");
        if (from) q = q.gte("date", from);
        if (to) q = q.lte("date", to);
        return q.range(f, t);
      })
    : emptyAtt;
  const errors: string[] = [];
  if (attRes.error || attRes.truncated) {
    errors.push("attendance_records");
    console.error(
      "[attendance/leaves] attendance_records:",
      attRes.error ?? "truncated",
    );
  }
  const records = attRes.rows;

  const rows: LeaveRow[] = records
    .filter((r) => studentById.has(r.student_id))
    .map((r) => ({
      id: r.id,
      studentName: studentById.get(r.student_id)!.full_name,
      studentCode: studentById.get(r.student_id)!.code,
      date: r.date,
      status: r.status as LeaveRow["status"],
      source: r.source,
      note: r.note,
    }));

  const excused = rows.filter((r) => r.status === "excused").length;
  const unexcused = rows.filter((r) => r.status === "unexcused").length;
  const late = rows.filter((r) => r.status === "late").length;

  return (
    <div>
      <PageHeader
        section="Chuyên cần"
        title="Nghỉ học / đi muộn"
        description={`Các lượt vắng và đi muộn của lớp ${selected.name}, gồm cả dữ liệu gộp từ Sổ đầu bài và báo của phụ huynh.`}
      />
      <ClassChips
        classes={classes}
        selectedId={selected.id}
        href="/attendance/leaves"
        params={{ from, to }}
      />
      <AttendanceRangeNav
        from={from}
        to={to}
        params={{ class: selected.id }}
      />

      {errors.length > 0 ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải đủ dữ liệu - vui lòng thử lại.
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="Vắng có phép" value={excused} tone="warning" />
            <StatCard label="Vắng không phép" value={unexcused} tone="error" />
            <StatCard label="Đi muộn" value={late} tone="warning" />
          </div>

          <LeavesTable rows={rows} />
        </>
      )}
    </div>
  );
}
