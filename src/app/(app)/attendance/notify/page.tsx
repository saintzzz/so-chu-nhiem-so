import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Announcement, ClassRoom, Student } from "@/types";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { NotifyForm } from "@/components/attendance/notify-form";

export default async function AttendanceNotifyPage({
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
          section="Phân hệ II - Chuyên cần"
          title="Thông báo phụ huynh"
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
  const studentName = new Map(students.map((s) => [s.id, s.full_name]));

  const { data: annData } = await supabase
    .from("announcements")
    .select("*")
    .eq("class_id", selected.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const announcements = (annData ?? []) as Announcement[];

  return (
    <div>
      <PageHeader
        section="Phân hệ II - Chuyên cần"
        title="Thông báo phụ huynh"
        description={`Soạn và gửi thông báo đến phụ huynh lớp ${selected.name} - toàn lớp hoặc từng học sinh.`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <NotifyForm
          classId={selected.id}
          className={selected.name}
          senderId={profile.id}
          students={students.map((s) => ({
            id: s.id,
            fullName: s.full_name,
            code: s.code,
          }))}
        />

        <div>
          <h2 className="mb-3 text-base font-semibold">Đã gửi gần đây</h2>
          <DataTable
            columns={["Ngày gửi", "Tiêu đề", "Đối tượng", "Nội dung"]}
            footer={<span>{announcements.length} thông báo gần nhất</span>}
          >
            {announcements.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </td>
                <td className="max-w-40 font-medium">{a.title}</td>
                <td className="whitespace-nowrap">
                  {a.student_id
                    ? (studentName.get(a.student_id) ?? "1 học sinh")
                    : "Cả lớp"}
                </td>
                <td className="max-w-56 truncate text-muted-foreground">
                  {a.content}
                </td>
              </tr>
            ))}
            {announcements.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  Chưa có thông báo nào được gửi.
                </td>
              </tr>
            )}
          </DataTable>
        </div>
      </div>
    </div>
  );
}
