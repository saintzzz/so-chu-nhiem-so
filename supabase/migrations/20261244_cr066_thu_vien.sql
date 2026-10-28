-- CR-066: thu_vien - danh muc + so dang ky ca biet + muon/tra.
-- Quan ly = admin|bgh (thu thu kiem nhiem); staff cung truong doc danh
-- muc; HS doc sach dang muon cua minh. Ghi copy/loan chi qua RPC.

-- ===== 0) Module flag helper =====
create or replace function public.lib_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.school_features sf
    where sf.school_id = p_school and sf.module = 'thu_vien' and sf.enabled = false
  );
$$;

-- ===== 1) Bang =====
create table if not exists public.lib_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  title text not null,
  author text,
  publisher text,
  pub_year int,
  isbn text,
  category text,
  price numeric,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- So dang ky ca biet (DKCB) tang dan theo truong - pattern fee_receipt_seq.
create table if not exists public.lib_accession_seq (
  school_id uuid primary key references public.schools(id),
  next_no int not null default 1
);

create table if not exists public.lib_copies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  book_id uuid not null references public.lib_books(id) on delete cascade,
  accession_no int not null, -- so DKCB
  status text not null default 'available'
    check (status in ('available','on_loan','lost','damaged')),
  source text default 'mua',
  acquired_at date not null default now()::date,
  notes text,
  created_at timestamptz not null default now(),
  unique (school_id, accession_no)
);

create table if not exists public.lib_loans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  copy_id uuid not null references public.lib_copies(id),
  accession_no int, -- snapshot so DKCB luc muon (HS khong doc duoc lib_copies)
  book_title text, -- snapshot ten sach luc muon
  student_id uuid references public.students(id),
  teacher_id uuid references public.profiles(id),
  borrower_name text,
  borrower_label text, -- ten lop hoac "Giao vien"
  issued_by uuid references public.profiles(id),
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  return_condition text check (return_condition in ('ok','damaged','lost')),
  notes text,
  created_at timestamptz not null default now(),
  -- Nguoi muon: HS xor GV/staff
  check ((student_id is not null)::int + (teacher_id is not null)::int = 1)
);
-- 1 copy chi 1 loan dang mo.
create unique index if not exists lib_loans_open_copy
  on public.lib_loans (copy_id) where returned_at is null;
create index if not exists lib_loans_student on public.lib_loans (student_id) where returned_at is null;

-- ===== 2) RLS =====
alter table public.lib_books enable row level security;
alter table public.lib_copies enable row level security;
alter table public.lib_loans enable row level security;
alter table public.lib_accession_seq enable row level security;

create policy lib_books_read on public.lib_books for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[]);
create policy lib_books_write on public.lib_books for all
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin']::text[]
    and (select public.lib_module_enabled(school_id)))
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin']::text[]
    and (select public.lib_module_enabled(school_id)));

create policy lib_copies_read on public.lib_copies for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[]);
create policy lib_loans_read on public.lib_loans for select
  using (
    (student_id = (select st.id from public.students st where st.profile_id = auth.uid() limit 1))
    or (school_id = (select my_school_id())
      and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[])
  );
-- seq: khong doc truc tiep.
revoke all on public.lib_accession_seq from authenticated, anon;

-- Ghi copies/loans chi qua RPC: revoke DML truc tiep.
revoke insert, update, delete on public.lib_copies from authenticated, anon;
revoke insert, update, delete on public.lib_loans from authenticated, anon;
grant select on public.lib_copies to authenticated;
grant select on public.lib_loans to authenticated;

-- ===== 3) Trigger cross-tenant =====
create or replace function public.lib_copy_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.lib_books b
                 where b.id = new.book_id and b.school_id = new.school_id) then
    raise exception 'cross_school_book';
  end if;
  return new;
end $$;
drop trigger if exists lib_copy_tenant on public.lib_copies;
create trigger lib_copy_tenant before insert or update on public.lib_copies
  for each row execute function public.lib_copy_tenant();

