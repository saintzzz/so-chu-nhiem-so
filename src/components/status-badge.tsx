import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  primary: "bg-primary-bg text-primary",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
      )}
    >
      {label}
    </span>
  );
}

/** vi-VN label+tone maps for domain statuses */
export const ATT_STATUS = {
  present: { label: "Có mặt", tone: "success" as const },
  excused: { label: "Vắng có phép", tone: "warning" as const },
  unexcused: { label: "Vắng không phép", tone: "error" as const },
  late: { label: "Đi muộn", tone: "warning" as const },
};

export const SEVERITY = {
  low: { label: "Thấp", tone: "muted" as const },
  medium: { label: "Trung bình", tone: "warning" as const },
  high: { label: "Cao", tone: "error" as const },
  critical: { label: "Nghiêm trọng", tone: "error" as const },
};

export const FLOW_STATUS = {
  draft: { label: "Nháp", tone: "muted" as const },
  pending: { label: "Chờ duyệt", tone: "warning" as const },
  approved: { label: "Đã duyệt", tone: "success" as const },
  done: { label: "Hoàn thành", tone: "success" as const },
  cancelled: { label: "Đã hủy", tone: "muted" as const },
  rejected: { label: "Từ chối", tone: "error" as const },
  new: { label: "Mới", tone: "primary" as const },
  following: { label: "Đang theo dõi", tone: "warning" as const },
  resolved: { label: "Đã xử lý", tone: "success" as const },
  archived: { label: "Lưu trữ", tone: "muted" as const },
  proposed: { label: "Đề xuất", tone: "primary" as const },
  confirmed: { label: "Đã xác nhận", tone: "success" as const },
  in_progress: { label: "Đang thực hiện", tone: "primary" as const },
  submitted: { label: "Đã nộp", tone: "primary" as const },
  reviewed: { label: "Đã xem xét", tone: "warning" as const },
  signed: { label: "Đã ký", tone: "success" as const },
  locked: { label: "Đã khóa", tone: "muted" as const },
  registered: { label: "Đã đăng ký", tone: "primary" as const },
  assessing: { label: "Đang đánh giá", tone: "warning" as const },
  counseling: { label: "Đang tư vấn", tone: "primary" as const },
  referred: { label: "Đã chuyển tuyến", tone: "primary" as const },
  dismissed: { label: "Đã bỏ qua", tone: "muted" as const },
  active: { label: "Đang hoạt động", tone: "success" as const },
  transferred: { label: "Đã chuyển", tone: "muted" as const },
  graduated: { label: "Đã tốt nghiệp", tone: "muted" as const },
  suspended: { label: "Đình chỉ", tone: "error" as const },
};
