import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge, SEVERITY, FLOW_STATUS } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IncidentForm } from "@/components/safety/incident-form";
import type { ClassRoom, Incident, Profile, Student } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function scopedClasses(
  supabase: Supabase,
  profile: Profile,
): Promise<ClassRoom[]> {
  const wideRoles = ["bgh", "so_gd", "admin", "to_truong"];
  let query = supabase.from("classes").select("*").order("name");
  if (wideRoles.includes(profile.role)) {
    if (profile.school_id) query = query.eq("school_id", profile.school_id);
  } else {
    query = query.eq("gvcn_id", profile.id);
  }
  const { data } = await query;
  return (data ?? []) as ClassRoom[];
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

export default async function SafetyReportPage() {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh"]);
  const supabase = await createClient();

  const classes = await scopedClasses(supabase, profile);
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,full_name,class_id,code")
        .in("class_id", classIds)
        .eq("status", "active")
        .order("full_name")
    : { data: [] };
  const students = (studentData ?? []) as Pick<
    Student,
    "id" | "full_name" | "class_id" | "code"
  >[];
  const studentName = new Map(students.map((s) => [s.id, s.full_name]));

  const { data: incData } = classIds.length
    ? await supabase
        .from("incidents")
        .select("*")
        .in("class_id", classIds)
        .order("occurred_at", { ascending: false })
        .limit(10)
    : { data: [] };
  const incidents = (incData ?? []) as Incident[];

  return (
    <div>
      <PageHeader
        section="Phân hệ VIII - An toàn HS"
        title="Ghi nhận sự cố"
        description="Ghi nhận nhanh các sự cố liên quan đến an toàn, sức khỏe và kỷ luật của học sinh."
      />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <IncidentForm
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          students={students}
        />
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Sự cố ghi nhận gần đây
          </h2>
          {incidents.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
              Chưa có sự cố nào được ghi nhận.
            </div>
          ) : (
            <DataTable
              columns={[
                "Thời điểm",
                "Học sinh",
                "Loại",
                "Mức độ",
                "Trạng thái",
              ]}
            >
              {incidents.map((i) => {
                const sev = SEVERITY[i.severity];
                const st = FLOW_STATUS[i.status];
                return (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {fmtDateTime(i.occurred_at)}
                    </td>
                    <td className="font-medium">
                      {i.student_id
                        ? (studentName.get(i.student_id) ?? "-")
                        : `Lớp ${i.class_id ? (className.get(i.class_id) ?? "") : ""}`}
                    </td>
                    <td className="max-w-48 truncate">{i.type}</td>
                    <td>
                      <StatusBadge label={sev.label} tone={sev.tone} />
                    </td>
                    <td>
                      <StatusBadge label={st.label} tone={st.tone} />
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </div>
      </div>
    </div>
  );
}
