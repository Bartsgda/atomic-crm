-- =====================================================================
-- flag_resolutions — per-flag tracking dla systemu przypomnień Aliny
-- Target: test schema (Alina sandbox)
-- Branch: schema-refactor-vehicles-insured-2026-05-14
-- =====================================================================

-- Tabela śledzi stan każdej flagi (resolved / dismissed / active)
-- per tenant + target (POLICY lub CLIENT) + flag_type.
-- UNIQUE constraint zapewnia jeden wiersz per kombinacja — UPSERT-friendly.

CREATE TABLE IF NOT EXISTS test.flag_resolutions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
    target_type           text NOT NULL CHECK (target_type IN ('POLICY', 'CLIENT')),
    target_id             uuid NOT NULL,
    flag_type             text NOT NULL,
    resolved_at           timestamptz,
    resolved_by_user_id   uuid REFERENCES auth.users(id),
    dismissed_at          timestamptz,
    dismiss_reason        text CHECK (dismiss_reason IS NULL OR dismiss_reason IN ('snooze_today', 'manual_skip')),
    dismissed_by_user_id  uuid REFERENCES auth.users(id),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, target_type, target_id, flag_type)
);

CREATE INDEX IF NOT EXISTS idx_fr_tenant_target
    ON test.flag_resolutions(tenant_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_fr_tenant_unresolved
    ON test.flag_resolutions(tenant_id, resolved_at)
    WHERE resolved_at IS NULL;

-- updated_at trigger (analogiczny do innych tabel w schemacie)
CREATE OR REPLACE FUNCTION test.set_flag_resolutions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_flag_resolutions_updated_at ON test.flag_resolutions;
CREATE TRIGGER trg_flag_resolutions_updated_at
    BEFORE UPDATE ON test.flag_resolutions
    FOR EACH ROW EXECUTE FUNCTION test.set_flag_resolutions_updated_at();

-- RLS — analogiczne do test.policies (4 osobne policy: SELECT/INSERT/UPDATE/DELETE)
ALTER TABLE test.flag_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flag_resolutions_sel ON test.flag_resolutions;
DROP POLICY IF EXISTS flag_resolutions_ins ON test.flag_resolutions;
DROP POLICY IF EXISTS flag_resolutions_upd ON test.flag_resolutions;
DROP POLICY IF EXISTS flag_resolutions_del ON test.flag_resolutions;
-- usuń stary policy z poprzedniej wersji migracji, gdyby istniał
DROP POLICY IF EXISTS flag_resolutions_tenant_policy ON test.flag_resolutions;

CREATE POLICY flag_resolutions_sel ON test.flag_resolutions
    FOR SELECT USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());
CREATE POLICY flag_resolutions_ins ON test.flag_resolutions
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());
CREATE POLICY flag_resolutions_upd ON test.flag_resolutions
    FOR UPDATE USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());
CREATE POLICY flag_resolutions_del ON test.flag_resolutions
    FOR DELETE USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin());
