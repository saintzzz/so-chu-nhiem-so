"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { sortByVietnameseName } from "@/lib/utils";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

export interface RecordStudent {
  id: string;
  code: string;
  full_name: string;
}

const TYPES = [
  { value: "nhan_xet", label: "Nhận xét" },
  { value: "khen_thuong", label: "Khen thưởng" },
  { value: "vi_pham", label: "Vi phạm" },
];

const TYPE_ACTIVE_CLS: Record<string, string> = {
  nhan_xet: "border-primary bg-primary-bg text-primary",
  khen_thuong: "border-success bg-success-bg text-success",
  vi_pham: "border-destructive bg-error-bg text-error",
};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-ring";

/** Form to add a conduct_records row (nhận xét / khen thưởng / vi phạm). */
export function ConductRecordForm({
  students: rawStudents,
  meId,
}: {
  students: RecordStudent[];
  meId: string;
}) {
  const students = sortByVietnameseName(rawStudents, (s) => s.full_name);
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [type, setType] = useState("nhan_xet");
  const [points, setPoints] = useState("0");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit() {
    setSaved(false);
    setError(null);
    if (!studentId) {
      setError("Vui lòng chọn học sinh.");
      return;
    }
    if (!content.trim()) {
      setError("Vui lòng nhập nội dung.");
      return;
    }
    const pts = Number(points);
    if (Number.isNaN(pts)) {
      setError("Điểm không hợp lệ.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("conduct_records").insert({
        student_id: studentId,
        type,
        content: content.trim(),
        points: pts,
        date,
        recorded_by: meId,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setContent("");
      setPoints("0");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <h3 className="mb-3 text-base font-semibold">Thêm ghi nhận mới</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Học sinh
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={inputCls}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          <legend className="sr-only">Loại</legend>
          <span aria-hidden>Loại</span>
          <div className="flex h-9 items-center gap-1.5">
            {TYPES.map((t) => (
              <label
                key={t.value}
                className={`flex h-full cursor-pointer items-center rounded-lg border px-2.5 text-sm font-medium transition-colors ${
                  type === t.value
                    ? TYPE_ACTIVE_CLS[t.value]
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="record-type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => setType(t.value)}
                  className="sr-only"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Ngày
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Điểm (+/−)
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-3">
          Nội dung
          <AutoGrowTextarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="VD: Tích cực phát biểu, đi học muộn…"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu ghi nhận"}
        </Button>
        {saved && <span className="text-sm text-success">Đã lưu.</span>}
        {error && <span className="text-sm text-error">{error}</span>}
      </div>
    </div>
  );
}
