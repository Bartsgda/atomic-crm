
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.development.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SB_SECRET_KEY; // service_role

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'test' }
});

async function checkColumns() {
  console.log("--- Skanowanie kolumn test.insurance_clients ---");
  
  // Próba pobrania definicji kolumn przez rpc lub bezpośredni select jeśli mamy uprawnienia
  // Ale najprościej: spróbujmy pobrać jeden rekord i zobaczyć co wróci w kluczach obiektu
  const { data, error } = await supabase
    .from('insurance_clients')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Błąd dostępu do tabeli:", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log("Dostępne kolumny:", Object.keys(data[0]).join(', '));
    if (Object.keys(data[0]).includes('v1_original_id')) {
      console.log("✅ Kolumna v1_original_id ISTNIEJE.");
    } else {
      console.log("❌ Kolumna v1_original_id BRAKUJE.");
    }
  } else {
    console.log("Tabela jest pusta, sprawdzam przez query do information_schema...");
    // Próba przez RPC exec_sql (jeśli Bartek go stworzył wcześniej)
    const { data: cols, error: colErr } = await supabase.rpc('execute_sql', {
      sql_query: "SELECT column_name FROM information_schema.columns WHERE table_schema = 'test' AND table_name = 'insurance_clients'"
    });
    
    if (colErr) {
       console.log("Nie można sprawdzić information_schema (brak RPC execute_sql).");
    } else {
       console.log("Kolumny z bazy:", cols.map(c => c.column_name).join(', '));
    }
  }
}

checkColumns();