create or replace function public.lib_loan_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.lib_copies c
                 where c.id = new.copy_id and c.school_id = new.school_id) then
    raise exception 'cross_school_copy';
  end if;
  if new.student_id is not null and not exists (
    select 1 from public.students st join public.classes c on c.id = st.class_id
    where st.id = new.student_id and c.school_id = new.school_id) then
    raise exception 'cross_school_student';
  end if;
  if new.teacher_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.teacher_id and p.school_id = new.school_id) then
    raise exception 'cross_school_teacher';
  end if;
  return new;
end $$;
drop trigger if exists lib_loan_tenant on public.lib_loans;
create trigger lib_loan_tenant before insert or update on public.lib_loans
  for each row execute function public.lib_loan_tenant();

-- ===== 4) RPC =====

-- Cap N so DKCB atomic theo truong (advisory lock + upsert).
create or replace function public.lib_next_accessions(p_school uuid, p_count int)
returns int[] language plpgsql security definer set search_path = public as $$
declare v_start int;
begin
  perform pg_advisory_xact_lock(hashtext(p_school::text || ':lib-acc'));
  insert into public.lib_accession_seq (school_id, next_no)
  values (p_school, 1)
  on conflict (school_id) do nothing;
  update public.lib_accession_seq set next_no = next_no + p_count
  where school_id = p_school returning next_no - p_count into v_start;
  return (select array_agg(v_start + g) from generate_series(0, p_count - 1) g);
end $$;

-- 4a) Them sach + N ban sao (cap DKCB).
create or replace function public.lib_add_book(
  p_title text, p_author text, p_publisher text, p_year int, p_isbn text,
  p_category text, p_price numeric, p_copies int, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_book uuid; v_nos int[]; i int;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.lib_module_enabled(v_school)) then raise exception 'module_disabled'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'invalid_title'; end if;

  insert into public.lib_books
    (school_id, title, author, publisher, pub_year, isbn, category, price, created_by)
  values (v_school, trim(p_title), nullif(trim(p_author),''), nullif(trim(p_publisher),''),
          p_year, nullif(trim(p_isbn),''), nullif(trim(p_category),''),
          p_price, auth.uid())
  returning id into v_book;

  p_copies := greatest(0, least(coalesce(p_copies, 0), 200));
  if p_copies > 0 then
    v_nos := public.lib_next_accessions(v_school, p_copies);
    for i in 1 .. array_length(v_nos, 1) loop
      insert into public.lib_copies (school_id, book_id, accession_no, source)
      values (v_school, v_book, v_nos[i], coalesce(nullif(p_source,''), 'mua'));
    end loop;
  end if;
  return jsonb_build_object('book_id', v_book, 'copies', p_copies);
end $$;

-- 4b) Them ban sao cho sach da co.
create or replace function public.lib_add_copies(p_book uuid, p_count int, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_nos int[]; i int; v_first int;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.lib_module_enabled(v_school)) then raise exception 'module_disabled'; end if;
  if not exists (select 1 from public.lib_books b where b.id = p_book and b.school_id = v_school) then
    raise exception 'book_not_found';
  end if;
  p_count := greatest(1, least(coalesce(p_count, 1), 200));
  v_nos := public.lib_next_accessions(v_school, p_count);
  for i in 1 .. array_length(v_nos, 1) loop
    insert into public.lib_copies (school_id, book_id, accession_no, source)
    values (v_school, p_book, v_nos[i], coalesce(nullif(p_source,''), 'mua'));
  end loop;
  return jsonb_build_object('added', p_count, 'first_no', v_nos[1]);
end $$;

