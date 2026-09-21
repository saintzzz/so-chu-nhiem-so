-- CR-004: tách trường sổ đầu bài + subtype điểm ĐĐGtx (miệng/15ph/1tiết)
ALTER TABLE public.period_logs
  ADD COLUMN IF NOT EXISTS lesson_title text,
  ADD COLUMN IF NOT EXISTS lesson_content text,
  ADD COLUMN IF NOT EXISTS teacher_comment text;

UPDATE public.period_logs
SET teacher_comment = note
WHERE teacher_comment IS NULL AND note IS NOT NULL;

ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS subtype text;

-- subtype bắt buộc (chuỗi rỗng = ĐĐGtx chung/dữ liệu cũ) + đưa vào unique key
UPDATE public.grades SET subtype = '' WHERE subtype IS NULL;
ALTER TABLE public.grades ALTER COLUMN subtype SET DEFAULT '';
ALTER TABLE public.grades ALTER COLUMN subtype SET NOT NULL;
ALTER TABLE public.grades DROP CONSTRAINT grades_student_subject_term_type_seq_key;
ALTER TABLE public.grades ADD CONSTRAINT grades_student_subject_term_type_seq_key
  UNIQUE (student_id, subject_id, term, assessment_type, subtype, seq);
