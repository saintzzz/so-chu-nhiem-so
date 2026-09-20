import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AcademicYear, ClassRoom, Profile } from "@/types";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { NewClassForm } from "@/components/records/new-class-form";

const CLASS_STATUS: Record<
  ClassRoom["status"],
  { label: string; tone: "success" | "warning" | "muted" }
> = {
  active: FLOW_STATUS.active,
  pending: FLOW_STATUS.pending,
  archived: FLOW_STATUS.archived,
};

export default async function RecordsIntakePage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  // Lớp do GVCN phụ trách; BGH xem toàn bộ lớp của trường
  let classQuery = supabase.from("classes").select("*").order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];

  const classIds = classes.map((c) => c.id);
  const gvcnIds = [...new Set(classes.map((c) => c.gvcn_id).filter(Boolean))] as string[];
  const yearIds = [
    ...new Set(classes.map((c) => c.academic_year_id).filter(Boolean)),
  ];

  const [studentsRes, profilesRes, yearsRes] = await Promise.all([
    classIds.length
      ? supabase.from("students").select("class_id").in("class_id", classIds)
      : Promise.resolve({ data: [] }),
    gvcnIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", gvcnIds)
      : Promise.resolve({ data: [] }),
    yearIds.length
      ? supabase.from("academic_years").select("*").in("id", yearIds)
      : Promise.resolve({ data: [] }),
  ]);

  const students = (studentsRes.data ?? []) as { class_id: string }[];
  const sizeByClass = new Map<string, number>();
  for (const s of students) {
    sizeByClass.set(s.class_id, (sizeByClass.get(s.class_id) ?? 0) + 1);
  }
  const teacherById = new Map(
    ((profilesRes.data ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );
  const yearById = new Map(
    ((yearsRes.data ?? []) as AcademicYear[]).map((y) => [y.id, y.name]),
  );

  const yearFromClasses =
    ((yearsRes.data ?? []) as AcademicYear[]).find((y) => y.is_current)?.id ??
    classes[0]?.academic_year_id ??
    null;

  let currentYearId = yearFromClasses;
  if (!currentYearId && profile.school_id) {
    const { data: currentYear } = await supabase
      .from("academic_years")
      .select("id")
      .eq("school_id", profile.school_id)
      .eq("is_current", true)
      .maybeSingle();
    currentYearId = currentYear?.id ?? null;
  }

  let campusId = profile.campus_id ?? null;
  if (!campusId && profile.school_id) {
    const { data: campus } = await supabase
      .from("campuses")
      .select("id")
      .eq("school_id", profile.school_id)
      .order("name")
      .limit(1)
      .maybeSingle();
    campusId = campus?.id ?? null;
  }

  return (
    <div>
      <PageHeader
        section="Hồ sơ lớp học"
        title="Tiếp nhận lớp / danh sách lớp"
        description={
          profile.role === "gvcn"
            ? "Các lớp bạn đang làm chủ nhiệm trong năm học hiện tại."
            : "Danh sách lớp của trường trong năm học hiện tại."
        }
        actions={
          <NewClassForm
            schoolId={profile.school_id}
            academicYearId={currentYearId}
            gvcnId={profile.id}
            campusId={campusId}
          />
        }
      />

      <DataTable
        columns={["Lớp", "GVCN", "Sĩ số", "Năm học", "Trạng thái", ""]}
        footer={<span>{classes.length} lớp</span>}
      >
        {classes.map((c) => {
          const st = CLASS_STATUS[c.status] ?? {
            label: c.status,
            tone: "muted" as const,
          };
          return (
            <tr key={c.id}>
              <td>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Khối {c.grade}
                </span>
              </td>
              <td>
                {c.gvcn_id ? (teacherById.get(c.gvcn_id) ?? "-") : "Chưa phân công"}
              </td>
              <td>{sizeByClass.get(c.id) ?? 0}</td>
              <td>{yearById.get(c.academic_year_id) ?? "-"}</td>
              <td>
                <StatusBadge label={st.label} tone={st.tone} />
              </td>
              <td>
                <Link prefetch={false}
                  href={`/records/students?class=${c.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Xem hồ sơ
                </Link>
              </td>
            </tr>
          );
        })}
        {classes.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có lớp nào được phân công. Nhấn &quot;Tiếp nhận lớp mới&quot;
              để bắt đầu.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
