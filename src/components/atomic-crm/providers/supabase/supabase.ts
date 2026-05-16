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
 *  Auth persistSession=false żeby NIE tworzył drugiego storage key (GoTrue conflict).
 */
export const getPublicSupabaseClient = () => {
  if (!publicSupabaseClient) {
    publicSupabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      {
        db: { schema: "public" },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return publicSupabaseClient;
};

/**
 * Klient do schematu `test` — read-only archiwum historyczne (XLSX 2025).
 * Używany przez "Wczytaj historię" w StatusEye (2026-05-16).
 * NIE zapisuj nigdy do tego klienta — tylko select.
 * Auth persistSession=false: nie chcemy drugiego/trzeciego GoTrue storage key.
 */
export const getArchiveSupabaseClient = () => {
  if (!archiveSupabaseClient) {
    archiveSupabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      {
        db: { schema: "test" },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return archiveSupabaseClient;
};
