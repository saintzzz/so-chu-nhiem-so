"use client";

import { useMemo, useState } from "react";
import { Shuffle, ClipboardCheck, PlusCircle, UserPlus } from "lucide-react";
import { StudentRecordEditor } from "@/components/records/student-record-editor";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { cn, sortByVietnameseName } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { ROLE_LABELS_BCS, type ClassRoleRow } from "./types";
import type { Student, StudentGroup } from "@/types";

const BCS_OPTIONS = ["", ...Object.keys(ROLE_LABELS_BCS)];

type ParentRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
};

export function RosterClient({
  classId,
  students: initialStudents,
  groups: initialGroups,
  roles: initialRoles,
  parents: initialParents,
  parentLinks: initialLinks,
}: {
  classId: string;
  students: Student[];
  groups: StudentGroup[];
  roles: ClassRoleRow[];
  parents: ParentRow[];
  parentLinks: { student_id: string; parent_id: string }[];
}) {
  const supabase = createClient();
  const [students, setStudents] = useState<Student[]>(() => sortByVietnameseName(initialStudents, (s) => s.full_name));
  const [groups, setGroups] = useState<StudentGroup[]>(initialGroups);
  const [roles, setRoles] = useState<ClassRoleRow[]>(initialRoles);
  const [parents, setParents] = useState<ParentRow[]>(initialParents);
  const [links, setLinks] = useState(initialLinks);
  const [linkStudent, setLinkStudent] = useState("");
  const [linkParent, setLinkParent] = useState("");
  const [newParentName, setNewParentName] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentRel, setNewParentRel] = useState("cha");
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
      logAudit(supabase, {
        action: "Chia đều tổ",
        entity: "students",
        entityId: classId,
        payload: { groups: groups.length, students: updated.length },
      });
    } else {
      setMessage("Có lỗi khi chia tổ. Vui lòng thử lại.");
    }
    setBusy(false);
  }

  async function addGroup() {
    const name = window.prompt("Tên tổ mới (ví dụ: Tổ 5)");
    if (!name?.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("student_groups")
      .insert({ class_id: classId, name: name.trim() })
      .select()
      .single();
    if (!error && data) {
      setGroups((gs) => [...gs, data as StudentGroup]);
      setMessage(`Đã tạo ${name.trim()}.`);
      logAudit(supabase, {
        action: "Tạo tổ học sinh",
        entity: "student_groups",
        entityId: data.id,
        payload: { class_id: classId, name: name.trim() },
      });
    } else {
      setMessage("Không thể tạo tổ. Vui lòng thử lại.");
    }
    setBusy(false);
  }

  async function assignGroup(studentId: string, groupId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("students")
      .update({ group_id: groupId || null })
      .eq("id", studentId);
    if (!error) {
      setStudents((ss) =>
        ss.map((s) => (s.id === studentId ? { ...s, group_id: groupId || null } : s)),
      );
      logAudit(supabase, {
        action: "Xếp học sinh vào tổ",
        entity: "students",
        entityId: studentId,
        payload: { group_id: groupId || null },
      });
    }
    setBusy(false);
  }

  async function linkParentToStudent() {
    if (!linkStudent) return;
    let parentId = linkParent;
    setBusy(true);
    setMessage(null);
    if (!parentId) {
      if (!newParentName.trim()) {
        setMessage("Chọn phụ huynh có sẵn hoặc nhập tên phụ huynh mới.");
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.rpc("create_parent_for_student", {
        p_full_name: newParentName.trim(),
        p_phone: newParentPhone.trim(),
        p_email: newParentEmail.trim(),
        p_relationship: newParentRel,
        p_student_id: linkStudent,
      });
      if (error || !data) {
        setMessage("Không thể tạo phụ huynh. Vui lòng thử lại.");
        setBusy(false);
        return;
      }
      parentId = data as string;
      setParents((ps) => [
        ...ps,
        {
          id: parentId,
          full_name: newParentName.trim(),
          phone: newParentPhone.trim() || null,
          email: newParentEmail.trim() || null,
          relationship: newParentRel,
        },
      ]);
      setLinks((ls) => [...ls, { student_id: linkStudent, parent_id: parentId }]);
      setLinkStudent("");
      setLinkParent("");
      setNewParentName("");
      setNewParentPhone("");
      setNewParentEmail("");
      setMessage("Đã tạo phụ huynh và liên kết với học sinh.");
      logAudit(supabase, {
        action: "Tạo + liên kết phụ huynh",
        entity: "parent_students",
        entityId: linkStudent,
        payload: { parent_id: parentId },
      });
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("parent_students")
      .insert({ parent_id: parentId, student_id: linkStudent });
    if (!error) {
      setLinks((ls) => [...ls, { student_id: linkStudent, parent_id: parentId }]);
      setLinkStudent("");
      setLinkParent("");
      setNewParentName("");
      setNewParentPhone("");
      setNewParentEmail("");
      setMessage("Đã liên kết phụ huynh với học sinh.");
      logAudit(supabase, {
        action: "Liên kết phụ huynh - học sinh",
        entity: "parent_students",
        entityId: linkStudent,
        payload: { parent_id: parentId },
      });
    } else {
      setMessage("Không thể liên kết. Có thể liên kết đã tồn tại.");
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
        logAudit(supabase, {
          action: "Phân chức danh BCS",
          entity: "class_roles",
          entityId: studentId,
          payload: { role },
        });
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
      if (points > 0) {
        // Trigger trg_sync_positive_points dong bo students.positive_points;
        // cap nhat local state de UI phan anh ngay.
        setStudents((ss) =>
          ss.map((s) =>
            s.id === student.id
              ? { ...s, positive_points: s.positive_points + points }
              : s,
          ),
        );
      }
      logAudit(supabase, {
        action: "Ghi nhận rèn luyện",
        entity: "conduct_records",
        entityId: student.id,
        payload: { content, points },
      });
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
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => quickConduct(s)}
            >
              <ClipboardCheck /> Ghi nhận
            </Button>
            <StudentRecordEditor student={s} />
          </div>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={addGroup} disabled={busy}>
            <PlusCircle /> Thêm tổ
          </Button>
          <Button onClick={shuffleGroups} disabled={busy || groups.length === 0}>
            <Shuffle /> Chia đều {groups.length} Tổ
          </Button>
        </div>
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
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span>{s.full_name}</span>
                      <select
                        value=""
                        disabled={busy || groups.length === 0}
                        onChange={(e) => assignGroup(s.id, e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        aria-label={`Xếp tổ cho ${s.full_name}`}
                      >
                        <option value="">Xếp vào tổ...</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <UserPlus className="h-4 w-4" /> Liên kết phụ huynh - học sinh
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Học sinh
            </label>
            <select
              value={linkStudent}
              onChange={(e) => setLinkStudent(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Chọn học sinh...</option>
              {students.map((s) => {
                const n = links.filter((l) => l.student_id === s.id).length;
                return (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({n} PH)
                  </option>
                );
              })}
            </select>
            <label className="text-xs font-medium text-muted-foreground">
              Phụ huynh có sẵn
            </label>
            <select
              value={linkParent}
              onChange={(e) => setLinkParent(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Tạo phụ huynh mới...</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.phone ? ` - ${p.phone}` : ""}
                </option>
              ))}
            </select>
          </div>
          {!linkParent && (
            <div className="space-y-2">
              <input
                value={newParentName}
                onChange={(e) => setNewParentName(e.target.value)}
                placeholder="Họ tên phụ huynh *"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newParentPhone}
                  onChange={(e) => setNewParentPhone(e.target.value)}
                  placeholder="Số điện thoại"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <select
                  value={newParentRel}
                  onChange={(e) => setNewParentRel(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="cha">Cha</option>
                  <option value="me">Mẹ</option>
                  <option value="nguoi_giam_ho">Người giám hộ</option>
                </select>
              </div>
              <input
                value={newParentEmail}
                onChange={(e) => setNewParentEmail(e.target.value)}
                placeholder="Email (nhận thông báo)"
                type="email"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={linkParentToStudent}
            disabled={busy || !linkStudent}
          >
            <UserPlus /> Liên kết
          </Button>
        </div>
      </div>
    </div>
  );
}
