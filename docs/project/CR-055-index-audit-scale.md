# CR-055 - Index audit cho multi-tenant scale + ranking query

## What / Why

Audit live DB (2026-10-23) sau quyet dinh PO ve lo trinh scale 1000 truong:
- Tat ca bang tenant schema `tvc` da co leading `school_id` index.
- Public schema: chi 2 gap thuc te.
  1. `activity_announcements` chi co PK tren `activity_id` - thieu index
     `school_id` cho RLS early-pruning khi bang lon dan.
  2. `emulation_scores` - trang `/emulation/ranking` loc theo `period`
     don le (unique index hien tai la (class_id, criterion_id, period),
     khong match query). Can composite `(period, class_id)`.

Materialized view cho ranking: DEFER - emulation_scores con nho
(vai nghin rows), MV la gold-plating o quy mo nay. Re-anchor khi
>200 truong hoac emulation_scores >500k rows.

## Acceptance criteria

- AC-55.1: `activity_announcements` co index tren `school_id`.
- AC-55.2: `emulation_scores` co index `(period, class_id)`.
- AC-55.3: index tao bang CONCURRENTLY - khong lock ghi.
- AC-55.4: migration luu trong `supabase/migrations/` - reproducible.

## Impact

- DB: 2 index nho, them ~vai KB. Khong doi code, khong doi RLS.
- Risk: rat thap - chi them index.
