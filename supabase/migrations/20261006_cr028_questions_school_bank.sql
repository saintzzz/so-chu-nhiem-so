-- CR-028: ngan hang cau hoi cap truong (thay per-owner) + index scale
-- Doc: owner + staff cung truong. Ghi/sua/xoa: owner hoac to_truong/bgh/admin
-- cung truong. Dung my_role()/my_school_id() (security definer) - KHONG subquery
-- profiles truc tiep trong policy (RLS chain -> seq scan -> timeout).

alter table tvc.questions
  add column if not exists school_id uuid references public.schools(id);

-- Backfill tu truong cua owner (profiles chinh cua SCN)
update tvc.questions q
set school_id = p.school_id
from public.profiles p
where q.owner_id = p.id and q.school_id is null;

create index if not exists questions_school_idx on tvc.questions(school_id);
create index if not exists questions_stds_gin on tvc.questions using gin(standard_ids);
create index if not exists questions_review_idx on tvc.questions(review_state);
create index if not exists questions_pick_idx on tvc.questions(subject_code, grade, qtype, level);

drop policy if exists tvc_q_owner on tvc.questions;

create policy tvc_q_read on tvc.questions for select
  using (
    auth.uid() is not null
    and (owner_id = auth.uid()
        or (school_id = my_school_id() and my_role() in ('gvcn','gvbm','to_truong','bgh','admin')))
  );

create policy tvc_q_insert on tvc.questions for insert
  with check (
    owner_id = auth.uid()
    and my_role() in ('gvcn','gvbm','to_truong','bgh','admin')
    and (school_id is null or school_id = my_school_id())
  );

create policy tvc_q_update on tvc.questions for update
  using (
    owner_id = auth.uid()
    or (school_id = my_school_id() and my_role() in ('to_truong','bgh','admin'))
  )
  with check (
    owner_id = auth.uid()
    or (school_id = my_school_id() and my_role() in ('to_truong','bgh','admin'))
  );

create policy tvc_q_delete on tvc.questions for delete
  using (
    owner_id = auth.uid()
    or (school_id = my_school_id() and my_role() in ('to_truong','bgh','admin'))
  );

-- View public phai recreate de nhan cot moi (select * chi expand luc tao view)
create or replace view public.tvc_questions
with (security_invoker = true) as
select * from tvc.questions;
notify pgrst, 'reload schema';