-- 4c) Cho muon (atomic: UPDATE ... WHERE available chong double-checkout).
create or replace function public.lib_checkout(
  p_copy uuid, p_student uuid, p_teacher uuid, p_days int, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_copy record; v_name text; v_label text; v_loan uuid; v_days int;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.lib_module_enabled(v_school)) then raise exception 'module_disabled'; end if;
  if (p_student is not null)::int + (p_teacher is not null)::int <> 1 then
    raise exception 'borrower_xor';
  end if;

  -- Khoa copy + doi available atomically.
  update public.lib_copies set status = 'on_loan'
  where id = p_copy and school_id = v_school and status = 'available'
  returning id into v_copy;
  if not found then
    if exists (select 1 from public.lib_copies where id = p_copy and school_id = v_school) then
      raise exception 'not_available';
    end if;
    raise exception 'copy_not_found';
  end if;

  -- snapshot DKCB + ten sach vao loan (HS khong doc duoc lib_copies).
  select c.accession_no, b.title as book_title into v_copy
  from public.lib_copies c join public.lib_books b on b.id = c.book_id
  where c.id = p_copy;

  if p_student is not null then
    select st.full_name, c.name into v_name, v_label
    from public.students st join public.classes c on c.id = st.class_id
    where st.id = p_student and c.school_id = v_school;
    if not found then raise exception 'student_not_found'; end if;
  else
    select p.full_name, 'Giáo viên' into v_name, v_label
    from public.profiles p where p.id = p_teacher and p.school_id = v_school;
    if not found then raise exception 'teacher_not_found'; end if;
  end if;

  v_days := greatest(1, least(coalesce(p_days, 14), 90));
  insert into public.lib_loans
    (school_id, copy_id, accession_no, book_title, student_id, teacher_id,
     borrower_name, borrower_label, issued_by, due_at, notes)
  values (v_school, p_copy, v_copy.accession_no, v_copy.book_title,
          p_student, p_teacher, v_name, v_label,
          auth.uid(), now() + (v_days || ' days')::interval, nullif(trim(p_note),''))
  returning id into v_loan;
  return jsonb_build_object('loan_id', v_loan, 'due_days', v_days);
end $$;

-- 4d) Tra sach: ok -> available; damaged/lost -> copy status tuong ung.
create or replace function public.lib_return(p_loan uuid, p_condition text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_loan record; v_status text;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.lib_module_enabled(v_school)) then raise exception 'module_disabled'; end if;
  p_condition := coalesce(nullif(p_condition,''), 'ok');
  if p_condition not in ('ok','damaged','lost') then raise exception 'invalid_condition'; end if;

  update public.lib_loans
  set returned_at = now(), return_condition = p_condition,
      notes = case when nullif(trim(p_note),'') is not null
                   then coalesce(notes || E'\n', '') || trim(p_note) else notes end
  where id = p_loan and school_id = v_school and returned_at is null
  returning * into v_loan;
  if not found then
    if exists (select 1 from public.lib_loans where id = p_loan and school_id = v_school) then
      raise exception 'already_returned';
    end if;
    raise exception 'loan_not_found';
  end if;

  v_status := case p_condition when 'ok' then 'available' else p_condition end;
  update public.lib_copies set status = v_status where id = v_loan.copy_id;
  return jsonb_build_object('loan_id', v_loan.id, 'copy_status', v_status);
end $$;

-- ===== 5) Grants =====
revoke all on function public.lib_module_enabled(uuid) from public;
grant execute on function public.lib_module_enabled(uuid) to authenticated, anon;
-- helper noi bo: chi goi tu RPC definer, khong expose PostgREST
-- (can revoke PUBLIC - execute mac dinh cap cho public)
revoke all on function public.lib_next_accessions(uuid, int) from public, authenticated, anon;
grant execute on function public.lib_add_book(text, text, text, int, text, text, numeric, int, text) to authenticated;
grant execute on function public.lib_add_copies(uuid, int, text) to authenticated;
grant execute on function public.lib_checkout(uuid, uuid, uuid, int, text) to authenticated;
grant execute on function public.lib_return(uuid, text, text) to authenticated;
