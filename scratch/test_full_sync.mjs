/**
 * FULL E2E SYNC TEST — Tests the EXACT flow that the V1 island uses.
 * Simulates: V1 creates client → sync to cloud (with UUID mapping) → read back → verify round-trip
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://xqznrssrlnxqkdvisnck.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

// ── Replicate the toUUID function from supabaseStorage.ts ──
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(s) { return UUID_REGEX.test(s); }

async function toUUID(v1Id) {
  if (!v1Id) return crypto.randomUUID();
  if (isValidUUID(v1Id)) return v1Id.toLowerCase();
  const encoded = new TextEncoder().encode(v1Id);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(hashBuffer);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  FULL V1→CLOUD SYNC SIMULATION TEST');
  console.log('═══════════════════════════════════════════\n');

  // ── Simulate V1 local data ──
  const v1ClientId = `sim_c_${Date.now()}_test`;
  const v1PolicyId = `sim_p_${Date.now()}_test`;
  
  console.log(`V1 Client ID: ${v1ClientId}`);
  console.log(`V1 Policy ID: ${v1PolicyId}`);

  // ── Step 1: Convert to UUID (simulating clientToRow) ──
  const dbClientId = await toUUID(v1ClientId);
  const dbPolicyId = await toUUID(v1PolicyId);
  
  console.log(`\nMapped Client UUID: ${dbClientId}`);
  console.log(`Mapped Policy UUID: ${dbPolicyId}`);

  // Verify determinism
  const dbClientId2 = await toUUID(v1ClientId);
  console.log(`\n✅ Deterministic check: ${dbClientId === dbClientId2 ? 'PASS' : 'FAIL'}`);

  // ── Step 2: Insert client ──
  try {
    const { error } = await sb.from('insurance_clients').upsert({
      id: dbClientId,
      tenant_id: TENANT_ID,
      first_name: 'TestSync',
      last_name: 'E2E_Verify',
      phones: null,
      emails: null,
      source: 'manual',
      is_fake: true,
      v1_original_id: v1ClientId,
    }, { onConflict: 'id' });
    if (error) throw error;
    console.log('✅ Client upsert: OK');
  } catch (e) {
    console.log(`❌ Client upsert FAILED: ${e.message}`);
    return;
  }

  // ── Step 3: Insert policy ──
  try {
    const { error } = await sb.from('policies').upsert({
      id: dbPolicyId,
      tenant_id: TENANT_ID,
      client_id: dbClientId,
      type: 'OC',
      stage: 'of_do_zrobienia',
      insurer_name: 'PZU',
      policy_number: 'TEST-001',
      premium: 1200,
      payment_status: 'UNPAID',
      policy_start_date: '2026-01-01',
      policy_end_date: '2027-01-01',
      source: 'manual',
      is_fake: true,
      v1_original_id: v1PolicyId,
      v1_original_client_id: v1ClientId,
    }, { onConflict: 'id' });
    if (error) throw error;
    console.log('✅ Policy upsert: OK');
  } catch (e) {
    console.log(`❌ Policy upsert FAILED: ${e.message}`);
  }

  // ── Step 4: Read back (simulating init/restore) ──
  try {
    const { data: clients, error: ce } = await sb.from('insurance_clients')
      .select('*').eq('id', dbClientId).single();
    if (ce) throw ce;
    
    const localId = clients.v1_original_id || clients.id;
    console.log(`\n✅ Read client: ${clients.first_name} ${clients.last_name}`);
    console.log(`   DB id: ${clients.id}`);
    console.log(`   V1 original: ${clients.v1_original_id}`);
    console.log(`   Restored local id: ${localId}`);
    console.log(`   Round-trip match: ${localId === v1ClientId ? '✅ PASS' : '❌ FAIL'}`);
  } catch (e) {
    console.log(`❌ Read client: ${e.message}`);
  }

  try {
    const { data: policy, error: pe } = await sb.from('policies')
      .select('*').eq('id', dbPolicyId).single();
    if (pe) throw pe;

    const localPolicyId = policy.v1_original_id || policy.id;
    const localClientRef = policy.v1_original_client_id || policy.client_id;
    console.log(`\n✅ Read policy: ${policy.insurer_name} ${policy.policy_number}`);
    console.log(`   DB id: ${policy.id}`);
    console.log(`   V1 original: ${policy.v1_original_id}`);
    console.log(`   Restored policy id: ${localPolicyId} ${localPolicyId === v1PolicyId ? '✅' : '❌'}`);
    console.log(`   Restored client ref: ${localClientRef} ${localClientRef === v1ClientId ? '✅' : '❌'}`);
  } catch (e) {
    console.log(`❌ Read policy: ${e.message}`);
  }

  // ── Step 5: Second upsert (simulate re-sync) — should UPDATE not duplicate ──
  try {
    const { error } = await sb.from('insurance_clients').upsert({
      id: dbClientId,  // same UUID
      tenant_id: TENANT_ID,
      first_name: 'TestSync_UPDATED',
      last_name: 'E2E_Verify',
      source: 'manual',
      is_fake: true,
      v1_original_id: v1ClientId,
    }, { onConflict: 'id' });
    if (error) throw error;

    const { data } = await sb.from('insurance_clients').select('first_name').eq('id', dbClientId).single();
    console.log(`\n✅ Re-sync upsert: ${data?.first_name === 'TestSync_UPDATED' ? 'UPDATED correctly' : 'FAILED - still old value'}`);
  } catch (e) {
    console.log(`❌ Re-sync: ${e.message}`);
  }

  // ── Step 6: Cleanup ──
  await sb.from('policies').delete().eq('id', dbPolicyId);
  await sb.from('insurance_clients').delete().eq('id', dbClientId);
  console.log('\n✅ Cleanup: done');

  console.log('\n═══════════════════════════════════════════');
  console.log('  TEST COMPLETE');
  console.log('═══════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
