"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { formatDateOnly } from "@/lib/utils";
import { bghDecideLessonPlan } from "@/app/(app)/academics/lesson-plans/actions";
import { decideSubstituteRequest } from "@/app/(app)/school/substitutes/actions";
import { reviewActivity } from "@/app/(app)/activities/actions";

interface LpRow {
  id: string;
  title: string;
  teacher: string;
  className: string;
  subject: string;
  week: number | null;
  content: string | null;
}
interface SubRow {
  id: string;
  date: string;
  period: number;
  className: string;
  subject: string;
  absent: string;
  substitute: string | null;
  reason: string | null;
}
interface ActRow {
  id: string;
  title: string;
  className: string;
  date: string | null;
  description: string | null;
}

export function ApprovalsQueue({
  lessonPlans,
  substitutes,
  activities,
}: {
  lessonPlans: LpRow[];
  substitutes: SubRow[];
  activities: ActRow[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await fn();
      if (r.error) setErr(r.error);
      else setMsg(okMsg);
    });
  }

  const Actions = ({
    onApprove,
    onReject,
    disabled,
  }: {
    onApprove: () => void;
    onReject: () => void;
    disabled?: boolean;
  }) => (
    <span className="flex gap-1">
      <button
        type="button"
        onClick={onApprove}
        disabled={pending || disabled}
        title="Duyệt"
        className="rounded-md p-1.5 text-success hover:bg-success-bg disabled:opacity-40"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={pending}
        title="Từ chối / trả về"
        className="rounded-md p-1.5 text-error hover:bg-error-bg disabled:opacity-40"
      >
        <X className="size-4" />
      </button>
    </span>
  );

  return (
    <div className="space-y-6">
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

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Giáo án đã qua tổ duyệt ({lessonPlans.length})
        </h2>
        <DataTable
          columns={["Bài dạy", "Giáo viên", "Lớp", "Môn", "Tuần", "Nội dung", "Quyết định"]}
        >
          {lessonPlans.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.title}</td>
              <td>{p.teacher}</td>
              <td>{p.className}</td>
              <td>{p.subject}</td>
              <td>{p.week ? `Tuần ${p.week}` : "-"}</td>
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
                  <p className="mt-1 max-w-md whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    {p.content ?? "-"}
                  </p>
                )}
              </td>
              <td>
                <Actions
                  onApprove={() =>
                    run(
                      () => bghDecideLessonPlan(p.id, true),
                      "Đã duyệt giáo án.",
                    )
                  }
                  onReject={() =>
                    run(
                      () => bghDecideLessonPlan(p.id, false),
                      "Đã trả về giáo án.",
                    )
                  }
                />
              </td>
            </tr>
          ))}
          {lessonPlans.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-muted-foreground">
                Không có giáo án chờ duyệt.
              </td>
            </tr>
          )}
        </DataTable>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Điều động dạy thay ({substitutes.length})
        </h2>
        <DataTable
          columns={["Ngày", "Tiết", "Lớp", "Môn", "GV vắng", "GV dạy thay", "Lý do", "Quyết định"]}
        >
          {substitutes.map((r) => (
            <tr key={r.id}>
              <td>{formatDateOnly(r.date)}</td>
              <td>Tiết {r.period}</td>
              <td className="font-medium">{r.className}</td>
              <td>{r.subject}</td>
              <td>{r.absent}</td>
              <td>{r.substitute ?? <span className="text-muted-foreground">Chưa chọn</span>}</td>
              <td className="max-w-48 text-muted-foreground">{r.reason ?? "-"}</td>
              <td>
                <Actions
                  disabled={!r.substitute}
                  onApprove={() =>
                    run(
                      () => decideSubstituteRequest(r.id, true),
                      "Đã duyệt điều động.",
                    )
                  }
                  onReject={() =>
                    run(
                      () => decideSubstituteRequest(r.id, false),
                      "Đã từ chối điều động.",
                    )
                  }
                />
              </td>
            </tr>
          ))}
          {substitutes.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-muted-foreground">
                Không có yêu cầu điều động chờ duyệt.
              </td>
            </tr>
          )}
        </DataTable>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Kế hoạch hoạt động ({activities.length})
        </h2>
        <DataTable columns={["Hoạt động", "Lớp", "Ngày", "Mô tả", "Quyết định"]}>
          {activities.map((a) => (
            <tr key={a.id}>
              <td className="font-medium">{a.title}</td>
              <td>{a.className}</td>
              <td>{a.date ? formatDateOnly(a.date) : "-"}</td>
              <td className="max-w-64 text-muted-foreground">
                {a.description ?? "-"}
              </td>
              <td>
                <Actions
                  onApprove={() =>
                    run(() => reviewActivity(a.id, true), "Đã duyệt hoạt động.")
                  }
                  onReject={() =>
                    run(() => reviewActivity(a.id, false), "Đã trả về hoạt động.")
                  }
                />
              </td>
            </tr>
          ))}
          {activities.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-muted-foreground">
                Không có hoạt động chờ duyệt.
              </td>
            </tr>
          )}
        </DataTable>
      </section>
    </div>
  );
}
