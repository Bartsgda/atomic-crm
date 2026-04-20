import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xqznrssrlnxqkdvisnck.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Inviting redroadai@gmail.com...');

  const { data: user1, error: err1 } = await supabase.auth.admin.inviteUserByEmail('redroadai@gmail.com');
  if (err1) {
    if (err1.message.includes('already registered')) {
        console.log('✅ redroadai@gmail.com is already registered.');
    } else {
        console.error('❌ Failed to invite:', err1.message);
    }
  } else {
    console.log('✅ Invited redroadai@gmail.com:', user1.user.id);
  }
}

main().catch(console.error);
