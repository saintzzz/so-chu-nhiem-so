import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Material } from "@/types/tvc";
import { MaterialStatusBadge } from "@/components/tvc/status-badge";
import { FolderOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  lesson_plan: "KHBĐ",
  matrix: "Ma trận",
  exam: "Đề thi",
  worksheet: "Phiếu học tập",
  question_set: "Bộ câu hỏi",
  presentation: "Trình chiếu",
  rubric: "Rubric",
  other: "Khác",
};

export default async function StudioLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  const { type } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("tvc_materials")
    .select("id, title, type, tool_code, subject_code, grade, status, updated_at")
    .eq("author_id", profile.id)
    .order("updated_at", { ascending: false });
  if (type) q = q.eq("type", type);
  const { data } = await q.limit(100);
  const materials = (data as Partial<Material>[]) ?? [];

  // Reviewer xem hoc lieu truong dang cho duyet
  const isReviewer = ["to_truong", "bgh", "admin"].includes(profile.role);
  const { data: pendingData } = isReviewer
    ? await supabase
        .from("tvc_materials")
        .select("id, title, type, tool_code, subject_code, grade, status, updated_at")
        .neq("author_id", profile.id)
        .in("status", ["in_review", "totruong_ok"])
        .order("updated_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const pendingReview = (pendingData as Partial<Material>[]) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        section="Công cụ số giáo viên"
        title="Thư viện của tôi"
        description={`${materials.length} học liệu đã lưu - riêng tư theo tài khoản`}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { key: "", label: "Tất cả" },
          { key: "lesson_plan", label: "KHBĐ" },
          { key: "matrix", label: "Ma trận" },
          { key: "exam", label: "Đề thi" },
          { key: "worksheet", label: "Phiếu học tập" },
        ].map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/studio/library?type=${f.key}` : "/studio/library"}
            className={`rounded-full border px-3 py-1 text-sm ${
              (type ?? "") === f.key
                ? "border-primary bg-secondary font-semibold text-secondary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {pendingReview.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">
            Chờ duyệt của trường ({pendingReview.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-amber-500/40 bg-card shadow-sm">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {pendingReview.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/studio/library/${m.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {m.title}
                      </Link>
                      {m.tool_code && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {m.tool_code}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {TYPE_LABEL[m.type ?? ""] ?? m.type}
                    </td>
                    <td className="px-4 py-3">
                      <MaterialStatusBadge status={m.status!} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {formatDate(m.updated_at!)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {materials.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed bg-card p-12 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Chưa có học liệu nào.{" "}
            <Link href="/studio" className="text-primary hover:underline">
              Mở công cụ để biên soạn
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Loại</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Môn / Khối</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/library/${m.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {m.title}
                    </Link>
                    {m.tool_code && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {m.tool_code}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {TYPE_LABEL[m.type ?? ""] ?? m.type}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {m.subject_code ?? "-"} {m.grade ? `/ ${m.grade}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <MaterialStatusBadge status={m.status!} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatDate(m.updated_at!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
