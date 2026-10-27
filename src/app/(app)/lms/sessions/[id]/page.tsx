import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { fmtDateTimeVN } from "@/lib/utils";
import { compareVietnameseName, sortByVietnameseName } from "@/lib/utils";

type SubRow = {
  student_id: string;
  student_name: string;
  status: string;
  score: number | null;
  max_score: number | null;
  essay_pending: boolean;
  submitted_at: string | null;
};

export default async function LmsSessionResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRoles(["gvbm", "gvcn", "to_truong", "bgh", "admin", "so_gd"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("lms_session_results", {
    p_session: id,
  });
  const res = data as {
    title?: string;
    closes_at?: string;
    submissions?: SubRow[];
    not_started?: string[];
  } | null;

  if (error || !res) {
    const msg = error?.message.includes("session_not_found")
      ? "Không tìm thấy bài giao."
      : "Không tải được dữ liệu - vui lòng thử lại.";
    return (
      <div>
        <PageHeader section="Bài tập trực tuyến" title="Kết quả" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          {msg}
        </p>
      </div>
    );
  }

  const subs = sortByVietnameseName(res.submissions ?? [], (s) => s.student_name);
  const notStarted = res.not_started ?? [];

  return (
    <div>
      <PageHeader section="Bài tập trực tuyến" title={res.title ?? "Kết quả"} />
      <p className="mb-4 text-sm text-muted-foreground">
        Đóng lúc {res.closes_at ? fmtDateTimeVN(res.closes_at) : "-"} · Đã nộp{" "}
        {subs.filter((s) => s.status === "submitted").length}/{subs.length + notStarted.length} học sinh
      </p>
      <DataTable columns={["Học sinh", "Trạng thái", "Điểm tự động", "Nộp lúc"]}>
        {subs.map((s) => (
          <tr key={s.student_id}>
            <td className="font-medium">{s.student_name}</td>
            <td className="text-muted-foreground">
              {s.status === "submitted" ? "Đã nộp" : "Đang làm"}
              {s.essay_pending ? " · chờ chấm tự luận" : ""}
            </td>
            <td>
              {s.status === "submitted"
                ? `${s.score ?? 0}/${s.max_score ?? 0}`
                : "-"}
            </td>
            <td className="text-muted-foreground">
              {s.submitted_at ? fmtDateTimeVN(s.submitted_at) : "-"}
            </td>
          </tr>
        ))}
        {subs.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-muted-foreground">
              Chưa có học sinh nào làm bài.
            </td>
          </tr>
        )}
      </DataTable>
      {notStarted.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa làm bài ({notStarted.length}):{" "}
          {[...notStarted].sort((a, b) => compareVietnameseName(a, b)).join(", ")}
        </p>
      )}
    </div>
  );
}
