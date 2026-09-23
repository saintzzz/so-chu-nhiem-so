import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ComposeForm } from "@/components/parents/compose-form";
import type { Announcement, ClassRoom, Profile, Student } from "@/types";
import { fmtDateTimeVN } from "@/lib/utils";

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
  return fmtDateTimeVN(iso);
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

  // Coverage: lớp/HS -> số phụ huynh có email (kênh nhận thông báo duy nhất).
  const studentIds = students.map((s) => s.id);
  const { data: linkData } = studentIds.length
    ? await supabase
        .from("parent_students")
        .select("student_id,parent_id")
        .in("student_id", studentIds)
    : { data: [] };
  const links = (linkData ?? []) as {
    student_id: string;
    parent_id: string;
  }[];
  const parentIds = [...new Set(links.map((l) => l.parent_id))];
  const { data: parentData } = parentIds.length
    ? await supabase
        .from("parents")
        .select("id,email")
        .in("id", parentIds)
    : { data: [] };
  const emailByParent = new Map(
    ((parentData ?? []) as { id: string; email: string | null }[]).map((p) => [
      p.id,
      Boolean(p.email),
    ]),
  );
  // studentId -> {withEmail,total}
  const coverage = new Map<string, { withEmail: number; total: number }>();
  for (const l of links) {
    const c = coverage.get(l.student_id) ?? { withEmail: 0, total: 0 };
    c.total += 1;
    if (emailByParent.get(l.parent_id)) c.withEmail += 1;
    coverage.set(l.student_id, c);
  }

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
          coverage={Object.fromEntries(coverage)}
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
