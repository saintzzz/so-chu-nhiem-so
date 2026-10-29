import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { hasAnyRole, hasRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { todayVN, isoDateVN } from "@/lib/utils";
import { MealsBoard } from "@/components/meals/meals-board";

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh", "pht", "ke_toan", "admin"]);
  await requireModule("bua_an");
  const canWrite = hasAnyRole(profile, ["gvcn", "bgh", "pht", "ke_toan", "admin"]);
  const canMenu = hasAnyRole(profile, ["bgh", "pht", "ke_toan", "admin"]);
  const isHomeroom = hasRole(profile, "gvcn");
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? todayVN();
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: menus }, { data: classes }, { data: counts }, { data: regs }] =
    await Promise.all([
      must(supabase
        .from("meal_menus")
        .select("id, menu_date, meal_type, description, allergen_notes, supplier, cost_per_portion")
        .eq("school_id", sid)
        .gte("menu_date", date)
        .lte("menu_date", isoDateVN(new Date(new Date(date + "T00:00:00Z").getTime() + 6 * 86400000)))
        .order("menu_date"), "menus"),
      must(supabase
        .from("classes")
        .select("id,name,gvcn_id")
        .order("name"), "classes"),
      must(supabase
        .from("meal_counts")
        .select("id, class_id, menu_date, meal_type, planned_count, actual_count, note")
        .eq("school_id", sid)
        .eq("menu_date", date), "counts"),
      // registrations thang hien tai - planned_count basis
      must(supabase
        .from("meal_registrations")
        .select("student_id, meal_type, students(class_id)")
        .eq("school_id", sid)
        .eq("year", Number(date.slice(0, 4)))
        .eq("month", Number(date.slice(5, 7)))
        .eq("registered", true), "regs"),
    ]);

  const myClassId = isHomeroom
    ? (classes ?? []).find((c) => c.gvcn_id === profile.id)?.id ?? null
    : null;

  return (
    <div>
      <PageHeader
        section="Vận hành"
        title="Bữa ăn & bán trú"
        description="Thực đơn theo tuần, số suất ăn theo lớp - GVCN báo số suất lớp mình."
      />
      <MealsBoard
        date={date}
        menus={(menus ?? []) as never[]}
        classes={(classes ?? []) as never[]}
        counts={(counts ?? []) as never[]}
        registrations={(regs ?? []) as never[]}
        canWrite={canWrite}
        canMenu={canMenu}
        myClassId={myClassId}
      />
    </div>
  );
}
