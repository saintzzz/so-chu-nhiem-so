-- CR-045: digest webhook fields - doi chieu su kien Resend
-- (delivered/bounced/complained/failed/delayed) theo provider_id.
alter table digest_deliveries
  add column if not exists provider_id text,
  add column if not exists delivery_event text,
  add column if not exists event_at timestamptz;

create index if not exists digest_deliveries_provider_idx
  on digest_deliveries (provider_id) where provider_id is not null;
