import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppointmentsClient } from "@/components/parents/appointments-client";
import type { Appointment, Parent, Student } from "@/types";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

export default async function AppointmentsPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  const { data: apptData } = await supabase
    .from("appointments")
    .select("*")
    .eq("teacher_id", profile.id)
    .order("scheduled_at", { ascending: false });
  const appointments = (apptData ?? []) as Appointment[];

  const parentIds = [...new Set(appointments.map((a) => a.parent_id))];
  const studentIds = [
    ...new Set(
      appointments.map((a) => a.student_id).filter((x): x is string => !!x),
    ),
  ];

  const { data: parentData } = parentIds.length
    ? await supabase
        .from("parents")
        .select("id,full_name")
        .in("id", parentIds)
    : { data: [] };
  const parents = (parentData ?? []) as Pick<Parent, "id" | "full_name">[];
  const parentName = new Map(parents.map((p) => [p.id, p.full_name]));

  const { data: studentData } = studentIds.length
    ? await supabase
        .from("students")
        .select("id,full_name")
        .in("id", studentIds)
    : { data: [] };
  const students = (studentData ?? []) as Pick<Student, "id" | "full_name">[];
  const studentName = new Map(students.map((s) => [s.id, s.full_name]));

  const proposed = appointments.filter((a) => a.status === "proposed").length;
  const confirmed = appointments.filter(
    (a) => a.status === "confirmed",
  ).length;
  const done = appointments.filter((a) => a.status === "done").length;

  return (
    <div>
      <PageHeader
        section="Phụ huynh"
        title="Lịch hẹn trao đổi"
        description="Quản lý lịch hẹn trao đổi trực tiếp giữa giáo viên chủ nhiệm và phụ huynh."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng lịch hẹn" value={appointments.length} />
        <StatCard label="Chờ xác nhận" value={proposed} tone="primary" />
        <StatCard label="Đã xác nhận" value={confirmed} tone="success" />
        <StatCard label="Đã hoàn thành" value={done} />
      </div>
      <AppointmentsClient
        rows={appointments.map((a) => ({
          id: a.id,
          parentName: parentName.get(a.parent_id) ?? "Phụ huynh",
          studentName: a.student_id
            ? (studentName.get(a.student_id) ?? null)
            : null,
          scheduledAt: fmtDateTime(a.scheduled_at),
          purpose: a.purpose,
          status: a.status,
        }))}
      />
    </div>
  );
}
