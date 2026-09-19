import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, Pagination } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { AuditLog } from "@/components/register/types";
import type { Profile } from "@/types";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireProfile();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const { data, count } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const logs = (data ?? []) as AuditLog[];

  const actorIds = [
    ...new Set(logs.map((l) => l.actor_id).filter(Boolean)),
  ] as string[];
  const { data: actorData } =
    actorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", actorIds)
      : { data: [] };
  const actorNames = new Map(
    ((actorData ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (
    <>
      <PageHeader
        section="Phân hệ IX - Sổ chủ nhiệm"
        title="Nhật ký thao tác"
        description="Mọi thao tác trên sổ chủ nhiệm đều được ghi lại (chỉ xem)."
      />
      <DataTable
        columns={[
          "Thời điểm",
          "Người thao tác",
          "Hành động",
          "Đối tượng",
          "Chi tiết",
        ]}
        footer={<Pagination total={count ?? logs.length} page={page} pageSize={PAGE_SIZE} />}
      >
        {logs.map((l) => (
          <tr key={l.id}>
            <td className="whitespace-nowrap text-muted-foreground">
              {new Date(l.created_at).toLocaleString("vi-VN")}
            </td>
            <td className="font-medium">
              {l.actor_id ? (actorNames.get(l.actor_id) ?? "-") : "Hệ thống"}
            </td>
            <td>
              <StatusBadge label={l.action} tone="primary" />
            </td>
            <td className="text-muted-foreground">
              {l.entity}
              {l.entity_id ? ` · ${l.entity_id.slice(0, 8)}…` : ""}
            </td>
            <td className="max-w-xs truncate text-xs text-muted-foreground">
              {l.payload ? JSON.stringify(l.payload) : "-"}
            </td>
          </tr>
        ))}
        {logs.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Chưa có nhật ký thao tác nào.
            </td>
          </tr>
        )}
      </DataTable>
    </>
  );
}
