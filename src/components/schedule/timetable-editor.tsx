"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  saveTimetableEntry,
  deleteTimetableEntry,
} from "@/app/(app)/school/actions";
import { compareVietnameseName } from "@/lib/utils";

const WEEKDAYS = [2, 3, 4, 5, 6, 7] as const;
const PERIODS = [1, 2, 3, 4, 5] as const;

interface Entry {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  weekday: number;
  period: number;
  room: string | null;
}

const selCls =
  "h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring";

export function TimetableEditor({
  classId,
  entries,
  subjects,
  teachers,
}: {
  classId: string;
  entries: Entry[];
  subjects: { id: string; name: string }[];
  teachers: { id: string; full_name: string }[];
}) {
  const [editing, setEditing] = useState<{
    id?: string;
    weekday: number;
    period: number;
  } | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sortedTeachers = [...teachers].sort((a, b) =>
    compareVietnameseName(a.full_name, b.full_name),
  );
  const grid = new Map(entries.map((e) => [`${e.weekday}-${e.period}`, e]));
  const subName = new Map(subjects.map((s) => [s.id, s.name]));
  const teaName = new Map(teachers.map((t) => [t.id, t.full_name]));

  function openCell(weekday: number, period: number) {
    const ex = grid.get(`${weekday}-${period}`);
    setEditing({ id: ex?.id, weekday, period });
    setSubjectId(ex?.subject_id ?? "");
    setTeacherId(ex?.teacher_id ?? "");
    setRoom(ex?.room ?? "");
    setErr(null);
  }

  function save() {
    if (!editing) return;
    start(async () => {
      const r = await saveTimetableEntry({
        id: editing.id,
        classId,
        subjectId,
        teacherId,
        weekday: editing.weekday,
        period: editing.period,
        room,
      });
      if (r.error) setErr(r.error);
      else setEditing(null);
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await deleteTimetableEntry(id);
      if (r.error) setErr(r.error);
    });
  }

  return (
    <>
      <div className="relative overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tiết</th>
              {WEEKDAYS.map((d) => (
                <th key={d} className="px-3 py-2 text-left font-medium">
                  Thứ {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-muted-foreground">Tiết {p}</td>
                {WEEKDAYS.map((d) => {
                  const e = grid.get(`${d}-${p}`);
                  return (
                    <td key={d} className="px-2 py-1.5 align-top">
                      {e ? (
                        <div className="group rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5">
                          <p className="font-medium leading-tight">
                            {subName.get(e.subject_id) ?? "?"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.teacher_id ? (teaName.get(e.teacher_id) ?? "-") : "-"}
                            {e.room ? ` - ${e.room}` : ""}
                          </p>
                          <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              aria-label="Sửa"
                              onClick={() => openCell(d, p)}
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Xoá"
                              disabled={pending}
                              onClick={() => remove(e.id)}
                              className="rounded p-0.5 text-muted-foreground hover:bg-error-bg hover:text-error"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCell(d, p)}
                          className="flex w-full items-center justify-center rounded-lg border border-dashed border-border py-3 text-muted-foreground hover:border-primary hover:text-primary"
                          aria-label={`Thêm tiết Thứ ${d} Tiết ${p}`}
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <p className="mt-3 text-sm text-error">{err}</p>}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">
                Thứ {editing.weekday} - Tiết {editing.period}
              </h3>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Môn học</span>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={selCls}>
                  <option value="">Chọn môn</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Giáo viên</span>
                <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={selCls}>
                  <option value="">Chọn giáo viên</option>
                  {sortedTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Phòng học</span>
                <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="VD: P201" className={selCls} />
              </label>
              {err && <p className="text-sm text-error">{err}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  Huỷ
                </Button>
                <Button size="sm" onClick={save} disabled={pending || !subjectId}>
                  {editing.id ? "Cập nhật" : "Thêm tiết"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
