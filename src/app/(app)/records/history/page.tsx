import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassRoom, Profile, Student } from "@/types";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";

interface RecordHistoryRow {
  id: string;
  student_id: string;
  changed_by: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  address: "Địa chỉ",
  full_name: "Họ tên",
  dob: "Ngày sinh",
  gender: "Giới tính",
  status: "Trạng thái",
  group_id: "Tổ",
  phone: "Số điện thoại",
  code: "Mã học sinh",
};

export default async function RecordsHistoryPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  let classQuery = supabase.from("classes").select("*").order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];
  const classIds = classes.map((c) => c.id);

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,code,full_name,class_id")
        .in("class_id", classIds)
    : { data: [] };
  const students = (studentData ?? []) as Pick<
    Student,
    "id" | "code" | "full_name" | "class_id"
  >[];
  const studentById = new Map(students.map((s) => [s.id, s]));
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const studentIds = students.map((s) => s.id);
  const { data: histData } = studentIds.length
    ? await supabase
        .from("student_record_history")
        .select("*")
        .in("student_id", studentIds)
        .order("changed_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const history = (histData ?? []) as RecordHistoryRow[];

  const changerIds = [
    ...new Set(history.map((h) => h.changed_by).filter(Boolean)),
  ] as string[];
  const { data: changerData } = changerIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", changerIds)
    : { data: [] };
  const changerById = new Map(
    ((changerData ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (
    <div>
      <PageHeader
        section="Phân hệ I - Hồ sơ lớp học"
        title="Lịch sử cập nhật hồ sơ"
        description="Mọi thay đổi trên hồ sơ học sinh đều được ghi lại: trường dữ liệu, giá trị cũ/mới và người thực hiện."
      />

      <DataTable
        columns={[
          "Thời gian",
          "Học sinh",
          "Lớp",
          "Trường dữ liệu",
          "Giá trị cũ",
          "Giá trị mới",
          "Người cập nhật",
        ]}
        footer={<span>{history.length} thay đổi gần nhất</span>}
      >
        {history.map((h) => {
          const st = studentById.get(h.student_id);
          return (
            <tr key={h.id}>
              <td className="whitespace-nowrap text-muted-foreground">
                {new Date(h.changed_at).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td>
                <span className="font-medium">{st?.full_name ?? "—"}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {st?.code}
                </span>
              </td>
              <td>
                {st ? (classNameById.get(st.class_id) ?? "—") : "—"}
              </td>
              <td>{FIELD_LABEL[h.field] ?? h.field}</td>
              <td className="max-w-40 truncate text-muted-foreground">
                {h.old_value ?? "—"}
              </td>
              <td className="max-w-40 truncate font-medium">
                {h.new_value ?? "—"}
              </td>
              <td>
                {h.changed_by
                  ? (changerById.get(h.changed_by) ?? "—")
                  : "Hệ thống"}
              </td>
            </tr>
          );
        })}
        {history.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-muted-foreground">
              Chưa có thay đổi nào được ghi nhận.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
