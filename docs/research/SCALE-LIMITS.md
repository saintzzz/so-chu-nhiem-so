# SCALE ASSESSMENT - kien truc hien tai o quy mo lon

Cau hoi: nhieu truong + nhieu nguoi dung, kien truc dap ung khong?
Tra loi: du cho quy mo **hang tram truong** voi cac cai tien duoi; quy mo ngan
truong can them tang partitioning/read-replica. Honest limits:

## Diem nghen that (theo thu tu sap cham toi)

1. **Postgres don node** - bottleneck so 1. Supabase 1 instance + Supavisor.
   - Hien da dung: `(select my_school_id())` cached-per-query, composite index
     theo school_id tren moi bang nong, RPC-only writes.
   - Lam NGAY (re): index (status,next_retry_at) cho outbox; materialized view
     cho dashboard/report queries; chron archive cho attendance_records +
     student_record_history + notifications (append-only, tang nhanh nhat).
   - Khi can (trigger: >~50 truong active hoac >~10 trieu rows/bang nong): read
     replica cho report queries; partition attendance/notifications theo
     (school_id hoac month); archive nam hoc cu sang schema cold.
   - Xa hon (>1000 truong): tenant sharding - moi region 1 Supabase project,
     routing theo school -> day la "microservice" that su cho DATA layer; gio
     khong can.

2. **RLS policy cost** - moi query chay my_roles()/my_school_id().
   - Da dung `(select ...)` scalar form (cache trong query). Giu quy tac nay.
   - Khi scale: chuyen cac bang nong sang pattern `security definer view` hoac
     session GUC set mot lan.

3. **Serverless limits** - Vercel function timeout + cold start.
   - Trang nang (dashboard, reports) -> stream/defer AI calls (repo law),
     materialized view thay vi aggregate live.
   - Mutation nang (issue 435 invoices) -> da bat dau pattern batch RPC; tiep
     tuc cho report gen/extract.

4. **AI/external calls trong request path** - timeout + retry.
   - Rule: heavy work qua outbox + cron worker (CR-072) - gom ca email, webhook,
     Ministry push, AI batch gen.

5. **Rate limiting** - admissions da co (Turnstile + rate limit). Mo rong:
     per-tenant rate limit tren mutation RPCs khi co nhieu truong lon (defer -
     khong phai bay gio).

6. **Observability** - hien chi co console log. Khi co khach that: Sentry DSN
     (env) - da co MCP/dep; bat qua env khi can.

## Limitation khong giai quyet bang "them microservice"

- Deployment model khong phai limit so 1 - DB la. Tach 4 service van chung 1
  Postgres thi khong thay doi gi; tach DB moi can, va khi do bounded contexts
  (lib_/sm_/lms_/fee_) san sang.

## Checklist chuan bi da lam

- [x] Composite index school-scoped tren bang nong
- [x] RPC-only write boundary (de tach service sau)
- [x] Module flag kill-switch (khong anh huong tenant khac khi them tinh nang)
- [x] Async pattern cho mutation lon (fee_issue_period batch)
- [x] Cron worker pattern (parent-digest, radar-sync)
- [ ] CR-072: outbox + connectors + retry/DLQ (dang lam)
- [ ] Materialized views cho dashboards (CR-071 kem theo)
- [ ] Archive strategy nam hoc (CR-07x)
