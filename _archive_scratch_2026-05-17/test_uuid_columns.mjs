/**
 * Test with proper UUID and check column types for phones/emails
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://xqznrssrlnxqkdvisnck.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

async function main() {
  console.log('\n=== UUID + COLUMN TYPE TEST ===\n');

  // Test 1: Use proper UUID
  const uuid = crypto.randomUUID();
  console.log(`Testing with proper UUID: ${uuid}`);

  // Test 1a: phones as null (should work)
  try {
    const { error } = await sb.from('insurance_clients').insert({
      id: uuid,
      tenant_id: TENANT_ID,
      first_name: 'Test',
      last_name: 'UUID_OK',
      phones: null,
      emails: null,
      source: 'manual',
      is_fake: true,
    });
    if (error) throw error;
    console.log('✅ Insert with UUID + null phones/emails: OK');
    await sb.from('insurance_clients').delete().eq('id', uuid);
    console.log('✅ Cleanup OK');
  } catch (e) {
    console.log(`❌ Insert with UUID: ${e.message}`);
  }

  // Test 2: phones as string (encrypted data would be a string)
  const uuid2 = crypto.randomUUID();
  try {
    const { error } = await sb.from('insurance_clients').insert({
      id: uuid2,
      tenant_id: TENANT_ID,
      first_name: 'Test',
      last_name: 'STRING_PHONES',
      phones: 'some_encrypted_base64_string',
      emails: 'another_encrypted_string',
      source: 'manual',
      is_fake: true,
    });
    if (error) throw error;
    console.log('✅ Insert with STRING phones/emails: OK (column is TEXT)');
    await sb.from('insurance_clients').delete().eq('id', uuid2);
  } catch (e) {
    console.log(`❌ Insert with STRING phones: ${e.message}`);
    if (e.message.includes('malformed array')) {
      console.log('   → Column is TEXT[] (array), not TEXT. Migration needed!');
    }
  }

  // Test 3: phones as array
  const uuid3 = crypto.randomUUID();
  try {
    const { error } = await sb.from('insurance_clients').insert({
      id: uuid3,
      tenant_id: TENANT_ID,
      first_name: 'Test',
      last_name: 'ARRAY_PHONES',
      phones: ['600123456', '500987654'],
      emails: ['test@test.pl'],
      source: 'manual',
      is_fake: true,
    });
    if (error) throw error;
    console.log('✅ Insert with ARRAY phones/emails: OK (column is TEXT[])');
    await sb.from('insurance_clients').delete().eq('id', uuid3);
  } catch (e) {
    console.log(`❌ Insert with ARRAY phones: ${e.message}`);
  }

  // Test 4: Read existing data to see actual format
  console.log('\n=== EXISTING DATA SAMPLE ===');
  const { data, error } = await sb.from('insurance_clients').select('id, first_name, last_name, phones, emails').eq('tenant_id', TENANT_ID).limit(3);
  if (error) {
    console.log(`❌ Read existing: ${error.message}`);
  } else {
    data.forEach(r => {
      console.log(`  ID: ${r.id} (${typeof r.id})`);
      console.log(`  Name: ${r.first_name} ${r.last_name}`);
      console.log(`  Phones: ${JSON.stringify(r.phones)} (type: ${typeof r.phones}, isArray: ${Array.isArray(r.phones)})`);
      console.log(`  Emails: ${JSON.stringify(r.emails)} (type: ${typeof r.emails}, isArray: ${Array.isArray(r.emails)})`);
      console.log('  ---');
    });
  }

  // Test 5: Check policies table
  console.log('\n=== POLICIES SAMPLE ===');
  const { data: pol, error: polErr } = await sb.from('policies').select('id, client_id, type, insurer_name').eq('tenant_id', TENANT_ID).limit(3);
  if (polErr) {
    console.log(`❌ Read policies: ${polErr.message}`);
  } else {
    pol.forEach(r => {
      console.log(`  ID: ${r.id} (${typeof r.id})`);
      console.log(`  client_id: ${r.client_id}`);
      console.log(`  type: ${r.type}, insurer: ${r.insurer_name}`);
      console.log('  ---');
    });
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
