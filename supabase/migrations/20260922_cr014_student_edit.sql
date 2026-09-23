-- CR-014: quyen sua ho so HS + trigger dong bo positive_points

-- 1. Siet RLS students: gvcn chi lop chu nhiem, bgh theo truong, admin
drop policy if exists students_staff_upd on students;
drop policy if exists students_staff_ins on students;
drop policy if exists students_staff_del on students;

create policy students_staff_upd on students for update using (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and exists (
      select 1 from classes c
      where c.id = students.class_id and c.gvcn_id = auth.uid()
    ))
  )
) with check (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and exists (
      select 1 from classes c
      where c.id = students.class_id and c.gvcn_id = auth.uid()
    ))
  )
);

create policy students_staff_ins on students for insert with check (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and exists (
      select 1 from classes c
      where c.id = students.class_id and c.gvcn_id = auth.uid()
    ))
  )
);

create policy students_staff_del on students for delete using (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
  )
);

-- 2. Trigger dong bo positive_points tu conduct_records (diem duong)
create or replace function scn_apply_positive_points()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.points > 0 then
      update students set positive_points = positive_points + new.points where id = new.student_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.points > 0 then
      update students set positive_points = greatest(0, positive_points - old.points) where id = old.student_id;
    end if;
    return old;
  else
    if old.points > 0 then
      update students set positive_points = greatest(0, positive_points - old.points) where id = old.student_id;
    end if;
    if new.points > 0 then
      update students set positive_points = positive_points + new.points where id = new.student_id;
    end if;
    return new;
  end if;
end $$;

drop trigger if exists trg_sync_positive_points on conduct_records;
create trigger trg_sync_positive_points
  after insert or update or delete on conduct_records
  for each row execute function scn_apply_positive_points();
