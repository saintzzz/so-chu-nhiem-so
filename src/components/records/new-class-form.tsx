"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function NewClassForm({
  schoolId,
  academicYearId,
  gvcnId,
  campusId,
}: {
  schoolId: string | null;
  academicYearId: string | null;
  gvcnId: string;
  campusId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("6");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!schoolId || !academicYearId) {
      setMessage("Thiếu thông tin trường / năm học. Không thể tạo lớp.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage("Vui lòng nhập tên lớp (ví dụ: 6A3).");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("classes").insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      name: trimmed,
      grade: Number(grade),
      gvcn_id: gvcnId,
      campus_id: campusId,
      status: "active",
    });
    setLoading(false);
    if (error) {
      setMessage(`Không thể tiếp nhận lớp: ${error.message}`);
      return;
    }
    setName("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div>
      <Button type="button" onClick={() => setOpen((o) => !o)}>
        {open ? "Đóng" : "Tiếp nhận lớp mới"}
      </Button>
      {open && (
        <form
          onSubmit={onSubmit}
          className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="nc-name" className="mb-1 block text-sm font-medium">
                Tên lớp
              </label>
              <input
                id="nc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: 6A3"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label htmlFor="nc-grade" className="mb-1 block text-sm font-medium">
                Khối
              </label>
              <select
                id="nc-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className={inputCls}
              >
                {["6", "7", "8", "9"].map((g) => (
                  <option key={g} value={g}>
                    Khối {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Lớp mới sẽ gán cho bạn làm GVCN. Sau đó, vào mục &quot;Upload danh
            sách học sinh&quot; để nhập sĩ số.
          </p>
          {message && (
            <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
              {message}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Đang tạo..." : "Tạo lớp"}
          </Button>
        </form>
      )}
    </div>
  );
}
