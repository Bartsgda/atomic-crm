
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SB_SECRET_KEY);

async function getColumnTypes() {
  console.log("--- Column Types Investigation ---");
  
  // We'll try to insert a single row with an object into 'phones' 
  // and see if it fails with telltale error messages.
  
  const dummyClient = {
    id: `temp_${Date.now()}`,
    tenant_id: '11111111-1111-1111-1111-111111111111',
    first_name: 'Test',
    last_name: 'User',
    phones: 'just-a-string' // This should fail if it's text[]
  };

  const { error } = await supabase.from('insurance_clients').insert(dummyClient);
  
  if (error) {
    console.log(`Error when sending string to 'phones':`, error.message);
  } else {
    console.log(`Success! 'phones' is just a TEXT column.`);
  }

  // Try again with an array
  const { error: error2 } = await supabase.from('insurance_clients').insert({
    ...dummyClient,
    id: `temp_${Date.now()}_2`,
    phones: ['array-item']
  });

  if (error2) {
    console.log(`Error when sending array to 'phones':`, error2.message);
  } else {
    console.log(`Success! 'phones' is an ARRAY column.`);
  }
}

getColumnTypes();
