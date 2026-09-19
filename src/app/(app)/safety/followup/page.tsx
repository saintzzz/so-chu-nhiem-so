import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FollowupList } from "@/components/safety/followup-list";
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

export default async function SafetyFollowupPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const classes = await scopedClasses(supabase, profile);
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const { data: incData } = classIds.length
    ? await supabase
        .from("incidents")
        .select("*")
        .in("class_id", classIds)
        .in("status", ["new", "following"])
        .order("occurred_at", { ascending: false })
    : { data: [] };
  const incidents = (incData ?? []) as Incident[];

  const studentIds = [
    ...new Set(
      incidents.map((i) => i.student_id).filter((x): x is string => !!x),
    ),
  ];
  const { data: studentData } = studentIds.length
    ? await supabase
        .from("students")
        .select("id,full_name")
        .in("id", studentIds)
    : { data: [] };
  const studentName = new Map(
    ((studentData ?? []) as Pick<Student, "id" | "full_name">[]).map((s) => [
      s.id,
      s.full_name,
    ]),
  );

  return (
    <div>
      <PageHeader
        section="Phân hệ VIII - An toàn HS"
        title="Theo dõi & nhắc"
        description={`Cập nhật tình trạng xử lý và ghi chú theo dõi cho ${incidents.length} sự cố đang mở.`}
      />
      <FollowupList
        incidents={incidents.map((i) => ({
          id: i.id,
          occurredAt: fmtDateTime(i.occurred_at),
          className: i.class_id ? (className.get(i.class_id) ?? "—") : "—",
          studentName: i.student_id
            ? (studentName.get(i.student_id) ?? "—")
            : "Sự cố chung",
          type: i.type,
          severity: i.severity,
          status: i.status,
          description: i.description,
        }))}
      />
    </div>
  );
}
