-- CR-066 r1: dong findings external review.
-- r1-1: validate borrower TRUOC khi doi copy (ro rang hon, van atomic).
-- r1-2: lib_return update copy kem school + on_loan predicate.
-- r1-3: revoke PUBLIC/anon tren moi lib_* RPC (default grant con sot).
-- r1-4: read policies gan lib_module_enabled (module off = off ca PostgREST).
-- r1-5: CHECK tren lib_books cho direct-write surface.
-- r1-6: lib_loans.copy_id -> on delete restrict (khong xoa lich su muon).

-- ===== r1-6) FK restrict =====
alter table public.lib_loans drop constraint if exists lib_loans_copy_id_fkey;
alter table public.lib_loans add constraint lib_loans_copy_id_fkey
  foreign key (copy_id) references public.lib_copies(id) on delete restrict;

-- ===== r1-5) CHECK lib_books =====
alter table public.lib_books
  add constraint lib_books_title_nn check (btrim(title) <> ''),
  add constraint lib_books_price_nn check (price is null or price >= 0),
  add constraint lib_books_year_ok check (pub_year is null or pub_year between 1800 and 2100);

-- ===== r1-4) module flag trong read policies =====
drop policy if exists lib_books_read on public.lib_books;
create policy lib_books_read on public.lib_books for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[]
    and (select public.lib_module_enabled(school_id)));
drop policy if exists lib_copies_read on public.lib_copies;
create policy lib_copies_read on public.lib_copies for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[]
    and (select public.lib_module_enabled(school_id)));
drop policy if exists lib_loans_read on public.lib_loans;
create policy lib_loans_read on public.lib_loans for select
  using (
    (student_id = (select st.id from public.students st where st.profile_id = auth.uid() limit 1)
      and (select public.lib_module_enabled(school_id)))
    or (school_id = (select my_school_id())
      and (select my_roles()) && array['gvbm','gvcn','to_truong','bgh','admin','ke_toan','so_gd']::text[]
      and (select public.lib_module_enabled(school_id)))
  );

-- ===== r1-1) checkout: validate borrower truoc, sau do lock copy =====
create or replace function public.lib_checkout(
  p_copy uuid, p_student uuid, p_teacher uuid, p_days int, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_acc int; v_title text; v_name text; v_label text; v_loan uuid; v_days int;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.lib_module_enabled(v_school)) then raise exception 'module_disabled'; end if;
  if (p_student is not null)::int + (p_teacher is not null)::int <> 1 then
    raise exception 'borrower_xor';
  end if;

  -- Validate borrower TRUOC khi cham copy (ro rang, exception = full rollback).
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

  -- Lock copy + doi available atomically.
  update public.lib_copies set status = 'on_loan'
  where id = p_copy and school_id = v_school and status = 'available'
  returning accession_no into v_acc;
  if not found then
    if exists (select 1 from public.lib_copies where id = p_copy and school_id = v_school) then
      raise exception 'not_available';
    end if;
    raise exception 'copy_not_found';
  end if;
  select b.title into v_title from public.lib_copies c
  join public.lib_books b on b.id = c.book_id where c.id = p_copy;

  v_days := greatest(1, least(coalesce(p_days, 14), 90));
  insert into public.lib_loans
    (school_id, copy_id, accession_no, book_title, student_id, teacher_id,
     borrower_name, borrower_label, issued_by, due_at, notes)
  values (v_school, p_copy, v_acc, v_title,
          p_student, p_teacher, v_name, v_label,
          auth.uid(), now() + (v_days || ' days')::interval, nullif(trim(p_note),''))
  returning id into v_loan;
  return jsonb_build_object('loan_id', v_loan, 'due_days', v_days);
end $$;

-- ===== r1-2) return: copy update kem school + on_loan =====
create or replace function public.lib_return(p_loan uuid, p_condition text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_loan record; v_status text; v_updated uuid;
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
  update public.lib_copies set status = v_status
  where id = v_loan.copy_id and school_id = v_school and status = 'on_loan'
  returning id into v_updated;
  if v_updated is null then raise exception 'copy_state_conflict'; end if;
  return jsonb_build_object('loan_id', v_loan.id, 'copy_status', v_status);
end $$;

-- ===== r1-3) revoke PUBLIC/anon tren moi RPC =====
revoke all on function public.lib_add_book(text, text, text, int, text, text, numeric, int, text) from public, anon;
revoke all on function public.lib_add_copies(uuid, int, text) from public, anon;
revoke all on function public.lib_checkout(uuid, uuid, uuid, int, text) from public, anon;
revoke all on function public.lib_return(uuid, text, text) from public, anon;
grant execute on function public.lib_add_book(text, text, text, int, text, text, numeric, int, text) to authenticated;
grant execute on function public.lib_add_copies(uuid, int, text) to authenticated;
grant execute on function public.lib_checkout(uuid, uuid, uuid, int, text) to authenticated;
grant execute on function public.lib_return(uuid, text, text) to authenticated;
