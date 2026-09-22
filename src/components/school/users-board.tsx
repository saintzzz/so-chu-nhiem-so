"use client";

import { useTransition } from "react";
import { DataTable } from "@/components/data-table";
import { updateStaffAccount } from "@/app/(app)/school/actions";
import { compareVietnameseName } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/nav";
import type { Role } from "@/types";

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  campus_id: string | null;
  department_id: string | null;
  phone: string | null;
}

const EDITABLE_ROLES: Role[] = ["gvcn", "gvbm", "to_truong", "pht", "ke_toan", "bgh"];

const selCls =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring";

export function UsersBoard({
  users,
  campuses,
  departments,
}: {
  users: UserRow[];
  campuses: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const sorted = [...users].sort((a, b) =>
    compareVietnameseName(a.full_name, b.full_name),
  );

  function update(id: string, patch: Parameters<typeof updateStaffAccount>[1]) {
    start(async () => {
      await updateStaffAccount(id, patch);
    });
  }

  return (
    <DataTable
      columns={["Họ tên", "Email", "Vai trò", "Cơ sở", "Tổ chuyên môn", "Điện thoại"]}
      footer={<span>{users.length} tài khoản</span>}
    >
      {sorted.map((u) => (
        <tr key={u.id}>
          <td className="font-medium">{u.full_name}</td>
          <td className="text-muted-foreground">{u.email ?? "-"}</td>
          <td>
            <select
              defaultValue={u.role}
              disabled={pending}
              onChange={(e) => update(u.id, { role: e.target.value })}
              className={selCls}
            >
              {EDITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </td>
          <td>
            <select
              defaultValue={u.campus_id ?? ""}
              disabled={pending}
              onChange={(e) =>
                update(u.id, { campusId: e.target.value || null })
              }
              className={selCls}
            >
              <option value="">Toàn trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </td>
          <td>
            <select
              defaultValue={u.department_id ?? ""}
              disabled={pending}
              onChange={(e) =>
                update(u.id, { departmentId: e.target.value || null })
              }
              className={selCls}
            >
              <option value="">-</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </td>
          <td className="text-muted-foreground">{u.phone ?? "-"}</td>
        </tr>
      ))}
      {users.length === 0 && (
        <tr>
          <td colSpan={6} className="py-8 text-center text-muted-foreground">
            Chưa có tài khoản giáo viên nào.
          </td>
        </tr>
      )}
    </DataTable>
  );
}
