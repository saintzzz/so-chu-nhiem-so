-- CR-081: reconcile cleanup sau khi merge wave remote CR-068..076.
-- Cac bang duoi day duoc tao boi nhanh local som nhung bi supersede boi
-- implement remote da qua review; khong con code nao tham chieu:
--   student_health_profiles/health_checkups/health_incidents -> superseded
--     boi yt_* tables (20261256_cr075_y_te_bhyt, page /school/health).
--   school_signing_keys/hocba_xml_exports -> superseded boi hb_exports
--     ky 2 cap (20261252_cr069_hb_xml, page /records/exports).
-- students.vneid_subject_id giu nguyen: 20261255_vneid_prep da add idempotent.
drop table if exists public.hocba_xml_exports;
drop table if exists public.school_signing_keys;
drop table if exists public.health_incidents;
drop table if exists public.health_checkups;
drop table if exists public.student_health_profiles;

-- Module flag 'y_te' bi trung ten voi staff position va superseded boi
-- 'y_te_bhyt' - go flag cu khoi school_features neu co.
delete from public.school_features
where module = 'y_te';
