import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/nav";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { Profile, Role, School } from "@/types";

const ROLE_TONES: Record<Role, "primary" | "success" | "warning" | "muted"> = {
  admin: "primary",
  so_gd: "primary",
  bgh: "warning",
  to_truong: "success",
  gvcn: "success",
  gvbm: "muted",
  phu_huynh: "muted",
  hoc_sinh: "muted",
};

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export default async function DeptUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await requireRoles(["so_gd", "admin"]);
  const { role } = await searchParams;
  const activeRole = ROLES.includes(role as Role) ? (role as Role) : undefined;

  const supabase = await createClient();

  const [profilesRes, schoolsRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("profiles")
        .select("id,full_name,email,role,school_id")
        .order("full_name");
      if (activeRole) q = q.eq("role", activeRole);
      return q;
    })(),
    supabase.from("schools").select("id,name"),
  ]);

  const profiles = (profilesRes.data ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email" | "role" | "school_id"
  >[];
  const schools = (schoolsRes.data ?? []) as Pick<School, "id" | "name">[];
  const schoolNameOf = new Map(schools.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Quản trị người dùng"
        description="Danh sách tài khoản trong hệ thống — lọc theo vai trò"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/dept/users"
          className={cn(
            "rounded-full border border-border px-3 py-1 text-sm",
            !activeRole
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          Tất cả
        </Link>
        {ROLES.map((r) => (
          <Link
            key={r}
            href={`/dept/users?role=${r}`}
            className={cn(
              "rounded-full border border-border px-3 py-1 text-sm",
              activeRole === r
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {ROLE_LABELS[r]}
          </Link>
        ))}
      </div>

      <DataTable
        columns={["Họ tên", "Email", "Vai trò", "Trường"]}
        footer={<span>{profiles.length} người dùng</span>}
      >
        {profiles.map((p) => (
          <tr key={p.id}>
            <td className="font-medium">{p.full_name}</td>
            <td className="text-muted-foreground">{p.email ?? "—"}</td>
            <td>
              <StatusBadge
                label={ROLE_LABELS[p.role]}
                tone={ROLE_TONES[p.role]}
              />
            </td>
            <td>{p.school_id ? (schoolNameOf.get(p.school_id) ?? "—") : "—"}</td>
          </tr>
        ))}
        {profiles.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-muted-foreground">
              Không có người dùng nào với vai trò này.
            </td>
          </tr>
        )}
      </DataTable>

      <p className="mt-4 rounded-xl border border-border bg-primary-bg p-4 text-sm text-primary">
        Việc tạo tài khoản mới hiện được thực hiện qua seed dữ liệu — liên hệ
        quản trị hệ thống để thêm người dùng.
      </p>
    </>
  );
}
