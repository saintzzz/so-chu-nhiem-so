"use client";

import { useMemo, useState, useTransition } from "react";
import type { CurriculumStandard, Subject } from "@/types/tvc";
import {
  saveStandard,
  deleteStandard,
  toggleStandardStatus,
} from "@/lib/tvc/actions";
import { Plus, Trash2, PenLine, Loader2, Ban, RotateCcw, X } from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
const input =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none";

interface StdForm {
  id?: string;
  code: string;
  subject_code: string;
  grade: number;
  strand: string;
  lesson_ref: string;
  description: string;
  competencies: string;
}

const EMPTY: StdForm = {
  code: "",
  subject_code: "toan",
  grade: 1,
  strand: "",
  lesson_ref: "",
  description: "",
  competencies: "",
};

export function StandardsManager({
  standards,
  subjects,
  canManage,
}: {
  standards: CurriculumStandard[];
  subjects: Subject[];
  canManage: boolean;
}) {
  const [fSubject, setFSubject] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fQ, setFQ] = useState("");
  const [form, setForm] = useState<StdForm | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(
    () =>
      standards.filter(
        (s) =>
          (!fSubject || s.subject_code === fSubject) &&
          (!fGrade || s.grade === Number(fGrade)) &&
          (!fQ ||
            s.code.toLowerCase().includes(fQ.toLowerCase()) ||
            s.description.toLowerCase().includes(fQ.toLowerCase())),
      ),
    [standards, fSubject, fGrade, fQ],
  );
  const schoolRows = filtered.filter((s) => s.school_id);
  const systemRows = filtered.filter((s) => !s.school_id);

  const subName = (code: string) =>
    subjects.find((s) => s.code === code)?.name ?? code;

  const act = (fn: () => Promise<{ error?: string; ok?: boolean }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) setError(r.error);
      else setForm(null);
    });

  const submit = () =>
    act(async () =>
      saveStandard({
        id: form?.id,
        code: form!.code,
        subject_code: form!.subject_code,
        grade: form!.grade,
        strand: form!.strand,
        lesson_ref: form!.lesson_ref,
        description: form!.description,
        competencies: form!.competencies
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      }),
    );

  const row = (s: CurriculumStandard, school: boolean) => (
    <tr key={s.id} className="hover:bg-muted/40">
      <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
      <td className="hidden px-4 py-2.5 sm:table-cell">{subName(s.subject_code)}</td>
      <td className="px-4 py-2.5">{s.grade}</td>
      <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">{s.strand}</td>
      <td className="px-4 py-2.5">{s.description}</td>
      <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
        {(s.competencies ?? []).join(", ") || "-"}
      </td>
      <td className="px-4 py-2.5">
        {s.status === "active" ? (
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300">Dùng</span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Tắt</span>
        )}
      </td>
      {school && canManage && (
        <td className="px-4 py-2.5">
          <div className="flex gap-1">
            <button
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              title="Sửa"
              onClick={() =>
                setForm({
                  id: s.id,
                  code: s.code,
                  subject_code: s.subject_code,
                  grade: s.grade,
                  strand: s.strand,
                  lesson_ref: s.lesson_ref ?? "",
                  description: s.description,
                  competencies: (s.competencies ?? []).join(", "),
                })
              }
            >
              <PenLine className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              title={s.status === "active" ? "Tắt" : "Bật lại"}
              onClick={() =>
                act(() => toggleStandardStatus(s.id, s.status !== "active"))
              }
            >
              {s.status === "active" ? (
                <Ban className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </button>
            <button
              className="rounded-md p-1.5 text-destructive hover:bg-muted"
              title="Xoá"
              onClick={() => {
                if (confirm(`Xoá YCCĐ ${s.code} của trường?`))
                  act(() => deleteStandard(s.id));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={input} style={{ width: "auto" }} value={fSubject} onChange={(e) => setFSubject(e.target.value)}>
          <option value="">Mọi môn</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
        <select className={input} style={{ width: "auto" }} value={fGrade} onChange={(e) => setFGrade(e.target.value)}>
          <option value="">Mọi khối</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
            <option key={g} value={g}>Lớp {g}</option>
          ))}
        </select>
        <input
          className={input}
          style={{ width: 220 }}
          placeholder="Tìm mã / mô tả..."
          value={fQ}
          onChange={(e) => setFQ(e.target.value)}
        />
        {canManage && (
          <button className={btnPrimary} onClick={() => setForm(EMPTY)}>
            <Plus className="h-4 w-4" /> Thêm YCCĐ của trường
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {form && (
        <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">
              {form.id ? `Sửa ${form.code}` : "Thêm YCCĐ của trường"}
            </h3>
            <button className="rounded-md p-1 hover:bg-muted" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Mã YCCĐ</label>
              <input
                className={input}
                placeholder="vd: TOAN3.5.1"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Môn</label>
              <select
                className={input}
                value={form.subject_code}
                onChange={(e) => setForm({ ...form, subject_code: e.target.value })}
              >
                {subjects.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Khối</label>
              <select
                className={input}
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>Lớp {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Chủ đề / mạch</label>
              <input
                className={input}
                placeholder="vd: Số và phép tính"
                value={form.strand}
                onChange={(e) => setForm({ ...form, strand: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Bài / phạm vi</label>
              <input
                className={input}
                placeholder="vd: Tuần 10-12, Chủ đề 3 (tuỳ trường)"
                value={form.lesson_ref}
                onChange={(e) => setForm({ ...form, lesson_ref: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Năng lực (cách nhau bởi dấu phẩy)</label>
              <input
                className={input}
                placeholder="vd: Tư duy và lập luận, Giải quyết vấn đề"
                value={form.competencies}
                onChange={(e) => setForm({ ...form, competencies: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-xs text-muted-foreground">Mô tả yêu cầu cần đạt</label>
              <AutoGrowTextarea
                className={input}
                rows={2}
                placeholder="HS thực hiện được ..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className={btnPrimary}
              disabled={pending || !form.code.trim() || form.description.trim().length < 10}
              onClick={submit}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {form.id ? "Lưu thay đổi" : "Thêm YCCĐ"}
            </button>
            <button className={btn} onClick={() => setForm(null)}>Huỷ</button>
          </div>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold text-muted-foreground">
        YCCĐ của trường ({schoolRows.length})
      </h3>
      <div className="mt-2 overflow-x-auto relative rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Mã</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Môn</th>
              <th className="px-4 py-2.5 font-medium">Khối</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Mạch</th>
              <th className="px-4 py-2.5 font-medium">Mô tả</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Năng lực</th>
              <th className="px-4 py-2.5 font-medium">Trạng thái</th>
              {canManage && <th className="px-4 py-2.5 font-medium" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {schoolRows.map((s) => row(s, true))}
            {!schoolRows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Trường chưa có YCCĐ riêng - đang dùng bộ khung hệ thống.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-muted-foreground">
        YCCĐ hệ thống ({systemRows.length}) - khung tham khảo theo CTGDPT 2018
      </h3>
      <div className="mt-2 overflow-x-auto relative rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Mã</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Môn</th>
              <th className="px-4 py-2.5 font-medium">Khối</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Mạch</th>
              <th className="px-4 py-2.5 font-medium">Mô tả</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Năng lực</th>
              <th className="px-4 py-2.5 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {systemRows.map((s) => row(s, false))}
            {!systemRows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Không có YCCĐ hệ thống theo bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
