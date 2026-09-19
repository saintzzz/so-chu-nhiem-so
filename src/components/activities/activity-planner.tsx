"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import {
  createActivity,
  submitActivity,
  reviewActivity,
} from "@/app/(app)/activities/actions";

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export interface ActivityItem {
  id: string;
  title: string;
  className: string;
  activityDate: string;
  description: string | null;
  status: keyof typeof FLOW_STATUS;
}

export function ActivityPlanner({
  activities,
  classes,
  canCreate,
  isBgh,
}: {
  activities: ActivityItem[];
  classes: { id: string; name: string }[];
  canCreate: boolean;
  isBgh: boolean;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleCreate() {
    setSaving(true);
    setFeedback(null);
    const res = await createActivity({
      classId,
      title,
      description,
      activityDate: date || null,
    });
    setSaving(false);
    if (res.error) {
      setFeedback({ kind: "error", text: res.error });
    } else {
      setFeedback({ kind: "success", text: "Đã tạo kế hoạch hoạt động." });
      setTitle("");
      setDescription("");
      setDate("");
    }
  }

  async function act(
    id: string,
    fn: () => Promise<{ error?: string }>,
    errMsg: string,
  ) {
    setPendingId(id);
    const res = await fn();
    setPendingId(null);
    if (res.error) setFeedback({ kind: "error", text: res.error || errMsg });
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h2 className="mb-4 text-base font-semibold">
            Lập kế hoạch hoạt động mới
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Lớp</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className={INPUT_CLS}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Ngày hoạt động
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                Tên hoạt động
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Tham quan Bảo tàng Lịch sử"
                className={INPUT_CLS}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Mục tiêu, nội dung, kinh phí dự kiến..."
                className={INPUT_CLS}
              />
            </div>
          </div>
          {feedback && (
            <p
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-sm",
                feedback.kind === "success"
                  ? "bg-success-bg text-success"
                  : "bg-error-bg text-error",
              )}
            >
              {feedback.text}
            </p>
          )}
          <div className="mt-3">
            <Button
              onClick={handleCreate}
              disabled={saving || !classId || !title.trim()}
            >
              {saving ? "Đang lưu..." : "Tạo kế hoạch (nháp)"}
            </Button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chưa có hoạt động giáo dục nào.
        </div>
      ) : (
        <DataTable
          columns={[
            "Hoạt động",
            "Lớp",
            "Ngày",
            "Mô tả",
            "Trạng thái",
            "Thao tác",
          ]}
        >
          {activities.map((a) => {
            const st = FLOW_STATUS[a.status];
            const busy = pendingId === a.id;
            return (
              <tr key={a.id}>
                <td className="font-medium">{a.title}</td>
                <td>{a.className}</td>
                <td className="text-muted-foreground">{a.activityDate}</td>
                <td className="max-w-64 truncate text-muted-foreground">
                  {a.description ?? "-"}
                </td>
                <td>
                  <StatusBadge label={st.label} tone={st.tone} />
                </td>
                <td>
                  <div className="flex gap-1.5">
                    {a.status === "draft" && canCreate && (
                      <Button
                        size="xs"
                        onClick={() =>
                          act(a.id, () => submitActivity(a.id), "Lỗi gửi duyệt")
                        }
                        disabled={busy}
                      >
                        Gửi phê duyệt
                      </Button>
                    )}
                    {a.status === "pending" && isBgh && (
                      <>
                        <Button
                          size="xs"
                          onClick={() =>
                            act(
                              a.id,
                              () => reviewActivity(a.id, true),
                              "Lỗi phê duyệt",
                            )
                          }
                          disabled={busy}
                        >
                          Duyệt
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() =>
                            act(
                              a.id,
                              () => reviewActivity(a.id, false),
                              "Lỗi từ chối",
                            )
                          }
                          disabled={busy}
                        >
                          Từ chối
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
