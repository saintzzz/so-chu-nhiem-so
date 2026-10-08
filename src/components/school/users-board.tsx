"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/data-table";
import {
  createStaffAccount,
  updateStaffProfile,
  setTeacherSubjects,
  updateDepartmentSubjects,
} from "@/app/(app)/school/actions";
import { UserGrantRow } from "./feature-permissions";
import { compareVietnameseName } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/nav";
import { CONCURRENT_ELIGIBLE } from "@/lib/roles";
import type { Role } from "@/types";

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  campus_id: string | null;
  department_id: string | null;
  phone: string | null;
  staff_code?: string | null;
  employment_type?: string | null;
  qualification?: string | null;
  concurrent_roles?: string[];
}

interface Dept {
  id: string;
  name: string;
  subject_ids?: string[];
}

type Grant = {
  id: string;
  feature: string;
  role: string | null;
  user_id: string | null;
  effect: "allow" | "deny";
};

const EDITABLE_ROLES: Role[] = ["gvcn", "gvbm", "to_truong", "pht", "ke_toan", "bgh"];

const EMPLOYMENT_LABEL: Record<string, string> = {
  bien_che: "Biên chế",
  hop_dong: "Hợp đồng",
  thinh_giang: "Thỉnh giảng",
};

const selCls =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring";
const inputCls =
  "h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring";

