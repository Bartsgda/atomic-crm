-- =====================================================================
-- Schema refactor v2 — vehicles, insured_persons, client_businesses,
-- policy_note_links, renewal chain
-- Target: test schema (Alina sandbox)
-- Branch: schema-refactor-vehicles-insured-2026-05-14
-- =====================================================================

-- -------------------------------------------------------
-- 1. VEHICLES — pojazd jako osobna encja
--    Klucz: (tenant_id, reg) — unikat per najemca
--    policies.vehicle_id → vehicles.id
--    Migracja: z istniejących vehicle_brand/model/reg w policies
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS test.vehicles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
    client_id   uuid REFERENCES test.insurance_clients(id) ON DELETE SET NULL,
    reg         text,                          -- tablica rejestracyjna
    brand       text,                          -- marka
    model       text,                          -- model
    year        integer,                       -- rok produkcji
    engine_cc   integer,                       -- pojemność cm³
    power_kw    integer,                       -- moc kW
    fuel        text CHECK (fuel IN ('benzyna','diesel','hybryda','elektryczny','LPG','CNG','MHEV','PHEV','inne')),
    vehicle_type text CHECK (vehicle_type IN ('OSOBOWY','DOSTAWCZY','CIEZAROWY','PRZYCZEPA','MOTOCYKL','CIAGNIK','SPECJALNY','inne')),
    vin         text,
    first_reg_date date,
    notes       text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v_tenant    ON test.vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_v_client    ON test.vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_v_reg       ON test.vehicles(reg);
CREATE INDEX IF NOT EXISTS idx_v_brand_mod ON test.vehicles(brand, model);

-- FK z policies na vehicles
ALTER TABLE test.policies
    ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES test.vehicles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_p_vehicle ON test.policies(vehicle_id);

-- Migracja danych: utwórz vehicles z istniejących policy.vehicle_reg/brand/model
-- Deduplikuj po reg (jedna tablica = jeden pojazd)
INSERT INTO test.vehicles (tenant_id, client_id, reg, brand, model,
                            year, engine_cc, power_kw, fuel, vehicle_type)
SELECT DISTINCT ON (p.tenant_id, p.vehicle_reg)
    p.tenant_id,
    p.client_id,
    p.vehicle_reg,
    p.vehicle_brand,
    p.vehicle_model,
    (p.auto_details->>'year')::integer,
    (p.auto_details->>'engine_cc')::integer,
    (p.auto_details->>'power_kw')::integer,
    p.auto_details->>'fuel',
    p.auto_details->>'vehicle_type'
FROM test.policies p
WHERE p.vehicle_reg IS NOT NULL
ORDER BY p.tenant_id, p.vehicle_reg, p.created_at DESC
ON CONFLICT DO NOTHING;

-- Podpnij vehicle_id do polis
UPDATE test.policies p
SET vehicle_id = v.id
FROM test.vehicles v
WHERE v.tenant_id = p.tenant_id
  AND v.reg = p.vehicle_reg
  AND p.vehicle_reg IS NOT NULL
  AND p.vehicle_id IS NULL;


