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
  phone: string | null;
  email: string | null;
}

export default async function ParentChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: classData } = await supabase
    .from("classes")
    .select("id,name")
    .eq("status", "active")
    .eq("gvcn_id", profile.id)
    .order("name");
  const classes = (classData ?? []) as ClassRow[];

  const selectedClassId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? null);

  const { data: studentData } = selectedClassId
    ? await supabase
        .from("students")
        .select("id,class_id,full_name")
        .eq("class_id", selectedClassId)
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
        .select("id,profile_id,full_name,phone,email")
        .in("id", parentIds)
    : { data: [] };
  const parents = sortByVietnameseName(
    (parentData ?? []) as ParentRow[],
    (p) => p.full_name,
  );

  const contacts = parents.map((p) => {
    const link = parentStudents.find((ps) => ps.parent_id === p.id);
    const student = link ? studentMap.get(link.student_id) : undefined;
    return {
      parentId: p.id,
      peerId: p.profile_id,
      name: p.full_name,
      phone: p.phone,
      email: p.email,
      studentId: link?.student_id ?? null,
      subtitle: student ? `PH của ${student.full_name}` : "Phụ huynh",
    };
  });

  const messagable = contacts.filter(
    (c) => c.peerId && c.peerId !== profile.id,
  );

  const peerId =
    typeof sp.to === "string" && messagable.some((c) => c.peerId === sp.to)
      ? sp.to
      : (messagable[0]?.peerId ?? "");
  const peer = messagable.find((c) => c.peerId === peerId);

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
        description="Danh bạ phụ huynh lấy từ hồ sơ lớp (Danh sách học sinh & Tổ). Trao đổi trực tiếp với phụ huynh đã có tài khoản cổng thông tin."
      />

      {classes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Lớp:</span>
          {classes.map((c) => (
            <Link prefetch={false}
              key={c.id}
              href={`/academics/parent-chat?class=${c.id}`}
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
            Phụ huynh ({contacts.length})
          </p>
          <ul className="max-h-[32rem] overflow-y-auto p-2">
            {contacts.map((c) =>
              c.peerId ? (
                <li key={c.parentId}>
                  <Link prefetch={false}
                    href={`/academics/parent-chat?class=${selectedClassId}&to=${c.peerId}`}
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
              ) : (
                <li
                  key={c.parentId}
                  className="rounded-lg px-3 py-2 text-sm opacity-60"
                  title="Phụ huynh chưa có tài khoản cổng thông tin"
                >
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.subtitle} - Chưa có tài khoản
                  </span>
                  {(c.phone || c.email) && (
                    <span className="block text-xs text-muted-foreground">
                      {[c.phone, c.email].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ),
            )}
            {contacts.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Lớp chưa có phụ huynh nào. Thêm phụ huynh tại trang{" "}
                <Link prefetch={false}
                  href="/register/roster"
                  className="text-primary underline"
                >
                  Danh sách học sinh &amp; Tổ
                </Link>
                .
              </li>
            )}
          </ul>
        </aside>

        {peer ? (
          <ChatThread
            key={peer.peerId}
            meId={profile.id}
            peerId={peer.peerId as string}
            peerName={peer.name}
            studentId={peer.studentId}
            messages={messages}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
            {contacts.length === 0
              ? "Lớp chưa có phụ huynh nào. Thêm phụ huynh tại trang Danh sách học sinh & Tổ."
              : "Chọn một phụ huynh có tài khoản để bắt đầu trao đổi."}
          </div>
        )}
      </div>
    </div>
  );
}
