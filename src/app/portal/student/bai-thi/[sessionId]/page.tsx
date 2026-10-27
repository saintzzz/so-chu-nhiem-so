import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal/portal-header";
import { TakeExam } from "@/components/lms/take-exam";

export default async function TakeExamPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const profile = await requireRoles(["hoc_sinh"]);
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("lms_sessions")
    .select("id, title, closes_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !session) {
    return (
      <div className="theme-fluent min-h-screen bg-background">
        <PortalHeader title="Cổng học sinh" userName={profile.full_name} />
        <main className="mx-auto w-full max-w-3xl px-4 py-6">
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
            Không tìm thấy bài hoặc bài không dành cho lớp của bạn.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="theme-fluent min-h-screen bg-background">
      <PortalHeader title="Cổng học sinh" userName={profile.full_name} />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <TakeExam sessionId={session.id} title={session.title} />
      </main>
    </div>
  );
}
