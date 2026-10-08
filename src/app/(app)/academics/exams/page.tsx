import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ExamsBoard } from "@/components/exams/exams-board";
import { hasRole } from "@/lib/roles";

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
    { data: examData, error: examErr },
    { data: classData, error: classErr },
    { data: subjectData, error: subjectErr },
    { data: teacherData, error: teacherErr },
    { data: schoolData, error: schoolErr },
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
    supabase.from("subjects").select("id,name").eq("school_id", profile.school_id ?? "").order("name"),
    supabase
      .from("profiles")
      .select("id,full_name")
      .or("role.in.(gvcn,gvbm,to_truong,bgh),concurrent_roles.ov.{gvcn,gvbm,to_truong,bgh}")
      .eq("school_id", profile.school_id ?? "")
      .order("full_name"),
    supabase.from("schools").select("id").limit(1),
  ]);

  // R15-03: moi nguon loi phai duoc ghi nhan - board + export template khong
  // duoc chay tren du lieu thieu.
  const srcErrors: string[] = [];
  if (examErr) {
    srcErrors.push("exams");
    console.error("[academics/exams] exams:", examErr.message);
  }
  if (classErr) {
    srcErrors.push("classes");
    console.error("[academics/exams] classes:", classErr.message);
  }
  if (subjectErr) {
    srcErrors.push("subjects");
    console.error("[academics/exams] subjects:", subjectErr.message);
  }
  if (teacherErr) {
    srcErrors.push("profiles");
    console.error("[academics/exams] profiles:", teacherErr.message);
  }
  if (schoolErr) {
    srcErrors.push("schools");
    console.error("[academics/exams] schools:", schoolErr.message);
  }

  const exams = (examData ?? []) as ExamRow[];
  const examId =
    typeof sp.exam === "string" && exams.some((e) => e.id === sp.exam)
      ? sp.exam
      : (exams[0]?.id ?? "");

  // exam_sessions co the vuot PostgREST cap ~1000 rows (nhieu lop x nhieu
  // mon x nhieu ky) -> fetchAllRows voi khoa sap xep on dinh date,start_time,
  // id. Loi/truncated -> gate board, khong hien so buoi thi hay export
  // template tu du lieu thieu.
  const sessionsRes = examId
    ? await fetchAllRows<SessionRow>((f, t) =>
        supabase
          .from("exam_sessions")
          .select("id,exam_id,class_id,subject_id,date,start_time,end_time,room,proctor_id")
          .eq("exam_id", examId)
          .order("date")
          .order("start_time")
          .order("id")
          .range(f, t),
      )
    : { rows: [], error: null, truncated: false };
  if (sessionsRes.error || sessionsRes.truncated) {
    srcErrors.push("exam_sessions");
    console.error(
      "[academics/exams] exam_sessions:",
      sessionsRes.error ?? "truncated",
    );
  }
  const sessions = sessionsRes.rows;

  const canEdit = hasRole(profile, "gvcn") || hasRole(profile, "bgh");
  const loadError = srcErrors.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Học tập"
        title="Quản lý kỳ thi"
        description="Tạo kỳ thi, xếp lịch thi theo lớp và môn, phân công phòng thi và giám thị."
      />
      {loadError ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <>
          {/* CR-041: sinh cau hoi tap trung tai ngan hang Studio - ket qua
              chay qua pipeline YCCD + duyet 2 lop, DC-03 rut de dung lai duoc */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Sinh câu hỏi bằng AI</p>
              <p className="text-muted-foreground">
                Sinh theo môn + chủ đề trong Ngân hàng câu hỏi - câu hỏi được gắn
                YCCĐ, kiểm duyệt và rút vào đề bằng công cụ DC-03.
              </p>
            </div>
            <Link
              href="/studio/questions?gen=1"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Mở ngân hàng câu hỏi
            </Link>
          </div>
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
        </>
      )}
    </div>
  );
}
