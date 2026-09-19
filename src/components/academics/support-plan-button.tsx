"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Creates a pending support_plans row for a weak student+subject pair. */
export function SupportPlanButton({
  studentId,
  subjectId,
  avg,
  meId,
}: {
  studentId: string;
  subjectId: string;
  avg: number;
  meId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function create() {
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("support_plans").insert({
        student_id: studentId,
        subject_id: subjectId,
        reason: `Điểm trung bình môn ${avg.toFixed(1)} dưới 5.0`,
        plan: "Phụ đạo 2 buổi/tuần, giao bài tập bổ sung, theo dõi tiến độ hàng tuần",
        status: "pending",
        created_by: meId,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size="xs" variant="outline" onClick={create} disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo kế hoạch"}
      </Button>
      {error && <span className="text-xs text-error">{error}</span>}
    </span>
  );
}
