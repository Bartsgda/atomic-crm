/**
 * TESTER FIX: Verify v1_original_id in 'test' schema
 * Run: node scratch/verify_test_schema.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from ALINA test config
dotenv.config({ path: path.resolve(process.cwd(), '.env.alina.test') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SB_SECRET_KEY; // service_role
const SCHEMA = process.env.VITE_SUPABASE_SCHEMA || 'test';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SB_SECRET_KEY in .env.alina.test');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: SCHEMA }
});

async function verify() {
  console.log(`\n=== VERIFYING SCHEMA: ${SCHEMA} ===\n`);

  // 1. Check Column Existence
  console.log('1. Checking columns in insurance_clients...');
  const { data: cols, error: colErr } = await supabase
    .from('insurance_clients')
    .select('id, v1_original_id')
    .limit(1);

  if (colErr) {
    if (colErr.message.includes('column "v1_original_id" does not exist')) {
      console.error('❌ FAILED: Column "v1_original_id" is MISSING in schema "test".');
      console.log('👉 ACTION: Run supabase/FIX_TEST_SCHEMA_LEGACY.sql in SQL Editor.');
    } else {
      console.error('❌ ERROR:', colErr.message);
    }
  } else {
    console.log('✅ SUCCESS: Column "v1_original_id" exists.');
  }

  // 2. Check config data (tenants)
  console.log('\n2. Checking tenants data...');
  const { count: tenantCount, error: tenantErr } = await supabase
    .from('tenants')
    .select('*', { count: 'exact', head: true });

  if (tenantErr) {
    console.error('❌ ERROR checking tenants:', tenantErr.message);
  } else {
    console.log(`✅ SUCCESS: Found ${tenantCount} tenants in schema "${SCHEMA}".`);
  }

  // 3. Write Test
  console.log('\n3. Performing Write Test...');
  const testId = crypto.randomUUID();
  const { error: insErr } = await supabase.from('insurance_clients').insert({
    id: testId,
    tenant_id: '11111111-1111-1111-1111-111111111111',
    first_name: 'TESTER_FIX_VERIFY',
    last_name: 'DELETEME',
    v1_original_id: 'v1_test_' + Date.now(),
    is_fake: true
  });

  if (insErr) {
    console.error('❌ FAILED to add client:', insErr.message);
  } else {
    console.log('✅ SUCCESS: Client with v1_original_id added.');
    
    // Cleanup
    await supabase.from('insurance_clients').delete().eq('id', testId);
    console.log('✅ SUCCESS: Test record cleaned up.');
  }

  console.log('\n=== VERIFICATION FINISHED ===');
}

verify().catch(console.error);
