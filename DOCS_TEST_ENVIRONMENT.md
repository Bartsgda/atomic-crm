# CRM-Atomic: Test Environment (Schema-based)

This document describes the architecture and setup of the isolated test environment for the CRM-Atomic project.

## 🏗️ Architecture

Instead of using a separate Supabase project (which would break Google OAuth redirect URLs) or using table prefixes (which would require complex code changes), we use a **PostgreSQL Schema-based isolation**.

- **Production**: Uses the `public` schema.
- **Test**: Uses the `test` schema within the SAME database.

### Key Benefits
1. **OAuth Compatibility**: Uses the same production URL, so OAuth redirects continue to work.
2. **Code Simplicity**: The application logic remains the same; only the Supabase client configuration changes.
3. **Data Safety**: Production data in `public` is isolated from test operations in `test`.

## ⚙️ Configuration

The environment is switched using the `VITE_SUPABASE_SCHEMA` environment variable.

### Environment Files
- `.env.alina.prod`: `VITE_SUPABASE_SCHEMA=public`
- `.env.alina.test`: `VITE_SUPABASE_SCHEMA=test`

### Supabase Client Initialization
In `src/components/atomic-crm/providers/supabase/supabase.ts`:
```typescript
const schema = import.meta.env.VITE_SUPABASE_SCHEMA || 'public';
const supabase = createClient(url, key, {
  db: { schema }
});
```

## 🛠️ Setup & Stabilization

### 1. Schema Creation
The `test` schema must be exposed in the Supabase Management API (`db_schema` setting).

### 2. DDL Patch (Legacy V1 Support)
If the `test` schema was created from a base dump, it might miss legacy columns required by the V1 bridge.
Run `supabase/FIX_TEST_SCHEMA_LEGACY.sql` in the Supabase SQL Editor.

### 3. Data Sync (Encryption)
To allow logging in with the same credentials and accessing encrypted data, the following tables must be synced from `public` to `test`:
- `tenants`
- `tenant_keys`

> [!WARNING]
> The `tenants` table in the ALINA project does NOT have an `updated_at` column. Ensure sync scripts reflect this.

## 🧪 Verification

To verify the test environment is correctly configured and stabilized:
```bash
node _archive_scratch_2026-05-17/verify_test_schema.mjs
```

This script checks for the existence of legacy columns and performs a test write/read operation in the `test` schema.
