-- =====================================================================
-- TIMELINE ARCHITECTURE (Faza 3) — bi-temporal model
-- Spec: src/legacy-v1/TIMELINE_ARCHITECTURE.md
-- Plan: src/legacy-v1/AUDIT_PLAN.md § Faza 3 (lines 101-126)
-- Target: test schema (Alina sandbox)
-- Branch: schema-refactor-vehicles-insured-2026-05-14
-- Decision log: see commit message / agent design report 2026-05-15
--
-- Decisions:
--   #1 assets = polymorphic FK (asset_kind+asset_id) on policies,
--      NEW table `homes` analogously to `vehicles` (commit 1bc5188).
--      No parent `assets` table — VEHICLE/HOME/BUSINESS have different shapes.
--   #2 client_attribute_history = single generic SCD2 table, app-driven (no triggers).
--   #3 policy_versions = minimal (version_number + superseded_by chain),
--      full snapshot table deferred to Faza 2.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HOMES — nieruchomość jako trwała encja (analogicznie do vehicles)
--    Klucz: (tenant_id, address_normalized) UNIQUE
--    Persistent: ten sam adres = kolejne polisy DOM przez lata
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test.homes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
    client_id           uuid REFERENCES test.insurance_clients(id) ON DELETE SET NULL,
    address_normalized  text NOT NULL,                -- 'gdansk-junony-88' (lower, ascii, no diacritics)
    address_raw         text,                         -- '80-298 Gdańsk, ul. Junony 88/3'
    city                text,
    zip_code            text,
    home_type           text CHECK (home_type IN ('mieszkanie','dom','dom_w_budowie','dzialka','lokal_uzytkowy','inne')),
    area_m2             numeric(7,2),
    construction_year   integer,
    has_mortgage        boolean DEFAULT false,
    mortgage_bank       text,
    notes               text,
    status              text NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','SOLD','DISPOSED','INACTIVE','PLANNED')),
    acquired_at         date,
    disposed_at         date,
    source              text DEFAULT 'manual' CHECK (source IN ('manual','xlsx_import','crm','sync')),
    legacy_id           text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_h_tenant    ON test.homes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_h_client    ON test.homes(client_id);
CREATE INDEX IF NOT EXISTS idx_h_addr      ON test.homes(tenant_id, address_normalized);
CREATE INDEX IF NOT EXISTS idx_h_status    ON test.homes(status) WHERE status = 'ACTIVE';

-- vehicles + client_businesses (z commit 1bc5188) dostają symetryczne kolumny
-- żeby polymorphic FK z policies był spójny per asset_kind
ALTER TABLE test.vehicles
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','SOLD','DISPOSED','INACTIVE','PLANNED')),
    ADD COLUMN IF NOT EXISTS acquired_at date,
    ADD COLUMN IF NOT EXISTS disposed_at date,
    ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'
        CHECK (source IN ('manual','xlsx_import','crm','sync')),
    ADD COLUMN IF NOT EXISTS legacy_id text;
CREATE INDEX IF NOT EXISTS idx_v_status ON test.vehicles(status) WHERE status = 'ACTIVE';

ALTER TABLE test.client_businesses
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','SOLD','DISPOSED','INACTIVE','PLANNED')),
    ADD COLUMN IF NOT EXISTS acquired_at date,
    ADD COLUMN IF NOT EXISTS disposed_at date,
    ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'
        CHECK (source IN ('manual','xlsx_import','crm','sync')),
    ADD COLUMN IF NOT EXISTS legacy_id text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_cb_status ON test.client_businesses(status) WHERE status = 'ACTIVE';


