import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRowsIn } from "@/lib/supabase/fetch-all";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { RosterClient } from "@/components/register/roster-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  LoadErrorNotice,
  pickClass,
} from "@/components/register/server-utils";
import type { ClassRoleRow } from "@/components/register/types";
import type { Student, StudentGroup } from "@/types";
import { must } from "@/lib/supabase/must";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const { classes, error: classesErr } = await getAccessibleClasses(profile);
  const cls = pickClass(classes, classParam);

  if (classesErr) {
    console.error("[register/roster] classes:", classesErr);
  }
  if (!cls) {
    return (
      <>
        <PageHeader
          section="Sổ chủ nhiệm"
          title="Danh sách học sinh & Tổ"
        />
        {classesErr ? <LoadErrorNotice /> : <EmptyClassNotice />}
      </>
    );
  }

  const [
    { data: studentsData, error: studentsErr },
    { data: groupsData, error: groupsErr },
  ] = await Promise.all([
    must(supabase
      .from("students")
      .select("*")
      .eq("class_id", cls.id)
      .eq("status", "active")
      .order("full_name"), "students"),
    must(supabase
      .from("student_groups")
      .select("*")
      .eq("class_id", cls.id)
      .order("name"), "student_groups"),
  ]);

  const students = (studentsData ?? []) as Student[];
  const groups = (groupsData ?? []) as StudentGroup[];

  const { data: rolesData, error: rolesErr } =
    students.length > 0
      ? await supabase
          .from("class_roles")
          .select("*")
          .in(
            "student_id",
            students.map((s) => s.id),
          )
      : { data: [], error: null };
  const roles = (rolesData ?? []) as ClassRoleRow[];

  // r26: .in chunk + phan trang - parent_students khoa kep (student_id,
  // parent_id), khong co cot id.
  const linkRes =
    students.length > 0
      ? await fetchAllRowsIn<{ student_id: string; parent_id: string }>(
          (chunk, f, t) =>
            supabase
              .from("parent_students")
              .select("student_id,parent_id")
              .in("student_id", chunk)
              .order("student_id")
              .order("parent_id")
              .range(f, t),
          students.map((s) => s.id),
        )
      : { rows: [], error: null, truncated: false };
  const linkData = linkRes.rows;
  const linkErr =
    linkRes.error || linkRes.truncated
      ? { message: linkRes.error ?? "truncated" }
      : null;
  const parentLinks = linkData;

  const linkedParentIds = [...new Set(parentLinks.map((l) => l.parent_id))];
  const parentsRes = linkedParentIds.length
    ? await fetchAllRowsIn<{
        id: string;
        full_name: string;
        phone: string | null;
        email: string | null;
        relationship: string | null;
      }>(
        (chunk, f, t) =>
          supabase
            .from("parents")
            .select("id,full_name,phone,email,relationship")
            .in("id", chunk)
            .order("id")
            .range(f, t),
        linkedParentIds,
      )
    : { rows: [], error: null, truncated: false };
  const parentsData = parentsRes.rows;
  const parentsErr =
    parentsRes.error || parentsRes.truncated
      ? { message: parentsRes.error ?? "truncated" }
      : null;
  const parents = (parentsData ?? []) as {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    relationship: string | null;
  }[];

  // R14-01: roster la editor (scn_set_class_role replace chuc danh tung HS,
  // chia to, lien ket PH) - mount tren nguon loi/thieu cho phep ghi de sai.
  // Bat cu loi nao -> khoa editor, hien notice.
  const srcErrors = Object.entries({
    classes_source: classesErr,
    students: studentsErr?.message ?? null,
    student_groups: groupsErr?.message ?? null,
    class_roles: rolesErr?.message ?? null,
    parent_students: linkErr?.message ?? null,
    parents: parentsErr?.message ?? null,
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[register/roster] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Danh sách học sinh & Tổ"
        description={`Lớp ${cls.name} · ${students.length} học sinh · ${groups.length} tổ`}
      />
      <ClassChips classes={classes} selectedId={cls.id} href="/register/roster" />
      {loadError ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <RosterClient
          key={cls.id}
          classId={cls.id}
          students={students}
          groups={groups}
          roles={roles}
          parents={parents}
          parentLinks={parentLinks}
        />
      )}
    </>
  );
}
