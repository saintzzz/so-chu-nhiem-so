"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

export function SelfAssessmentForm({
  teacherId,
  yearId,
  assessmentId,
  initialReview,
  initialPlan,
  status,
}: {
  teacherId: string;
  yearId: string;
  assessmentId: string | null;
  initialReview: string;
  initialPlan: string;
  status: string;
}) {
  const router = useRouter();
  const [review, setReview] = useState(initialReview);
  const [plan, setPlan] = useState(initialPlan);
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = status === "reviewed" || status === "approved";

  async function save(nextStatus: "draft" | "submitted") {
    setSaving(nextStatus);
    setMessage(null);
    setError(null);
    const supabase = createClient();
    try {
      const payload = {
        self_review: review.trim() === "" ? null : review.trim(),
        plan: plan.trim() === "" ? null : plan.trim(),
        status: nextStatus,
      };
      if (assessmentId) {
        const { error: e } = await supabase
          .from("teacher_assessments")
          .update(payload)
          .eq("id", assessmentId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase
          .from("teacher_assessments")
          .insert({
            teacher_id: teacherId,
            academic_year_id: yearId,
            ...payload,
          });
        if (e) throw e;
      }
      setMessage(
        nextStatus === "submitted"
          ? "Đã nộp đánh giá cho tổ trưởng xem xét."
          : "Đã lưu nháp.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu đánh giá");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      {locked && (
        <p className="mb-4 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
          Đánh giá đã được tổ trưởng xem xét/phê duyệt - nội dung chỉ để xem.
        </p>
      )}

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-medium">
          Tự đánh giá năng lực
        </span>
        <span className="mb-1.5 block text-xs text-muted-foreground">
          Nhận định về công tác chủ nhiệm, điểm mạnh và hạn chế trong năm học
        </span>
        <AutoGrowTextarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          disabled={locked}
          placeholder="Ví dụ: Hoàn thành tốt nhiệm vụ chủ nhiệm, duy trì tỷ lệ chuyên cần cao..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
        />
      </label>

      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm font-medium">
          Kế hoạch phát triển
        </span>
        <span className="mb-1.5 block text-xs text-muted-foreground">
          Mục tiêu và việc cần làm để nâng cao năng lực trong năm học tới
        </span>
        <AutoGrowTextarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          disabled={locked}
          placeholder="Ví dụ: Nâng cao kỹ năng tư vấn học sinh, tham gia tập huấn chuyên môn..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {!locked && (
          <>
            <Button
              variant="outline"
              onClick={() => void save("draft")}
              disabled={saving !== null}
            >
              <Save />
              {saving === "draft" ? "Đang lưu..." : "Lưu nháp"}
            </Button>
            <Button
              onClick={() => void save("submitted")}
              disabled={saving !== null}
            >
              <Send />
              {saving === "submitted" ? "Đang nộp..." : "Nộp đánh giá"}
            </Button>
          </>
        )}
        {message && (
          <span className="rounded-lg bg-success-bg px-3 py-1.5 text-sm text-success">
            {message}
          </span>
        )}
        {error && (
          <span className="rounded-lg bg-error-bg px-3 py-1.5 text-sm text-error">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
