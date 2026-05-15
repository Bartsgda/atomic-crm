-- =====================================================================
-- reserved_slots — 30 generic scratch tables (test.slot_01..slot_30)
-- Target: test schema (Alina sandbox)
-- Branch: schema-refactor-vehicles-insured-2026-05-14
-- =====================================================================
-- Cel: zarezerwowane puste tabele do tymczasowego użytku przez Claude
-- w przyszłych sesjach. Każdy slot ma generyczną strukturę JSONB payload.
-- Gdy sesja "zabiera" slot — aktualizuje SLOT_REGISTRY.md.
-- Na koniec miesiąca Bartek decyduje: PROMOTE (RENAME + typed columns) lub RESET.
--
-- SCHEMAT: test (nie public)
-- TRIGGER: test.set_updated_at_insurance() — reużywa istniejącej funkcji
-- RLS: 4 osobne polisy per slot (SELECT/INSERT/UPDATE/DELETE) — wzorzec z flag_resolutions
-- IDEMPOTENTNE: IF NOT EXISTS + DROP IF EXISTS na triggerach/policach

DO $$
DECLARE
  i         INT;
  slot_name TEXT;
BEGIN
  FOR i IN 1..30 LOOP
    slot_name := 'slot_' || lpad(i::text, 2, '0');

    -- ── CREATE TABLE ──────────────────────────────────────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS test.%I (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID        NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
        payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
        slot_purpose TEXT,       -- wolny opis czemu sesja używa tego slotu
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    $f$, slot_name);

    -- ── INDEXES ───────────────────────────────────────────────────
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON test.%I (tenant_id)',
      slot_name || '_tenant_idx', slot_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON test.%I USING GIN (payload jsonb_path_ops)',
      slot_name || '_payload_gin', slot_name
    );

    -- ── RLS ───────────────────────────────────────────────────────
    EXECUTE format('ALTER TABLE test.%I ENABLE ROW LEVEL SECURITY', slot_name);

    -- DROP istniejących (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS %I ON test.%I', slot_name || '_sel', slot_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON test.%I', slot_name || '_ins', slot_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON test.%I', slot_name || '_upd', slot_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON test.%I', slot_name || '_del', slot_name);

    EXECUTE format($f$
      CREATE POLICY %I ON test.%I
        FOR SELECT TO authenticated
        USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin())
    $f$, slot_name || '_sel', slot_name);

    EXECUTE format($f$
      CREATE POLICY %I ON test.%I
        FOR INSERT TO authenticated
        WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_insurance_admin())
    $f$, slot_name || '_ins', slot_name);

    EXECUTE format($f$
      CREATE POLICY %I ON test.%I
        FOR UPDATE TO authenticated
        USING     (tenant_id = public.current_tenant_id() OR public.is_insurance_admin())
        WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_insurance_admin())
    $f$, slot_name || '_upd', slot_name);

    EXECUTE format($f$
      CREATE POLICY %I ON test.%I
        FOR DELETE TO authenticated
        USING (tenant_id = public.current_tenant_id() OR public.is_insurance_admin())
    $f$, slot_name || '_del', slot_name);

    -- ── UPDATED_AT TRIGGER ────────────────────────────────────────
    -- Reużywa test.set_updated_at_insurance() z 20260514_schema_refactor_vehicles_insured.sql
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON test.%I',
      slot_name || '_updated_at', slot_name
    );
    EXECUTE format($f$
      CREATE TRIGGER %I
        BEFORE UPDATE ON test.%I
        FOR EACH ROW EXECUTE FUNCTION test.set_updated_at_insurance()
    $f$, slot_name || '_updated_at', slot_name);

  END LOOP;
END
$$;

-- ── Walidacja (informacyjna) ──────────────────────────────────────────────────
SELECT count(*) AS slot_count
FROM information_schema.tables
WHERE table_schema = 'test' AND table_name LIKE 'slot_%';
-- Oczekiwane: 30