-- ---------------------------------------------------------------------
-- 2. POLICY_TERMINATIONS — wypowiedzenia ze statusem
--    Cel: persistent encja "ten klient był u Warty, wypowiedzieliśmy mu polisę X"
--    Spec: TIMELINE_ARCHITECTURE.md § 3.2
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test.policy_terminations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
    new_policy_id         uuid REFERENCES test.policies(id) ON DELETE CASCADE,
    old_policy_id         uuid REFERENCES test.policies(id) ON DELETE SET NULL,
    old_insurer_id        uuid,                       -- FK do insurers (jeśli istnieje) — soft ref
    old_insurer_name      text,
    old_policy_number     text,
    old_policy_end_date   date,
    status                text NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT','SENT','REGISTERED','CONFIRMED','EXPIRED','CANCELED','NOT_REQUIRED')),
    termination_basis     text CHECK (termination_basis IN (
                              'art28','art28a','zmiana_wlasciciela','nieoplacenie',
                              'zerwanie_pakietu','inne'
                          )),
    sent_at               date,
    registered_at         date,
    confirmed_at          timestamptz,
    confirmed_by_user_id  uuid,
    source_note_id        uuid REFERENCES test.policy_notes(id) ON DELETE SET NULL,
    ai_extracted          boolean NOT NULL DEFAULT false,
    ai_note               text,
    notes                 text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pt_new        ON test.policy_terminations(new_policy_id);
CREATE INDEX IF NOT EXISTS idx_pt_old        ON test.policy_terminations(old_policy_id);
CREATE INDEX IF NOT EXISTS idx_pt_tenant     ON test.policy_terminations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pt_status     ON test.policy_terminations(status, confirmed_at);
CREATE INDEX IF NOT EXISTS idx_pt_pending    ON test.policy_terminations(tenant_id, status)
    WHERE status IN ('SENT','REGISTERED') AND confirmed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pt_source_note ON test.policy_terminations(source_note_id)
    WHERE source_note_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- 3. CLIENT_ATTRIBUTE_HISTORY — SCD2 historia atrybutów klienta
