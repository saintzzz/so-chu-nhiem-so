-- CR-004: tách trường sổ đầu bài + subtype điểm ĐĐGtx (miệng/15ph/1tiết)
ALTER TABLE public.period_logs
  ADD COLUMN IF NOT EXISTS lesson_title text,
  ADD COLUMN IF NOT EXISTS lesson_content text,
  ADD COLUMN IF NOT EXISTS teacher_comment text;

UPDATE public.period_logs
SET teacher_comment = note
WHERE teacher_comment IS NULL AND note IS NOT NULL;

ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS subtype text;
