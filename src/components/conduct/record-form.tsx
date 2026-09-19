"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-ring";

/** Form to add a conduct_records row (nhận xét / khen thưởng / vi phạm). */
export function ConductRecordForm({
  students,
  meId,
}: {
  students: RecordStudent[];
  meId: string;
}) {
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
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Loại
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputCls}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
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
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="VD: Tích cực phát biểu, đi học muộn…"
            className={inputCls}
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
