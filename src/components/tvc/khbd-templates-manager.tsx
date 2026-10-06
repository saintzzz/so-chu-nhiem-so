"use client";

import { useState, useTransition } from "react";
import {
  saveKhbdTemplate,
  deleteKhbdTemplate,
  type KhbdActivityInput,
} from "@/lib/tvc/actions";
import { Plus, Trash2, PenLine, Loader2, X } from "lucide-react";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
const input =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none";

interface Tpl {
  id: string;
  name: string;
  activities: KhbdActivityInput[];
  include_review: boolean;
  include_signoff: boolean;
  is_default: boolean;
  school_id: string | null;
}

interface Form {
  id?: string;
  name: string;
  activities: KhbdActivityInput[];
  include_review: boolean;
  include_signoff: boolean;
  is_default: boolean;
}

const EMPTY: Form = {
  name: "",
  activities: [{ name: "", minutes: undefined, hint: "" }],
  include_review: true,
  include_signoff: true,
  is_default: false,
};

export function KhbdTemplatesManager({
  templates,
  canManage,
}: {
  templates: Tpl[];
  canManage: boolean;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    if (!form) return;
    setError("");
    start(async () => {
      const res = await saveKhbdTemplate(form);
      if (res.error) setError(res.error);
      else setForm(null);
    });
  };

  const remove = (id: string, name: string) => {
    if (!confirm(`Xoá biểu mẫu "${name}"?`)) return;
    start(async () => {
      const res = await deleteKhbdTemplate(id);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      {canManage && !form && (
        <button className={btnPrimary} onClick={() => setForm({ ...EMPTY })}>
          <Plus className="h-4 w-4" /> Thêm biểu mẫu của trường
        </button>
      )}
      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {form && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {form.id ? "Sửa biểu mẫu" : "Biểu mẫu mới"}
            </h3>
            <button className={btn} onClick={() => setForm(null)}>
              <X className="h-4 w-4" /> Đóng
            </button>
          </div>
          <input
            className={input}
            placeholder="Tên biểu mẫu (VD: KHBD theo hướng dẫn Sở GDĐT)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Các hoạt động (theo thứ tự):</p>
            {form.activities.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-sm text-muted-foreground">
                  {i + 1}.
                </span>
                <input
                  className={`${input} w-48`}
                  placeholder="Tên hoạt động"
                  value={a.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      activities: form.activities.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  className={`${input} w-24`}
                  type="number"
                  min={1}
                  placeholder="Phút"
                  value={a.minutes ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      activities: form.activities.map((x, j) =>
                        j === i
                          ? { ...x, minutes: Number(e.target.value) || undefined }
                          : x,
                      ),
                    })
                  }
                />
                <input
                  className={`${input} flex-1`}
                  placeholder="Gợi ý mục tiêu hoạt động (không bắt buộc)"
                  value={a.hint ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      activities: form.activities.map((x, j) =>
                        j === i ? { ...x, hint: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  className={btn}
                  onClick={() =>
                    setForm({
                      ...form,
                      activities: form.activities.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              className={btn}
              onClick={() =>
                setForm({
                  ...form,
                  activities: [...form.activities, { name: "", hint: "" }],
                })
              }
            >
              <Plus className="h-4 w-4" /> Thêm hoạt động
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.include_review}
                onChange={(e) =>
                  setForm({ ...form, include_review: e.target.checked })
                }
              />
              Mục &quot;Điều chỉnh sau bài dạy&quot;
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.include_signoff}
                onChange={(e) =>
                  setForm({ ...form, include_signoff: e.target.checked })
                }
              />
              Khối ký duyệt (tổ trưởng / người soạn)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm({ ...form, is_default: e.target.checked })
                }
              />
              Đặt làm mặc định của trường
            </label>
          </div>
          <button
            className={btnPrimary}
            disabled={pending || !form.name.trim()}
            onClick={submit}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Lưu biểu mẫu
          </button>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {t.name}
                  {!t.school_id ? (
                    <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
                      Hệ thống
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
                      Của trường
                    </span>
                  )}
                  {t.is_default && (
                    <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {t.school_id ? "Mặc định trường" : "Mặc định hệ thống"}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.activities
                    .map((a) => `${a.name}${a.minutes ? ` (${a.minutes}')` : ""}`)
                    .join(" → ")}
                </p>
              </div>
              {canManage && t.school_id && (
                <div className="flex gap-2">
                  <button
                    className={btn}
                    onClick={() =>
                      setForm({
                        id: t.id,
                        name: t.name,
                        activities: t.activities,
                        include_review: t.include_review,
                        include_signoff: t.include_signoff,
                        is_default: t.is_default,
                      })
                    }
                  >
                    <PenLine className="h-4 w-4" /> Sửa
                  </button>
                  <button className={btn} onClick={() => remove(t.id, t.name)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!templates.length && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có biểu mẫu nào.
          </p>
        )}
      </div>
    </div>
  );
}
