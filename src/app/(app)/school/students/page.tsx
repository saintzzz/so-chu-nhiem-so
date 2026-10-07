import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { compareVietnameseName, fmtDateVN } from "@/lib/utils";
import type { ClassRoom, Student } from "@/types";

export default async function SchoolStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";
  const sp = await searchParams;
  const classParam = sp.class ?? null;

  const { data: classIdRows } = await supabase
    .from("classes")
    .select("id")
    .eq("school_id", sid);
  const classIds = (classIdRows ?? []).map((c: { id: string }) => c.id);

  const [{ data: classRaw }, { rows: stuRaw }] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name,campus_id")
      .eq("school_id", sid)
      .eq("status", "active")
      .order("name"),
    // paging de vuot PostgREST row cap - truong >1000 HS khong bi mat du lieu
    fetchAllRows<
      Pick<Student, "id" | "class_id" | "code" | "full_name" | "dob" | "gender" | "status" | "national_id">
    >((f, t) =>
      supabase
        .from("students")
        .select("id,class_id,code,full_name,dob,gender,status,national_id")
        .in("class_id", classIds)
        .order("id")
        .range(f, t),
    ),
  ]);
  const classes = (classRaw ?? []) as Pick<
    ClassRoom,
    "id" | "name" | "campus_id"
  >[];
  const students = (stuRaw ?? []) as Pick<
    Student,
    "id" | "class_id" | "code" | "full_name" | "dob" | "gender" | "status" | "national_id"
  >[];
  students.sort((a, b) => compareVietnameseName(a.full_name, b.full_name));

  const selected = classParam ?? "all";
  const shown =
    selected === "all"
      ? students
      : students.filter((s) => s.class_id === selected);
  const classNameOf = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Hồ sơ học sinh toàn trường"
        description={`${students.length} học sinh - ${classes.length} lớp.`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/school/students"
          className={`rounded-full border px-3 py-1 text-sm ${selected === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
        >
          Tất cả ({students.length})
        </Link>
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/school/students?class=${c.id}`}
            className={`rounded-full border px-3 py-1 text-sm ${selected === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
          >
            {c.name}
          </Link>
        ))}
      </div>
      <DataTable
        columns={["Mã học sinh", "Họ tên", "Lớp", "Ngày sinh", "Giới tính", "Mã định danh", "Trạng thái"]}
        footer={<span>{shown.length} học sinh</span>}
      >
        {shown.map((s) => (
          <tr key={s.id}>
            <td className="font-mono text-xs">{s.code}</td>
            <td className="font-medium">{s.full_name}</td>
            <td>{classNameOf.get(s.class_id) ?? "-"}</td>
            <td>{s.dob ? fmtDateVN(s.dob) : "-"}</td>
            <td>{s.gender === "nam" ? "Nam" : s.gender === "nu" ? "Nữ" : "-"}</td>
            <td className="font-mono text-xs">{s.national_id ?? "-"}</td>
            <td>
              <StatusBadge
                label={s.status === "active" ? "Đang học" : s.status}
                tone={s.status === "active" ? "success" : "muted"}
              />
            </td>
          </tr>
        ))}
        {shown.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-muted-foreground">
              Không có học sinh nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
