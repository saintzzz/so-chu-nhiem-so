import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { fmtDateVN } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  available: "Sẵn sàng",
  on_loan: "Đang mượn",
  lost: "Mất",
  damaged: "Hỏng",
};

// CR-066: so dang ky ca biet - an ban chuan Thu vien Quoc gia.
export default async function RegisterPage() {
  await requireRoles(["bgh", "admin"]);
  const supabase = await createClient();

  const copiesRes = await supabase
    .from("lib_copies")
    .select("accession_no, status, source, acquired_at, lib_books(title, author, publisher, price)")
    .order("accession_no")
    .limit(20000);

  if (copiesRes.error) {
    return (
      <div>
        <PageHeader section="Thư viện" title="Sổ đăng ký cá biệt" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }

  const rows = ((copiesRes.data ?? []) as unknown[]).map((r) => {
    const row = r as {
      accession_no: number; status: string; source: string | null; acquired_at: string;
      lib_books: { title: string; author: string | null; publisher: string | null; price: number | null } | null;
    };
    return { ...row, book: row.lib_books };
  });

  return (
    <div>
      <PageHeader section="Thư viện" title="Sổ đăng ký cá biệt" />
      <p className="mb-4 text-sm text-muted-foreground">
        Tổng {rows.length} bản sao. Số đăng ký cá biệt (ĐKCB) cấp tự động theo thứ tự nhập.
      </p>
      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">ĐKCB</th>
              <th className="px-4 py-3 font-medium">Tên sách</th>
              <th className="px-4 py-3 font-medium">Tác giả</th>
              <th className="px-4 py-3 font-medium">NXB</th>
              <th className="px-4 py-3 font-medium">Nguồn nhập</th>
              <th className="px-4 py-3 font-medium">Ngày nhập</th>
              <th className="px-4 py-3 font-medium">Tình trạng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.accession_no} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium tabular-nums">{r.accession_no}</td>
                <td className="px-4 py-3">{r.book?.title ?? "?"}</td>
                <td className="px-4 py-3">{r.book?.author ?? "-"}</td>
                <td className="px-4 py-3">{r.book?.publisher ?? "-"}</td>
                <td className="px-4 py-3">{r.source ?? "-"}</td>
                <td className="px-4 py-3">{fmtDateVN(r.acquired_at)}</td>
                <td className="px-4 py-3">{STATUS_LABEL[r.status] ?? r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Chưa có bản sao nào (0) - thêm sách ở trang Danh mục.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
