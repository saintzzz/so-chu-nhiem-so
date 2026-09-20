import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { AssignmentsBoard } from "@/components/school/assignments-board";
import { AiInsightCard } from "@/components/ai/ai-insight-card";

interface ClassRow {
  id: string;
  name: string;
  grade: number;
  gvcn_id: string | null;
}
interface TeacherRow {
  id: string;
  full_name: string;
  role: string;
}
interface TeacherSubjectRow {
  teacher_id: string;
  subject_id: string;
}
interface SubjectRow {
  id: string;
  name: string;
}
interface TimetableRow {
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
}

export default async function AssignmentsPage() {
  const profile = await requireRoles(["bgh"]);
  const supabase = await createClient();

  const [
    { data: classData },
    { data: teacherData },
    { data: tsData },
    { data: subjectData },
    { data: ttData },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name,grade,gvcn_id")
      .eq("school_id", profile.school_id ?? "")
      .eq("status", "active")
      .order("grade")
      .order("name"),
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("school_id", profile.school_id ?? "")
      .in("role", ["gvcn", "gvbm", "to_truong"])
      .order("full_name"),
    supabase.from("teacher_subjects").select("teacher_id,subject_id"),
    supabase
      .from("subjects")
      .select("id,name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("timetable_entries")
      .select("class_id,subject_id,teacher_id"),
  ]);

  const classes = (classData ?? []) as ClassRow[];
  const teachers = (teacherData ?? []) as TeacherRow[];
  const teacherSubjects = (tsData ?? []) as TeacherSubjectRow[];
  const subjects = (subjectData ?? []) as SubjectRow[];

  // distinct (class, subject) pairs with current teacher
  const pairMap = new Map<string, string | null>();
  for (const t of (ttData ?? []) as TimetableRow[]) {
    const key = `${t.class_id}|${t.subject_id}`;
    if (!pairMap.has(key)) pairMap.set(key, t.teacher_id);
  }
  const pairs = [...pairMap.entries()].map(([key, teacher_id]) => {
    const [class_id, subject_id] = key.split("|");
    return { class_id, subject_id, teacher_id };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        section="Quản trị"
        title="Phân công năm học"
        description="Phân công giáo viên chủ nhiệm cho từng lớp, môn phụ trách của giáo viên và phân công giảng dạy theo lớp."
      />
      <AiInsightCard
        endpoint="/api/ai/assignment-suggest"
        payload={() => ({})}
        title="AI gợi ý phân công giảng dạy"
        buttonLabel="Đề xuất phân công"
      />
      <AssignmentsBoard
        classes={classes}
        teachers={teachers}
        subjects={subjects}
        teacherSubjects={teacherSubjects}
        pairs={pairs}
      />
    </div>
  );
}
