-- =====================================================================
-- Cloud Archive Support & Encryption Fix
-- Author: Antigravity
-- Date: 2026-04-19
-- =====================================================================

-- 1. Fix insurance_clients columns to support encrypted strings
ALTER TABLE public.insurance_clients 
  ALTER COLUMN birth_date TYPE TEXT,
  ALTER COLUMN phones TYPE TEXT DEFAULT NULL,
  ALTER COLUMN emails TYPE TEXT DEFAULT NULL;

-- 2. Create Archive table for "Atomic Archival"
CREATE TABLE IF NOT EXISTS public.insurance_trash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CLIENT','POLICY','NOTE')),
  data jsonb NOT NULL,
  deleted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS on trash
ALTER TABLE public.insurance_trash ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for trash (based on current_tenant_id from sales)
CREATE POLICY "insurance_trash_sel" ON public.insurance_trash FOR SELECT USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());
CREATE POLICY "insurance_trash_ins" ON public.insurance_trash FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());
CREATE POLICY "insurance_trash_upd" ON public.insurance_trash FOR UPDATE USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());
CREATE POLICY "insurance_trash_del" ON public.insurance_trash FOR DELETE USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());

-- 5. Index for trash
CREATE INDEX idx_it_tenant ON public.insurance_trash(tenant_id);
CREATE INDEX idx_it_type ON public.insurance_trash(type);
