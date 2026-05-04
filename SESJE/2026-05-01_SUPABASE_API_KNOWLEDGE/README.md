# SESJA 2026-05-01: Stabilizacja CRM-Atomic TEST (Schema-based)

## 🎯 Cel
Zapewnienie bezpiecznego środowiska testowego, które nie psuje Google OAuth i korzysta z tej samej bazy danych (projekt ALINA), ale w izolacji schematowej.

## 🧠 Wiedza o Supabase Management API
Odkryto, że standardowa dokumentacja dotycząca `/config/postgrest` może nie działać dla wszystkich projektów.
- **Poprawny Endpoint**: `https://api.supabase.com/v1/projects/{ref}/postgrest`
- **Metoda**: `PATCH`
- **Kluczowe pole**: `db_schema` (string rozdzielony przecinkami, np. `"public,test,graphql_public"`)
- **UWAGA**: Ustawienie to jest krytyczne, aby PostgREST wystawił tabele z niestandardowego schematu do API.

## 🛠️ Procedura Izolacji Schematowej
1. **Baza danych**:
   - Stworzenie schematu `test`.
   - `GRANT USAGE ON SCHEMA test TO anon, authenticated, service_role;`
   - `GRANT ALL ON ALL TABLES IN SCHEMA test TO ...;`
   - **Stabilizacja V1**: Dodanie kolumn legacy (`v1_original_id`, `legacy_id`) do schematu `test`.
2. **PostgREST**:
   - Dodanie `test` do `db_schema` przez Management API.
   - Restart projektu lub `NOTIFY pgrst, 'reload config';`
3. **Aplikacja**:
   - Konfiguracja `supabase-js` z opcją `db: { schema: 'test' }`.
   - Automatyczne przełączanie przez `VITE_SUPABASE_SCHEMA` w plikach `.env`.
4. **Szyfrowanie (Client-side)**:
   - Skopiowanie `tenant_keys` i `tenants` z `public` do `test`.
   - **Główny błąd (Updated At)**: Tabela `tenants` w projekcie ALINA nie posiada kolumny `updated_at`. Skrypty synchronizacji muszą używać tylko: `id, name, slug, business_type, created_at`.

## 🔐 Bezpieczeństwo (Lekcja)
- Klucze API/Management nie powinny pojawiać się w logach poleceń (PowerShell).
- Należy dążyć do używania `search_path` i RLS nawet w schematach testowych.
- **Rygor Operatora**: Zmiany DDL w projektach bez RPC `execute_sql` muszą być wykonywane przez SQL Editor w Dashboardzie.

## 📁 Pliki i Zmiany
- `src/components/atomic-crm/providers/supabase/supabase.ts` (obsługa schematów)
- `.env.alina.test` (konfiguracja pod schemat `test`)
- `START_ALINA_TEST.bat` (uruchamianie w izolacji)
- `supabase/FIX_TEST_SCHEMA_LEGACY.sql` (patch struktury i danych)
- `scratch/verify_test_schema.mjs` (skrypt weryfikujący stabilność)
