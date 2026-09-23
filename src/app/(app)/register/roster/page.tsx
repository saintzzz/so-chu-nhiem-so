import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { RosterClient } from "@/components/register/roster-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  pickClass,
} from "@/components/register/server-utils";
import type { ClassRoleRow } from "@/components/register/types";
import type { Student, StudentGroup } from "@/types";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const classes = await getAccessibleClasses(profile);
  const cls = pickClass(classes, classParam);

  if (!cls) {
    return (
      <>
        <PageHeader
          section="Sổ chủ nhiệm"
          title="Danh sách học sinh & Tổ"
        />
        <EmptyClassNotice />
      </>
    );
  }

  const [{ data: studentsData }, { data: groupsData }] = await Promise.all([
    supabase
      .from("students")
      .select("*")
      .eq("class_id", cls.id)
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("student_groups")
      .select("*")
      .eq("class_id", cls.id)
      .order("name"),
  ]);

  const students = (studentsData ?? []) as Student[];
  const groups = (groupsData ?? []) as StudentGroup[];

  const { data: rolesData } =
    students.length > 0
      ? await supabase
          .from("class_roles")
          .select("*")
          .in(
            "student_id",
            students.map((s) => s.id),
          )
      : { data: [] };
  const roles = (rolesData ?? []) as ClassRoleRow[];

  const { data: linkData } =
    students.length > 0
      ? await supabase
          .from("parent_students")
          .select("student_id,parent_id")
          .in(
            "student_id",
            students.map((s) => s.id),
          )
      : { data: [] };
  const parentLinks = (linkData ?? []) as {
    student_id: string;
    parent_id: string;
  }[];

  const { data: parentsData } = await supabase
    .from("parents")
    .select("id,full_name,phone,email,relationship")
    .order("full_name");
  const parents = (parentsData ?? []) as {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    relationship: string | null;
  }[];

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Danh sách học sinh & Tổ"
        description={`Lớp ${cls.name} · ${students.length} học sinh · ${groups.length} tổ`}
      />
      <ClassChips classes={classes} selectedId={cls.id} href="/register/roster" />
      <RosterClient
        key={cls.id}
        classId={cls.id}
        students={students}
        groups={groups}
        roles={roles}
        parents={parents}
        parentLinks={parentLinks}
      />
    </>
  );
}
