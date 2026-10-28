# ARCH-1M: Lộ trình kiến trúc tới 1 triệu người dùng

Ngày: 28/10/2026 · Phân tích Tech Lead · Thay đổi quyết định cần PO duyệt.
Bối cảnh: yêu cầu đánh giá "microservice + monorepo" cho mục tiêu 1M users.
Ruling cũ (CR-059 §G, MEMORY): modular monolith + tách tenant khi scale.
Tài liệu này làm rõ con đường kỹ thuật cụ thể - giữ ruling đó nhưng mô tả
đầy đủ khi nào và làm thế nào tách.

## 1. Hiện trạng (fact từ repo)

- Monolith: Next.js 16.4.2 App Router, 1 deploy duy nhất (Vercel, push master).
- Backend: Supabase 1 project Postgres (compute Micro) + Auth + RLS ~351 policies.
- Domain: 14 module keys `school_features`, ~30 route groups, RLS mọi bảng.
- Đã tách sẵn theo tinh thần "worker": AI async job + callback (`ai_jobs`,
  `/api/ai/devin-callback`), TTS provider chain, export route handlers.
- Scaling hardening đã làm: CR-057 wrap `auth.uid()`, FK indexes, revoke
  EXECUTE anon, ANALYZE sau reseed; CR-058 deferred (tách schema practice).

## 2. 1M users nghĩa là gì (ước lượng trung thực)

- ~500-1,000 trường × 1,000-2,000 user (HS+GV+PH cùng 1 con ≈ 2-3 account/HS).
- DAU giả định 10-20% → 100-200k; peak đồng thời sáng sớm điểm danh +
  chiều PH xem điểm: 20-60k session.
- Write burst: điểm danh 1 buổi ≈ 1M HS → ~1M upsert/`attendance_records`
  trong 30-60 phút (~300-600 w/s đỉnh). Grading/kỳ thi burst tương tự.
- **Row growth là kẻ giết người**: attendance ~180M rows/năm;
  notifications, audit_logs, messages cùng bậc; grades ~40 cột×HK×môn.
- Public traffic: cổng tuyển sinh `/apply` + tra cứu - profile khác hẳn
  (anonymous, burst theo mùa, attack surface cao).

Kết luận kỹ thuật: **nút thắt là Postgres (connections, RLS cost, row
volume, write IOPS), KHÔNG phải Next.js** (stateless, scale ngang vô hạn
trên Vercel). Microservice tách code không chạm được nút thắt này trừ khi
tách cả dữ liệu - và đó chính là "tenant sharding", không phải
microservice theo domain.

## 3. Đánh giá các phương án

| Phương án | Giải quyết 1M? | Chi phí/rủi ro cho team này |
|---|---|---|
| Microservice theo domain trên 1 DB | Không - DB vẫn nghẽn; thêm distributed txn | Cao: N deploy, tracing, độ phức tạp > lợi ích |
| Microservice + DB riêng từng service | Có, nhưng overkill + phá cross-module flows (điểm↔học bạ↔thu phí cùng transaction) | Rất cao: eventual consistency trong nghiệp vụ trường học là ác mộng |
| **Modular monolith + workers + tenant sharding** | **Có - đúng nút thắt** | **Vừa phải, đi từng bước chứng minh được** |
| Serverless-ize (Supabase edge fns) | Một phần | Đã có sẵn; không thay đổi DB |

**Khuyến nghị: giữ monolith module hóa, chuẩn hóa thành monorepo đa
package, tách worker theo profile tải, shard theo tenant khi >~15-50
trường.** "Microservice" chỉ áp dụng cho đúng các đơn vị có profile tải/
rủi ro khác biệt - liệt kê ở §4, và tất cả vẫn nằm trong 1 monorepo.

## 4. Monorepo đề xuất (pnpm + turbo workspaces)

```
apps/
  web/          # (app) staff shell hiện tại - core product
  public/       # TÁCH: /apply tuyển sinh + tra cứu (anonymous, burst,
                # threat surface riêng) - Next app nhẹ, share packages
  docs/         # (optional) trang tài liệu/marketing sau này
packages/
  db/           # supabase clients, migrations, generated types, RLS helpers
  domain/       # tt22.ts, hocba.ts, fee calc, validations - pure TS, test được
  ui/           # shadcn primitives + app components dùng chung
  config/       # eslint, tsconfig, tailwind tokens
workers/
  ai/           # AI generation pipeline (đã async qua ai_jobs + Devin)
  notify/       # email/digest/Zalo-sau: queue consumer Resend + webhook
  export/       # docx/pdfmake render nặng CPU - queue job, trả signed URL
  integrations/ # CR-072 connectors + outbox (QD3016, payment webhook)
```

Giá trị thực của monorepo: domain logic (TT22, học phí, học bạ XML) thành
**package pure-TS test được**, share giữa web/public/workers; deploy unit
độc lập chỉ nơi cần thiết. Đây là 80% lợi ích "microservice" với 20%
chi phí.

## 5. Roadmap theo ngưỡng trường

### Phase A — nay → ~15 trường (~20-30k users) [làm sớm]
- Supabase **Pro + compute Small→Large** trước khi trường thật vào
  (đã ghi HANDOVER + MEMORY - Micro throttle đã thấy trong QA).
