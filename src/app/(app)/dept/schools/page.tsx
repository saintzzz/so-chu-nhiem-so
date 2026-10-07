import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SchoolsBoard } from "@/components/dept/schools-board";
import type { School } from "@/types";

export const maxDuration = 60;

// PostgREST mac dinh tra toi da ~1000 rows/request - can vong lap range
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const out: T[] = [];
  let incomplete = false;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) { incomplete = true; break; }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return { rows: out, incomplete };
}

export default async function DeptSchoolsPage() {
  await requireRoles(["so_gd", "admin"]);
  const supabase = await createClient();

  const [{ data: schoolsRaw }, profilesRes] = await Promise.all([
    supabase.from("schools").select("id,name,code,level").order("name"),
    fetchAll<{ school_id: string | null }>((f, t) =>
      supabase.from("profiles").select("id,school_id").range(f, t)),
  ]);
  const profilesRaw = profilesRes.rows;

  const schools = (schoolsRaw ?? []) as Pick<
    School,
    "id" | "name" | "code" | "level"
  >[];
  const userCounts: Record<string, number> = {};
  for (const p of profilesRaw ?? []) {
    if (p.school_id) userCounts[p.school_id] = (userCounts[p.school_id] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Quản lý trường"
        description="Tạo trường mới và cấp tài khoản quản trị đầu tiên - trường tự tạo tài khoản giáo viên sau đó."
      />
      <SchoolsBoard schools={schools} userCounts={userCounts} />
    </div>
  );
}
