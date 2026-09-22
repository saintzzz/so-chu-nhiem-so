-- CR-011: feature-parity - equipment, school KPIs, school-wide announcements
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  campus_id uuid REFERENCES public.campuses(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'thiet_bi',
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition text NOT NULL DEFAULT 'tot'
    CHECK (condition IN ('tot','hong_nhe','hong_nang','thanh_ly')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_staff_read ON public.equipment FOR SELECT
  USING ((SELECT is_staff()) AND EXISTS (
    SELECT 1 FROM schools s WHERE s.id = equipment.school_id
      AND (scn_is_dept() OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid()
          AND p.school_id = equipment.school_id))));
CREATE POLICY equipment_staff_write ON public.equipment FOR ALL
  USING ((SELECT my_role()) IN ('bgh','pht','ke_toan','admin')
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                     AND p.school_id = equipment.school_id))
  WITH CHECK ((SELECT my_role()) IN ('bgh','pht','ke_toan','admin')
              AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                          AND p.school_id = equipment.school_id));

CREATE TABLE IF NOT EXISTS public.school_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  period text NOT NULL,
  title text NOT NULL,
  target text,
  actual text,
  unit text,
  status text NOT NULL DEFAULT 'dang_thuc_hien'
    CHECK (status IN ('dang_thuc_hien','dat','chua_dat','quy_hoach')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY skpi_staff_read ON public.school_kpis FOR SELECT
  USING ((SELECT is_staff()) AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND (scn_is_dept() OR p.school_id = school_kpis.school_id)));
CREATE POLICY skpi_staff_write ON public.school_kpis FOR ALL
  USING ((SELECT my_role()) IN ('bgh','pht','admin')
         AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                     AND p.school_id = school_kpis.school_id))
  WITH CHECK ((SELECT my_role()) IN ('bgh','pht','admin')
              AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                          AND p.school_id = school_kpis.school_id));

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS school_id uuid
  REFERENCES public.schools(id);
