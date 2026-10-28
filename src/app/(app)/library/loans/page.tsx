import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  LoansBoard,
  type LibLoanRow,
  type CopyOpt,
  type StudentOpt,
  type TeacherOpt,
} from "@/components/library/loans-board";

export default async function LoansPage() {
  await requireRoles(["bgh", "admin"]);
  const supabase = await createClient();

  const [loansRes, copiesRes, studentsRes, teachersRes, classesRes] = await Promise.all([
    supabase
      .from("lib_loans")
      .select("id, borrower_name, borrower_label, borrowed_at, due_at, accession_no, book_title")
      .is("returned_at", null)
      .order("due_at")
      .limit(2000),
    supabase
      .from("lib_copies")
      .select("id, accession_no, lib_books(title)")
      .eq("status", "available")
      .order("accession_no")
      .limit(50000),
    supabase
      .from("students")
      .select("id, full_name, classes(name)")
      .limit(5000),
    supabase
      .from("profiles")
      .select("id, full_name")
      .not("full_name", "is", null)
      .order("full_name")
      .limit(500),
    supabase
      .from("classes")
      .select("id, name, grade")
      .order("grade")
      .order("name")
      .limit(300),
  ]);

  const srcErr = loansRes.error ?? copiesRes.error ?? studentsRes.error ?? teachersRes.error ?? classesRes.error;
  if (srcErr) {
    return (
      <div>
        <PageHeader section="Thư viện" title="Mượn & trả sách" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }

  const loans = ((loansRes.data ?? []) as {
    id: string; borrower_name: string | null; borrower_label: string | null;
    borrowed_at: string; due_at: string; accession_no: number | null; book_title: string | null;
  }[]).map((r) => ({
    id: r.id,
    borrower_name: r.borrower_name ?? "?",
    borrower_label: r.borrower_label ?? "",
    borrowed_at: r.borrowed_at,
    due_at: r.due_at,
    accession_no: r.accession_no ?? 0,
    book_title: r.book_title ?? "?",
  })) as LibLoanRow[];

  const copies = ((copiesRes.data ?? []) as unknown[]).map((r) => {
    const row = r as { id: string; accession_no: number; lib_books: { title: string } | { title: string }[] | null };
    const book = Array.isArray(row.lib_books) ? row.lib_books[0] : row.lib_books;
    return { id: row.id, accession_no: row.accession_no, book_title: book?.title ?? "?" };
  }) as CopyOpt[];

  const students = ((studentsRes.data ?? []) as unknown[]).map((r) => {
    const row = r as { id: string; full_name: string; classes: { name: string } | { name: string }[] | null };
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    return { id: row.id, full_name: row.full_name, class_name: cls?.name ?? "?" };
  }) as StudentOpt[];

  return (
    <div>
      <PageHeader section="Thư viện" title="Mượn & trả sách" />
      <LoansBoard
        loans={loans}
        copies={copies}
        students={students}
        teachers={(teachersRes.data ?? []) as TeacherOpt[]}
        classes={(classesRes.data ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
