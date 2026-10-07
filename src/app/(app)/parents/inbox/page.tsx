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

export default async function InboxPage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  // R10-02: trang dau gioi han 50 (desc + tie-break id cho cursor paging);
  // unread dem bang head:true count query - KHONG suy ra tu cac hang da tai
  // vi tin cu hon 50 van co the chua doc.
  const [msgRes, unreadRes] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", profile.id)
      .is("read_at", null),
  ]);
  const messages = (msgRes.data ?? []) as MessageRow[];

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

  const unread = unreadRes.count ?? 0;

  return (
    <div>
      <PageHeader
        section="Phụ huynh"
        title="Hộp thư phản hồi"
        description={`Tin nhắn từ phụ huynh gửi đến giáo viên chủ nhiệm. ${unread} tin chưa đọc.`}
      />
      <InboxClient
        meId={profile.id}
        initialHasMore={messages.length === 50}
        messages={messages.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: senderName.get(m.sender_id) ?? "Phụ huynh",
          studentId: m.student_id,
          studentName: m.student_id
            ? (studentName.get(m.student_id) ?? null)
            : null,
          content: m.content,
          createdAt: m.created_at,
          read: !!m.read_at,
        }))}
      />
    </div>
  );
}
