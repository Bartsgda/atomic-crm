/**
 * E2E Supabase Connection Test
 * Tests: connect → read → write → read-back → delete → verify
 * Run: node scratch/test_supabase_e2e.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xqznrssrlnxqkdvisnck.supabase.co';
const SECRET_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID    = '11111111-1111-1111-1111-111111111111';

const sb = createClient(SUPABASE_URL, SECRET_KEY);

const TEST_CLIENT_ID = 'e2e-test-' + crypto.randomUUID();

const results = [];
function log(step, ok, detail) {
  const icon = ok ? '✅' : '❌';
  results.push({ step, ok, detail });
  console.log(`${icon} ${step}: ${detail}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  SUPABASE E2E CONNECTION TEST');
  console.log('═══════════════════════════════════════════\n');

  // ── Step 1: Connection test (read insurers) ──────────────────────
  try {
    const { data, error } = await sb.from('insurers').select('name').eq('tenant_id', TENANT_ID).limit(5);
    if (error) throw error;
    log('1. CONNECTION', true, `OK — read ${data.length} insurers`);
  } catch (e) {
    log('1. CONNECTION', false, `FAIL — ${e.message}`);
    console.log('\n⛔ Cannot proceed without connection. Aborting.\n');
    process.exit(1);
  }

  // ── Step 2: List existing tables ─────────────────────────────────
  const tables = ['insurance_clients', 'policies', 'policy_notes', 'sub_agents', 'insurers', 'insurance_trash'];
  for (const t of tables) {
    try {
      const { data, error, count } = await sb.from(t).select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
      if (error) throw error;
      log(`2. TABLE [${t}]`, true, `EXISTS — ${count ?? '?'} rows`);
    } catch (e) {
      log(`2. TABLE [${t}]`, false, `MISSING or error: ${e.message}`);
    }
  }

  // ── Step 3: Write test client ────────────────────────────────────
  const testRow = {
    id: TEST_CLIENT_ID,
    tenant_id: TENANT_ID,
    first_name: 'TEST_E2E',
    last_name: 'DELETEME',
    pesel_encrypted: null,
    birth_date: null,
    gender: null,
    phones: null,
    emails: null,
    businesses: null,
    street: null,
    city: 'Gdansk',
    zip_code: '80-001',
    source: 'manual',
    is_fake: true,
  };

  try {
    const { error } = await sb.from('insurance_clients').insert(testRow);
    if (error) throw error;
    log('3. WRITE CLIENT', true, `Inserted id=${TEST_CLIENT_ID}`);
  } catch (e) {
    log('3. WRITE CLIENT', false, `${e.code || ''} ${e.message}`);
    
    // Try to diagnose: is it a column type issue?
    if (e.message?.includes('invalid input syntax') || e.message?.includes('uuid')) {
      log('3a. DIAGNOSIS', false, `ID format problem — DB expects UUID but got "${TEST_CLIENT_ID}"`);
    }
    if (e.message?.includes('malformed array')) {
      log('3a. DIAGNOSIS', false, 'Array column type mismatch — phones/emails expect text[] but got string');
    }
  }

  // ── Step 4: Read back ────────────────────────────────────────────
  try {
    const { data, error } = await sb.from('insurance_clients').select('*').eq('id', TEST_CLIENT_ID).single();
    if (error) throw error;
    if (data) {
      log('4. READ BACK', true, `Found: ${data.first_name} ${data.last_name} in ${data.city}`);
    } else {
      log('4. READ BACK', false, 'No data returned');
    }
  } catch (e) {
    log('4. READ BACK', false, e.message);
  }

  // ── Step 5: Delete test data ─────────────────────────────────────
  try {
    const { error } = await sb.from('insurance_clients').delete().eq('id', TEST_CLIENT_ID);
    if (error) throw error;
    log('5. DELETE', true, 'Test client cleaned up');
  } catch (e) {
    log('5. DELETE', false, e.message);
  }

  // ── Step 6: Verify deletion ──────────────────────────────────────
  try {
    const { data, error } = await sb.from('insurance_clients').select('id').eq('id', TEST_CLIENT_ID);
    if (error) throw error;
    if (data.length === 0) {
      log('6. VERIFY DELETE', true, 'Confirmed: test row gone');
    } else {
      log('6. VERIFY DELETE', false, `Still found ${data.length} rows!`);
    }
  } catch (e) {
    log('6. VERIFY DELETE', false, e.message);
  }

  // ── Step 7: Test with V1-style ID (non-UUID) ────────────────────
  const v1StyleId = `sim_c_${Date.now()}`;
  try {
    const { error } = await sb.from('insurance_clients').insert({
      ...testRow,
      id: v1StyleId,
    });
    if (error) throw error;
    log('7. V1-STYLE ID', true, `V1 string ID accepted: ${v1StyleId}`);
    // cleanup
    await sb.from('insurance_clients').delete().eq('id', v1StyleId);
  } catch (e) {
    log('7. V1-STYLE ID', false, `V1 string ID REJECTED: ${e.message}`);
    log('7a. IMPLICATION', false, 'V1 island IDs (sim_c_xxx) will FAIL on insert. Schema needs TEXT id or code needs UUID generation.');
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('═══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
