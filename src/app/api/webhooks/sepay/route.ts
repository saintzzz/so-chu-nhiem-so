import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/sepay - nhan giao dich ngan hang tu SePay,
 * match payment_code -> fee_invoices -> fee_payments (atomic RPC).
 *
 * Auth: header `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`
 * (dashboard SePay -> Webhooks -> API key). Thieu env -> 503 fail-closed.
 *
 * SePay retry Fibonacci toi da 7 lan khi response != 200 - handler
 * idempotent bang (provider='sepay', external_id) unique.
 *
 * Match: payload.code (SePay trich theo cau truc ma thanh toan da cau
 * hinh) HOAC regex SCN[A-Z0-9]{8} trong content -> invoice.payment_code.
 */
interface SepayPayload {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string;
  code?: string | null;
  content?: string;
  transferType?: string;
  transferAmount?: number;
  referenceCode?: string;
}

const CODE_RE = /\bSCN[A-Z0-9]{8}\b/;

export async function POST(req: NextRequest) {
  const key = process.env.SEPAY_WEBHOOK_API_KEY;
  if (!key) {
    console.error("[sepay] missing SEPAY_WEBHOOK_API_KEY");
    return NextResponse.json({ error: "disabled" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Apikey ${key}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const p = (await req.json().catch(() => null)) as SepayPayload | null;
  if (!p || p.id == null || typeof p.transferAmount !== "number") {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  if (p.transferType !== "in") {
    // chi tien vao - bo qua giao dich ra.
    return NextResponse.json({ success: true });
  }

  const supabase = createAdminClient();
  const code =
    p.code?.trim().toUpperCase() ||
    (p.content ? CODE_RE.exec(p.content.toUpperCase())?.[0] : undefined);

  // Resolve invoice + school bang payment_code truoc khi ghi txn.
  let invoice: { id: string; school_id: string; amount: number; paid_amount: number } | null = null;
  if (code) {
    const { data: inv, error: invErr } = await supabase
      .from("fee_invoices")
      .select("id, school_id, amount, paid_amount, status")
      .eq("payment_code", code)
      .maybeSingle();
    if (invErr) {
      console.error("[sepay] invoice lookup:", invErr.message);
      return NextResponse.json({ success: false }, { status: 500 });
    }
    if (inv && inv.status !== "paid" && inv.status !== "exempt") {
      invoice = inv;
    }
  }

  // Khong resolve duoc invoice: van luu raw vao truong cua txn account?
  // school_id bat buoc - neu khong match, gan theo school qua
  // school_integrations.bank.account_number khop accountNumber.
  let schoolId = invoice?.school_id;
  if (!schoolId) {
    const { data: integ, error: integErr } = await supabase
      .from("school_integrations")
      .select("school_id")
      .eq("provider", "bank")
      .eq("enabled", true)
      .filter("config->>account_number", "eq", p.accountNumber ?? "")
      .limit(1)
      .maybeSingle();
    if (integErr) {
      console.error("[sepay] bank lookup:", integErr.message);
      return NextResponse.json({ success: false }, { status: 500 });
    }
    schoolId = integ?.school_id;
  }
  if (!schoolId) {
    // Khong thuoc truong nao minh quan ly -> van tra 200 de SePay khong
    // retry vo ich, nhung khong ghi gi (log de debug).
    console.log("[sepay] unmatched txn:", p.id, p.accountNumber, code ?? "-");
    return NextResponse.json({ success: true });
  }

  const { data: txn, error: insErr } = await supabase
    .from("bank_transactions")
    .insert({
      school_id: schoolId,
      provider: "sepay",
      external_id: String(p.id),
      gateway: p.gateway ?? null,
      txn_date: p.transactionDate ?? null,
      account_number: p.accountNumber ?? null,
      code: code ?? null,
      content: p.content ?? null,
      amount: p.transferAmount,
      reference_code: p.referenceCode ?? null,
      invoice_id: invoice?.id ?? null,
      match_status: invoice ? "matched" : "unmatched",
      raw: p as unknown as Record<string, unknown>,
    })
    .select("id")
    .maybeSingle();
  if (insErr) {
    if (insErr.code === "23505") {
      // retry/replay - giao dich da ghi nhan.
      return NextResponse.json({ success: true });
    }
    console.error("[sepay] txn insert:", insErr.message);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  if (invoice && txn?.id) {
    const { error: rpcErr } = await supabase.rpc("fee_record_transfer", {
      p_invoice: invoice.id,
      p_amount: p.transferAmount,
      p_method: "bank_auto",
      p_note: `SePay ${p.gateway ?? ""} ${p.referenceCode ?? ""}`.trim(),
      p_txn: txn.id,
    });
    if (rpcErr) {
      console.error("[sepay] fee_record_transfer:", rpcErr.message);
      // invoice da qua han/thay doi trang thai giua luc resolve va insert.
      // cas-ok: CAS da dat tren cot match_status='matched' (scanner chi
      // dem cot 'status' nguyen - match_status khong match regex).
      const { error: upErr } = await supabase
        .from("bank_transactions")
        .update({ match_status: "unmatched", invoice_id: null })
        .eq("id", txn.id)
        .eq("match_status", "matched")
        .select("id");
      if (upErr) console.error("[sepay] txn unmatch:", upErr.message);
      return NextResponse.json({ success: true });
    }
  }
  return NextResponse.json({ success: true });
}
