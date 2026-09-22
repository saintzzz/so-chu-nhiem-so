import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ChatThread, type ChatMessage } from "@/components/academics/chat-thread";
import { cn, sortByVietnameseName } from "@/lib/utils";

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
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery.order("name");
  const classes = (classData ?? []) as ClassRow[];

  const selectedClassId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? null);

  const { data: studentData } = selectedClassId
    ? await supabase
        .from("students")
        .select("id,class_id,code,full_name,profile_id")
        .eq("class_id", selectedClassId)
        .eq("status", "active")
    : { data: [] };
  const students = sortByVietnameseName(
    (studentData ?? []) as StudentRow[],
    (s) => s.full_name,
  );

  const peerId =
    typeof sp.to === "string" && students.some((s) => s.profile_id === sp.to)
      ? sp.to
      : (students.find((s) => s.profile_id)?.profile_id ?? "");
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
        section="Rèn luyện"
        title="Trao đổi học sinh"
        description="Trao đổi trực tiếp với học sinh về rèn luyện và hạnh kiểm."
      />

      {classes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Lớp:</span>
          {classes.map((c) => (
            <Link prefetch={false}
              key={c.id}
              href={`/conduct/student-chat?class=${c.id}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                c.id === selectedClassId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
          <p className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Học sinh ({students.length})
          </p>
          <ul className="max-h-[32rem] overflow-y-auto p-2">
            {students.map((s) =>
              s.profile_id ? (
                <li key={s.id}>
                  <Link prefetch={false}
                    href={`/conduct/student-chat?class=${s.class_id}&to=${s.profile_id}`}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm hover:bg-muted",
                      s.profile_id === peerId && "bg-primary-bg text-primary",
                    )}
                  >
                    <span className="block font-medium">{s.full_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.code}
                    </span>
                  </Link>
                </li>
              ) : (
                <li
                  key={s.id}
                  className="rounded-lg px-3 py-2 text-sm opacity-60"
                  title="Học sinh chưa có tài khoản cổng thông tin"
                >
                  <span className="block font-medium">{s.full_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.code} - Chưa có tài khoản
                  </span>
                </li>
              ),
            )}
            {students.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Lớp chưa có học sinh nào.
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
            {students.length === 0
              ? "Lớp chưa có học sinh nào."
              : "Chọn một học sinh có tài khoản để bắt đầu trao đổi."}
          </div>
        )}
      </div>
    </div>
  );
}
