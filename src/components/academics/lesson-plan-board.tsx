"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { formatDateTime } from "@/lib/utils";
import {
  submitLessonPlan,
  teamReviewLessonPlan,
  bghDecideLessonPlan,
} from "@/app/(app)/academics/lesson-plans/actions";

interface Plan {
  id: string;
  class_id: string;
  subject_id: string | null;
  week: number | null;
  periods: string | null;
  title: string;
  content: string | null;
  status: "draft" | "submitted" | "team_approved" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  teacher_id?: string;
}

const LP_STATUS: Record<
  Plan["status"],
  { label: string; tone: "muted" | "warning" | "success" | "error" | "primary" }
> = {
  draft: { label: "Nháp", tone: "muted" },
  submitted: { label: "Chờ tổ duyệt", tone: "warning" },
  team_approved: { label: "Chờ BGH duyệt", tone: "primary" },
  approved: { label: "Đã duyệt", tone: "success" },
  rejected: { label: "Trả về", tone: "error" },
};

export function LessonPlanBoard({
  mode,
  classes,
  subjects,
  plans,
  teacherNames,
}: {
  mode: "teacher" | "team" | "bgh";
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  plans: Plan[];
  teacherNames: Record<string, string>;
}) {
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [week, setWeek] = useState("");
  const [periods, setPeriods] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const className = new Map(classes.map((c) => [c.id, c.name]));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  function submit() {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await submitLessonPlan({
        classId,
        subjectId,
        week: week ? Number(week) : null,
        periods,
        title,
        content,
      });
      if (r.error) setErr(r.error);
      else {
        setMsg("Đã nộp giáo án - chờ tổ chuyên môn duyệt.");
        setTitle("");
        setContent("");
        setWeek("");
        setPeriods("");
      }
    });
  }

  function decide(id: string, approve: boolean) {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r =
        mode === "team"
          ? await teamReviewLessonPlan(id, approve, note || undefined)
          : await bghDecideLessonPlan(id, approve, note || undefined);
      if (r.error) setErr(r.error);
      else setMsg(approve ? "Đã duyệt." : "Đã trả về.");
      setNoteFor(null);
      setNote("");
    });
  }

  const canAct = (p: Plan) =>
    (mode === "team" && p.status === "submitted") ||
    (mode === "bgh" && p.status === "team_approved");

  return (
    <div className="space-y-6">
      {mode === "teacher" && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h2 className="mb-3 text-sm font-semibold">Nộp giáo án mới</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Lớp</span>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
              >
                <option value="">- Chọn lớp -</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Môn</span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
              >
                <option value="">- Chọn môn -</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Tuần</span>
              <input
                type="number"
                min={1}
                max={38}
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="VD: 5"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Tiết</span>
              <input
                type="text"
                value={periods}
                onChange={(e) => setPeriods(e.target.value)}
                placeholder="VD: Tiết 21-25"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
              />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Tên bài dạy
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Phương trình bậc nhất một ẩn"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Nội dung giáo án
            </span>
            <AutoGrowTextarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Mục tiêu, hoạt động khởi động - khám phá - luyện tập - vận dụng, đồ dùng dạy học..."
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !classId || !subjectId || !title.trim() || !content.trim()}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Nộp giáo án
          </button>
        </div>
      )}

      {err && (
        <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-success/30 bg-success-bg px-3 py-2 text-sm text-success">
          {msg}
        </p>
      )}

      <DataTable
        columns={[
          ...(mode !== "teacher" ? ["Giáo viên"] : []),
          "Bài dạy",
          "Lớp",
          "Môn",
          "Tuần",
          "Nộp lúc",
          "Trạng thái",
          "Chi tiết",
          ...(mode !== "teacher" ? ["Duyệt"] : []),
        ]}
      >
        {plans.map((p) => (
          <tr key={p.id}>
            {mode !== "teacher" && (
              <td>{p.teacher_id ? (teacherNames[p.teacher_id] ?? "-") : "-"}</td>
            )}
            <td className="font-medium">{p.title}</td>
            <td>{className.get(p.class_id) ?? "-"}</td>
            <td>{p.subject_id ? (subjectName.get(p.subject_id) ?? "-") : "-"}</td>
            <td>
              {p.week ? `Tuần ${p.week}` : "-"}
              {p.periods ? ` · ${p.periods}` : ""}
            </td>
            <td className="text-muted-foreground">
              {formatDateTime(p.created_at)}
            </td>
            <td>
              <StatusBadge
                label={LP_STATUS[p.status].label}
                tone={LP_STATUS[p.status].tone}
              />
            </td>
            <td>
              <button
                type="button"
                onClick={() =>
                  setExpanded(expanded === p.id ? null : p.id)
                }
                className="text-sm text-primary hover:underline"
              >
                {expanded === p.id ? "Thu gọn" : "Xem"}
              </button>
              {expanded === p.id && (
                <div className="mt-1 max-w-md whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                  {p.content ?? "-"}
                  {p.review_note && (
                    <p className="mt-2 border-t border-border pt-1">
                      <span className="font-medium">Ghi chú duyệt:</span>{" "}
                      {p.review_note}
                    </p>
                  )}
                </div>
              )}
            </td>
            {mode !== "teacher" && (
              <td>
                {canAct(p) ? (
                  noteFor === p.id ? (
                    <span className="flex flex-col gap-1">
                      <AutoGrowTextarea
                        bare
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ghi chú duyệt (tuỳ chọn)"
                      />
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => decide(p.id, true)}
                          disabled={pending}
                          className="rounded-md bg-success-bg px-2 py-1 text-xs font-medium text-success"
                        >
                          Duyệt
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(p.id, false)}
                          disabled={pending}
                          className="rounded-md bg-error-bg px-2 py-1 text-xs font-medium text-error"
                        >
                          Trả về
                        </button>
                      </span>
                    </span>
                  ) : (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNoteFor(p.id);
                          setNote("");
                        }}
                        disabled={pending}
                        title="Duyệt / trả về"
                        className="rounded-md p-1.5 text-success hover:bg-success-bg"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNoteFor(p.id);
                          setNote("");
                        }}
                        disabled={pending}
                        title="Trả về kèm ghi chú"
                        className="rounded-md p-1.5 text-error hover:bg-error-bg"
                      >
                        <X className="size-4" />
                      </button>
                    </span>
                  )
                ) : (
                  "-"
                )}
              </td>
            )}
          </tr>
        ))}
        {plans.length === 0 && (
          <tr>
            <td
              colSpan={mode === "teacher" ? 7 : 9}
              className="py-8 text-center text-muted-foreground"
            >
              {mode === "teacher"
                ? "Chưa có giáo án nào - nộp giáo án đầu tiên ở form trên."
                : "Không có giáo án nào đang chờ duyệt."}
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
