import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { requireRoles, hasAnyRole } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import ExportsBoard from "@/components/exports/board";

export const dynamic = "force-dynamic";

// CR-069: hoc ba XML + ky so - gvcn lop minh, bgh|admin toan truong.
export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["bgh", "admin", "gvcn"]);
  await requireModule("hoc_ba");
  const supabase = await createClient();
  const { class: classId } = await searchParams;
  const isAdmin = hasAnyRole(profile, ["bgh", "admin"]);

  // Lop hien tai cua truong; gvcn chi thay lop chu nhiem minh.
  let clsQ = supabase
    .from("classes")
    .select("id,name,grade")
    .eq("school_id", profile.school_id)
    .order("grade")
    .order("name");
  if (!isAdmin) clsQ = clsQ.eq("gvcn_id", profile.id);
  const { data: classes } = await must(clsQ, "classes");

  const cls = classes?.find((c) => c.id === classId) ?? classes?.[0] ?? null;

  const { data: year } = await must(supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("is_current", true)
    .maybeSingle(), "academic_years");

  const [{ data: students }, { data: exports }] = cls
    ? await Promise.all([
        must(supabase
          .from("students")
          .select("id,full_name,code")
          .eq("class_id", cls.id)
          .neq("status", "transferred")
          .limit(200), "students"),
        year
          ? must(supabase
              .from("hb_exports")
              .select("id,student_id,status,gvcn_at,bgh_at")
              .eq("school_id", profile.school_id)
              .eq("academic_year_id", year.id), "hb_exports")
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <ExportsBoard
      classes={classes ?? []}
      currentClassId={cls?.id ?? null}
      students={students ?? []}
      exports={exports ?? []}
      yearId={year?.id ?? null}
      isAdmin={isAdmin}
    />
  );
}
