
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.development.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SB_SECRET_KEY; // service_role

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' }
});

async function checkPublic() {
  console.log("--- Skanowanie kolumn public.insurance_clients ---");
  const { data, error } = await supabase.from('insurance_clients').select('*').limit(1);
  if (error) { console.error(error.message); return; }
  if (data && data.length > 0) {
    console.log("Kolumny:", Object.keys(data[0]).join(', '));
  } else {
    console.log("Tabela pusta, nie można sprawdzić przez select.");
  }
}
checkPublic();
