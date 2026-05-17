import fs from 'fs';

const PROJECT_REF = 'xqznrssrlnxqkdvisnck';
const MGMT_KEY = process.env.SUPABASE_MGMT_TOKEN;

async function main() {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${MGMT_KEY}`,
      'Content-Type': 'application/json',
    }
  });

  const data = await resp.json();
  console.log('--- Supabase Auth Config ---');
  console.log('Google Enabled:', data.external_google_enabled);
  console.log('Google Client ID Set:', !!data.external_google_client_id);
  console.log('Google Secret Set:', !!data.external_google_secret);
  
  if (!data.external_google_enabled && data.external_google_client_id) {
     console.log('\nEnabling Google Provider...');
     const updateResp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${MGMT_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ external_google_enabled: true })
     });
     console.log('Update Status:', updateResp.status);
  }
}

main().catch(console.error);
