import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";

import { formatMoney as fmt } from "@/lib/utils";

export default async function FeeReportsPage() {
  await requireRoles(["ke_toan", "bgh", "admin", "so_gd"]);
  const supabase = await createClient();

  const { data: periods, error: e1 } = await supabase
    .from("fee_periods")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  const { data: invoices, error: e2 } = await supabase
    .from("fee_invoices")
    .select("period_id, student_id, amount, exemption_amount, paid_amount, status, students(classes(name))")
    .limit(5000);
  if (e1 || e2) {
    return (
      <div>
        <PageHeader section="Khoản thu" title="Báo cáo thu chi" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }

  type InvRow = {
    period_id: string;
    amount: number;
    exemption_amount: number;
    paid_amount: number;
    status: string;
    students: { classes: { name: string } | { name: string }[] | null } | { classes: { name: string }[] }[] | null;
  };
  const rows = ((invoices ?? []) as InvRow[]).map((r) => {
    const stu = Array.isArray(r.students) ? r.students[0] : r.students;
    const cls = Array.isArray(stu?.classes) ? stu.classes[0] : stu?.classes;
    return { ...r, class_name: cls?.name ?? null };
  });

  // Tong hop theo dot thu.
  const byPeriod = new Map<string, { due: number; paid: number; count: number; unpaid: number }>();
  for (const r of rows) {
    const cur = byPeriod.get(r.period_id) ?? { due: 0, paid: 0, count: 0, unpaid: 0 };
    cur.due += r.amount - r.exemption_amount;
    cur.paid += r.paid_amount;
    cur.count += 1;
    if (r.status === "unpaid" || r.status === "partial") cur.unpaid += 1;
    byPeriod.set(r.period_id, cur);
  }

  // Tong hop theo lop.
  const byClass = new Map<string, { due: number; paid: number; unpaid: number }>();
  for (const r of rows) {
    const cls = r.class_name ?? "Không lớp";
    const cur = byClass.get(cls) ?? { due: 0, paid: 0, unpaid: 0 };
    cur.due += r.amount - r.exemption_amount;
    cur.paid += r.paid_amount;
    if (r.status === "unpaid" || r.status === "partial") cur.unpaid += 1;
    byClass.set(cls, cur);
  }
  const classRows = [...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));

  const totalDue = rows.reduce((s, r) => s + (r.amount - r.exemption_amount), 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid_amount, 0);

  return (
    <div>
      <PageHeader section="Khoản thu" title="Báo cáo thu chi" />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <p className="text-sm text-muted-foreground">Tổng phải thu</p>
          <p className="text-2xl font-semibold tabular-nums">{fmt(totalDue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <p className="text-sm text-muted-foreground">Đã thu</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <p className="text-sm text-muted-foreground">Công nợ còn lại</p>
          <p className="text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">{fmt(totalDue - totalPaid)}</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-2">Theo đợt thu</h2>
      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)] mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Đợt thu</th>
              <th className="px-4 py-3 font-medium">Số hóa đơn</th>
              <th className="px-4 py-3 font-medium">Phải thu</th>
              <th className="px-4 py-3 font-medium">Đã thu</th>
              <th className="px-4 py-3 font-medium">Còn nợ</th>
              <th className="px-4 py-3 font-medium">HS chưa đủ</th>
            </tr>
          </thead>
          <tbody>
            {(periods ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Chưa có dữ liệu.</td></tr>
            )}
            {(periods ?? []).map((p) => {
              const s = byPeriod.get(p.id) ?? { due: 0, paid: 0, count: 0, unpaid: 0 };
              return (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums">{s.count}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(s.due)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(s.paid)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(s.due - s.paid)}</td>
                  <td className="px-4 py-3 tabular-nums">{s.unpaid}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold mb-2">Theo lớp</h2>
      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Lớp</th>
              <th className="px-4 py-3 font-medium">Phải thu</th>
              <th className="px-4 py-3 font-medium">Đã thu</th>
              <th className="px-4 py-3 font-medium">Còn nợ</th>
              <th className="px-4 py-3 font-medium">HS chưa đủ</th>
            </tr>
          </thead>
          <tbody>
            {classRows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Chưa có dữ liệu.</td></tr>
            )}
            {classRows.map(([cls, s]) => (
              <tr key={cls} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-medium">{cls}</td>
                <td className="px-4 py-3 tabular-nums">{fmt(s.due)}</td>
                <td className="px-4 py-3 tabular-nums">{fmt(s.paid)}</td>
                <td className="px-4 py-3 tabular-nums">{fmt(s.due - s.paid)}</td>
                <td className="px-4 py-3 tabular-nums">{s.unpaid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
