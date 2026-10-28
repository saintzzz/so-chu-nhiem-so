import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { hasRole } from "@/lib/auth";
import RequestsBoard from "@/components/movements/requests-board";

export const dynamic = "force-dynamic";

// CR-067: bien dong hoc sinh - gvcn tao yeu cau (lop chu nhiem), bgh|admin duyet.
export default async function MovementsPage() {
  const profile = await requireRoles(["gvcn", "bgh", "admin"]);
  const supabase = await createClient();
  const canDecide = hasRole(profile, "bgh") || hasRole(profile, "admin");
  const isGvcnOnly = !canDecide;

  const classesRes = await supabase
    .from("classes")
    .select("id, name, grade, gvcn_id")
    .eq("school_id", profile.school_id)
    .order("grade")
    .order("name")
    .limit(300);
  const allClasses = classesRes.data ?? [];
  const myClasses = isGvcnOnly
    ? allClasses.filter((c) => c.gvcn_id === profile.id)
    : allClasses;
  const classIds = allClasses.map((c) => c.id);
  const myClassIds = myClasses.map((c) => c.id);

  const [requestsRes, studentsRes] = await Promise.all([
    supabase
      .from("sm_requests")
      .select(
        "id,type,status,student_id,student_name,class_label,effective_date,counterpart_school,to_class_id,reason,decision_note,requested_by,created_at,created_student_id",
      )
      .order("created_at", { ascending: false })
      .limit(300),
    classIds.length
      ? supabase
          .from("students")
          .select("id, full_name, code, status, class_id, classes(name)")
          .in("class_id", isGvcnOnly ? myClassIds : classIds)
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const requests = requestsRes.data ?? [];
  const requesterIds = [...new Set(requests.map((r) => r.requested_by).filter(Boolean))];
  const profilesRes = requesterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", requesterIds).limit(400)
    : { data: [] };
  const requesterNames = Object.fromEntries(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name]),
  );

  const students = (studentsRes.data ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    code: s.code,
    status: s.status,
    class_label: (s.classes as { name?: string } | null)?.name ?? "",
  }));

  return (
    <RequestsBoard
      requests={requests.map((r) => ({
        ...r,
        requester_name: r.requested_by ? (requesterNames[r.requested_by] ?? "") : "",
      }))}
      students={students}
      classes={allClasses.map((c) => ({ id: c.id, name: c.name }))}
      canDecide={canDecide}
      myId={profile.id}
      loadError={requestsRes.error?.message ?? studentsRes.error?.message ?? null}
    />
  );
}
