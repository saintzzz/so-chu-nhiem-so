"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/data-table";
import {
  createStaffAccount,
  updateStaffAccount,
} from "@/app/(app)/school/actions";
import { UserGrantRow } from "./feature-permissions";
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

type Grant = {
  id: string;
  feature: string;
  role: string | null;
  user_id: string | null;
  effect: "allow" | "deny";
};

const EDITABLE_ROLES: Role[] = ["gvcn", "gvbm", "to_truong", "pht", "ke_toan", "bgh"];

const selCls =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring";
const inputCls =
  "h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring";

export function UsersBoard({
  users,
  campuses,
  departments,
  grants,
}: {
  users: UserRow[];
  campuses: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  grants: Grant[];
}) {
  const [pending, start] = useTransition();
  const [openGrants, setOpenGrants] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "gvcn",
    campusId: "",
    departmentId: "",
  });
  const sorted = [...users].sort((a, b) =>
    compareVietnameseName(a.full_name, b.full_name),
  );

  function update(id: string, patch: Parameters<typeof updateStaffAccount>[1]) {
    start(async () => {
      await updateStaffAccount(id, patch);
    });
  }

  function create() {
    setMsg("");
    start(async () => {
      const r = await createStaffAccount({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: form.role,
        campusId: form.campusId || null,
        departmentId: form.departmentId || null,
      });
      if (r.error) setMsg(r.error);
      else {
        setMsg("Đã tạo tài khoản.");
        setForm({ email: "", password: "", fullName: "", role: "gvcn", campusId: "", departmentId: "" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "Đóng" : "+ Thêm giáo viên"}
        </button>
        {showCreate && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4">
            <label className="text-xs text-muted-foreground">
              Họ tên
              <input className={`${inputCls} mt-1 block`} value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">
              Email
              <input className={`${inputCls} mt-1 block`} type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">
              Mật khẩu
              <input className={`${inputCls} mt-1 block`} type="text" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 8 ký tự" />
            </label>
            <label className="text-xs text-muted-foreground">
              Vai trò
              <select className={`${selCls} mt-1 block h-9`} value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {EDITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Cơ sở
              <select className={`${selCls} mt-1 block h-9`} value={form.campusId}
                onChange={(e) => setForm({ ...form, campusId: e.target.value })}>
                <option value="">Toàn trường</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Tổ chuyên môn
              <select className={`${selCls} mt-1 block h-9`} value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">-</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={pending}
              onClick={create}
            >
              Tạo tài khoản
            </button>
            {msg && <p className="w-full text-sm text-muted-foreground">{msg}</p>}
          </div>
        )}
      </div>

      <DataTable
        columns={["Họ tên", "Email", "Vai trò", "Cơ sở", "Tổ chuyên môn", "Quyền"]}
        footer={<span>{users.length} tài khoản</span>}
      >
        {sorted.map((u) => (
          <>
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
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  defaultValue={u.campus_id ?? ""}
                  disabled={pending}
                  onChange={(e) => update(u.id, { campusId: e.target.value || null })}
                  className={selCls}
                >
                  <option value="">Toàn trường</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  defaultValue={u.department_id ?? ""}
                  disabled={pending}
                  onChange={(e) => update(u.id, { departmentId: e.target.value || null })}
                  className={selCls}
                >
                  <option value="">-</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                  onClick={() => setOpenGrants(openGrants === u.id ? null : u.id)}
                >
                  {openGrants === u.id ? "Ẩn" : "Quyền riêng"}
                </button>
              </td>
            </tr>
            {openGrants === u.id && (
              <tr key={`${u.id}-g`}>
                <td colSpan={6}>
                  <UserGrantRow userId={u.id} userName={u.full_name} grants={grants} />
                </td>
              </tr>
            )}
          </>
        ))}
        {users.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có tài khoản giáo viên nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
