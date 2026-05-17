/**
 * Add v1_original_id columns via Supabase Management API
 * Uses the sbp_ key (Management API / Service Role key)
 */

const PROJECT_REF = 'xqznrssrlnxqkdvisnck';
const MGMT_KEY = process.env.SUPABASE_MGMT_TOKEN;

const SQL = `
-- Add v1_original_id columns for V1 island round-trip ID preservation
ALTER TABLE insurance_clients ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS v1_original_client_id TEXT DEFAULT NULL;
ALTER TABLE policy_notes ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL;
ALTER TABLE policy_notes ADD COLUMN IF NOT EXISTS v1_original_client_id TEXT DEFAULT NULL;
ALTER TABLE insurance_trash ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL;
ALTER TABLE sub_agents ADD COLUMN IF NOT EXISTS v1_original_id TEXT DEFAULT NULL;
`;

async function main() {
  console.log('Running SQL migration via Supabase Management API...\n');
  console.log('SQL:\n' + SQL);

  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MGMT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });

  const status = resp.status;
  const text = await resp.text();
  
  console.log(`\nStatus: ${status}`);
  
  if (status === 201 || status === 200) {
    console.log('✅ Migration successful!');
    try {
      const data = JSON.parse(text);
      console.log('Response:', JSON.stringify(data, null, 2));
    } catch {
      console.log('Response:', text.substring(0, 500));
    }
  } else {
    console.log('❌ Migration failed');
    console.log('Response:', text.substring(0, 1000));
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
