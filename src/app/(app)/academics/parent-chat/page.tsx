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
  full_name: string;
}
interface ParentStudentRow {
  parent_id: string;
  student_id: string;
}
interface ParentRow {
  id: string;
  profile_id: string | null;
  full_name: string;
}

export default async function ParentChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn"]);
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
        .select("id,class_id,full_name")
        .in("class_id", classIds)
        .eq("status", "active")
    : { data: [] };
  const students = (studentData ?? []) as StudentRow[];
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const studentIds = students.map((s) => s.id);

  const { data: psData } = studentIds.length
    ? await supabase
        .from("parent_students")
        .select("parent_id,student_id")
        .in("student_id", studentIds)
    : { data: [] };
  const parentStudents = (psData ?? []) as ParentStudentRow[];
  const parentIds = [...new Set(parentStudents.map((p) => p.parent_id))];

  const { data: parentData } = parentIds.length
    ? await supabase
        .from("parents")
        .select("id,profile_id,full_name")
        .in("id", parentIds)
        .not("profile_id", "is", null)
        .order("full_name")
    : { data: [] };
  const parents = (parentData ?? []) as ParentRow[];

  const contacts = parents
    .map((p) => {
      const link = parentStudents.find((ps) => ps.parent_id === p.id);
      const student = link ? studentMap.get(link.student_id) : undefined;
      return {
        peerId: p.profile_id as string,
        name: p.full_name,
        studentId: link?.student_id ?? null,
        subtitle: student
          ? `PH của ${student.full_name} - ${className.get(student.class_id) ?? ""}`
          : "Phụ huynh",
      };
    })
    .filter((c) => c.peerId !== profile.id);

  const peerId =
    typeof sp.to === "string" && contacts.some((c) => c.peerId === sp.to)
      ? sp.to
      : (contacts[0]?.peerId ?? "");
  const peer = contacts.find((c) => c.peerId === peerId);

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
        section="Học tập"
        title="Trao đổi phụ huynh"
        description="Trao đổi trực tiếp với phụ huynh học sinh trong lớp."
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
          <p className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Phụ huynh
          </p>
          <ul className="max-h-[32rem] overflow-y-auto p-2">
            {contacts.map((c) => (
              <li key={c.peerId}>
                <Link prefetch={false}
                  href={`/academics/parent-chat?to=${c.peerId}`}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm hover:bg-muted",
                    c.peerId === peerId && "bg-primary-bg text-primary",
                  )}
                >
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.subtitle}
                  </span>
                </Link>
              </li>
            ))}
            {contacts.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Chưa có phụ huynh nào có tài khoản.
              </li>
            )}
          </ul>
        </aside>

        {peer ? (
          <ChatThread
            key={peer.peerId}
            meId={profile.id}
            peerId={peer.peerId}
            peerName={peer.name}
            studentId={peer.studentId}
            messages={messages}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
            Chọn một phụ huynh để bắt đầu trao đổi.
          </div>
        )}
      </div>
    </div>
  );
}
