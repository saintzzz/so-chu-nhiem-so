-- CR-055: index audit cho multi-tenant scale.
-- AC-55.1: activity_announcements school_id cho RLS early-pruning.
-- AC-55.2: emulation_scores (period, class_id) - ranking loc theo period.
-- AC-55.3: CONCURRENTLY - khong lock ghi khi them index.
create index concurrently if not exists idx_activity_announcements_school
  on public.activity_announcements (school_id);
create index concurrently if not exists idx_emulation_scores_period_class
  on public.emulation_scores (period, class_id);
