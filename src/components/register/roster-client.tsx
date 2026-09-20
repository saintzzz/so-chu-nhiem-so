"use client";

import { useMemo, useState } from "react";
import { Shuffle, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { cn, sortByVietnameseName } from "@/lib/utils";
import { ROLE_LABELS_BCS, type ClassRoleRow } from "./types";
import type { Student, StudentGroup } from "@/types";

const BCS_OPTIONS = ["", ...Object.keys(ROLE_LABELS_BCS)];

export function RosterClient({
  students: initialStudents,
  groups,
  roles: initialRoles,
}: {
  classId: string;
  students: Student[];
  groups: StudentGroup[];
  roles: ClassRoleRow[];
}) {
  const supabase = createClient();
  const [students, setStudents] = useState<Student[]>(() => sortByVietnameseName(initialStudents, (s) => s.full_name));
  const [roles, setRoles] = useState<ClassRoleRow[]>(initialRoles);
  const [tab, setTab] = useState<"list" | "groups">("list");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const roleMap = useMemo(() => {
    const m = new Map<string, string>();
    roles.forEach((r) => m.set(r.student_id, r.role));
    return m;
  }, [roles]);

  const groupMap = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  async function shuffleGroups() {
    if (groups.length === 0 || students.length === 0) return;
    setBusy(true);
    setMessage(null);
    const updated = students.map((s, i) => ({
      ...s,
      group_id: groups[i % groups.length].id,
    }));
    const results = await Promise.all(
      updated.map((s) =>
        supabase.from("students").update({ group_id: s.group_id }).eq("id", s.id),
      ),
    );
    const failed = results.some((r) => r.error);
    if (!failed) {
      setStudents(updated);
      setMessage(`Đã chia đều ${updated.length} học sinh vào ${groups.length} tổ.`);
    } else {
      setMessage("Có lỗi khi chia tổ. Vui lòng thử lại.");
    }
    setBusy(false);
  }

  async function assignRole(studentId: string, role: string) {
    setBusy(true);
    if (role === "") {
      await supabase.from("class_roles").delete().eq("student_id", studentId);
      setRoles((rs) => rs.filter((r) => r.student_id !== studentId));
    } else {
      await supabase.from("class_roles").delete().eq("student_id", studentId);
      const { error } = await supabase
        .from("class_roles")
        .insert({ student_id: studentId, role });
      if (!error) {
        setRoles((rs) => [
          ...rs.filter((r) => r.student_id !== studentId),
          { student_id: studentId, role },
        ]);
      }
    }
    setBusy(false);
  }

  async function quickConduct(student: Student) {
    const content = window.prompt(
      `Ghi nhận rèn luyện cho ${student.full_name} (ví dụ: Phát biểu xây dựng bài)`,
    );
    if (!content) return;
    const pointsRaw = window.prompt("Số điểm (dương = khen, âm = vi phạm)", "1");
    if (pointsRaw === null) return;
    const points = Number(pointsRaw) || 0;
    const { error } = await supabase.from("conduct_records").insert({
      student_id: student.id,
      type: points >= 0 ? "khen_thuong" : "vi_pham",
      content,
      points,
      date: new Date().toISOString().slice(0, 10),
    });
    if (!error) {
      setMessage(`Đã ghi nhận rèn luyện cho ${student.full_name}.`);
      if (points !== 0) {
        const next = students.map((s) =>
          s.id === student.id
            ? { ...s, positive_points: s.positive_points + points }
            : s,
        );
        setStudents(next);
        await supabase
          .from("students")
          .update({
            positive_points: student.positive_points + points,
          })
          .eq("id", student.id);
      }
    } else {
      setMessage("Không thể ghi nhận. Vui lòng thử lại.");
    }
  }

  function renderRow(s: Student) {
    const role = roleMap.get(s.id) ?? "";
    return (
      <tr key={s.id}>
        <td className="font-medium">{s.full_name}</td>
        <td className="text-muted-foreground">{s.code}</td>
        <td>{s.group_id ? (groupMap.get(s.group_id) ?? "-") : "-"}</td>
        <td>
          <select
            value={role}
            disabled={busy}
            onChange={(e) => assignRole(s.id, e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            aria-label={`Chức danh BCS của ${s.full_name}`}
          >
            {BCS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === "" ? "-" : ROLE_LABELS_BCS[r]}
              </option>
            ))}
          </select>
        </td>
        <td>
          <StatusBadge
            label={`${s.positive_points} điểm`}
            tone={s.positive_points > 0 ? "success" : "muted"}
          />
        </td>
        <td>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => quickConduct(s)}
          >
            <ClipboardCheck /> Ghi nhận
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(
            [
              ["list", "Danh sách"],
              ["groups", "Theo Tổ"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={shuffleGroups} disabled={busy || groups.length === 0}>
          <Shuffle /> Chia đều {groups.length} Tổ
        </Button>
      </div>

      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}

      {tab === "list" ? (
        <DataTable
          columns={[
            "Họ tên",
            "Mã HS",
            "Tổ",
            "Chức danh BCS",
            "Điểm tích cực",
            "Rèn luyện",
          ]}
        >
          {students.map(renderRow)}
        </DataTable>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const members = students.filter((s) => s.group_id === g.id);
            return (
              <div
                key={g.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">{g.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {members.length} HS
                  </span>
                </div>
                <ul className="space-y-1 text-sm">
                  {members.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>{s.full_name}</span>
                      {roleMap.get(s.id) && (
                        <span className="text-xs text-muted-foreground">
                          {ROLE_LABELS_BCS[roleMap.get(s.id) ?? ""] ??
                            roleMap.get(s.id)}
                        </span>
                      )}
                    </li>
                  ))}
                  {members.length === 0 && (
                    <li className="text-muted-foreground">Chưa có học sinh</li>
                  )}
                </ul>
              </div>
            );
          })}
          {students.filter((s) => !s.group_id).length > 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Chưa xếp tổ</h3>
              <ul className="space-y-1 text-sm">
                {students
                  .filter((s) => !s.group_id)
                  .map((s) => (
                    <li key={s.id}>{s.full_name}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