- Supavisor transaction pooling (OPS-supavisor.md); giới hạn connection
  per instance; check `check-perf.mjs` vào CI.
- Partition theo tháng: `attendance_records`, `audit_logs`, `notifications`,
  `period_absences` - declarative partition, retention theo năm học.
- Monorepo restructure (pnpm/turbo) - KHÔNG đổi deploy, chỉ tổ chức code.
- Observability: Sentry + structured request log + per-tenant metric
  (supabase logs drain). Alert: p95, 5xx, queue depth `ai_jobs`.
- PITR backup khi có trường thật (daily backup đủ cho demo, không đủ cho
  dữ liệu hợp đồng).

### Phase B — 15-100 trường (~100-200k users)
- **Tách `apps/public`**: cổng apply/tra cứu deploy riêng (Vercel project
  riêng), đọc/ghi qua RPC scoped - cách ly burst tuyển sinh + attack
  surface khỏi app nhân viên.
- Read replica cho báo cáo nặng: dept dashboards, finance reports,
  hoc-ba export batch → route read-only qua replica.
- Worker `export` + `notify` thành service container riêng (queue-driven;
  Vercel function giới hạn duration - job dài đã thấy timeout DB).
- Cache nav/module-flags/profile vào edge KV (đã React-cache per request;
  thêm cross-request cache TTL ngắn).
- Materialize scope tables cho RLS policy nặng (`scn_my_scope_*` → bảng
  duy trì bằng trigger) khi policy cost đo được là bottleneck.

### Phase C — 100-1,000 trường (~1M users)
- **Tenant sharding**: nhiều Supabase project (mỗi cụm ~100-200 trường
  theo vùng); control-plane DB map school→cluster; proxy routing theo
  `school_id` claim. Đây là "microservice" đúng nghĩa cho scale này:
  blast-radius theo cụm tenant, schema giống nhau, migrate đồng bộ.
- Compute-heavy thành service riêng ngoài Vercel (Fly/ECS): export
  batch, TTS, AI worker - scale theo queue, giá rẻ hơn function lớn.
- Data warehouse cho analytics xuyên trường/cấp Sở (đồng bộ CDC →
  Parquet/BigQuery hoặc Postgres riêng read-optimized) - dept/cross-
  cluster báo cáo không dội vào OLTP.
- Archive năm học cũ ra cold tables/storage (giữ hot DB gọn).

### Phase D — chỉ khi chứng minh cần (>1M hoặc team lớn)
- Tách microservice theo domain khi: team >10-15 dev cùng đụng 1 codebase,
  cadence deploy khác nhau thật, hoặc service có SLA/stack khác biệt
  (vd: integration layer, public API cho Bộ GD).
- Lúc đó monorepo + packages/domain sẵn sàng cho việc tách - đó là lý do
  đầu tư monorepo sớm hơn là viết service.

## 6. Checklist kỹ thuật cụ thể nên làm NGAY (không phụ thuộc scale)

1. Partition `attendance_records` (bảng lớn nhất, growth tuyến tính theo HS).
2. `pg_cron`/edge job ANALYZE định kỳ sau seed/batch lớn (bài học MEMORY).
3. Batch-view materialized cho dashboard gvcn/dept (refresh 1-5 phút).
4. Rate-limit + Turnstile đã có login - mở rộng `/apply` public (CR-054 lớp 2).
5. Giới hạn export per user (đã cap 20/h - giữ) + export lớp chạy qua queue.
6. IaC: migrations replay-safe (đang tốt), seed idempotent, `check-*` trong CI.
7. Contract tests cho packages/domain khi tách (tt22 đã có 29 test - giữ pattern).

## 7. Rủi ro & lựa chọn thay thế

- **Vercel cost ở 1M**: bandwidth + function minutes đắt - Phase C cân
  nhắc self-host compute nặng trên container (đã ghi). Web tier vẫn giữ
  Vercel được (stateless, rẻ theo request).
- **Supabase single-project ceiling**: Postgres đứng rất cao (XL/2XL +
  replica) nhưng RLS-per-request + connection pooling là giới hạn thật →
  sharding theo tenant là câu trả lời đúng, và `school_id` scope đã có
  sẵn mọi bảng = sharding key tự nhiên.
- **Supavisor/đối tác**: nếu cần thoát Supabase hosted → self-host
  Postgres + Supavisor hoặc dịch sang RDS/Cloud SQL; schema chuẩn
  Postgres nên migrate được (không lock-in cứng, trừ Auth/Storage).
- **Không làm**: per-domain microservice sớm, Kubernetes, event sourcing,
  schema-per-school (phá migration sync), multi-master.

## 8. Tóm tắt cho PO

- Microservice theo domain **không phải** câu trả lời cho 1M - DB/tenant
  scale mới là. Đề xuất: **monorepo đa package + modular monolith +
  worker theo tải + shard theo cụm trường** - đúng ruling CR-059, lần này
  kèm bản đồ từng bước và ngưỡng kích hoạt.
- Việc cần duyệt: (a) nâng Supabase Pro+Small ngay khi trường pilot vào;
  (b) monorepo restructure làm CR riêng (effort ~2-3 ngày, không đổi
  deploy); (c) tách `apps/public` khi mở tuyển sinh cho trường thật;
  (d) Phase B/C chỉ kích hoạt theo ngưỡng - không trả tiền trước.
