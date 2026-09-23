import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export default async function NotificationsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id,type,title,body,link,read_at,created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader
        section="Tài khoản"
        title="Thông báo"
        description="Các sự kiện liên quan đến bạn - nộp sổ, ký duyệt, lịch hẹn, tin nhắn."
      />
      <NotificationsClient
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
