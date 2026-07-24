import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

const SCHEMA_KEY = "crm_active_schema";

/** Aktywny schemat danych — 'public' (prod) lub 'test' (sandbox).
 *  Persystowany w localStorage żeby przeżywał reload strony.
 *  Zapis przez switchSchema() — nigdy bezpośrednio.
 */
export const getActiveSchema = (): "public" | "test" => {
  try {
    // Dev mode (START_ALINA_TEST.bat): VITE_SUPABASE_SCHEMA=test wygrywa zawsze
    if (import.meta.env.VITE_SUPABASE_SCHEMA === "test") return "test";
    const v = localStorage.getItem(SCHEMA_KEY);
    return v === "test" ? "test" : "public";
  } catch {
    return "public";
  }
};

let supabaseClient: SupabaseClient | null = null;
let publicSupabaseClient: SupabaseClient | null = null;
let testSupabaseClient: SupabaseClient | null = null;

/** Główny klient danych — schema zależy od getActiveSchema().
 *  Gdy schema = 'test': supabaseStorage czyta/pisze test sandbox.
 *  Gdy schema = 'public': normalna produkcja.
 */
export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      { db: { schema: getActiveSchema() } },
    );
  }
  return supabaseClient;
};

/** Klient zawsze w schemacie public — do tabel auth-side (tenant_keys, tenants, configuration).
 *  UWAGA: NIE ustawiaj `persistSession: false` — PassphraseGate query do tenant_keys
 *  wymaga zalogowanego usera (RLS po user_id). 2026-05-16: incydent "konto
 *  niezainicjowane" gdy ta opcja była włączona.
 */
export const getPublicSupabaseClient = () => {
  if (!publicSupabaseClient) {
    publicSupabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      { db: { schema: "public" } },
    );
  }
  return publicSupabaseClient;
};

/** Klient zawsze w schemacie test — pełnoprawny sandbox (read + write).
 *  Używany gdy potrzeba jawnie schematu test niezależnie od trybu.
 *  UWAGA 2026-05-16: NIE ustawiaj `persistSession: false`.
 */
export const getTestSupabaseClient = () => {
  if (!testSupabaseClient) {
    testSupabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      { db: { schema: "test" } },
    );
  }
  return testSupabaseClient;
};

/** Przełącza aktywny schemat danych i przeładowuje stronę.
 *  NIGDY nie przełączaj test → public bez jawnego wywołania przez użytkownika.
 */
export const switchSchema = (schema: "public" | "test") => {
  localStorage.setItem(SCHEMA_KEY, schema);
  supabaseClient = null;
  window.location.reload();
};
