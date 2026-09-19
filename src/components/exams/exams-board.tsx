"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { FilterSelect } from "@/components/academics/filter-select";

interface ExamRow {
  id: string;
  name: string;
  term: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "published" | "done";
}
interface SessionRow {
  id: string;
  class_id: string;
  subject_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  room: string | null;
  proctor_id: string | null;
}

const STATUS_LABEL: Record<string, { label: string; tone: "muted" | "primary" | "success" }> = {
  draft: { label: "Nháp", tone: "muted" },
  published: { label: "Đã công bố", tone: "primary" },
  done: { label: "Đã thi", tone: "success" },
};

const inputCls =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring";

export function ExamsBoard({
  exams,
  examId,
  sessions,
  classes,
  subjects,
  teachers,
  schoolId,
  canEdit,
}: {
  exams: ExamRow[];
  examId: string;
  sessions: SessionRow[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  teachers: { id: string; full_name: string }[];
  schoolId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newExam, setNewExam] = useState({
    name: "",
    term: "hk1",
    start_date: "",
    end_date: "",
  });
  const [newSession, setNewSession] = useState({
    class_id: classes[0]?.id ?? "",
    subject_id: subjects[0]?.id ?? "",
    date: "",
    start_time: "07:30",
    end_time: "08:15",
    room: "",
    proctor_id: "",
  });

  const className = new Map(classes.map((c) => [c.id, c.name]));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const teacherName = new Map(teachers.map((t) => [t.id, t.full_name]));
  const exam = exams.find((e) => e.id === examId);

  function run(fn: () => Promise<string | null>, refresh = true) {
    setError(null);
    startTransition(async () => {
      const err = await fn();
      if (err) setError(err);
      else if (refresh) router.refresh();
    });
  }

  function createExam() {
    if (!newExam.name.trim()) {
      setError("Nhập tên kỳ thi.");
      return;
    }
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("exams").insert({
        school_id: schoolId,
        name: newExam.name.trim(),
        term: newExam.term,
        start_date: newExam.start_date || null,
        end_date: newExam.end_date || null,
        status: "draft",
      });
      return err?.message ?? null;
    });
  }

  function setExamStatus(status: string) {
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("exams")
        .update({ status })
        .eq("id", examId);
      return err?.message ?? null;
    });
  }

  function addSession() {
    if (!newSession.date) {
      setError("Chọn ngày thi.");
      return;
    }
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("exam_sessions").insert({
        exam_id: examId,
        class_id: newSession.class_id,
        subject_id: newSession.subject_id,
        date: newSession.date,
        start_time: newSession.start_time,
        end_time: newSession.end_time || null,
        room: newSession.room.trim() || null,
        proctor_id: newSession.proctor_id || null,
      });
      return err?.message ?? null;
    });
  }

  function removeSession(id: string) {
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("exam_sessions")
        .delete()
        .eq("id", id);
      return err?.message ?? null;
    });
  }

  function patchSession(id: string, patch: Partial<SessionRow>) {
    run(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("exam_sessions")
        .update(patch)
        .eq("id", id);
      return err?.message ?? null;
    }, false);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-destructive p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <FilterSelect
          name="exam"
          label="Kỳ thi"
          value={examId}
          options={exams.map((e) => ({ value: e.id, label: e.name }))}
          params={examId ? { exam: examId } : {}}
        />
        {exam && (
          <div className="flex items-center gap-2 pb-1">
            <StatusBadge
              label={STATUS_LABEL[exam.status].label}
              tone={STATUS_LABEL[exam.status].tone}
            />
            <span className="text-sm text-muted-foreground">
              {exam.start_date ?? "?"} - {exam.end_date ?? "?"}
            </span>
            {canEdit && exam.status === "draft" && (
              <Button size="sm" variant="secondary" onClick={() => setExamStatus("published")}>
                Công bố
              </Button>
            )}
            {canEdit && exam.status === "published" && (
              <Button size="sm" variant="secondary" onClick={() => setExamStatus("done")}>
                Đánh dấu đã thi
              </Button>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <span className="w-full text-sm font-semibold">Tạo kỳ thi mới</span>
          <input
            placeholder="Tên kỳ thi (VD: Kiểm tra giữa kỳ I)"
            value={newExam.name}
            onChange={(e) => setNewExam((p) => ({ ...p, name: e.target.value }))}
            className={`${inputCls} h-9 min-w-64`}
          />
          <select
            value={newExam.term}
            onChange={(e) => setNewExam((p) => ({ ...p, term: e.target.value }))}
            className={`${inputCls} h-9`}
          >
            <option value="hk1">Học kỳ I</option>
            <option value="hk2">Học kỳ II</option>
          </select>
          <input
            type="date"
            value={newExam.start_date}
            onChange={(e) =>
              setNewExam((p) => ({ ...p, start_date: e.target.value }))
            }
            className={`${inputCls} h-9`}
          />
          <input
            type="date"
            value={newExam.end_date}
            onChange={(e) =>
              setNewExam((p) => ({ ...p, end_date: e.target.value }))
            }
            className={`${inputCls} h-9`}
          />
          <Button size="sm" onClick={createExam} disabled={pending}>
            Tạo kỳ thi
          </Button>
        </div>
      )}

      {examId ? (
        <>
          <DataTable
            columns={["Ngày", "Giờ", "Lớp", "Môn", "Phòng", "Giám thị", ...(canEdit ? [""] : [])]}
            footer={<span>{sessions.length} buổi thi</span>}
          >
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {canEdit ? (
                    <input
                      type="date"
                      defaultValue={s.date}
                      onBlur={(e) =>
                        e.target.value !== s.date &&
                        patchSession(s.id, { date: e.target.value })
                      }
                      className={inputCls}
                    />
                  ) : (
                    s.date
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <input
                      type="time"
                      defaultValue={s.start_time?.slice(0, 5)}
                      onBlur={(e) =>
                        patchSession(s.id, { start_time: e.target.value })
                      }
                      className={`${inputCls} w-24`}
                    />
                  ) : (
                    s.start_time?.slice(0, 5)
                  )}
                </td>
                <td className="font-medium">{className.get(s.class_id)}</td>
                <td>{subjectName.get(s.subject_id)}</td>
                <td>
                  {canEdit ? (
                    <input
                      defaultValue={s.room ?? ""}
                      placeholder="P.201"
                      onBlur={(e) =>
                        e.target.value !== (s.room ?? "") &&
                        patchSession(s.id, { room: e.target.value || null })
                      }
                      className={`${inputCls} w-24`}
                    />
                  ) : (
                    (s.room ?? "-")
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <select
                      defaultValue={s.proctor_id ?? ""}
                      onChange={(e) =>
                        patchSession(s.id, {
                          proctor_id: e.target.value || null,
                        })
                      }
                      className={inputCls}
                    >
                      <option value="">-</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (s.proctor_id ? teacherName.get(s.proctor_id) : "-")
                  )}
                </td>
                {canEdit && (
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSession(s.id)}
                      disabled={pending}
                    >
                      Xóa
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground">
                  Chưa có buổi thi nào trong kỳ này.
                </td>
              </tr>
            )}
          </DataTable>

          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
              <span className="w-full text-sm font-semibold">Thêm buổi thi</span>
              <select
                value={newSession.class_id}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, class_id: e.target.value }))
                }
                className={`${inputCls} h-9`}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={newSession.subject_id}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, subject_id: e.target.value }))
                }
                className={`${inputCls} h-9`}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newSession.date}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, date: e.target.value }))
                }
                className={`${inputCls} h-9`}
              />
              <input
                type="time"
                value={newSession.start_time}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, start_time: e.target.value }))
                }
                className={`${inputCls} h-9 w-24`}
              />
              <input
                type="time"
                value={newSession.end_time}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, end_time: e.target.value }))
                }
                className={`${inputCls} h-9 w-24`}
              />
              <input
                placeholder="Phòng"
                value={newSession.room}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, room: e.target.value }))
                }
                className={`${inputCls} h-9 w-24`}
              />
              <select
                value={newSession.proctor_id}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, proctor_id: e.target.value }))
                }
                className={`${inputCls} h-9`}
              >
                <option value="">- Giám thị -</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={addSession} disabled={pending}>
                Thêm buổi thi
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Chưa có kỳ thi nào. Tạo kỳ thi mới ở trên.
        </div>
      )}
    </div>
  );
}
