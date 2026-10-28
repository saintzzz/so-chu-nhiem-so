import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { BooksBoard, type LibBookRow } from "@/components/library/books-board";

export default async function LibraryPage() {
  await requireRoles(["bgh", "admin"]);
  const supabase = await createClient();

  const [booksRes, copiesRes, loansRes] = await Promise.all([
    supabase
      .from("lib_books")
      .select("id, title, author, publisher, pub_year, isbn, category, price, created_at")
      .order("title")
      .limit(2000),
    supabase
      .from("lib_copies")
      .select("id, book_id, status")
      .limit(50000),
    supabase
      .from("lib_loans")
      .select("id", { count: "exact", head: true })
      .is("returned_at", null),
  ]);

  const srcErr = booksRes.error ?? copiesRes.error ?? loansRes.error;
  if (srcErr) {
    return (
      <div>
        <PageHeader section="Thư viện" title="Danh mục sách" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }

  const stats = new Map<string, { total: number; available: number; on_loan: number; other: number }>();
  for (const c of copiesRes.data ?? []) {
    const s = stats.get(c.book_id) ?? { total: 0, available: 0, on_loan: 0, other: 0 };
    s.total += 1;
    if (c.status === "available") s.available += 1;
    else if (c.status === "on_loan") s.on_loan += 1;
    else s.other += 1;
    stats.set(c.book_id, s);
  }

  const books = ((booksRes.data ?? []) as Omit<LibBookRow, "stats">[]).map((b) => ({
    ...b,
    stats: stats.get(b.id) ?? { total: 0, available: 0, on_loan: 0, other: 0 },
  })) as LibBookRow[];

  return (
    <div>
      <PageHeader section="Thư viện" title="Danh mục sách" />
      <BooksBoard books={books} openLoans={loansRes.count ?? 0} />
    </div>
  );
}
