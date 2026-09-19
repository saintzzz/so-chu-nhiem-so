"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/academics/filter-select";
import { sortByVietnameseName } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "truong_ban", label: "Trưởng ban" },
  { value: "pho_ban", label: "Phó ban" },
  { value: "uy_vien", label: "Ủy viên" },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

interface ParentRow {
  id: string;
  full_name: string;
  phone: string | null;
}
interface MemberRow {
  id: string;
  parent_id: string;
  role: string;
  note: string | null;
}

export function CmhsBoard({
  classes,
  classId,
  parents,
  members,
}: {
  classes: { id: string; name: string }[];
  classId: string;
  parents: ParentRow[];
  members: MemberRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addId, setAddId] = useState("");
  const [addRole, setAddRole] = useState("uy_vien");

  const memberIds = new Set(members.map((m) => m.parent_id));
  const candidates = sortByVietnameseName(
    parents.filter((p) => !memberIds.has(p.id)),
    (p) => p.full_name,
  );
  const parentName = new Map(parents.map((p) => [p.id, p]));
  const truongBan = members.find((m) => m.role === "truong_ban");

  function run(fn: () => Promise<string | null>) {
    setError(null);
    startTransition(async () => {
      const err = await fn();
      if (err) setError(err);
      else router.refresh();
    });
  }

  function addMember() {
    if (!addId) return;
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("cmhs_members").insert({
        class_id: classId,
        parent_id: addId,
        role: addRole,
      });
      return err?.message ?? null;
    });
  }

  function removeMember(id: string) {
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("cmhs_members")
        .delete()
        .eq("id", id);
      return err?.message ?? null;
    });
  }

  function setRole(id: string, role: string) {
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("cmhs_members")
        .update({ role })
        .eq("id", id);
      return err?.message ?? null;
    });
  }

  return (
    <div className="space-y-4">
      {classes.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <FilterSelect
            name="class"
            label="Lớp"
            value={classId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            params={{ class: classId }}
          />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive p-3 text-sm text-error">
          {error}
        </div>
      )}

      {truongBan ? (
        <div className="rounded-xl border border-border bg-primary-bg p-3 text-sm text-primary">
          Trưởng ban:{" "}
          <strong>{parentName.get(truongBan.parent_id)?.full_name}</strong>
          {parentName.get(truongBan.parent_id)?.phone
            ? ` - ${parentName.get(truongBan.parent_id)?.phone}`
            : ""}
        </div>
      ) : (
        <div className="rounded-xl border border-warning bg-card p-3 text-sm text-warning">
          Lớp chưa có Trưởng ban đại diện CMHS.
        </div>
      )}

      <DataTable
        columns={["Phụ huynh", "Điện thoại", "Vai trò", "Thao tác"]}
        footer={<span>{members.length} thành viên</span>}
      >
        {sortByVietnameseName(members, (m) => parentName.get(m.parent_id)?.full_name ?? "").map((m) => {
          const p = parentName.get(m.parent_id);
          return (
            <tr key={m.id}>
              <td className="font-medium">{p?.full_name ?? "-"}</td>
              <td className="text-muted-foreground">{p?.phone ?? "-"}</td>
              <td>
                <select
                  value={m.role}
                  onChange={(e) => setRole(m.id, e.target.value)}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMember(m.id)}
                  disabled={pending}
                >
                  Xóa
                </Button>
              </td>
            </tr>
          );
        })}
        {members.length === 0 && (
          <tr>
            <td colSpan={4} className="text-center text-muted-foreground">
              Chưa có thành viên nào trong Ban đại diện.
            </td>
          </tr>
        )}
      </DataTable>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="h-9 min-w-56 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">- Chọn phụ huynh của lớp -</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
              {p.phone ? ` (${p.phone})` : ""}
            </option>
          ))}
        </select>
        <select
          value={addRole}
          onChange={(e) => setAddRole(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={addMember} disabled={pending || !addId}>
          Thêm vào ban
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {ROLE_LABEL.truong_ban}: đại diện chính thức của tập thể cha mẹ học
        sinh lớp, phối hợp với GVCN và nhà trường theo Điều 44 TT 32/2020.
      </p>
    </div>
  );
}
