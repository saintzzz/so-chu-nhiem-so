import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ComposeForm } from "@/components/parents/compose-form";
import type { Announcement, ClassRoom, Profile, Student } from "@/types";

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

export default async function ComposePage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  const classes = await scopedClasses(supabase, profile);
  const classIds = classes.map((c) => c.id);

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

  const { data: annData } = await supabase
    .from("announcements")
    .select("*")
    .eq("sender_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const announcements = (annData ?? []) as Announcement[];

  const className = new Map(classes.map((c) => [c.id, c.name]));
  const studentName = new Map(students.map((s) => [s.id, s.full_name]));

  return (
    <div>
      <PageHeader
        section="Phụ huynh"
        title="Soạn & gửi thông báo"
        description="Gửi thông báo đến phụ huynh cả lớp hoặc từng học sinh."
      />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <ComposeForm
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          students={students}
        />
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Thông báo đã gửi gần đây
          </h2>
          {announcements.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
              Chưa có thông báo nào đã gửi.
            </div>
          ) : (
            <DataTable
              columns={["Tiêu đề", "Đối tượng", "Nội dung", "Thời gian"]}
            >
              {announcements.map((a) => (
                <tr key={a.id}>
                  <td className="max-w-56 truncate font-medium">{a.title}</td>
                  <td>
                    {a.student_id ? (
                      <StatusBadge
                        label={studentName.get(a.student_id) ?? "Cá nhân"}
                        tone="primary"
                      />
                    ) : (
                      <StatusBadge
                        label={
                          a.class_id
                            ? `Lớp ${className.get(a.class_id) ?? ""}`
                            : "Cả lớp"
                        }
                        tone="muted"
                      />
                    )}
                  </td>
                  <td className="max-w-72 truncate text-muted-foreground">
                    {a.content}
                  </td>
                  <td className="text-muted-foreground">
                    {fmtDateTime(a.created_at)}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      </div>
    </div>
  );
}
