-- Dedupe tvc_questions: cung (stem, grade, subject_code, qtype) xuat hien
-- nhieu lan vi gen script gan 1 row per standard_id. Merge ve 1 row:
-- keeper = row approved truoc (uu tien), union standard_ids, xoa phan du.
-- Dam bao khong mat coverage YCCD nao.

with d as (
  select lower(trim(stem)) as s, grade, subject_code, qtype
  from tvc_questions
  group by 1, 2, 3, 4
  having count(*) > 1
),
ranked as (
  select q.id, q.standard_ids,
         row_number() over (
           partition by lower(trim(q.stem)), q.grade, q.subject_code, q.qtype
           order by (q.review_state = 'approved') desc, q.id
         ) as rn,
         lower(trim(q.stem)) as s, q.grade, q.subject_code, q.qtype
  from tvc_questions q
  join d on lower(trim(q.stem)) = d.s
        and q.grade = d.grade
        and q.subject_code = d.subject_code
        and q.qtype = d.qtype
),
merged as (
  select s, grade, subject_code, qtype,
         (array_agg(id order by rn))[1] as keeper_id,
         array_agg(distinct sid) as all_standards
  from ranked
  cross join lateral unnest(standard_ids) as sid
  group by s, grade, subject_code, qtype
)
update tvc_questions q
set standard_ids = m.all_standards
from merged m
where q.id = m.keeper_id;

-- xoa cac row du (rn > 1)
with d as (
  select lower(trim(stem)) as s, grade, subject_code, qtype
  from tvc_questions
  group by 1, 2, 3, 4
  having count(*) > 1
),
ranked as (
  select q.id,
         row_number() over (
           partition by lower(trim(q.stem)), q.grade, q.subject_code, q.qtype
           order by (q.review_state = 'approved') desc, q.id
         ) as rn
  from tvc_questions q
  join d on lower(trim(q.stem)) = d.s
        and q.grade = d.grade
        and q.subject_code = d.subject_code
        and q.qtype = d.qtype
)
delete from tvc_questions
where id in (select id from ranked where rn > 1);
