import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ChatThread, type ChatMessage } from "@/components/academics/chat-thread";
import { cn } from "@/lib/utils";

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  class_id: string;
  code: string;
  full_name: string;
  profile_id: string | null;
}

export default async function StudentChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const sp = await searchParams;
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("id,name")
    .eq("status", "active");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  }
  const { data: classData } = await classQuery.order("name");
  const classes = (classData ?? []) as ClassRow[];
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const classIds = classes.map((c) => c.id);

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id,code,full_name,profile_id")
        .in("class_id", classIds)
        .eq("status", "active")
        .not("profile_id", "is", null)
        .order("full_name")
    : { data: [] };
  const students = (studentData ?? []) as StudentRow[];

  const peerId =
    typeof sp.to === "string" && students.some((s) => s.profile_id === sp.to)
      ? sp.to
      : (students[0]?.profile_id ?? "");
  const peer = students.find((s) => s.profile_id === peerId);

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
        section="Phân hệ IV - Rèn luyện"
        title="Trao đổi học sinh"
        description="Trao đổi trực tiếp với học sinh về rèn luyện và hạnh kiểm."
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
          <p className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Học sinh
          </p>
          <ul className="max-h-[32rem] overflow-y-auto p-2">
            {students.map((s) => (
              <li key={s.id}>
                <Link prefetch={false}
                  href={`/conduct/student-chat?to=${s.profile_id}`}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm hover:bg-muted",
                    s.profile_id === peerId && "bg-primary-bg text-primary",
                  )}
                >
                  <span className="block font-medium">{s.full_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.code} - {className.get(s.class_id) ?? ""}
                  </span>
                </Link>
              </li>
            ))}
            {students.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Chưa có học sinh nào có tài khoản.
              </li>
            )}
          </ul>
        </aside>

        {peer ? (
          <ChatThread
            key={peer.id}
            meId={profile.id}
            peerId={peer.profile_id as string}
            peerName={peer.full_name}
            studentId={peer.id}
            messages={messages}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
            Chọn một học sinh để bắt đầu trao đổi.
          </div>
        )}
      </div>
    </div>
  );
}
