
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SB_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log(`--- Supabase Table Inventory ---`);
  
  // Query to list all tables in 'public' schema
  const { data, error } = await supabase.rpc('get_tables'); // If RPC exists, or use raw select if permitted

  // Alternative: query information_schema via standard select if possible, 
  // but Supabase usually restricts information_schema over PostgREST.
  // Best way to find out what tables exist is to try selecting from them or use a predefined RPC.
  
  // Since we don't know the RPCs, let's try a list of likely candidates based on dataProvider.ts and supabaseStorage.ts
  const candidates = [
    'insurance_clients', 'policies', 'policy_notes', 'sub_agents', 'insurers',
    'contacts', 'deals', 'contact_notes', 'deal_notes', 'companies', 'sales', 'activity_log'
  ];

  for (const table of candidates) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
       // console.log(`[${table}] Not found or Error: ${error.message}`);
    } else {
       console.log(`[${table}] Found! Rows: ${count}`);
    }
  }
}

listTables();
