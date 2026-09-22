import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TimetableEditor } from "@/components/schedule/timetable-editor";
import { compareVietnameseName } from "@/lib/utils";
import type { ClassRoom, Subject } from "@/types";

export default async function TimetableManagePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";
  const sp = await searchParams;

  const [{ data: clsRaw }, { data: subRaw }, { data: teacherRaw }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id,name,grade")
        .eq("school_id", sid)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("subjects")
        .select("id,name")
        .eq("school_id", sid)
        .order("name"),
      supabase
        .from("profiles")
        .select("id,full_name")
        .eq("school_id", sid)
        .in("role", ["gvcn", "gvbm", "to_truong"]),
    ]);
  const classes = (clsRaw ?? []) as Pick<ClassRoom, "id" | "name" | "grade">[];
  const subjects = (subRaw ?? []) as Pick<Subject, "id" | "name">[];
  const teachers = (teacherRaw ?? []) as { id: string; full_name: string }[];
  teachers.sort((a, b) => compareVietnameseName(a.full_name, b.full_name));

  const classId =
    sp.class && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  const { data: entryRaw } = classId
    ? await supabase
        .from("timetable_entries")
        .select("id,class_id,subject_id,teacher_id,weekday,period,room")
        .eq("class_id", classId)
    : { data: [] };
  const entries = (entryRaw ?? []) as {
    id: string;
    class_id: string;
    subject_id: string;
    teacher_id: string | null;
    weekday: number;
    period: number;
    room: string | null;
  }[];

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Xếp thời khóa biểu"
        description="Sắp xếp tiết học theo lớp - hệ thống kiểm tra trùng giáo viên và phòng học."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {classes.map((c) => (
          <a
            key={c.id}
            href={`/schedule/manage?class=${c.id}`}
            className={`rounded-full border px-3 py-1 text-sm ${classId === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
          >
            {c.name}
          </a>
        ))}
      </div>
      {classId ? (
        <TimetableEditor
          key={classId}
          classId={classId}
          entries={entries}
          subjects={subjects}
          teachers={teachers}
        />
      ) : (
        <p className="text-muted-foreground">Chưa có lớp nào để xếp thời khóa biểu.</p>
      )}
    </div>
  );
}
