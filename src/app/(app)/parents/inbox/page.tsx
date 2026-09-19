import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "@/components/parents/inbox-client";
import type { Profile, Student } from "@/types";

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

export default async function InboxPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  const { data: msgData } = await supabase
    .from("messages")
    .select("*")
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const messages = (msgData ?? []) as MessageRow[];

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const studentIds = [
    ...new Set(
      messages.map((m) => m.student_id).filter((x): x is string => !!x),
    ),
  ];

  const { data: senderData } = senderIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", senderIds)
    : { data: [] };
  const senders = (senderData ?? []) as Pick<Profile, "id" | "full_name">[];
  const senderName = new Map(senders.map((s) => [s.id, s.full_name]));

  const { data: studentData } = studentIds.length
    ? await supabase
        .from("students")
        .select("id,full_name")
        .in("id", studentIds)
    : { data: [] };
  const students = (studentData ?? []) as Pick<Student, "id" | "full_name">[];
  const studentName = new Map(students.map((s) => [s.id, s.full_name]));

  const unread = messages.filter((m) => !m.read_at).length;

  return (
    <div>
      <PageHeader
        section="Phụ huynh"
        title="Hộp thư phản hồi"
        description={`Tin nhắn từ phụ huynh gửi đến giáo viên chủ nhiệm. ${unread} tin chưa đọc.`}
      />
      <InboxClient
        messages={messages.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: senderName.get(m.sender_id) ?? "Phụ huynh",
          studentId: m.student_id,
          studentName: m.student_id
            ? (studentName.get(m.student_id) ?? null)
            : null,
          content: m.content,
          createdAt: fmtDateTime(m.created_at),
          read: !!m.read_at,
        }))}
      />
    </div>
  );
}
