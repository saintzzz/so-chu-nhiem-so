import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/nav";
import type { Profile, Role, School } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DeptUsagePage() {
  await requireRoles(["so_gd", "admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  const [profilesRes, schoolsRes] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,role,school_id"),
    supabase.from("schools").select("id,name"),
  ]);
  const profiles = (profilesRes.data ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email" | "role" | "school_id"
  >[];
  const schools = (schoolsRes.data ?? []) as Pick<School, "id" | "name">[];
  const schoolNameOf = new Map(schools.map((s) => [s.id, s.name]));

  // auth.users.last_sign_in_at chi doc duoc qua admin API
  const lastSignIn = new Map<string, string | null>();
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = data?.users ?? [];
    for (const u of batch) lastSignIn.set(u.id, u.last_sign_in_at ?? null);
    if (batch.length < 1000) break;
  }

  const now = Date.now();
  const within = (iso: string | null | undefined, ms: number) =>
    !!iso && now - new Date(iso).getTime() < ms;

  const perSchool = schools.map((s) => {
    const users = profiles.filter((p) => p.school_id === s.id);
    const times = users
      .map((p) => lastSignIn.get(p.id))
      .filter(Boolean) as string[];
    return {
      school: s,
      total: users.length,
      active24h: users.filter((p) => within(lastSignIn.get(p.id), DAY_MS)).length,
      active7d: users.filter((p) => within(lastSignIn.get(p.id), 7 * DAY_MS)).length,
      latest: times.sort().at(-1) ?? null,
    };
  });

  const recent = profiles
    .map((p) => ({ p, last: lastSignIn.get(p.id) ?? null }))
    .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""))
    .slice(0, 50);

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Hoạt động sử dụng"
        description="Mức độ sử dụng theo trường - số tài khoản, người active 24h/7 ngày, lần đăng nhập gần nhất."
      />

      <DataTable
        columns={["Trường", "Tài khoản", "Active 24h", "Active 7 ngày", "Đăng nhập gần nhất"]}
        footer={<span>{perSchool.length} trường</span>}
        className="mb-8"
      >
        {perSchool.map((r) => (
          <tr key={r.school.id}>
            <td className="font-medium">{r.school.name}</td>
            <td>{r.total}</td>
            <td>{r.active24h}</td>
            <td>{r.active7d}</td>
            <td className="text-muted-foreground">
              {r.latest ? formatDateTime(r.latest) : "Chưa có"}
            </td>
          </tr>
        ))}
        {perSchool.length === 0 && (
          <tr>
            <td colSpan={5} className="py-8 text-center text-muted-foreground">
              Chưa có trường nào.
            </td>
          </tr>
        )}
      </DataTable>

      <h2 className="mb-2 text-sm font-semibold">Đăng nhập gần nhất theo tài khoản</h2>
      <DataTable
        columns={["Người dùng", "Vai trò", "Trường", "Đăng nhập gần nhất"]}
        footer={<span>Top {recent.length} tài khoản hoạt động gần nhất</span>}
      >
        {recent.map(({ p, last }) => (
          <tr key={p.id}>
            <td className="font-medium">{p.full_name}</td>
            <td>
              <StatusBadge label={ROLE_LABELS[p.role as Role] ?? p.role} tone="muted" />
            </td>
            <td className="text-muted-foreground">
              {p.school_id ? (schoolNameOf.get(p.school_id) ?? "-") : "-"}
            </td>
            <td className="text-muted-foreground">
              {last ? formatDateTime(last) : "Chưa đăng nhập"}
            </td>
          </tr>
        ))}
        {recent.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-muted-foreground">
              Không có tài khoản nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
