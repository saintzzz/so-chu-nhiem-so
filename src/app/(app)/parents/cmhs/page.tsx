import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { CmhsBoard } from "@/components/parents/cmhs-board";

interface ClassRow {
  id: string;
  name: string;
}
interface ParentRow {
  id: string;
  full_name: string;
  phone: string | null;
  class_id: string;
}
interface MemberRow {
  id: string;
  class_id: string;
  parent_id: string;
  role: "truong_ban" | "pho_ban" | "uy_vien";
  note: string | null;
}

export default async function CmhsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const sp = await searchParams;
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

  // parents of students in the selected class
  const { data: parentData } = classId
    ? await supabase
        .from("parent_students")
        .select("parent_id, students!inner(class_id), parents!inner(id,full_name,phone)")
        .eq("students.class_id", classId)
    : { data: [] };
  const parents = ((parentData ?? []) as unknown as {
    parent_id: string;
    parents: { id: string; full_name: string; phone: string | null };
  }[]).map((r) => ({
    id: r.parent_id,
    full_name: r.parents.full_name,
    phone: r.parents.phone,
    class_id: classId,
  })) as ParentRow[];

  const { data: memberData } = classId
    ? await supabase
        .from("cmhs_members")
        .select("id,class_id,parent_id,role,note")
        .eq("class_id", classId)
    : { data: [] };
  const members = (memberData ?? []) as MemberRow[];

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ VI - Phụ huynh"
        title="Ban đại diện cha mẹ học sinh"
        description="Thành lập và quản lý Ban đại diện CMHS của lớp theo Điều 44, Thông tư 32/2020 - gồm Trưởng ban, Phó ban và các Ủy viên."
      />
      <CmhsBoard
        classes={classes}
        classId={classId}
        parents={parents}
        members={members}
      />
    </div>
  );
}
