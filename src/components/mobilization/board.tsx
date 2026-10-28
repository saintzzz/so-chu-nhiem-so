"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAssignment,
  approveAssignment,
  endAssignment,
  cancelAssignment,
} from "@/app/(app)/schedule/mobilization/actions";
import { StatusBadge } from "@/components/status-badge";

type Cls = { id: string; name: string; grade: number };
type Entry = {
  id: string; weekday: number; period: number; room: string | null;
  teacher_id: string;
  subjects: { name: string } | null;
  profiles: { full_name: string } | null;
};
type Teacher = { id: string; full_name: string };
type Asn = {
  id: string; timetable_entry_id: string; teacher_id: string;
  effective_from: string; effective_to: string | null;
  status: string; reason: string;
};

const WD = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const STATUS = {
  pending: { label: "Chờ duyệt", tone: "warning" as const },
  active: { label: "Đang hiệu lực", tone: "success" as const },
  ended: { label: "Đã kết thúc", tone: "muted" as const },
  cancelled: { label: "Đã hủy", tone: "muted" as const },
};

export default function MobilizationBoard({
  classes,
  currentClassId,
  entries,
  teachers,
  assignments,
}: {
  classes: Cls[];
  currentClassId: string | null;
  entries: Entry[];
  teachers: Teacher[];
  assignments: Asn[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<{ entryId: string; teacherId: string; from: string; to: string; reason: string } | null>(null);

  const teacherName = (id: string) => teachers.find((t) => t.id === id)?.full_name ?? "-";
  const entryOf = (id: string) => entries.find((e) => e.id === id);
  const act = (fn: () => Promise<string | null>, okMsg: string) => {
    setErr(null); setOk(null);
    start(async () => {
      const res = await fn();
      if (res) setErr(res); else setOk(okMsg);
      if (!res) setForm(null);
    });
  };

  const visibleAsn = assignments.filter((a) => entryOf(a.timetable_entry_id) || a.status === "pending" || a.status === "active");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Điều động giáo viên</h1>
        <p className="text-sm text-muted-foreground">
          Phân công lại tiết TKB theo khoảng thời gian - giữ nguyên phân công
          gốc, có duyệt và đảo ngược được.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button key={c.id} type="button"
            onClick={() => router.push(`/schedule/mobilization?class=${c.id}`)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${c.id === currentClassId ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
            {c.name}
          </button>
        ))}
        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có lớp nào.</p>
        )}
      </div>

      {(err || ok) && (
        <p className={`text-sm ${err ? "text-destructive" : "text-green-600"}`}>{err ?? ok}</p>
      )}

      {form && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">
            Điều động tiết: {(() => { const e = entryOf(form.entryId); return e ? `${WD[e.weekday]} tiết ${e.period} - ${e.subjects?.name ?? ""}` : ""; })()}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Giáo viên điều động</span>
              <select value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">- Chọn giáo viên -</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Từ ngày</span>
              <input type="date" value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Đến ngày (để trống = không thời hạn)</span>
              <input type="date" value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-muted-foreground">Lý do điều động</span>
              <input value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="VD: GV Nguyễn A điều động đến thay cô B nghỉ thai sản"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={pending || !form.teacherId || !form.from || !form.reason.trim()}
              onClick={() => act(() => createAssignment({
                entryId: form.entryId, teacherId: form.teacherId,
                from: form.from, to: form.to || null, reason: form.reason,
              }), "Đã tạo phân công điều động - chờ duyệt.")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              Tạo phân công
            </button>
            <button type="button" onClick={() => setForm(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm">Hủy</button>
          </div>
        </div>
      )}

      <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">Tiết</th>
              <th className="p-3">Môn</th>
              <th className="p-3">GV phân công gốc</th>
              <th className="p-3">Điều động hiện tại</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                Lớp chưa có thời khóa biểu.
              </td></tr>
            )}
            {entries.map((e) => {
              const asn = assignments.find(
                (a) => a.timetable_entry_id === e.id && (a.status === "pending" || a.status === "active"),
              );
              return (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3">{WD[e.weekday]} - Tiết {e.period}</td>
                  <td className="p-3">{e.subjects?.name ?? "-"}</td>
                  <td className="p-3">{e.profiles?.full_name ?? "-"}</td>
                  <td className="p-3">
                    {asn ? (
                      <div className="flex items-center gap-2">
                        <span>{teacherName(asn.teacher_id)}</span>
                        <StatusBadge label={STATUS[asn.status as keyof typeof STATUS].label}
                          tone={STATUS[asn.status as keyof typeof STATUS].tone} />
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="p-3">
                    {!asn && (
                      <button type="button" disabled={pending}
                        onClick={() => setForm({ entryId: e.id, teacherId: "", from: "", to: "", reason: "" })}
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
                        Điều động
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleAsn.length > 0 && (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Tiết / môn</th>
                <th className="p-3">GV điều động</th>
                <th className="p-3">Hiệu lực</th>
                <th className="p-3">Lý do</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {visibleAsn.map((a) => {
                const e = entryOf(a.timetable_entry_id);
                const st = STATUS[a.status as keyof typeof STATUS] ?? STATUS.pending;
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="p-3">
                      {e ? `${WD[e.weekday]} t${e.period} - ${e.subjects?.name ?? ""}` : "Tiết khác lớp"}
                    </td>
                    <td className="p-3">{teacherName(a.teacher_id)}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {a.effective_from}{a.effective_to ? ` - ${a.effective_to}` : " - không thời hạn"}
                    </td>
                    <td className="max-w-48 truncate p-3 text-xs" title={a.reason}>{a.reason}</td>
                    <td className="p-3">
                      <StatusBadge label={st.label} tone={st.tone} />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {a.status === "pending" && (
                          <>
                            <button type="button" disabled={pending}
                              onClick={() => act(() => approveAssignment(a.id), "Đã duyệt - có hiệu lực.")}
                              className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">Phê duyệt</button>
                            <button type="button" disabled={pending}
                              onClick={() => act(() => cancelAssignment(a.id), "Đã hủy phân công.")}
                              className="rounded-lg border border-border px-2 py-1 text-xs text-destructive hover:bg-accent">Hủy</button>
                          </>
                        )}
                        {a.status === "active" && (
                          <button type="button" disabled={pending}
                            onClick={() => act(() => endAssignment(a.id), "Đã kết thúc điều động.")}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">Kết thúc</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
