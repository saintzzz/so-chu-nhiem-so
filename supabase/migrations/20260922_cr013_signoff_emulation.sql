-- CR-013: signoff 2 bước (GVCN nộp -> BGH ký) + siết quyền chấm thi đua

-- 1. Metadata nộp sổ chủ nhiệm
alter table register_signoffs
  add column if not exists submitted_by uuid references profiles(id),
  add column if not exists submitted_at timestamptz;

-- 2. Siết emulation_scores: GVCN chỉ lớp chủ nhiệm, BGH mọi lớp trong trường
drop policy if exists es_staff_ins on emulation_scores;
drop policy if exists es_staff_upd on emulation_scores;
drop policy if exists es_staff_del on emulation_scores;

create policy es_staff_ins on emulation_scores for insert with check (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and exists (
      select 1 from classes c
      where c.id = emulation_scores.class_id and c.gvcn_id = auth.uid()
    ))
  )
);

create policy es_staff_upd on emulation_scores for update using (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and exists (
      select 1 from classes c
      where c.id = emulation_scores.class_id and c.gvcn_id = auth.uid()
    ))
  )
) with check (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and exists (
      select 1 from classes c
      where c.id = emulation_scores.class_id and c.gvcn_id = auth.uid()
    ))
  )
);

create policy es_staff_del on emulation_scores for delete using (
  is_school_staff() and (
    my_role() = 'admin'
    or (my_role() = 'bgh' and scn_class_in_school(class_id))
    or (my_role() = 'gvcn' and exists (
      select 1 from classes c
      where c.id = emulation_scores.class_id and c.gvcn_id = auth.uid()
    ))
  )
);

-- 3. Cho phep status 'submitted' (flow GVCN nop -> BGH ky)
alter table register_signoffs drop constraint register_signoffs_status_check;
alter table register_signoffs add constraint register_signoffs_status_check
  check (status = any (array['pending','submitted','signed','locked','rejected']));