export function UsersBoard({
  users,
  campuses,
  departments,
  subjects,
  teacherSubjects,
  grants,
}: {
  users: UserRow[];
  campuses: { id: string; name: string }[];
  departments: Dept[];
  subjects: { id: string; name: string }[];
  teacherSubjects: Record<string, string[]>;
  grants: Grant[];
}) {
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "gvcn",
    campusId: "",
    departmentId: "",
    staffCode: "",
    qualification: "",
    employmentType: "",
  });
  // draft tung user trong panel chi tiet
  const [detail, setDetail] = useState<
    Record<
      string,
      { staffCode: string; employmentType: string; qualification: string; concurrentRoles: string[]; subjects: string[] }
    >
  >({});

  const sorted = [...users].sort((a, b) =>
    compareVietnameseName(a.full_name, b.full_name),
  );
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const deptById = new Map(departments.map((d) => [d.id, d]));

  function draftOf(u: UserRow) {
    return (
      detail[u.id] ?? {
        staffCode: u.staff_code ?? "",
        employmentType: u.employment_type ?? "",
        qualification: u.qualification ?? "",
        concurrentRoles: u.concurrent_roles ?? [],
        subjects: teacherSubjects[u.id] ?? [],
      }
    );
  }
  const setDraft = (id: string, patch: Partial<(typeof detail)[string]>) =>
    setDetail((p) => ({ ...p, [id]: { ...draftOf(users.find((x) => x.id === id)!), ...patch } }));

  function update(id: string, patch: Parameters<typeof updateStaffProfile>[1]) {
    start(async () => {
      const r = await updateStaffProfile(id, patch);
      if (r?.error) setMsg(r.error);
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
        staffCode: form.staffCode || undefined,
        employmentType: form.employmentType || undefined,
        qualification: form.qualification || undefined,
      });
      if (r.error) return setMsg(r.error);
      setMsg("Đã tạo tài khoản.");
      setForm({ email: "", password: "", fullName: "", role: "gvcn", campusId: "", departmentId: "", staffCode: "", qualification: "", employmentType: "" });
    });
  }

  function toggleDeptSubject(dept: Dept, sid: string) {
    const cur = dept.subject_ids ?? [];
    const next = cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid];
    dept.subject_ids = next; // optimistic
    start(async () => {
      const r = await updateDepartmentSubjects(dept.id, next);
      if (r?.error) setMsg(r.error);
    });
  }

  const roleCount = new Map<string, number>();
  const empCount = new Map<string, number>();
  for (const u of users) {
    roleCount.set(u.role, (roleCount.get(u.role) ?? 0) + 1);
    empCount.set(u.employment_type ?? "chua_khai_bao", (empCount.get(u.employment_type ?? "chua_khai_bao") ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      {/* Thong ke nhan su nhanh (CR-033) */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(ROLE_LABELS)
          .filter(([r]) => roleCount.get(r))
          .map(([r, l]) => (
            <span key={r} className="rounded-full border bg-card px-2.5 py-1">
              {l}: <b>{roleCount.get(r)}</b>
            </span>
          ))}
        {[...empCount.entries()].map(([k, n]) => (
          <span key={k} className="rounded-full border bg-muted/50 px-2.5 py-1 text-muted-foreground">
            {k === "chua_khai_bao" ? "Chưa khai báo" : EMPLOYMENT_LABEL[k] ?? k}: <b>{n}</b>
          </span>
        ))}
      </div>
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
            <label className="text-xs text-muted-foreground">
              Mã cán bộ
              <input className={`${inputCls} mt-1 block w-28`} value={form.staffCode}
                onChange={(e) => setForm({ ...form, staffCode: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">
              Loại hợp đồng
              <select className={`${selCls} mt-1 block h-9`} value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                <option value="">-</option>
                {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Trình độ/chuyên môn
              <input className={`${inputCls} mt-1 block w-48`} value={form.qualification}
                placeholder="VD: ThS Giáo dục tiểu học"
                onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
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

      {/* To chuyen mon - mon hoc (CR-032): nen tang kiem tra hop le + review theo mon */}
      {departments.length > 0 && subjects.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Tổ chuyên môn - môn học</h3>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
            Gán môn cho tổ - cảnh báo khi GV dạy môn khác tổ, và tổ trưởng lọc
            câu hỏi/học liệu theo môn của tổ.
          </p>
          {departments.map((d) => (
            <div key={d.id} className="mb-3 last:mb-0">
              <p className="mb-1.5 text-xs font-medium">{d.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => {
                  const on = (d.subject_ids ?? []).includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={pending}
                      onClick={() => toggleDeptSubject(d, s.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        columns={["Họ tên", "Email", "Vai trò", "Môn phụ trách", "Tổ", "Chi tiết"]}
        footer={<span>{users.length} tài khoản</span>}
      >
        {sorted.map((u) => {
          const mySubjects = teacherSubjects[u.id] ?? [];
          const dept = u.department_id ? deptById.get(u.department_id) : undefined;
          const mismatch =
            dept?.subject_ids?.length &&
            mySubjects.some((sid) => !dept.subject_ids!.includes(sid));
          const d = draftOf(u);
          return (
            <>
              <tr key={u.id}>
                <td className="font-medium">
                  {u.full_name}
                  {u.staff_code && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({u.staff_code})
                    </span>
                  )}
                </td>
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
                  {mySubjects.length ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {mySubjects.map((sid) => (
                        <span
                          key={sid}
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            dept?.subject_ids?.length && !dept.subject_ids.includes(sid)
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                              : "text-muted-foreground"
                          }`}
                          title={
                            dept?.subject_ids?.length && !dept.subject_ids.includes(sid)
                              ? `Môn ngoài danh mục của ${dept.name}`
                              : undefined
                          }
                        >
                          {subjectName.get(sid) ?? "?"}
                        </span>
                      ))}
                      {mismatch && (
                        <span className="text-xs text-amber-400" title="GV dạy môn ngoài tổ">
                          !khác tổ
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">chưa gán</span>
                  )}
                </td>
                <td>
                  <select
                    defaultValue={u.department_id ?? ""}
                    disabled={pending}
                    onChange={(e) => update(u.id, { departmentId: e.target.value || null })}
                    className={selCls}
                  >
                    <option value="">-</option>
                    {departments.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => setOpenId(openId === u.id ? null : u.id)}
                  >
                    {openId === u.id ? "Ẩn" : "Chi tiết"}
                  </button>
                </td>
              </tr>
              {openId === u.id && (
                <tr key={`${u.id}-d`}>
                  <td colSpan={6}>
                    <div className="space-y-4 rounded-lg bg-muted/30 p-4">
                      {/* Ho so */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Hồ sơ
                        </p>
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="text-xs text-muted-foreground">
                            Mã cán bộ
                            <input className={`${inputCls} mt-1 block w-32`} value={d.staffCode}
                              onChange={(e) => setDraft(u.id, { staffCode: e.target.value })} />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            Loại hợp đồng
                            <select className={`${selCls} mt-1 block h-9`} value={d.employmentType}
                              onChange={(e) => setDraft(u.id, { employmentType: e.target.value })}>
                              <option value="">-</option>
                              {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs text-muted-foreground">
                            Trình độ/chuyên môn
                            <input className={`${inputCls} mt-1 block w-52`} value={d.qualification}
                              placeholder="VD: ThS Giáo dục tiểu học"
                              onChange={(e) => setDraft(u.id, { qualification: e.target.value })} />
                          </label>
                          <div className="text-xs text-muted-foreground">
                            <p className="mb-1">Vai trò kiêm nhiệm (multi-role)</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {CONCURRENT_ELIGIBLE.filter((r) => r !== u.role).map((r) => {
                                const on = d.concurrentRoles.includes(r);
                                return (
                                  <button
                                    key={r}
                                    type="button"
                                    className={`rounded-full border px-2.5 py-1 text-xs ${
                                      on ? "border-primary bg-primary-bg text-primary" : "hover:bg-muted"
                                    }`}
                                    onClick={() =>
                                      setDraft(u.id, {
                                        concurrentRoles: on
                                          ? d.concurrentRoles.filter((x) => x !== r)
                                          : [...d.concurrentRoles, r],
                                      })
                                    }
                                  >
                                    {ROLE_LABELS[r]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <button
                            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                            disabled={pending}
                            onClick={() =>
                              update(u.id, {
                                staffCode: d.staffCode || null,
                                employmentType: d.employmentType || null,
                                qualification: d.qualification || null,
                                concurrentRoles: d.concurrentRoles,
                              })
                            }
                          >
                            Lưu hồ sơ
                          </button>
                        </div>
                      </div>

                      {/* Mon phu trach */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Môn phụ trách
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {subjects.map((s) => {
                            const on = d.subjects.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() =>
                                  setDraft(u.id, {
                                    subjects: on
                                      ? d.subjects.filter((x) => x !== s.id)
                                      : [...d.subjects, s.id],
                                  })
                                }
                                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                                  on
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                          <button
                            className="ml-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const r = await setTeacherSubjects(u.id, d.subjects);
                                if (r?.error) setMsg(r.error);
                                else setMsg(`Đã lưu môn phụ trách của ${u.full_name}.`);
                              })
                            }
                          >
                            Lưu môn
                          </button>
                        </div>
                      </div>

                      <UserGrantRow userId={u.id} userName={u.full_name} grants={grants} />
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
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
