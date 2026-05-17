
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.development.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SB_SECRET_KEY; // service_role

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'test' }
});

async function checkKeys() {
  console.log("--- Skanowanie kolumn test.tenant_keys ---");
  const { data, error } = await supabase.from('tenant_keys').select('*').limit(1);
  if (error) { console.error("Error or Not Found:", error.message); return; }
  if (data && data.length > 0) {
    console.log("Znaleziono klucze!");
  } else {
    console.log("Brak kluczy w test.tenant_keys.");
  }
}
checkKeys();
