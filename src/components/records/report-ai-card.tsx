import { Sparkles } from "lucide-react";
import { generateText } from "@/lib/ai";

interface ReportStats {
  name: string;
  size: number;
  attendancePct: number | null;
  avgScore: number | null;
  violations: number;
}

/**
 * Server component gọi LLM — bọc trong <Suspense> để page render ngay
 * (stats/table/chart) còn phần phân tích AI stream vào sau, không chặn TTFB.
 */
export async function ReportAiCard({
  stats,
  fallbackNarrative,
}: {
  stats: ReportStats[];
  fallbackNarrative: string[];
}) {
  const aiText =
    stats.length > 0
      ? await generateText(
          `Dữ liệu tổng hợp các lớp (JSON): ${JSON.stringify(
            stats.map((s) => ({
              lop: s.name,
              si_so: s.size,
              chuyen_can_pct: s.attendancePct,
              diem_tb: s.avgScore,
              vi_pham: s.violations,
            })),
          )}. Hãy viết 3-5 nhận xét phân tích ngắn gọn bằng tiếng Việt cho giáo viên chủ nhiệm/ban giám hiệu: lớp nổi bật, lớp cần chú ý, xu hướng và 1-2 đề xuất hành động cụ thể. Mỗi nhận xét một dòng, không đánh số, không ký tự đầu dòng.`,
          {
            system:
              "Bạn là trợ lý phân tích dữ liệu giáo dục cho trường phổ thông Việt Nam. Trả lời ngắn gọn, thực tế, không emoji.",
            maxTokens: 1024,
          },
        )
      : null;
  const aiNarrative = aiText
    ? aiText
        .split(/\n+/)
        .map((l) => l.replace(/^[\s\-*•\d.)\]]+/, "").trim())
        .filter(Boolean)
    : null;
  const narrative =
    aiNarrative && aiNarrative.length > 0 ? aiNarrative : fallbackNarrative;
  const aiUsed = Boolean(aiNarrative && aiNarrative.length > 0);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary-bg p-4 shadow-[var(--shadow-sm-token)]">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-primary">
          {aiUsed ? "Phân tích AI" : "Gợi ý (phân tích tự động)"}
        </h2>
      </div>
      {narrative.length > 0 ? (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
          {narrative.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chưa đủ dữ liệu để tạo gợi ý.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {aiUsed
          ? "Nội dung do AI tạo từ số liệu thống kê của lớp - chỉ mang tính tham khảo, giáo viên cần rà soát trước khi dùng."
          : "Gợi ý được sinh tự động từ số liệu thống kê của lớp - chỉ mang tính tham khảo."}
      </p>
    </div>
  );
}

export function ReportAiCardSkeleton() {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary-bg p-4 shadow-[var(--shadow-sm-token)]">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-4 animate-pulse text-primary" />
        <h2 className="text-sm font-semibold text-primary">
          Đang phân tích dữ liệu…
        </h2>
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-primary/10" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-primary/10" />
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-primary/10" />
      </div>
    </div>
  );
}
