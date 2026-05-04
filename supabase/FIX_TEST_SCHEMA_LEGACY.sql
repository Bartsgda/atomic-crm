-- ==========================================
-- FIX: Sync 'test' schema with legacy V1 requirements
-- Target Project: ALINA (xqznrssrlnxqkdvisnck)
-- ==========================================

-- 1. ADD MISSING COLUMNS (insurance_clients)
ALTER TABLE test.insurance_clients ADD COLUMN IF NOT EXISTS v1_original_id TEXT;
ALTER TABLE test.insurance_clients ADD COLUMN IF NOT EXISTS legacy_id TEXT;
ALTER TABLE test.insurance_clients ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- 2. ADD MISSING COLUMNS (policies)
ALTER TABLE test.policies ADD COLUMN IF NOT EXISTS v1_original_id TEXT;
ALTER TABLE test.policies ADD COLUMN IF NOT EXISTS v1_original_client_id TEXT;
ALTER TABLE test.policies ADD COLUMN IF NOT EXISTS legacy_id TEXT;

-- 3. ADD MISSING COLUMNS (policy_notes)
ALTER TABLE test.policy_notes ADD COLUMN IF NOT EXISTS v1_original_id TEXT;
ALTER TABLE test.policy_notes ADD COLUMN IF NOT EXISTS legacy_id TEXT;

-- 4. SYNC CONFIG DATA (tenants)
-- Essential for PassphraseGate initialization
INSERT INTO test.tenants (id, name, slug, business_type, created_at)
SELECT id, name, slug, business_type, created_at 
FROM public.tenants
ON CONFLICT (id) DO NOTHING;

-- 5. SYNC DECRYPTION KEYS (tenant_keys)
-- Essential for data access after login
INSERT INTO test.tenant_keys 
SELECT * FROM public.tenant_keys
ON CONFLICT (id) DO NOTHING;

-- 6. REFRESH PostgREST CACHE
-- Note: Running this script in SQL Editor usually triggers a cache refresh.
-- If API still fails, run: NOTIFY pgrst, 'reload schema';
