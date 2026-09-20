import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { MeetingForm } from "@/components/team/meeting-form";

interface DeptMeeting {
  id: string;
  department_id: string;
  title: string;
  meeting_date: string;
  content: string | null;
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10).split("-").reverse().join("/");
}

export default async function TeamMeetingsPage() {
  const profile = await requireRoles(["to_truong"]);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("dept_meetings")
    .select("id,department_id,title,meeting_date,content")
    .eq("department_id", profile.department_id ?? "")
    .order("meeting_date", { ascending: false });
  const meetings = (rows ?? []) as DeptMeeting[];

  return (
    <>
      <PageHeader
        section="Tổ chuyên môn"
        title="Sinh hoạt chuyên môn"
        description="Lịch sinh hoạt tổ và biên bản các buổi họp chuyên môn"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 text-base font-semibold">Tạo buổi sinh hoạt</h2>
          <MeetingForm />
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">
            Danh sách buổi sinh hoạt{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({meetings.length})
            </span>
          </h2>
          {meetings.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Chưa có buổi sinh hoạt chuyên môn nào.
            </p>
          ) : (
            <ul className="space-y-3">
              {meetings.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{m.title}</h3>
                    <span className="rounded-full bg-primary-bg px-2.5 py-0.5 text-xs font-medium text-primary">
                      {formatDate(m.meeting_date)}
                    </span>
                  </div>
                  {m.content && (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                      {m.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