-- -------------------------------------------------------
-- 2. INSURED_PERSONS — ubezpieczony ≠ ubezpieczający
--    Dotyczy: ZYCIE, NNW (dzieci), cesja (bank), OC współwłaściciel
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS test.insured_persons (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
    policy_id           uuid NOT NULL REFERENCES test.policies(id) ON DELETE CASCADE,
    relation            text CHECK (relation IN (
                            'ubezpieczony','wspolwlasciciel','cesjonariusz',
                            'dziecko','malzonek','pracownik','inne'
                        )) DEFAULT 'ubezpieczony',
    first_name          text,
    last_name           text,
    pesel_encrypted     text,                  -- DEK szyfrowanie (jak client.pesel_encrypted)
    birth_date          text,                  -- przechowywane jako text (encrypted lub YYYY-MM-DD)
    nip                 text,                  -- dla firm/cesjonariuszy
    email               text,
    phone               text,
    notes               text,
    ai_extracted        boolean DEFAULT false, -- czy wyciągnięty przez AI z notatek/XLSX
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ip_policy  ON test.insured_persons(policy_id);
CREATE INDEX IF NOT EXISTS idx_ip_tenant  ON test.insured_persons(tenant_id);

-- Migracja: wyciągnij coOwners z auto_details/firma_details do insured_persons
-- (tylko te które są prawdziwymi osobami, nie fake "pin XXXX" bugami)
INSERT INTO test.insured_persons (tenant_id, policy_id, relation, first_name, notes, ai_extracted)
SELECT
    p.tenant_id,
    p.id,
    CASE
        WHEN p.firma_details IS NOT NULL AND p.firma_details ? 'coOwners' THEN 'wspolwlasciciel'
        WHEN p.auto_details IS NOT NULL  AND p.auto_details  ? 'coOwners' THEN 'wspolwlasciciel'
        ELSE 'ubezpieczony'
    END,
    co->>'name',
    'Migracja z coOwners JSONB — wymaga weryfikacji',
    true
FROM test.policies p,
     LATERAL (
         SELECT jsonb_array_elements(
             COALESCE(p.auto_details->'coOwners', p.firma_details->'coOwners', '[]'::jsonb)
         ) AS co
     ) sub
WHERE (co->>'name') IS NOT NULL
  AND (co->>'name') NOT LIKE 'pin %'     -- odfiltruj PIN-bug (row_91)
  AND (co->>'name') NOT LIKE 'kl%'       -- odfiltruj pesel-kl bug
  AND length(co->>'name') > 2;


-- -------------------------------------------------------
-- 3. CLIENT_BUSINESSES — firma jako osobna encja
--    Zastępuje insurance_clients.businesses JSONB
--    (JSONB zostaje przez kompatybilność wsteczną)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS test.client_businesses (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES test.tenants(id) ON DELETE CASCADE,
    client_id   uuid NOT NULL REFERENCES test.insurance_clients(id) ON DELETE CASCADE,
    name        text NOT NULL,
    nip         text,
    regon       text,
    krs         text,
    role        text CHECK (role IN ('owner','proxy','employee','contact')) DEFAULT 'owner',
    notes       text,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cb_client ON test.client_businesses(client_id);
CREATE INDEX IF NOT EXISTS idx_cb_nip    ON test.client_businesses(nip) WHERE nip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_tenant ON test.client_businesses(tenant_id);

-- Migracja z JSONB
INSERT INTO test.client_businesses (tenant_id, client_id, name, nip)
SELECT
    c.tenant_id,
    c.id,
    biz->>'name',
    NULLIF(biz->>'nip', '')
FROM test.insurance_clients c,
     LATERAL jsonb_array_elements(
         CASE jsonb_typeof(c.businesses)
             WHEN 'array' THEN c.businesses
             ELSE '[]'::jsonb
         END
     ) AS biz
WHERE (biz->>'name') IS NOT NULL
  AND length(biz->>'name') > 1;


-- -------------------------------------------------------
-- 4. POLICY_NOTE_LINKS — właściwy junction zamiast uuid[]
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS test.policy_note_links (
    note_id     uuid NOT NULL REFERENCES test.policy_notes(id) ON DELETE CASCADE,
    policy_id   uuid NOT NULL REFERENCES test.policies(id)     ON DELETE CASCADE,
    PRIMARY KEY (note_id, policy_id)
);
CREATE INDEX IF NOT EXISTS idx_pnl_policy ON test.policy_note_links(policy_id);

-- Migracja z linked_policy_ids uuid[]
INSERT INTO test.policy_note_links (note_id, policy_id)
SELECT
    n.id,
    unnest(n.linked_policy_ids)
FROM test.policy_notes n
WHERE array_length(n.linked_policy_ids, 1) > 0
ON CONFLICT DO NOTHING;


-- -------------------------------------------------------
-- 5. RENEWAL CHAIN — łańcuch wznowień polis
-- -------------------------------------------------------
ALTER TABLE test.policies
    ADD COLUMN IF NOT EXISTS renewal_of_policy_id uuid REFERENCES test.policies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_p_renewal ON test.policies(renewal_of_policy_id)
    WHERE renewal_of_policy_id IS NOT NULL;


-- -------------------------------------------------------
-- 6. DODATKOWE KOLUMNY na policies (drobne uzupełnienia)
-- -------------------------------------------------------
ALTER TABLE test.policies
    ADD COLUMN IF NOT EXISTS referred_by_name text,     -- "klient z polecenia od X"
    ADD COLUMN IF NOT EXISTS referred_by_client_id uuid REFERENCES test.insurance_clients(id);


-- -------------------------------------------------------
-- 7. RLS dla nowych tabel
-- -------------------------------------------------------
ALTER TABLE test.vehicles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE test.insured_persons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE test.client_businesses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE test.policy_note_links   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN VALUES ('vehicles'),('insured_persons'),('client_businesses')
  LOOP
    EXECUTE format($f$
      CREATE POLICY IF NOT EXISTS "%1$s_sel" ON test.%1$I FOR SELECT USING (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
      CREATE POLICY IF NOT EXISTS "%1$s_ins" ON test.%1$I FOR INSERT WITH CHECK (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
      CREATE POLICY IF NOT EXISTS "%1$s_upd" ON test.%1$I FOR UPDATE USING (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
      CREATE POLICY IF NOT EXISTS "%1$s_del" ON test.%1$I FOR DELETE USING (tenant_id = test.current_tenant_id() OR test.is_insurance_admin());
    $f$, t);
  END LOOP;
END $$;

CREATE POLICY IF NOT EXISTS "pnl_sel" ON test.policy_note_links FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "pnl_ins" ON test.policy_note_links FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "pnl_del" ON test.policy_note_links FOR DELETE USING (true);

-- -------------------------------------------------------
-- 8. UPDATED_AT trigger dla nowych tabel
-- -------------------------------------------------------
CREATE TRIGGER trg_v_upd   BEFORE UPDATE ON test.vehicles          FOR EACH ROW EXECUTE PROCEDURE test.set_updated_at_insurance();
CREATE TRIGGER trg_cb_upd  BEFORE UPDATE ON test.client_businesses FOR EACH ROW EXECUTE PROCEDURE test.set_updated_at_insurance();