--    Spec: TIMELINE_ARCHITECTURE.md § 3.3
--    NO triggers — app-driven INSERT (z changed_by_user_id + reason)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test.client_attribute_history (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
    client_id             uuid NOT NULL REFERENCES test.insurance_clients(id) ON DELETE CASCADE,
    attribute             text NOT NULL
                          CHECK (attribute IN ('PHONE','EMAIL','ADDRESS','FIRST_NAME','LAST_NAME',
                                                'BUSINESS','BIRTH_DATE','PESEL','NIP')),
    value_old             jsonb,
    value_new             jsonb,
    valid_from            timestamptz NOT NULL DEFAULT now(),
    valid_to              timestamptz,                -- NULL = obecnie obowiązuje
    source                text NOT NULL DEFAULT 'manual'
                          CHECK (source IN ('manual','xlsx_import','crm_edit','sync','api')),
    changed_by_user_id    uuid,
    reason                text,
    created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cah_client_attr ON test.client_attribute_history(client_id, attribute);
CREATE INDEX IF NOT EXISTS idx_cah_current     ON test.client_attribute_history(client_id, attribute)
    WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_cah_at          ON test.client_attribute_history(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_cah_tenant      ON test.client_attribute_history(tenant_id);


-- ---------------------------------------------------------------------
-- 4. POLICIES — polymorphic FK + minimal versioning chain
--    Spec: decyzja #1 (asset_kind+asset_id) + decyzja #3 (minimal versioning)
--    Uwaga: vehicle_id (commit 1bc5188) zostaje — backward compat,
--           backfill ustawi asset_kind='VEHICLE' i asset_id=vehicle_id.
-- ---------------------------------------------------------------------
ALTER TABLE test.policies
    ADD COLUMN IF NOT EXISTS asset_kind text
        CHECK (asset_kind IN ('VEHICLE','HOME','BUSINESS','TRAVEL','LIFE','OTHER')),
    ADD COLUMN IF NOT EXISTS asset_id uuid,           -- polymorphic, resolved per asset_kind w app
    ADD COLUMN IF NOT EXISTS previous_policy_id uuid REFERENCES test.policies(id) ON DELETE SET NULL,
    -- versioning minimal (decyzja #3 C)
    ADD COLUMN IF NOT EXISTS version_number int NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS superseded_by_policy_id uuid REFERENCES test.policies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
    ADD COLUMN IF NOT EXISTS supersede_reason text;
CREATE INDEX IF NOT EXISTS idx_p_asset       ON test.policies(asset_kind, asset_id)
    WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_p_previous    ON test.policies(previous_policy_id)
    WHERE previous_policy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_p_superseded  ON test.policies(superseded_by_policy_id)
    WHERE superseded_by_policy_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- 5. RLS dla nowych tabel (tenant_id mandatory, analogicznie do § 7 commit 1bc5188)
-- ---------------------------------------------------------------------
ALTER TABLE test.homes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE test.policy_terminations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE test.client_attribute_history  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN VALUES ('homes'),('policy_terminations'),('client_attribute_history')
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s_sel" ON test.%1$I;
      DROP POLICY IF EXISTS "%1$s_ins" ON test.%1$I;
      DROP POLICY IF EXISTS "%1$s_upd" ON test.%1$I;
      DROP POLICY IF EXISTS "%1$s_del" ON test.%1$I;
      CREATE POLICY "%1$s_sel" ON test.%1$I FOR SELECT
        USING (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
      CREATE POLICY "%1$s_ins" ON test.%1$I FOR INSERT
        WITH CHECK (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
      CREATE POLICY "%1$s_upd" ON test.%1$I FOR UPDATE
        USING (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
      CREATE POLICY "%1$s_del" ON test.%1$I FOR DELETE
        USING (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
    $f$, t);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 6. UPDATED_AT triggers
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_h_upd  ON test.homes;
DROP TRIGGER IF EXISTS trg_pt_upd ON test.policy_terminations;
DROP TRIGGER IF EXISTS trg_cb_upd2 ON test.client_businesses;

CREATE TRIGGER trg_h_upd   BEFORE UPDATE ON test.homes
    FOR EACH ROW EXECUTE PROCEDURE test.set_updated_at_insurance();
CREATE TRIGGER trg_pt_upd  BEFORE UPDATE ON test.policy_terminations
    FOR EACH ROW EXECUTE PROCEDURE test.set_updated_at_insurance();
-- client_businesses dostał updated_at w § 1 — dodaj trigger jeśli nie ma
CREATE TRIGGER trg_cb_upd2 BEFORE UPDATE ON test.client_businesses
    FOR EACH ROW EXECUTE PROCEDURE test.set_updated_at_insurance();


-- ---------------------------------------------------------------------
-- 7. BACKWARD-COMPAT BACKFILL — vehicle_id → asset_kind/asset_id
--    Tylko dla policies które już mają vehicle_id z commit 1bc5188
-- ---------------------------------------------------------------------
UPDATE test.policies
SET asset_kind = 'VEHICLE',
    asset_id   = vehicle_id
WHERE vehicle_id IS NOT NULL
  AND asset_id IS NULL;

-- HOME / BUSINESS backfill zostaje dla scripts/timeline_backfill.py (Etap B)
-- bo wymaga utworzenia rekordów w test.homes / dopasowania do test.client_businesses.


-- ---------------------------------------------------------------------
-- 8. KOMENTARZE
-- ---------------------------------------------------------------------
COMMENT ON TABLE test.homes IS
    'Trwała nieruchomość (DOM/mieszkanie/lokal) — analogicznie do vehicles. UPSERT po (tenant_id, address_normalized).';
COMMENT ON TABLE test.policy_terminations IS
    'Wypowiedzenia polis ze statusem (DRAFT→SENT→REGISTERED→CONFIRMED). AI parsuje z notatek [STARA POLISA], agent potwierdza ręcznie.';
COMMENT ON TABLE test.client_attribute_history IS
    'SCD2 historia atrybutów klienta. Wpisy robi APP (z user_id+reason), NIE trigger. Stary tel widoczny w notatce z tamtej daty.';
COMMENT ON COLUMN test.policies.asset_kind IS
    'Polymorphic asset type. asset_id wskazuje vehicles.id (VEHICLE), homes.id (HOME), client_businesses.id (BUSINESS). Resolved w app, nie ma FK constraint.';
COMMENT ON COLUMN test.policies.version_number IS
    'Versioning minimal (decyzja #3C). Aneks = nowy rekord polisy z version_number=N+1, stary dostaje superseded_by_policy_id=new.id + superseded_at.';
