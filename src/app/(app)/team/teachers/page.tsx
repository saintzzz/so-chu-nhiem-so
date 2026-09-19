import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/nav";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { ClassRoom, Profile, Subject } from "@/types";

interface TeacherSubject {
  teacher_id: string;
  subject_id: string;
}

export default async function TeamTeachersPage() {
  const profile = await requireRoles(["to_truong"]);
  const supabase = await createClient();

  const { data: teacherRows } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("department_id", profile.department_id ?? "")
    .in("role", ["gvcn", "gvbm"])
    .order("full_name");
  const teachers = (teacherRows ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email" | "role"
  >[];
  const teacherIds = teachers.map((t) => t.id);

  const [tsRes, subjectsRes, classesRes] = await Promise.all([
    teacherIds.length
      ? supabase
          .from("teacher_subjects")
          .select("teacher_id,subject_id")
          .in("teacher_id", teacherIds)
      : Promise.resolve({ data: [] }),
    supabase.from("subjects").select("id,name"),
    teacherIds.length
      ? supabase.from("classes").select("id,name,gvcn_id").in("gvcn_id", teacherIds)
      : Promise.resolve({ data: [] }),
  ]);

  const subjectNameOf = new Map(
    ((subjectsRes.data ?? []) as Pick<Subject, "id" | "name">[]).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const subjectsOf = new Map<string, string[]>();
  for (const ts of (tsRes.data ?? []) as TeacherSubject[]) {
    const name = subjectNameOf.get(ts.subject_id);
    if (!name) continue;
    const list = subjectsOf.get(ts.teacher_id) ?? [];
    list.push(name);
    subjectsOf.set(ts.teacher_id, list);
  }
  const classesOf = new Map<string, string[]>();
  for (const c of (classesRes.data ?? []) as Pick<
    ClassRoom,
    "id" | "name" | "gvcn_id"
  >[]) {
    if (!c.gvcn_id) continue;
    const list = classesOf.get(c.gvcn_id) ?? [];
    list.push(c.name);
    classesOf.set(c.gvcn_id, list);
  }

  return (
    <>
      <PageHeader
        section="Tổ chuyên môn"
        title="Danh sách giáo viên"
        description="Giáo viên thuộc tổ — môn giảng dạy và lớp chủ nhiệm"
      />

      <DataTable
        columns={["Họ tên", "Vai trò", "Môn giảng dạy", "Lớp chủ nhiệm", "Email"]}
        footer={<span>{teachers.length} giáo viên</span>}
      >
        {teachers.map((t) => (
          <tr key={t.id}>
            <td className="font-medium">{t.full_name}</td>
            <td>
              <StatusBadge
                label={ROLE_LABELS[t.role]}
                tone={t.role === "gvcn" ? "success" : "muted"}
              />
            </td>
            <td>{subjectsOf.get(t.id)?.join(", ") || "—"}</td>
            <td>{classesOf.get(t.id)?.join(", ") || "—"}</td>
            <td className="text-muted-foreground">{t.email ?? "—"}</td>
          </tr>
        ))}
        {teachers.length === 0 && (
          <tr>
            <td colSpan={5} className="py-8 text-center text-muted-foreground">
              Chưa có giáo viên nào trong tổ.
            </td>
          </tr>
        )}
      </DataTable>
    </>
  );
}
