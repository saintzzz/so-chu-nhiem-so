-- CR-049 round-6 (Codex r6, commit bedef17) fixes.
-- H2  delete-all lam mat revision CAS -> grade_book_state ben vung
-- H3  unique key thieu academic_year_id
-- M9  enqueue khong resume qua 20k PH -> pending-parents RPC

-- ===== H2: revision ben vung per gradebook scope =====================
-- Xoa het diem -> max(updated_at)=NULL -> stale writer duoc chap nhan.
-- Bang nay ghi nhan MOI lan luu (ke ca luu tap rong) trong cung lock.
create table if not exists public.grade_book_state (
  scope_key text primary key,
  last_saved_at timestamptz not null default now()
);

alter table public.grade_book_state enable row level security;
-- Chi ghi qua scn_save_grades (caller la staff co quyen grades);
-- client khong can doc truc tiep.
create policy grade_book_state_staff on public.grade_book_state
  for all to authenticated
  using ((select is_staff()))
  with check ((select is_staff()));

create or replace function public.scn_save_grades(
  p_student_ids uuid[], p_subject_id uuid, p_term text, p_rows jsonb,
  p_expected_max timestamptz default null,
  p_academic_year_id uuid default null
) returns void language plpgsql
 set search_path to 'public'
as $function$
declare
  v_max timestamptz;
  v_state timestamptz;
  v_year uuid;
  v_scope text;
begin
  select coalesce(p_academic_year_id, c.academic_year_id) into v_year
    from public.students s
    join public.classes c on c.id = s.class_id
   where s.id = p_student_ids[1];
  v_scope := p_subject_id::text || '|' || p_term || '|'
             || coalesce(v_year::text, '');
  perform pg_advisory_xact_lock(hashtextextended(v_scope, 0));
  select max(g.updated_at) into v_max
    from public.grades g
   where g.student_id = any(p_student_ids)
     and g.subject_id = p_subject_id
     and g.term = p_term
     and (g.academic_year_id is null or g.academic_year_id = v_year);
  -- H2: revision cua gradebook (ke ca lan xoa het truoc do).
  select s.last_saved_at into v_state
    from public.grade_book_state s where s.scope_key = v_scope;
  if p_expected_max is not null
     and greatest(coalesce(v_max, '-infinity'::timestamptz),
                  coalesce(v_state, '-infinity'::timestamptz))
         > p_expected_max then
    raise exception 'stale_write' using errcode = 'P0001';
  end if;
  delete from public.grades g
   where g.student_id = any(p_student_ids)
     and g.subject_id = p_subject_id
     and g.term = p_term
     and (g.academic_year_id is null or g.academic_year_id = v_year);
  insert into public.grades (
    student_id, subject_id, term, entered_by, subtype,
    assessment_type, seq, level, score, comment, result, updated_at,
    academic_year_id
  )
  select (r->>'student_id')::uuid, p_subject_id, p_term, auth.uid(),
         coalesce(r->>'subtype', ''), r->>'assessment_type',
         (r->>'seq')::smallint, r->>'level', (r->>'score')::numeric,
         r->>'comment', r->>'result', now(),
         coalesce(p_academic_year_id, c.academic_year_id)
    from jsonb_array_elements(p_rows) as r
    left join public.students st on st.id = (r->>'student_id')::uuid
    left join public.classes c on c.id = st.class_id;
  -- clock_timestamp(): now() khong doi trong 1 transaction - hai save
  -- cung tx (batch/script) van phai xep dung thu tu cho CAS.
  insert into public.grade_book_state (scope_key, last_saved_at)
  values (v_scope, clock_timestamp())
  on conflict (scope_key) do update set last_saved_at = clock_timestamp();
end
$function$;

-- ===== H3: unique key theo nam hoc ===================================
-- Constraint cu thieu academic_year_id -> luu diem nam moi cho cung
-- HS+mon+term+seq vi pham unique (diem nam cu da duoc bao toan).
-- Constraint khong ho tro expression -> chuyen sang unique INDEX voi
-- coalesce (rows year NULL legacy van giu tinh duy nhat).
alter table public.grades
  drop constraint if exists grades_student_subject_term_type_seq_key;

create unique index if not exists grades_scope_year_uidx
  on public.grades (
    student_id, subject_id, term, assessment_type, subtype, seq,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ===== M9: enqueue resume qua 20k PH =================================
-- Scan keyset reset moi invocation -> PH thu 20001 khong bao gio toi.
-- RPC tra danh sach PH chua co outbox row + chua gui 'sent' tuan nay,
-- keyset theo parents.id -> moi run chi quet phan chua xu ly.
create or replace function public.scn_digest_pending_parents(
  p_week date, p_after uuid, p_limit int
) returns table(id uuid, full_name text, email text)
 language sql stable security definer
 set search_path to 'public'
as $function$
  select p.id, p.full_name, p.email
    from public.parents p
   where p.email is not null
     and p.email not ilike '%.scn'
     and p.id > p_after
     and not exists (
       select 1 from public.digest_outbox o
        where o.week_start = p_week and o.parent_id = p.id)
     and not exists (
       select 1 from public.digest_deliveries d
        where d.week_start = p_week and d.parent_id = p.id
          and d.status = 'sent')
   order by p.id
   limit p_limit
$function$;

revoke all on function public.scn_digest_pending_parents(date, uuid, int)
  from public, anon, authenticated;
grant execute on function public.scn_digest_pending_parents(date, uuid, int)
  to service_role;
