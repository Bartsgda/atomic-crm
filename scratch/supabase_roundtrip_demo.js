import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SB_SECRET_KEY);
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

async function runDemo() {
  console.log('--- Supabase Round-Trip Demo Starting ---');

  // PHASE 1: INSERT
  console.log('\n[Phase 1] Inserting example data...');
  const { data: clients, error: clientErr } = await supabase.from('insurance_clients').insert([
    { first_name: 'Jan', last_name: 'Kowalski', tenant_id: TENANT_ID, is_fake: true, type: 'PERSON' },
    { first_name: 'Anna', last_name: 'Nowak', tenant_id: TENANT_ID, is_fake: true, type: 'PERSON' }
  ]).select();

  if (clientErr) throw clientErr;
  console.log(`Inserted ${clients.length} clients.`);

  const janId = clients.find(c => c.first_name === 'Jan').id;
  const { data: policies, error: policyErr } = await supabase.from('policies').insert([
    { client_id: janId, type: 'OC', tenant_id: TENANT_ID, is_fake: true, insurer_name: 'PZU' }
  ]).select();

  if (policyErr) throw policyErr;
  console.log(`Inserted ${policies.length} policy for ${janId}.`);

  // PHASE 2: PURGE
  console.log('\n[Phase 2] Purging test data (Deleting)...');
  const { error: delPolicyErr } = await supabase.from('policies').delete().eq('is_fake', true).eq('tenant_id', TENANT_ID);
  if (delPolicyErr) throw delPolicyErr;

  const { error: delClientErr } = await supabase.from('insurance_clients').delete().eq('is_fake', true).eq('tenant_id', TENANT_ID);
  if (delClientErr) throw delClientErr;
  console.log('Deletion complete.');

  // PHASE 3: VERIFY EMPTY
  console.log('\n[Phase 3] Verifying database is empty for this test...');
  const { count: cCount } = await supabase.from('insurance_clients').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('is_fake', true);
  const { count: pCount } = await supabase.from('policies').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('is_fake', true);
  
  console.log(`Count in insurance_clients: ${cCount}`);
  console.log(`Count in policies: ${pCount}`);

  if (cCount === 0 && pCount === 0) {
    console.log('✅ Verification successful: Database is empty.');
  } else {
    console.warn('❌ Verification failed: Some test data remains.');
  }

  // PHASE 4: RESTORE
  console.log('\n[Phase 4] Restoring data for final state...');
  const { data: clientsR, error: clientErrR } = await supabase.from('insurance_clients').insert([
    { first_name: 'Jan', last_name: 'Kowalski', tenant_id: TENANT_ID, is_fake: true, type: 'PERSON' },
    { first_name: 'Anna', last_name: 'Nowak', tenant_id: TENANT_ID, is_fake: true, type: 'PERSON' }
  ]).select();
  
  const janIdR = clientsR.find(c => c.first_name === 'Jan').id;
  await supabase.from('policies').insert([
    { client_id: janIdR, type: 'OC', tenant_id: TENANT_ID, is_fake: true, insurer_name: 'PZU' }
  ]);

  console.log('✅ Restoration complete. Data is back in Supabase.');
  console.log('\n--- Demo Finished ---');
}

runDemo().catch(console.error);
