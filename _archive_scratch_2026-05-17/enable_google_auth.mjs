import fs from 'fs';

const PROJECT_REF = 'xqznrssrlnxqkdvisnck';
const MGMT_KEY = process.env.SUPABASE_MGMT_TOKEN;

async function main() {
  console.log('Enabling Google Provider via Management API...');
  
  const updateResp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
        'Authorization': `Bearer ${MGMT_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      external_google_enabled: true,
      external_google_client_id: '123456789-placeholder.apps.googleusercontent.com',
      external_google_secret: 'GOCSPX-placeholder_secret_replace_me',
      // Allow redirecting back to localhost
      site_url: 'http://localhost:5173',
      additional_redirect_urls: ['http://localhost:5173/v1', 'http://localhost:5173/']
    })
  });
  
  const status = updateResp.status;
  console.log('Update Status:', status);
  if (status !== 200) {
    console.log(await updateResp.text());
  } else {
    console.log('✅ Supabase Auth configured successfully (Google Enabled)!');
  }
}

main().catch(console.error);
