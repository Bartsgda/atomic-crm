/**
 * Migration: Add v1_original_id columns to support V1 island round-trip IDs.
 * Run: node scratch/migrate_v1_columns.mjs
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://xqznrssrlnxqkdvisnck.supabase.co',
  process.env.SUPABASE_MGMT_TOKEN  // 1h service role key
);

const migrations = [
  // insurance_clients
  `ALTER TABLE insurance_clients ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL`,
  // policies
  `ALTER TABLE policies ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL`,
  `ALTER TABLE policies ADD COLUMN IF NOT EXISTS v1_original_client_id TEXT DEFAULT NULL`,
  // policy_notes
  `ALTER TABLE policy_notes ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL`,
  `ALTER TABLE policy_notes ADD COLUMN IF NOT EXISTS v1_original_client_id TEXT DEFAULT NULL`,
  // insurance_trash
  `ALTER TABLE insurance_trash ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL`,
  // sub_agents
  `ALTER TABLE sub_agents ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL`,
];

async function main() {
  console.log('\n=== MIGRATION: Add v1_original_id columns ===\n');

  for (const sql of migrations) {
    const tableName = sql.match(/ALTER TABLE (\w+)/)?.[1] || '?';
    const colName = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] || '?';
    
    try {
      const { error } = await sb.rpc('exec_sql', { sql_text: sql });
      if (error) {
        // rpc might not exist, try raw SQL via REST
        throw error;
      }
      console.log(`✅ ${tableName}.${colName}: OK`);
    } catch (e) {
      console.log(`⚠️  ${tableName}.${colName}: RPC failed (${e.message}), trying alternative...`);
      
      // Alternative: try to insert a row with the column and see if it works
      // If the column already exists, it will just work
      try {
        const { error } = await sb.from(tableName).select(colName).limit(1);
        if (error && error.message.includes('does not exist')) {
          console.log(`❌ ${tableName}.${colName}: Column doesn't exist and cannot be added via API.`);
          console.log(`   → Run manually in Supabase SQL Editor:`);
          console.log(`   → ${sql};`);
        } else {
          console.log(`✅ ${tableName}.${colName}: Already exists`);
        }
      } catch (e2) {
        console.log(`❌ ${tableName}.${colName}: ${e2.message}`);
      }
    }
  }

  // Test: can we write to v1_original_id?
  console.log('\n=== WRITE TEST ===');
  const testUUID = crypto.randomUUID();
  try {
    const { error } = await sb.from('insurance_clients').insert({
      id: testUUID,
      tenant_id: '11111111-1111-1111-1111-111111111111',
      first_name: 'V1_MIGRATION_TEST',
      last_name: 'DELETEME',
      v1_original_id: 'sim_c_test_12345',
      source: 'manual',
      is_fake: true,
    });
    if (error) throw error;
    console.log(`✅ Write with v1_original_id: OK`);
    
    // Read back
    const { data } = await sb.from('insurance_clients').select('id, v1_original_id').eq('id', testUUID).single();
    console.log(`✅ Read back: id=${data?.id}, v1_original_id=${data?.v1_original_id}`);
    
    // Cleanup
    await sb.from('insurance_clients').delete().eq('id', testUUID);
    console.log(`✅ Cleanup: OK`);
  } catch (e) {
    console.log(`❌ Write test failed: ${e.message}`);
    if (e.message.includes('v1_original_id')) {
      console.log('\n⚠️  Column v1_original_id does not exist yet.');
      console.log('   Please run this SQL in Supabase SQL Editor:\n');
      migrations.forEach(sql => console.log(`   ${sql};`));
    }
    // cleanup anyway
    await sb.from('insurance_clients').delete().eq('id', testUUID).catch(() => {});
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
