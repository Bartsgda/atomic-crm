import fs from 'fs';

const PROJECT_REF = 'xqznrssrlnxqkdvisnck';
const MGMT_KEY = process.env.SUPABASE_MGMT_TOKEN;

// Extracted from the user's downloaded JSON
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function main() {
  console.log('Pushing real Google Cloud credentials to Supabase via Management API...');
  
  const updateResp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
        'Authorization': `Bearer ${MGMT_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      external_google_enabled: true,
      external_google_client_id: GOOGLE_CLIENT_ID,
      external_google_secret: GOOGLE_CLIENT_SECRET,
      site_url: 'http://localhost:5173',
      additional_redirect_urls: ['http://localhost:5173/v1', 'http://localhost:5173/']
    })
  });
  
  const status = updateResp.status;
  console.log('Update Status:', status);
  if (status !== 200) {
    console.log(await updateResp.text());
  } else {
    console.log('✅ Real Google Client ID & Secret fully configured on Supabase!');
  }
}

main().catch(console.error);
