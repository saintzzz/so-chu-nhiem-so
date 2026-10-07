-- ===========================================================================
-- R7-01: substitute_teacher_id phai la profile co role GV.
-- Truoc day scn_subr_refs_in_school chi kiem cung school - INSERT/UPDATE
-- qua RLS van gan duoc BGH/PHT/ke toan lam "GV day thay" (server actions
-- cung bo qua check o create/decide - da fix kem theo). sub check gio bat
-- role = any(array['gvbm','gvcn','to_truong']), khop TEACHER_LINK_ROLES
-- trong src/app/(app)/school/substitutes/actions.ts.
-- OR REPLACE giu OID nen subr_ins/subr_upd dung dinh nghia moi ngay.
-- ===========================================================================
create or replace function public.scn_subr_refs_in_school(school uuid, cid uuid, subid uuid, absent uuid, sub uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists(select 1 from classes c
                where c.id = cid and c.school_id = school
                  and scn_pht_allows_campus(c.campus_id))
     and (subid is null or exists(select 1 from subjects sj
                where sj.id = subid and sj.school_id = school))
     and exists(select 1 from profiles p
                where p.id = absent and p.school_id = school)
     and (sub is null or exists(select 1 from profiles p
                where p.id = sub and p.school_id = school
                  and p.role = any(array['gvbm','gvcn','to_truong'])))
$function$;
