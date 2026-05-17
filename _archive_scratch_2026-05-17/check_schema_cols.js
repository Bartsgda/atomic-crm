
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SB_SECRET_KEY);

async function checkSchema() {
  // We can't query information_schema easily, but we can try to select one row
  // and see the structure.
  
  for (const table of ['insurance_clients', 'contacts']) {
    console.log(`\n--- Structure of [${table}] ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
       console.log(`Failed to read [${table}]: ${error.message}`);
    } else if (data && data.length > 0) {
       console.log(`One row:`, Object.keys(data[0]));
       // Log one specific field to see if it's an array
       if (data[0].phones) console.log(`Phones type:`, typeof data[0].phones, Array.isArray(data[0].phones) ? '(Array)' : '(String)');
    } else {
       console.log(`Table exists but is empty.`);
       // Try to get column names using a dummy insert error? No, too risky.
       // We'll trust the error message I got earlier.
    }
  }
}

checkSchema();
