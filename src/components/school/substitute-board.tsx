"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { formatDateOnly } from "@/lib/utils";
import {
  createSubstituteRequest,
  decideSubstituteRequest,
} from "@/app/(app)/school/substitutes/actions";

interface TtEntry {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  weekday: number; // 2=Mon ... 7=Sat
  period: number;
}

interface Req {
  id: string;
  class_id: string;
  subject_id: string | null;
  date: string;
  period: number;
  absent_teacher_id: string;
  substitute_teacher_id: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  note: string | null;
}

const SUB_STATUS: Record<
  Req["status"],
  { label: string; tone: "muted" | "warning" | "success" | "error" }
> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
  rejected: { label: "Từ chối", tone: "error" },
};

export function SubstituteBoard({
  classes,
  subjects,
  requests,
  timetable,
  teacherSubjects,
  teachers,
  canDecide,
  canCreate,
}: {
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  requests: Req[];
  timetable: TtEntry[];
  teacherSubjects: { teacher_id: string; subject_id: string }[];
  teachers: { id: string; name: string }[];
  canDecide: boolean;
  canCreate: boolean;
}) {
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [period, setPeriod] = useState(1);
  const [subId, setSubId] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const teacherName = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.name])),
    [teachers],
  );
  const subjectName = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects],
  );
  const className = useMemo(
    () => new Map(classes.map((c) => [c.id, c.name])),
    [classes],
  );

  // weekday theo convention app: 2=Thu Hai ... 7=Thu Bay
  const weekday = useMemo(() => {
    if (!date) return null;
    const jsDay = new Date(date + "T00:00:00").getDay(); // 0=Sun
    if (jsDay === 0) return null;
    return jsDay + 1;
  }, [date]);

  const entry = useMemo(() => {
    if (!classId || !weekday) return null;
    return (
      timetable.find(
        (t) =>
          t.class_id === classId && t.weekday === weekday && t.period === period,
      ) ?? null
    );
  }, [timetable, classId, weekday, period]);

  // Gợi ý: GV dạy cùng môn, không bận tiết đó, khác GV vắng
  const suggestions = useMemo(() => {
    if (!entry?.subject_id || !entry.teacher_id || !weekday) return [];
    const busy = new Set(
      timetable
        .filter((t) => t.weekday === weekday && t.period === period)
        .map((t) => t.teacher_id)
        .filter((x): x is string => !!x),
    );
    const sameSubject = new Set(
      teacherSubjects
        .filter((ts) => ts.subject_id === entry.subject_id)
        .map((ts) => ts.teacher_id),
    );
    return teachers.filter(
      (t) =>
        sameSubject.has(t.id) &&
        t.id !== entry.teacher_id &&
        !busy.has(t.id),
    );
  }, [entry, teacherSubjects, timetable, teachers, weekday, period]);

  function submit() {
    if (!entry) return;
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await createSubstituteRequest({
        classId,
        subjectId: entry.subject_id,
        date,
        period,
        absentTeacherId: entry.teacher_id!,
        substituteTeacherId: subId || null,
        reason,
      });
      if (r.error) setErr(r.error);
      else {
        setMsg("Đã tạo yêu cầu điều động, chờ phê duyệt.");
        setSubId("");
        setReason("");
      }
    });
  }

  function decide(id: string, approve: boolean) {
    start(async () => {
      setErr(null);
      const r = await decideSubstituteRequest(id, approve);
      if (r.error) setErr(r.error);
      else setMsg(approve ? "Đã duyệt điều động." : "Đã từ chối.");
    });
  }

  return (
    <div className="space-y-6">
      {canCreate && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h2 className="mb-3 text-sm font-semibold">Tạo yêu cầu dạy thay</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Lớp</span>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSubId("");
                }}
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
              <span className="mb-1 block text-muted-foreground">Ngày</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Tiết</span>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(Number(e.target.value));
                  setSubId("");
                }}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    Tiết {p}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <span className="mb-1 block text-muted-foreground">
                Tiết đang có
              </span>
              {entry ? (
                <p className="rounded-lg bg-muted px-2.5 py-1.5 text-sm">
                  {subjectName.get(entry.subject_id) ?? "?"} -{" "}
                  {entry.teacher_id
                    ? (teacherName.get(entry.teacher_id) ?? "?")
                    : "Chưa phân công"}
                </p>
              ) : (
                <p className="rounded-lg bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
                  {weekday ? "Không có tiết trong TKB" : "Chủ nhật - không học"}
                </p>
              )}
            </div>
          </div>

          {entry && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="text-sm">
                <span className="mb-1 block text-muted-foreground">
                  GV dạy thay (gợi ý: cùng môn, rảnh tiết này)
                </span>
                {suggestions.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setSubId(subId === t.id ? "" : t.id)
                        }
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                          subId === t.id
                            ? "border-primary bg-primary-bg text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Không còn GV cùng môn rảnh tiết này - BGH duyệt sẽ phân công
                    sau.
                  </p>
                )}
              </div>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Lý do vắng
                </span>
                <AutoGrowTextarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="GV ốm, đi học tập, công tác..."
                />
              </label>
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !entry?.teacher_id}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Gửi yêu cầu điều động
            </button>
          </div>
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
          "Ngày",
          "Lớp",
          "Tiết",
          "Môn",
          "GV vắng",
          "GV dạy thay",
          "Lý do",
          "Trạng thái",
          ...(canDecide ? ["Thao tác"] : []),
        ]}
      >
        {requests.map((r) => (
          <tr key={r.id}>
            <td>{formatDateOnly(r.date)}</td>
            <td className="font-medium">{className.get(r.class_id) ?? "-"}</td>
            <td>Tiết {r.period}</td>
            <td>{r.subject_id ? (subjectName.get(r.subject_id) ?? "-") : "-"}</td>
            <td>{teacherName.get(r.absent_teacher_id) ?? "-"}</td>
            <td>
              {r.substitute_teacher_id
                ? (teacherName.get(r.substitute_teacher_id) ?? "-")
                : "-"}
            </td>
            <td className="max-w-48 text-muted-foreground">{r.reason ?? "-"}</td>
            <td>
              <StatusBadge
                label={SUB_STATUS[r.status].label}
                tone={SUB_STATUS[r.status].tone}
              />
            </td>
            {canDecide && (
              <td>
                {r.status === "pending" && (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => decide(r.id, true)}
                      disabled={pending || !r.substitute_teacher_id}
                      title={
                        r.substitute_teacher_id
                          ? "Duyệt"
                          : "Cần chọn GV dạy thay trước"
                      }
                      className="rounded-md p-1.5 text-success hover:bg-success-bg disabled:opacity-40"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(r.id, false)}
                      disabled={pending}
                      title="Từ chối"
                      className="rounded-md p-1.5 text-error hover:bg-error-bg disabled:opacity-40"
                    >
                      <X className="size-4" />
                    </button>
                  </span>
                )}
              </td>
            )}
          </tr>
        ))}
        {requests.length === 0 && (
          <tr>
            <td
              colSpan={canDecide ? 9 : 8}
              className="py-8 text-center text-muted-foreground"
            >
              Chưa có yêu cầu điều động nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
