import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { SubstituteBoard } from "@/components/school/substitute-board";
import type {
  ClassRoom,
  Profile,
  Subject,
  SubstituteRequest,
  TimetableEntry,
} from "@/types";

export default async function SubstitutesPage() {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [
    { data: classData },
    { data: subData },
    { data: reqData },
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
  // PHT chỉ thao tác lớp thuộc cơ sở phụ trách; chưa gán campus -> fail-closed.
  const scopedClasses =
    profile.role === "pht"
      ? profile.campus_id
        ? classes.filter((c) => c.campus_id === profile.campus_id)
        : []
      : classes;
  const scopedIds = new Set(scopedClasses.map((c) => c.id));

  // R7-03: timetable_entries truoc day fetch TOAN BO cac truong khong phan
  // trang (PostgREST cat ngam ~1000 rows) - gio scope server-side theo lop
  // hien thi va doc het qua fetchAllRows. teacher_subjects khong co cot id
  // -> order composite (teacher_id, subject_id) la khoa on dinh.
  const emptyRes = { rows: [] as never[], error: null, truncated: false };
  const [ttRes, tsRes] = await Promise.all([
    scopedIds.size
      ? fetchAllRows<TimetableEntry>((f, t) =>
          supabase
            .from("timetable_entries")
            .select("*")
            .in("class_id", [...scopedIds])
            .order("id")
            .range(f, t),
        )
      : Promise.resolve(emptyRes),
    fetchAllRows<{ teacher_id: string; subject_id: string }>((f, t) =>
      supabase
        .from("teacher_subjects")
        .select("teacher_id,subject_id")
        .order("teacher_id")
        .order("subject_id")
        .range(f, t),
    ),
  ]);
  // Loi/truncated -> hien thong bao thay vi render goi y thieu chinh xac.
  const errors: string[] = [];
  if (ttRes.error || ttRes.truncated) errors.push("timetable");
  if (tsRes.error || tsRes.truncated) errors.push("teacher_subjects");

  const timetable = ttRes.rows;
  const teacherSubjects = tsRes.rows;
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
      {errors.length > 0 ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải đủ dữ liệu nguồn để hiển thị điều động - kết quả có thể
          thiếu chính xác. Vui lòng thử lại sau.
        </p>
      ) : (
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
      )}
    </div>
  );
}
