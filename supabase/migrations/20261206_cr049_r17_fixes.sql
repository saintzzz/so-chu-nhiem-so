-- CR-049 r17 finding 4: luu pack de thi (chinh + du phong) trong MOT
-- transaction. Truoc day route insert tung buoc (exam -> questions ->
-- exam du phong -> questions); loi giua chung de lai exam khong cau
-- hoi, va 500 sau khi exam chinh da ton tai -> retry tao them de.
-- RPC SECURITY INVOKER: RLS insert van ap dung cho caller; function
-- rollback nguyen khi bat ky insert nao loi (atomic semantics).

create or replace function public.scn_save_exam_pack(
  p_matrix_id uuid,
  p_exams jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  ex jsonb;
  new_id uuid;
  out_ids uuid[] := '{}';
begin
  if jsonb_typeof(p_exams) <> 'array' or jsonb_array_length(p_exams) = 0 then
    raise exception 'p_exams phai la array khong rong';
  end if;
  for ex in select * from jsonb_array_elements(p_exams) loop
    insert into tvc_exams (
      owner_id, matrix_id, title, subject_code, grade, total_points, config
    ) values (
      auth.uid(),
      p_matrix_id,
      ex ->> 'title',
      ex ->> 'subject_code',
      (ex ->> 'grade')::int,
      (ex ->> 'total_points')::numeric,
      coalesce(ex -> 'config', '{}'::jsonb)
    )
    returning id into new_id;
    insert into tvc_exam_questions (
      exam_id, question_id, position, points, needs_review
    )
    select
      new_id,
      (q ->> 'question_id')::uuid,
      (q ->> 'position')::int,
      (q ->> 'points')::numeric,
      coalesce((q ->> 'needs_review')::boolean, false)
    from jsonb_array_elements(coalesce(ex -> 'questions', '[]'::jsonb)) q;
    out_ids := out_ids || new_id;
  end loop;
  return jsonb_build_object('exam_ids', to_jsonb(out_ids));
end;
$$;

revoke all on function public.scn_save_exam_pack(uuid, jsonb) from public, anon;
grant execute on function public.scn_save_exam_pack(uuid, jsonb) to authenticated;
