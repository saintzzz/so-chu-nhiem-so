# CR-072: Integration framework - connectors + outbox + worker

## Why
Can chuan bi dau noi CSDL Bo GD (nap diem), Google/MS (OneRoster/SDS), payment,
Zalo OA, va cac API khac. Luat: khong fake integration - xay KHUNG san sang,
connector cu the dien khi co credential. Phuc vu ca scale: moi external call
ra khoi request path.

## Module
Module ban kem `tich_hop` (school_features). Tat flag = mat nav + route deny +
RPC module_disabled + read gate.

## Scope
- `int_connectors`: cau hinh connector per truong (type, endpoint, auth_type,
  secret_name - TEN env chu khong gia tri secret, config jsonb, enabled).
  Types: webhook|custom|ministry_gd|vnpay|zalo_oa|google_classroom|ms_teams.
- `int_outbox`: event queue transactional (event_type, payload, status
  pending/processing/sent/failed/dead, attempts, next_retry_at backoff bac 2,
  last_error, idempotency_key unique per school).
- `int_inbox`: inbound event log (source, signature, idem_key unique - chong
  replay/double-process).
- RPC security-definer: int_upsert_connector/int_delete_connector (bgh|admin),
  int_enqueue (bgh|admin + definer callers), int_dequeue/int_mark (service_role),
  int_retry (bgh|admin). Direct write revoke.
- Worker `/api/cron/integration-worker`: Bearer CRON_SECRET, drain 20 events
  FOR UPDATE SKIP LOCKED, dispatch theo connector type (webhook POST +
  X-SCN-Signature HMAC, ministry_gd envelope stub -> credentials_required khi
  chua config), timeout 10s, exponential backoff, dead sau 6 attempts.
- Admin UI `/school/integrations`: connectors CRUD + outbox monitor + retry +
  test event. bgh|admin.
- Ministry CSDL: skeleton san sang (envelope + signing hook); credentials/spec
  chinh thuc -> BACKLOG-CREDENTIALS #2.
- OneRoster provider (SDS): CR-073 tiep theo - framework nay host no.

## Impact
- Khong cham bang nghiep vu hien co (chi bang int_* moi).
- Outbox la nen cho cross-module events sau nay (bien_dong->attendance notify...).
- Tenant trigger: connector_id cung school.

## Test
Static + live: enqueue -> worker drain -> sent; endpoint loi -> failed ->
retry -> dead; idempotency dedup; module off; role deny; direct write denied.
