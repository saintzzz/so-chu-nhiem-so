import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubstituteBoard } from "@/components/school/substitute-board";
import type {
  ClassRoom,
  Profile,
  Subject,
  SubstituteRequest,
  TimetableEntry,
} from "@/types";

export default async function SubstitutesPage() {
  const profile = await requireRoles(["bgh", "pht", "gvcn"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [
    { data: classData },
    { data: subData },
    { data: reqData },
    { data: ttData },
    { data: tsData },
    { data: profData },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .eq("school_id", sid)
      .eq("status", "active")
      .order("name"),
    supabase.from("subjects").select("*").eq("school_id", sid).order("name"),
    supabase
      .from("substitute_requests")
      .select("*")
      .eq("school_id", sid)
      .order("date", { ascending: false })
      .limit(50),
    supabase.from("timetable_entries").select("*"),
    supabase.from("teacher_subjects").select("teacher_id,subject_id"),
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("school_id", sid)
      .in("role", ["gvbm", "gvcn", "to_truong"]),
  ]);

  const classes = (classData ?? []) as ClassRoom[];
  const classIds = new Set(classes.map((c) => c.id));
  const subjects = (subData ?? []) as Subject[];
  const requests = ((reqData ?? []) as SubstituteRequest[]).filter((r) =>
    classIds.has(r.class_id),
  );
  // PHT chỉ thao tác lớp thuộc cơ sở phụ trách
  const scopedClasses =
    profile.role === "pht" && profile.campus_id
      ? classes.filter((c) => c.campus_id === profile.campus_id)
      : classes;
  const scopedIds = new Set(scopedClasses.map((c) => c.id));

  const timetable = ((ttData ?? []) as TimetableEntry[]).filter((t) =>
    scopedIds.has(t.class_id),
  );
  const teacherSubjects = (tsData ?? []) as {
    teacher_id: string;
    subject_id: string;
  }[];
  const teachers = (profData ?? []) as Pick<
    Profile,
    "id" | "full_name" | "role"
  >[];

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Điều động dạy thay"
        description="GV vắng - chọn tiết trống trong thời khóa biểu, hệ thống gợi ý GV cùng môn còn rảnh, BGH phê duyệt."
      />
      <SubstituteBoard
        classes={scopedClasses.map((c) => ({ id: c.id, name: c.name }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        requests={requests}
        timetable={timetable.map((t) => ({
          id: t.id,
          class_id: t.class_id,
          subject_id: t.subject_id,
          teacher_id: t.teacher_id,
          weekday: t.weekday,
          period: t.period,
        }))}
        teacherSubjects={teacherSubjects}
        teachers={teachers.map((t) => ({ id: t.id, name: t.full_name }))}
        canDecide={profile.role === "bgh" || profile.role === "pht"}
        canCreate
      />
    </div>
  );
}
