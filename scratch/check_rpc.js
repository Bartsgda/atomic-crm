
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SB_SECRET_KEY);

async function testRPC() {
  console.log("Checking if RPC 'execute_sql' exists on", process.env.VITE_SUPABASE_URL);
  const { data, error } = await supabase.rpc('execute_sql', { query: 'SELECT 1' });
  
  if (error) {
    console.log("RPC Failed:", error.code, error.message);
  } else {
    console.log("RPC Success! Data:", data);
  }
}
testRPC();
