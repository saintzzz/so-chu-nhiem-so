-- CR-029: kiem duyet hoc lieu cap truong (to truong -> BGH) + scale test data
alter table tvc.materials
  add column if not exists school_id uuid references public.schools(id);

update tvc.materials m
set school_id = p.school_id
from public.profiles p
where m.author_id = p.id and m.school_id is null;

create index if not exists materials_school_idx on tvc.materials(school_id);

create or replace view public.tvc_materials
with (security_invoker = true) as
select * from tvc.materials;

create policy tvc_mat_school_read on tvc.materials for select
  using (
    school_id = my_school_id()
    and my_role() in ('gvcn','gvbm','to_truong','bgh','admin')
  );

create policy tvc_rev_school on tvc.reviews for all
  using (
    exists (select 1 from tvc.materials m where m.id = reviews.material_id
            and m.school_id = my_school_id())
    and my_role() in ('to_truong','bgh','admin')
  )
  with check (
    exists (select 1 from tvc.materials m where m.id = reviews.material_id
            and m.school_id = my_school_id())
    and my_role() in ('to_truong','bgh','admin')
  );

create or replace function tvc.submit_material_review(mid uuid)
returns jsonb language plpgsql security definer set search_path = 'tvc','public' as $$
declare m tvc.materials%rowtype;
begin
  select * into m from tvc.materials where id = mid;
  if not found then return jsonb_build_object('error','Không tìm thấy học liệu.'); end if;
  if m.author_id <> auth.uid() then return jsonb_build_object('error','Chỉ tác giả mới gửi duyệt.'); end if;
  if m.status not in ('personal','draft','rejected','withdrawn') then
    return jsonb_build_object('error','Trạng thái không hợp lệ để gửi duyệt.');
  end if;
  update tvc.materials set status='in_review', updated_at=now() where id=mid;
  insert into tvc.reviews (material_id, reviewer_id, layer, status, notes)
    values (mid, auth.uid(), 0, 'submitted', 'Gửi duyệt');
  return jsonb_build_object('ok', true);
end $$;

create or replace function tvc.review_material(mid uuid, decision text, note text default '')
returns jsonb language plpgsql security definer set search_path = 'tvc','public' as $$
declare m tvc.materials%rowtype; r text; lay int;
begin
  select * into m from tvc.materials where id = mid;
  if not found then return jsonb_build_object('error','Không tìm thấy học liệu.'); end if;
  select role into r from public.profiles where id = auth.uid();
  if not (m.school_id = my_school_id()) then
    return jsonb_build_object('error','Học liệu không thuộc trường của bạn.');
  end if;
  if r = 'to_truong' then
    if m.status <> 'in_review' then return jsonb_build_object('error','Học liệu không ở trạng thái chờ tổ duyệt.'); end if;
    lay := 1;
    update tvc.materials
      set status = case when decision='approve' then 'totruong_ok' else 'rejected' end,
          review_note = note, updated_at = now()
      where id = mid;
  elsif r in ('bgh','admin') then
    if m.status not in ('in_review','totruong_ok') then return jsonb_build_object('error','Học liệu không ở trạng thái chờ duyệt.'); end if;
    lay := 2;
    update tvc.materials
      set status = case when decision='approve' then 'published' else 'rejected' end,
          review_note = note, updated_at = now()
      where id = mid;
  else
    return jsonb_build_object('error','Không có quyền duyệt học liệu.');
  end if;
  insert into tvc.reviews (material_id, reviewer_id, layer, status, notes)
    values (mid, auth.uid(), lay, case when decision='approve' then 'approved' else 'rejected' end, note);
  return jsonb_build_object('ok', true);
end $$;

grant execute on function tvc.submit_material_review(uuid) to authenticated;
grant execute on function tvc.review_material(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';

-- Wrapper public de PostgREST goi duoc (schema tvc khong expose)
create or replace function public.scn_submit_material_review(mid uuid)
returns jsonb language plpgsql security definer set search_path = 'public','tvc' as $$
begin
  return tvc.submit_material_review(mid);
end $$;

create or replace function public.scn_review_material(mid uuid, decision text, note text default '')
returns jsonb language plpgsql security definer set search_path = 'public','tvc' as $$
begin
  return tvc.review_material(mid, decision, note);
end $$;

grant execute on function public.scn_submit_material_review(uuid) to authenticated;
grant execute on function public.scn_review_material(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';

-- Mo rong check constraint cho material type slides + status totruong_ok
alter table tvc.materials drop constraint materials_type_check;
alter table tvc.materials add constraint materials_type_check
  check (type = any(array['lesson_plan','matrix','exam','worksheet','question_set','reading','vocab_set','dialogue','formula_set','variants','slides','other']));
alter table tvc.materials drop constraint materials_status_check;
alter table tvc.materials add constraint materials_status_check
  check (status = any(array['draft','personal','pending_review','in_review','totruong_ok','published','rejected','withdrawn']));

-- reviews.status them 'submitted' cho log gui duyet
alter table tvc.reviews drop constraint reviews_status_check;
alter table tvc.reviews add constraint reviews_status_check
  check (status = any(array['submitted','approved','needs_edit','rejected']));
