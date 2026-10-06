const LABEL: Record<string, string> = {
  draft: "Nháp",
  personal: "Cá nhân",
  pending_review: "Chờ duyệt",
  in_review: "Đang duyệt",
  published: "Đã xuất bản",
  rejected: "Bị từ chối",
  withdrawn: "Đã rút",
};

const COLOR: Record<string, string> = {
  draft: "bg-muted text-slate-300",
  personal: "bg-sky-400/15 text-sky-300",
  pending_review: "bg-amber-400/20 text-amber-300",
  in_review: "bg-violet-400/15 text-violet-300",
  published: "bg-emerald-400/15 text-emerald-300",
  rejected: "bg-destructive/20 text-red-300",
  withdrawn: "bg-muted text-slate-400",
};

export function MaterialStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[status] ?? COLOR.draft}`}
    >
      {LABEL[status] ?? status}
    </span>
  );
}
