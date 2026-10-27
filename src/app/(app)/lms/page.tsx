import { requireRoles } from "@/lib/auth";
import { hasAnyRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SessionsBoard, type LmsSession, type ExamOpt, type ClassOpt } from "@/components/lms/sessions-board";

export default async function LmsPage() {
  const profile = await requireRoles(["gvbm", "gvcn", "to_truong", "bgh", "admin", "so_gd"]);
  const canWrite = hasAnyRole(profile, ["gvbm", "gvcn", "to_truong", "bgh", "admin"]);
  const supabase = await createClient();

  // De thi chi thuoc ngan hang truong minh (owner la staff cung truong) -
  // khoa cheo truong ca voi bgh/admin, giong RPC lms_assign.
  const [staffRes, classRes, sessRes] = await Promise.all([
    supabase.from("profiles").select("id").eq("school_id", profile.school_id),
    supabase
      .from("classes")
      .select("id, name, grade")
      .eq("school_id", profile.school_id)
      .order("grade")
      .order("name")
      .limit(200),
    supabase
      .from("lms_sessions")
      .select("id, title, status, opens_at, closes_at, duration_minutes, classes(name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const staffIds = (staffRes.data ?? []).map((r) => r.id);
  const examRes = staffIds.length
    ? await supabase
        .from("tvc_exams")
        .select("id, title, subject_code, grade, created_at")
        .in("owner_id", staffIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  const srcErr = staffRes.error ?? examRes.error ?? classRes.error ?? sessRes.error;
  if (srcErr) {
    return (
      <div>
        <PageHeader section="Bài tập trực tuyến" title="Giao bài & theo dõi" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }

  const sessions = ((sessRes.data ?? []) as unknown[]).map((r) => {
    const row = r as LmsSession & { classes: { name: string } | { name: string }[] | null };
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    return { ...row, class_name: cls?.name ?? "?" };
  }) as LmsSession[];

  return (
    <div>
      <PageHeader section="Bài tập trực tuyến" title="Giao bài & theo dõi" />
      <SessionsBoard
        sessions={sessions}
        exams={(examRes.data ?? []) as ExamOpt[]}
        classes={(classRes.data ?? []) as ClassOpt[]}
        canWrite={canWrite}
      />
    </div>
  );
}
