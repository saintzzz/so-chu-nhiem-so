# CR-077: Thanh toan online + khung hoa don dien tu

## Nguon yeu cau
Gap "Cao" tu COMPETITIVE-GAP-2026-10-28: /finance co khoan thu/bien lai
nhung chua co cong thanh toan. Muc tieu: PH chuyen khoan co ma dinh danh,
he thong tu doi soat va ghi nhan thanh toan.

## Quyet dinh nghiep vu
- Cong chinh: VietQR dong + webhook doi soat kieu SePay. VietQR tao anh QR
  free (img.vietqr.io) - khong can merchant account. SePay can API key ->
  credential skeleton san sang, gan key la chay.
- Moi invoice co `payment_code` (SCN + 8 ky tu) - PH ghi vao noi dung CK.
- Webhook /api/webhooks/sepay nhan transaction, match payment_code ->
  ghi fee_payments(method='transfer') + cap nhat invoice + receipt_no.
- Idempotent: (provider, external_id) unique - SePay retry toi da 7 lan.
- E-invoice ND123: skeleton einvoice_requests + backlog (can provider
  MISA/SInvoice/BKAV contract - credentials).

## Scope
- school_integrations (per-school provider config, service-role read only).
- bank_transactions (raw webhook, dedupe external_id).
- fee_invoices.payment_code.
- RPC fee_record_transfer (insert payment + recalc status, atomic).
- /api/webhooks/sepay fail-closed khi thieu SEPAY_WEBHOOK_API_KEY.
- UI: /finance/invoices QR button + page /finance/integrations (ke_toan/
  bgh/admin) + list giao dich.
- Proxy: /api/webhooks/* da whitelist san.

## Impact
- Migration moi; fee_payments.method them 'bank_auto'.
- Notifications cho ke_toan khi match thanh cong; cho PH khi co email.

## AC
- AC-77.1: invoice co payment_code duy nhat; QR VietQR render dung bank.
- AC-77.2: webhook fail-closed thieu key; sai key -> 401; dung key + code
  khop -> fee_payments row + invoice status cap nhat; retry cung external_id
  khong tao duplicate payment.
- AC-77.3: code khong khop -> luu unmatched, ke_toan gan tay invoice ->
  reconcile RPC.
- AC-77.4: einvoice_requests skeleton + doc credentials backlog.
- AC-77.5: roles ke_toan/bgh/admin; so_gd read; RLS tenant.

## Out of scope
- Momo/VNPay contract gateways, refund, partial-match split.
- Provider e-invoice that (can hop dong CA don vi).
