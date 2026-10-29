# CR-078: Kenh thong bao PH - Zalo OA/ZNS + SMS outbox

## Nguon yeu cau
Kenh PH hien tai chi email (Resend). Doi thu gui Zalo/SMS.
Zalo ZNS can OA + template approval + access token; SMS can provider
account -> ca 2 deu credentials. Build khung day du, connector no-op
khi chua co key.

## Quyet dinh nghiep vu
- comm_outbox: hang doi tin nhan theo kenh (email|zalo|sms), co retry
  backoff, idempotent theo (channel, dedupe_key).
- Connector Zalo ZNS: src/lib/comm/zalo.ts doc config tu
  school_integrations.provider='zalo_oa' (access_token, template ids).
  Thieu config -> status 'skipped_no_credentials' (khong loi).
- Cron /api/cron/comm-outbox (CRON_SECRET) drain queue: attempts < 5,
  backoff 2^attempts phut.
- Wire sendAnnouncement: them buoc enqueue zalo/sms cho PH co
  parents.phone khi school bat channel.

## Scope
- comm_outbox table + RLS (ghi authenticated staff; doc bgh/admin/ke_toan).
- comm channel config tren school_integrations.
- Cron route + lib comm.
- UI: /school/announce hoac /finance -> khong bat buoc (backlog UI
  trang thai outbox - chi can API + admin xem).

## Impact
- sendAnnouncement gioi han them enqueue - khong doi hanh vi email.
- parents.phone da co san (dung cho admissions).

## AC
- AC-78.1: comm_outbox schema + status flow + retry attempts.
- AC-78.2: cron route fail-closed thieu CRON_SECRET; drain dung backoff.
- AC-78.3: zalo connector skipped_no_credentials khi chua config; co
  config gia -> goi fetch endpoint dung (mock test).
- AC-78.4: sendAnnouncement enqueue zalo cho PH co phone khi channel on.
- AC-78.5: RLS tenant + role; khong lo noi dung sai truong.

## Out of scope
- ZNS template approval flow tren Zalo (ngoai he thong).
- SMS provider selection (eSMS/SpeedSMS) - chi interface.
