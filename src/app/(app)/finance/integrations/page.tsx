import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { hasAnyRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { IntegrationsBoard } from "@/components/finance/integrations-board";

export default async function IntegrationsPage() {
  const profile = await requireRoles(["ke_toan", "bgh", "admin"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: bank }, { data: sepay }, { data: txns }, { data: unpaid }] =
    await Promise.all([
      must(supabase
        .from("school_integrations")
        .select("config")
        .eq("school_id", sid)
        .eq("provider", "bank")
        .maybeSingle(), "integ bank"),
      must(supabase
        .from("school_integrations")
        .select("enabled")
        .eq("school_id", sid)
        .eq("provider", "sepay")
        .maybeSingle(), "integ sepay"),
      must(supabase
        .from("bank_transactions")
        .select("id, external_id, gateway, txn_date, amount, code, content, reference_code, match_status, invoice_id")
        .eq("school_id", sid)
        .order("created_at", { ascending: false })
        .limit(50), "transactions"),
      must(supabase
        .from("fee_invoices")
        .select("id, payment_code, amount, paid_amount, exemption_amount, students(full_name, classes(name))")
        .eq("school_id", sid)
        .in("status", ["unpaid", "partial"])
        .order("created_at", { ascending: false })
        .limit(200), "open invoices"),
    ]);

  const cfg = (bank?.config ?? {}) as {
    bank_code?: string;
    account_number?: string;
    account_name?: string;
  };

  return (
    <div>
      <PageHeader
        section="Khoản thu"
        title="Tích hợp thanh toán"
        description="Cấu hình tài khoản nhận chuyển khoản (VietQR) và đối soát giao dịch tự động qua SePay."
      />
      <IntegrationsBoard
        bank={cfg}
        sepayEnabled={sepay?.enabled ?? false}
        transactions={(txns ?? []) as never[]}
        openInvoices={(unpaid ?? []) as never[]}
        canWrite={hasAnyRole(profile, ["bgh", "admin", "ke_toan"])}
      />
    </div>
  );
}
