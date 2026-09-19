import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ExamsBoard } from "@/components/exams/exams-board";

interface ExamRow {
  id: string;
  name: string;
  term: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "published" | "done";
}
interface SessionRow {
  id: string;
  exam_id: string;
  class_id: string;
  subject_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  room: string | null;
  proctor_id: string | null;
}

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh"]);
  const sp = await searchParams;
  const supabase = await createClient();

  const [
    { data: examData },
    { data: classData },
    { data: subjectData },
    { data: teacherData },
    { data: schoolData },
  ] = await Promise.all([
    supabase
      .from("exams")
      .select("id,name,term,start_date,end_date,status")
      .order("start_date", { ascending: false }),
    supabase
      .from("classes")
      .select("id,name")
      .eq("status", "active")
      .order("name"),
    supabase.from("subjects").select("id,name").order("name"),
    supabase
      .from("profiles")
      .select("id,full_name")
      .in("role", ["gvcn", "gvbm", "to_truong", "bgh"])
      .order("full_name"),
    supabase.from("schools").select("id").limit(1),
  ]);

  const exams = (examData ?? []) as ExamRow[];
  const examId =
    typeof sp.exam === "string" && exams.some((e) => e.id === sp.exam)
      ? sp.exam
      : (exams[0]?.id ?? "");

  const { data: sessionData } = examId
    ? await supabase
        .from("exam_sessions")
        .select("id,exam_id,class_id,subject_id,date,start_time,end_time,room,proctor_id")
        .eq("exam_id", examId)
        .order("date")
        .order("start_time")
    : { data: [] };
  const sessions = (sessionData ?? []) as SessionRow[];

  const canEdit = profile.role === "gvcn" || profile.role === "bgh";

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ III - Học tập"
        title="Quản lý kỳ thi"
        description="Tạo kỳ thi, xếp lịch thi theo lớp và môn, phân công phòng thi và giám thị."
      />
      <ExamsBoard
        exams={exams}
        examId={examId}
        sessions={sessions}
        classes={(classData ?? []) as { id: string; name: string }[]}
        subjects={(subjectData ?? []) as { id: string; name: string }[]}
        teachers={(teacherData ?? []) as { id: string; full_name: string }[]}
        schoolId={(schoolData?.[0] as { id: string } | undefined)?.id ?? ""}
        canEdit={canEdit}
      />
    </div>
  );
}
