import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export default async function NotificationsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();

  // R10-02: trang dau gioi han 50 (desc + tie-break id cho cursor paging);
  // unread dem bang head:true count query vi thong bao cu hon 50 van co the
  // chua doc - khong duoc suy ra tu cac hang da tai.
  const [listRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,type,title,body,link,read_at,created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
  ]);
  const data = listRes.data;

  return (
    <>
      <PageHeader
        section="Tài khoản"
        title="Thông báo"
        description="Các sự kiện liên quan đến bạn - nộp sổ, ký duyệt, lịch hẹn, tin nhắn."
      />
      <NotificationsClient
        meId={profile.id}
        initialHasMore={(data ?? []).length === 50}
        initialUnreadCount={unreadRes.count ?? 0}
        notifications={(data ?? []) as {
          id: string;
          type: string | null;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        }[]}
      />
    </>
  );
}
