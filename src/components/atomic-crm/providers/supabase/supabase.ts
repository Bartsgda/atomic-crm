import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;
let publicSupabaseClient: SupabaseClient | null = null;

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

/** Klient zawsze w schemacie public — do tabel auth-side (tenant_keys, tenants). */
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
