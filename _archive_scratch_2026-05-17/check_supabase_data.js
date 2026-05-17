
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SB_SECRET_KEY; // Using Secret Key for admin access

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SECRET_KEY in .env.development.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  
  console.log(`--- Supabase Data Audit ---`);
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Target Tenant: ${TENANT_ID}`);
  console.log(`----------------------------`);

  const tables = ['insurance_clients', 'policies', 'policy_notes', 'sub_agents', 'insurers'];
  
  for (const table of tables) {
    // Total count
    const { count: total, error: errTotal } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    // Tenant count
    const { count: tenantCount, error: errTenant } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID);
    
    if (errTotal) {
      console.error(`[${table}] Error:`, errTotal.message);
    } else {
      console.log(`[${table}] Total Rows: ${total} | Current Tenant Rows: ${tenantCount}`);
    }
  }
}

checkData();
