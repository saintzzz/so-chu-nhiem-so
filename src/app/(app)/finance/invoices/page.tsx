import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { hasAnyRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { InvoicesBoard, type Invoice } from "@/components/finance/invoices-board";

export default async function FeeInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await requireRoles(["ke_toan", "bgh", "admin", "so_gd"]);
  const canWrite = hasAnyRole(profile, ["ke_toan", "bgh", "admin"]);
  const { period: periodParam } = await searchParams;
  const supabase = await createClient();

  const { data: periods, error: periodsErr } = await supabase
    .from("fee_periods")
    .select("id, name, status")
    .order("created_at", { ascending: false });
  if (periodsErr) {
    return (
      <div>
        <PageHeader section="Khoản thu" title="Hóa đơn & thu tiền" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }
  const periodList = (periods ?? []) as { id: string; name: string; status: string }[];
  const selected =
    periodList.find((p) => p.id === periodParam) ??
    periodList.find((p) => p.status === "issued") ??
    periodList[0];

  let invoices: Invoice[] = [];
  let invoicesErr = false;
  if (selected) {
    const { data, error } = await supabase
      .from("fee_invoices")
      .select("id, student_id, amount, exemption_amount, paid_amount, status, receipt_no, students(full_name, classes(name))")
      .eq("period_id", selected.id)
      .limit(2000);
    if (error) {
      invoicesErr = true;
    } else {
      invoices = (data ?? []).map((row) => {
        const raw = Array.isArray(row.students) ? row.students[0] : row.students;
        const stu = raw as { full_name: string; classes: { name: string } | { name: string }[] | null } | null;
        const cls = Array.isArray(stu?.classes) ? stu.classes[0] : stu?.classes;
        return {
          id: row.id,
          student_id: row.student_id,
          amount: row.amount,
          exemption_amount: row.exemption_amount,
          paid_amount: row.paid_amount,
          status: row.status,
          receipt_no: row.receipt_no,
          student_name: stu?.full_name ?? "?",
          class_name: cls?.name ?? "?",
        } as Invoice;
      });
    }
  }

  return (
    <div>
      <PageHeader section="Khoản thu" title="Hóa đơn & thu tiền" />
      <div className="mb-4 flex flex-wrap gap-2">
        {periodList.map((p) => (
          <Link key={p.id} href={`/finance/invoices?period=${p.id}`}
            className={`rounded-full px-3 py-1.5 text-sm border ${p.id === selected?.id ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground"}`}>
            {p.name}
          </Link>
        ))}
        {periodList.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có đợt thu nào - tạo ở trang Đợt thu.</p>
        )}
      </div>
      {invoicesErr ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      ) : (
        <InvoicesBoard invoices={invoices} canWrite={canWrite} />
      )}
    </div>
  );
}
