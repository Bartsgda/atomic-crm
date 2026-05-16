import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;
let publicSupabaseClient: SupabaseClient | null = null;
let archiveSupabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      {
        db: {
          schema: import.meta.env.VITE_SUPABASE_SCHEMA || "public",
        },
      },
    );
  }
  return supabaseClient;
};

/** Klient zawsze w schemacie public — do tabel auth-side (tenant_keys, tenants).
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

/**
 * Klient do schematu `test` — read-only archiwum historyczne (XLSX 2025).
 * Używany przez "Wczytaj historię" w StatusEye (2026-05-16).
 * NIE zapisuj nigdy do tego klienta — tylko select.
 * UWAGA 2026-05-16: NIE ustawiaj `persistSession: false` — RLS na test
 * schema może wymagać `authenticated` role. Akceptujemy multi-GoTrueClient warning.
 */
export const getArchiveSupabaseClient = () => {
  if (!archiveSupabaseClient) {
    archiveSupabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      { db: { schema: "test" } },
    );
  }
  return archiveSupabaseClient;
};
