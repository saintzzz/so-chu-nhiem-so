"use client";

import { useMemo, useState, useTransition } from "react";
import { checkout, returnLoan } from "@/app/(app)/library/actions";
import { fmtDateTimeVN, sortByVietnameseName, compareVietnameseName, todayVN } from "@/lib/utils";

export type LibLoanRow = {
  id: string;
  borrower_name: string;
  borrower_label: string;
  borrowed_at: string;
  due_at: string;
  accession_no: number;
  book_title: string;
};
export type CopyOpt = { id: string; accession_no: number; book_title: string };
export type StudentOpt = { id: string; full_name: string; class_name: string };
export type TeacherOpt = { id: string; full_name: string };

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

export function LoansBoard({
  loans,
  copies,
  students,
  teachers,
  classes,
}: {
  loans: LibLoanRow[];
  copies: CopyOpt[];
  students: StudentOpt[];
  teachers: TeacherOpt[];
  classes: { id: string; name: string }[];
}) {
  const [accNo, setAccNo] = useState("");
  const [kind, setKind] = useState<"student" | "teacher">("student");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [days, setDays] = useState("14");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const byAccession = useMemo(() => {
    const m = new Map<number, CopyOpt>();
    for (const c of copies) m.set(c.accession_no, c);
    return m;
  }, [copies]);
  const copy = byAccession.get(Number(accNo));

  const classStudents = useMemo(() => {
    const clsName = classes.find((c) => c.id === classId)?.name;
    const list = students.filter((s) => !clsName || s.class_name === clsName);
    return sortByVietnameseName(list, (s) => s.full_name);
  }, [students, classes, classId]);
  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => compareVietnameseName(a.full_name, b.full_name)),
    [teachers],
  );

  const today = todayVN();
  const valid = !!copy && (kind === "student" ? !!studentId : !!teacherId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!copy) return;
    setErr(null); setMsg(null);
    start(async () => {
      const res = await checkout({
        copy_id: copy.id,
        student_id: kind === "student" ? studentId : null,
        teacher_id: kind === "teacher" ? teacherId : null,
        days: Number(days) || 14,
      });
      if (res?.error) return setErr(res.error);
      setMsg(`Đã cho mượn "${copy.book_title}" (ĐKCB ${copy.accession_no}).`);
      setAccNo(""); setStudentId(""); setTeacherId("");
    });
  }

  function doReturn(id: string, condition: "ok" | "damaged" | "lost") {
    const label = condition === "ok" ? "Xác nhận trả sách?" : condition === "damaged" ? "Báo hỏng và trả?" : "Báo mất sách?";
    if (!confirm(label)) return;
    setErr(null); setMsg(null);
    start(async () => {
      const res = await returnLoan(id, condition);
      if (res?.error) return setErr(res.error);
      setMsg(condition === "ok" ? "Đã trả sách." : condition === "damaged" ? "Đã ghi nhận sách hỏng." : "Đã ghi nhận sách mất.");
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Số ĐKCB *</span>
          <input required inputMode="numeric" value={accNo} onChange={(e) => setAccNo(e.target.value.replace(/\D/g, ""))}
            placeholder="vd: 125" className={inputCls + " w-28"} />
          {accNo && (
            <span className={"mt-1 block text-xs " + (copy ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
              {copy ? copy.book_title : "Không có bản sao sẵn sàng mang số này"}
            </span>
          )}
        </label>
        <div className="text-sm">
          <span className="mb-1 block text-muted-foreground">Người mượn *</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["student", "teacher"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={"px-3 py-2 text-sm " + (kind === k ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                {k === "student" ? "Học sinh" : "Giáo viên"}
              </button>
            ))}
          </div>
        </div>
        {kind === "student" ? (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Lớp</span>
              <select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(""); }} className={inputCls}>
                <option value="">- Tất cả -</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm min-w-48">
              <span className="mb-1 block text-muted-foreground">Học sinh *</span>
              <select required value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls + " w-full"}>
                <option value="">- Chọn học sinh -</option>
                {classStudents.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.class_name}</option>)}
              </select>
            </label>
          </>
        ) : (
          <label className="text-sm min-w-48">
            <span className="mb-1 block text-muted-foreground">Giáo viên *</span>
            <select required value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inputCls + " w-full"}>
              <option value="">- Chọn giáo viên -</option>
              {sortedTeachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Hạn (ngày)</span>
          <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls + " w-20"} />
        </label>
        <button type="submit" disabled={busy || !valid}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "..." : "Cho mượn"}
        </button>
      </form>

      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}

      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">ĐKCB</th>
              <th className="px-4 py-3 font-medium">Sách</th>
              <th className="px-4 py-3 font-medium">Người mượn</th>
              <th className="px-4 py-3 font-medium">Ngày mượn</th>
              <th className="px-4 py-3 font-medium">Hạn trả</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => {
              const overdue = l.due_at.slice(0, 10) < today;
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium tabular-nums">{l.accession_no}</td>
                  <td className="px-4 py-3">{l.book_title}</td>
                  <td className="px-4 py-3">
                    {l.borrower_name}
                    <span className="ml-1 text-xs text-muted-foreground">· {l.borrower_label}</span>
                  </td>
                  <td className="px-4 py-3">{fmtDateTimeVN(l.borrowed_at)}</td>
                  <td className={"px-4 py-3 " + (overdue ? "text-destructive font-medium" : "")}>
                    {fmtDateTimeVN(l.due_at)}{overdue ? " · quá hạn" : ""}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => doReturn(l.id, "ok")} className="text-primary hover:underline">Trả</button>
                    <button onClick={() => doReturn(l.id, "damaged")} className="text-amber-700 hover:underline dark:text-amber-400">Hỏng</button>
                    <button onClick={() => doReturn(l.id, "lost")} className="text-destructive hover:underline">Mất</button>
                  </td>
                </tr>
              );
            })}
            {loans.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Không có lượt mượn nào đang mở (0).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
