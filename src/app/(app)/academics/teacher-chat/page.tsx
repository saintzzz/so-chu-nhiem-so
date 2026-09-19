import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ChatThread, type ChatMessage } from "@/components/academics/chat-thread";
import { cn } from "@/lib/utils";

interface ProfileRow {
  id: string;
  full_name: string;
}
interface TeacherSubjectRow {
  teacher_id: string;
  subject_id: string;
}
interface SubjectRow {
  id: string;
  name: string;
}

export default async function TeacherChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong"]);
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: teacherData } = await supabase
    .from("profiles")
    .select("id,full_name")
    .eq("role", "gvbm")
    .neq("id", profile.id)
    .order("full_name");
  const teachers = (teacherData ?? []) as ProfileRow[];

  const teacherIds = teachers.map((t) => t.id);
  const [{ data: tsData }, { data: subjData }] = teacherIds.length
    ? await Promise.all([
        supabase
          .from("teacher_subjects")
          .select("teacher_id,subject_id")
          .in("teacher_id", teacherIds),
        supabase.from("subjects").select("id,name"),
      ])
    : [{ data: [] }, { data: [] }];
  const teacherSubjects = (tsData ?? []) as TeacherSubjectRow[];
  const subjects = (subjData ?? []) as SubjectRow[];
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const teacherSubjectNames = new Map<string, string[]>();
  for (const ts of teacherSubjects) {
    const arr = teacherSubjectNames.get(ts.teacher_id) ?? [];
    const name = subjectName.get(ts.subject_id);
    if (name) arr.push(name);
    teacherSubjectNames.set(ts.teacher_id, arr);
  }

  const peerId =
    typeof sp.to === "string" && teachers.some((t) => t.id === sp.to)
      ? sp.to
      : (teachers[0]?.id ?? "");
  const peer = teachers.find((t) => t.id === peerId);

  const { data: msgData } = peerId
    ? await supabase
        .from("messages")
        .select("id,sender_id,recipient_id,student_id,content,read_at,created_at")
        .or(
          `and(sender_id.eq.${profile.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${profile.id})`,
        )
        .order("created_at")
    : { data: [] };
  const messages = (msgData ?? []) as ChatMessage[];

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ III - Học tập"
        title="Trao đổi với GVBM"
        description="Trao đổi trực tiếp với giáo viên bộ môn về tình hình học tập của học sinh."
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
          <p className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Giáo viên bộ môn
          </p>
          <ul className="max-h-[32rem] overflow-y-auto p-2">
            {teachers.map((t) => (
              <li key={t.id}>
                <Link prefetch={false}
                  href={`/academics/teacher-chat?to=${t.id}`}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm hover:bg-muted",
                    t.id === peerId && "bg-primary-bg text-primary",
                  )}
                >
                  <span className="block font-medium">{t.full_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {(teacherSubjectNames.get(t.id) ?? []).join(", ") || "GVBM"}
                  </span>
                </Link>
              </li>
            ))}
            {teachers.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Không có GVBM nào.
              </li>
            )}
          </ul>
        </aside>

        {peer ? (
          <ChatThread
            key={peer.id}
            meId={profile.id}
            peerId={peer.id}
            peerName={peer.full_name}
            messages={messages}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
            Chọn một giáo viên bộ môn để bắt đầu trao đổi.
          </div>
        )}
      </div>
    </div>
  );
}
