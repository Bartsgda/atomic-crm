import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.development.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SB_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.development.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing Supabase connection to:', supabaseUrl)
  
  // Test Read
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Read Error:', error.message)
  } else {
    console.log('Read Success! Tenants found:', data.length)
    console.log('First Tenant:', data[0]?.name || 'No tenant name')
  }

  // Test Write (Dummy Note in insurance_activity_log if exists, or just check table list)
  const { data: tables, error: tableError } = await supabase
    .from('insurance_clients')
    .select('id')
    .limit(1)
    
  if (tableError) {
    console.error('Insurance Clients Table access error:', tableError.message)
  } else {
    console.log('Insurance Clients Table access confirmed.')
  }
}

testConnection()
