import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import type { AttendanceRecord } from "@/types";

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function DeptReportsPage() {
  const profile = await requireRoles(["so_gd", "phong_gd", "ubnd", "admin"]);
  const supabase = await createClient();

  const { data: orgData } = await supabase
    .from("org_units")
    .select("id,type,name,parent_id");
  const orgs = (orgData ?? []) as {
    id: string;
    type: string;
    name: string;
    parent_id: string | null;
  }[];

  let scopedOrgIds: Set<string> | null = null;
  if (profile.role === "phong_gd" && profile.org_unit_id) {
    scopedOrgIds = new Set(
      orgs
        .filter((o) => o.parent_id === profile.org_unit_id)
        .map((o) => o.id)
        .concat(profile.org_unit_id),
    );
  } else if (profile.role === "ubnd" && profile.org_unit_id) {
    scopedOrgIds = new Set([profile.org_unit_id]);
  }

  const { data: schoolRows } = await supabase
    .from("schools")
    .select("id,name,org_unit_id");
  const allSchools = (schoolRows ?? []) as {
    id: string;
    name: string;
    org_unit_id: string | null;
  }[];
  const scopedSchools = scopedOrgIds
    ? allSchools.filter((s) => s.org_unit_id && scopedOrgIds.has(s.org_unit_id))
    : allSchools;
  const scopedSchoolIds = new Set(scopedSchools.map((s) => s.id));
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  const { data: classRows } = await supabase
    .from("classes")
    .select("id,school_id")
    .eq("status", "active");
  const classes = ((classRows ?? []) as { id: string; school_id: string }[]).filter(
    (c) => scopedSchoolIds.has(c.school_id),
  );
  const classIds = classes.map((c) => c.id);

  const { data: studentRows } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id")
        .in("class_id", classIds)
    : { data: [] };
  const students = (studentRows ?? []) as { id: string; class_id: string }[];
  const studentIds = students.map((s) => s.id);
  const studentClass = new Map(students.map((s) => [s.id, s.class_id]));
  const classSchool = new Map(classes.map((c) => [c.id, c.school_id]));

  const { data: teacherRows } = await supabase
    .from("profiles")
    .select("id,school_id")
    .in("role", ["gvcn", "gvbm", "to_truong"])
    .in("school_id", scopedSchoolIds.size ? [...scopedSchoolIds] : ["none"]);

  const { data: latestAtt } = await supabase
    .from("attendance_records")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  const anchor =
    ((latestAtt ?? [])[0] as Pick<AttendanceRecord, "date"> | undefined)?.date ??
    new Date().toISOString().slice(0, 10);
  const windowStart = addDays(anchor, -29);

  const { data: attRows } = studentIds.length
    ? await supabase
        .from("attendance_records")
        .select("student_id,status")
        .gte("date", windowStart)
        .in("student_id", studentIds)
    : { data: [] };

  // Gom số liệu theo trường
  const per = new Map<
    string,
    { classes: number; students: number; teachers: number; total: number; present: number }
  >();
  for (const s of scopedSchools)
    per.set(s.id, { classes: 0, students: 0, teachers: 0, total: 0, present: 0 });
  for (const c of classes) per.get(c.school_id)!.classes++;
  for (const st of students) {
    const sid = classSchool.get(st.class_id);
    if (sid) per.get(sid)!.students++;
  }
  for (const t of (teacherRows ?? []) as { id: string; school_id: string }[]) {
    if (per.has(t.school_id)) per.get(t.school_id)!.teachers++;
  }
  for (const a of (attRows ?? []) as { student_id: string; status: string }[]) {
    const cid = studentClass.get(a.student_id);
    const sid = cid ? classSchool.get(cid) : undefined;
    if (!sid) continue;
    const row = per.get(sid)!;
    row.total++;
    if (a.status === "present" || a.status === "late") row.present++;
  }

  const totalStudents = students.length;
  const totalAtt = [...per.values()].reduce((a, b) => a + b.total, 0);
  const totalPresent = [...per.values()].reduce((a, b) => a + b.present, 0);

  return (
    <div>
      <PageHeader
        section="Giám sát & báo cáo"
        title="Báo cáo tổng hợp các trường"
        description={`Quy mô, nhân sự và chuyên cần 30 ngày gần nhất (đến ${anchor.split("-").reverse().join("/")}).`}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Trường" value={scopedSchools.length} />
        <StatCard label="Lớp" value={classes.length} />
        <StatCard label="Học sinh" value={totalStudents} tone="primary" />
        <StatCard
          label="Tỷ lệ chuyên cần"
          value={totalAtt ? `${((totalPresent / totalAtt) * 100).toFixed(1)}%` : "-"}
          tone={totalAtt && totalPresent / totalAtt >= 0.9 ? "success" : "warning"}
        />
      </div>
      <DataTable
        columns={["Trường", "Đơn vị quản lý", "Lớp", "Học sinh", "Giáo viên", "Chuyên cần 30N"]}
        footer={<span>{scopedSchools.length} trường</span>}
      >
        {scopedSchools.map((s) => {
          const r = per.get(s.id)!;
          const rate = r.total ? (r.present / r.total) * 100 : null;
          return (
            <tr key={s.id}>
              <td className="font-medium">{s.name}</td>
              <td className="text-muted-foreground">
                {s.org_unit_id ? (orgName.get(s.org_unit_id) ?? "-") : "-"}
              </td>
              <td>{r.classes}</td>
              <td>{r.students}</td>
              <td>{r.teachers}</td>
              <td className="font-semibold">
                {rate !== null ? `${rate.toFixed(1)}%` : "-"}
              </td>
            </tr>
          );
        })}
        {scopedSchools.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Không có trường nào trong phạm vi.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
