"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { matchTransaction, saveBankConfig } from "@/app/(app)/finance/actions";
import { VIETQR_BANKS } from "@/lib/vietqr";
import { formatDateTime, formatMoney } from "@/lib/utils";

interface BankCfg {
  bank_code?: string;
  account_number?: string;
  account_name?: string;
}
interface Txn {
  id: string;
  external_id: string;
  gateway: string | null;
  txn_date: string | null;
  amount: number;
  code: string | null;
  content: string | null;
  reference_code: string | null;
  match_status: string;
  invoice_id: string | null;
}
interface OpenInvoice {
  id: string;
  payment_code: string | null;
  amount: number;
  paid_amount: number;
  exemption_amount: number;
  students: { full_name: string; classes: { name: string } | { name: string }[] | null } | null;
}

const fmtMoney = formatMoney;

export function IntegrationsBoard({
  bank,
  sepayEnabled,
  transactions,
  openInvoices,
  canWrite,
}: {
  bank: BankCfg;
  sepayEnabled: boolean;
  transactions: Txn[];
  openInvoices: OpenInvoice[];
  canWrite: boolean;
}) {
  const [bankCode, setBankCode] = useState(bank.bank_code ?? "VCB");
  const [accNo, setAccNo] = useState(bank.account_number ?? "");
  const [accName, setAccName] = useState(bank.account_name ?? "");
  const [sepay, setSepay] = useState(sepayEnabled);
  const [matchTxnId, setMatchTxnId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const invoiceLabel = (i: OpenInvoice) => {
    const s = i.students;
    const st = Array.isArray(s) ? s[0] : s;
    const cl = st?.classes;
    const cname = Array.isArray(cl) ? cl[0]?.name : cl?.name;
    return `${st?.full_name ?? "?"} - ${cname ?? "?"} - ${fmtMoney(i.amount - i.exemption_amount - i.paid_amount)} (${i.payment_code ?? "?"})`;
  };

  function saveCfg(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await saveBankConfig({
        bank_code: bankCode,
        account_number: accNo,
        account_name: accName,
        sepay_enabled: sepay,
      });
      if (r?.error) setErr(r.error);
    });
  }

  function doMatch() {
    if (!matchTxnId || !invoiceId) return;
    setErr(null);
    start(async () => {
      const r = await matchTransaction(matchTxnId, invoiceId);
      if (r?.error) setErr(r.error);
      else setMatchTxnId(null);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveCfg} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="font-medium">Tài khoản nhận chuyển khoản</p>
        <div className="flex flex-wrap gap-3">
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {VIETQR_BANKS.map((b) => (
              <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
            ))}
          </select>
          <input value={accNo} onChange={(e) => setAccNo(e.target.value)}
            placeholder="Số tài khoản" required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-52" />
          <input value={accName} onChange={(e) => setAccName(e.target.value)}
            placeholder="Tên chủ TK (in HOA không dấu)" required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sepay} onChange={(e) => setSepay(e.target.checked)} />
            Đối soát tự động qua SePay
          </label>
          {canWrite && <Button type="submit" disabled={pending}>Lưu cấu hình</Button>}
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <p className="text-xs text-muted-foreground">
          Mã QR VietQR sẽ tự tạo trên từng hóa đơn. SePay webhook endpoint:
          <code className="mx-1 rounded bg-muted px-1">/api/webhooks/sepay</code>
          (cấu hình API key trong dashboard SePay).
        </p>
      </form>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-medium mb-3">Giao dịch ngân hàng ({transactions.length})</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Thời gian</th>
                  <th className="py-2 pr-3">NH</th>
                  <th className="py-2 pr-3">Số tiền</th>
                  <th className="py-2 pr-3">Mã</th>
                  <th className="py-2 pr-3">Nội dung</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  {canWrite && <th className="py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 whitespace-nowrap">{t.txn_date ? formatDateTime(t.txn_date) : "-"}</td>
                    <td className="py-2 pr-3">{t.gateway ?? "-"}</td>
                    <td className="py-2 pr-3 tabular-nums font-medium">{fmtMoney(t.amount)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{t.code ?? "-"}</td>
                    <td className="py-2 pr-3 max-w-64 truncate" title={t.content ?? ""}>{t.content ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {t.match_status === "matched" ? (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-xs">Đã khớp</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-xs">Chưa khớp</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="py-2 text-right">
                        {t.match_status !== "matched" && (
                          <Button size="sm" variant="outline" onClick={() => { setMatchTxnId(t.id); setInvoiceId(""); }}>
                            Gán hóa đơn
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {matchTxnId && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <p className="font-medium">Gán giao dịch vào hóa đơn còn nợ</p>
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">- Chọn hóa đơn -</option>
            {openInvoices.map((i) => {
              const rem = i.amount - i.paid_amount;
              const txn = transactions.find((t) => t.id === matchTxnId);
              const warn = txn && txn.amount > rem ? ` - ⚠ CK vượt nợ ${fmtMoney(rem)}, sẽ tính đúng nợ` : "";
              return <option key={i.id} value={i.id}>{invoiceLabel(i)}{warn}</option>;
            })}
          </select>
          <div className="flex gap-2">
            <Button onClick={doMatch} disabled={!invoiceId || pending}>Xác nhận gán</Button>
            <Button variant="outline" onClick={() => setMatchTxnId(null)}>Hủy</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Hóa đơn điện tử (ND123)</p>
        <p className="mt-1">
          Khung tích hợp sẵn sàng (bảng einvoice_requests). Kết nối nhà cung cấp
          (MISA/SInvoice/BKAV) cần hợp đồng + credentials - xem
          docs/project/BACKLOG-CREDENTIALS.md.
        </p>
      </div>
    </div>
  );
}
