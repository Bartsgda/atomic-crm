import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xqznrssrlnxqkdvisnck.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Sending invitations/Managing users...');

  // 1. Add airedroad@gmail.com
  const { data: user1, error: err1 } = await supabase.auth.admin.inviteUserByEmail('airedroad@gmail.com');
  if (err1) {
    if (err1.message.includes('already registered')) {
        console.log('✅ airedroad@gmail.com is already registered.');
    } else {
        console.error('❌ Failed to invite airedroad:', err1.message);
    }
  } else {
    console.log('✅ Invited airedroad@gmail.com:', user1.user.id);
  }

  // 2. Add alinakwidzinska@gmail.com
  const { data: user2, error: err2 } = await supabase.auth.admin.inviteUserByEmail('alinakwidzinska@gmail.com');
  if (err2) {
    if (err2.message.includes('already registered')) {
        console.log('✅ alinakwidzinska@gmail.com is already registered.');
    } else {
        console.error('❌ Failed to invite alina:', err2.message);
    }
  } else {
    console.log('✅ Invited alinakwidzinska@gmail.com:', user2.user.id);
  }
}

main().catch(console.error);
