import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AnnounceForm } from "@/components/school/announce-form";
import { fmtDateTimeVN } from "@/lib/utils";

export default async function SchoolAnnouncePage() {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("announcements")
    .select("id,title,content,created_at,sender_id")
    .eq("school_id", profile.school_id ?? "")
    .is("class_id", null)
    .order("created_at", { ascending: false })
    .limit(30);
  const items = (data ?? []) as {
    id: string;
    title: string;
    content: string;
    created_at: string;
    sender_id: string;
  }[];
  const senderIds = [...new Set(items.map((a) => a.sender_id))];
  const { data: senders } = senderIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", senderIds)
    : { data: [] };
  const senderName = new Map(
    ((senders ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Thông báo toàn trường"
        description="Gửi thông báo đến toàn bộ giáo viên, học sinh và phụ huynh của trường."
      />
      <div className="mb-6">
        <AnnounceForm />
      </div>
      <h2 className="mb-2 text-sm font-semibold">Thông báo đã gửi</h2>
      <DataTable
        columns={["Thời gian", "Tiêu đề", "Người gửi", "Nội dung"]}
        footer={<span>{items.length} thông báo gần nhất</span>}
      >
        {items.map((a) => (
          <tr key={a.id}>
            <td className="whitespace-nowrap text-muted-foreground">
              {fmtDateTimeVN(a.created_at)}
            </td>
            <td className="font-medium">{a.title}</td>
            <td className="text-muted-foreground">
              {senderName.get(a.sender_id) ?? "-"}
            </td>
            <td className="max-w-md">
              <span className="line-clamp-2 text-sm">{a.content}</span>
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-muted-foreground">
              Chưa có thông báo toàn trường nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
