# WIEDZA_CRM.md — Baza wiedzy projektu CRM-Alina

> Żywy dokument. AI uzupełnia po każdej sesji.
> Format: sekcje tematyczne (nie chronologiczne). Sesje na dole.
> Nadrzędna dokumentacja modułowa: `src/legacy-v1/CLAUDE.md` (38 specyfikacji).

---

## Architektura

### Supabase — 3 klienty (supabase.ts)

```
getSupabaseClient()        → schema z VITE_SUPABASE_SCHEMA (default: 'public')
getPublicSupabaseClient()  → zawsze 'public' (PassphraseGate, tenant_keys, app_config)
getArchiveSupabaseClient() → zawsze 'test' (XLSX 2025 import, sandbox, kopia prod)
```

`supabaseStorage.ts` (~900 LOC) używa `getSupabaseClient()` do wszystkich operacji.
Singletons — przy zmianie schematu MUSI być nullowany `supabaseClient = null`.

**UWAGA:** `persistSession: false` powoduje incydent "konto niezainicjowane" w PassphraseGate
(RLS wymaga zalogowanego usera). Nigdy nie ustawiaj tej opcji.

### Tabele — layout public vs test

**W OBACH schematach (39):**
`insurance_clients`, `policies`, `policy_notes`, `sub_agents`, `policy_sub_agent_shares`,
`insurance_feedback`, `insurance_activity_log`, `insurance_login_log`, `insurance_snapshots`,
`insurance_trash`, `insurers`, `terminations`, `checklist_templates`, `configuration`,
`init_state`, `tenant_keys`, `tenants`, `activity_log` + atomic-crm (contacts/deals/tasks...).

**TYLKO w test (38):**
- v2 refactor: `vehicles`, `insured_persons`, `client_businesses`, `policy_note_links`,
  `flag_resolutions`, `homes`, `policy_terminations`, `client_attribute_history`
- Scratch slots: `slot_01` … `slot_30` (patrz `src/legacy-v1/SLOT_REGISTRY.md`)

**TYLKO w public:** nic — public jest podzbiorem test.

### Schema sync prod→test (w budowie, 2026-05-16)

Architektura "magicznego przycisku":
1. **Edge Function** `sync-prod-to-test` (service_role) — kopiuje 14 tabel insurance_*
   prod→test (TRUNCATE + INSERT SELECT). Tabel v2-only nie kasuje.
2. **`public.configuration`** wiersz `active_schema` = `'public'` | `'test'`
3. **Supabase Realtime** subscription na `configuration` — broadcast do WSZYSTKICH klientów
4. **`SchemaContext.tsx`** — globalny context React, persystowany przez Realtime
5. **`TestModeBanner.tsx`** — floating amber banner widoczny u Aliny i Bartka gdy test
6. NIGDY test→public (jednostronne)

Tabele do sync (14): `insurance_clients`, `policies`, `policy_notes`, `sub_agents`,
`policy_sub_agent_shares`, `insurance_feedback`, `insurance_activity_log`,
`insurance_login_log`, `insurance_snapshots`, `insurance_trash`, `insurers`,
`terminations`, `checklist_templates`, `init_state`.

### PassphraseGate + szyfrowanie

- Klucze (`tenant_keys`) zawsze z `public` schema przez `getPublicSupabaseClient()`
- DEK (AES-GCM) ustawiany raz w sesji po unwrap hasłem
- Szyfrowane: PESEL, tel, email, adres, data ur., pojazd, treść notatek
- Plaintext: imiona, nazwiska, firmy ubezpieczeniowe, kwoty, daty
- Idle timeout: 30 min + `visibilitychange` gap >5 min → lock (fix 2026-05-11)

### Deploy — FTP architecture

- FTP root `/` = `https://redroad.pl/`
- `/alina/` = `https://redroad.pl/alina/` ← target deployu
- `/public_html/alina/` = STARY/BŁĘDNY folder (był backdoor `unzip_helper.php`)
- Skrypt: `scripts/ftp_deploy.py` (full build, STOR per plik, backup przed overwrite)
- Rollback: `scripts/ftp_rollback.py <timestamp>`
- FTP cleanup starych bundle: `scripts/ftp_cleanup.py`

### Prowizje — model dwupulowy (krytyczne!)

Agent i pośrednik dostają **DWIE NIEZALEŻNE prowizje** od towarzystwa:
- `commission` = pełna prowizja agenta (Aliny)
- `subAgentCommission` / `policy_sub_agent_shares.amount` = osobna prowizja pośrednika
- Często oba = 4% — to NIE błąd
- `incomeNet = commission` (NIE commission − partner)

---

## Pułapki i anty-wzorce

### supabaseStorage.ts — krytyczne
- Musi pobierać `policy_sub_agent_shares` w `init()` i mapować na `subAgentSplits`
- NIE hardcode `subAgentSplits: []` w `rowToPolicy`

### Stage enum — DB check constraint
Zawsze underscore, bez polskich znaków:
`uciety_kontakt`, `przel_kontakt`, `sprzedaz`, `oferta_wyslana`, `of_do_zrobienia`,
`czekam_na_dane`, `rez_po_ofercie`

Porównanie w TS — ZAWSZE 3 formy sprzedaży:
```ts
const SOLD_STAGES = ['sprzedaż', 'sprzedany', 'sprzedaz'];
```

### XLSX import — CODE FREEZE pliki
`dataMapper.ts` + `legacyParser.ts` = NIE dotykaj. Wszystkie reguły w spec.

### FTP deploy — Vite hash files zostają
Po każdym build Vite generuje nowe `index-<hash>.js`. STOR nie kasuje starych.
Fix: `ftp_cleanup.py` przed deployem albo po (osobne odpalenie).

### PolicyFormModal — selectedClient nie był czyszczony
Bug 2026-05-11: `key={policy-modal-${dataVersion}}` nie wymuszał remountu.
Fix: `else { setSelectedClient(null); setSearchClientTerm(''); }` w ELSE branch.

### Sesja przeżywająca Sleep/Hibernate
`createClient()` bez `auth: { storage }` → defaultowo `persistSession=true`, JWT rok.
Fix 2026-05-11: IdleTimeout 30min + visibilitychange + pageshow bfcache listener.

### insurance_feedback — usuwanie false positives
Bartek 2026-05-16: wpisy o "czas Polska" (zegar systemowy, nie bug aplikacji) usunięte.
Pattern: `sb.schema("public").table("insurance_feedback").delete().in_("id", ids).execute()`

### Supabase MCP claude_ai_Supabase — permission error
MCP `claude_ai_Supabase` zwraca 403 dla projektu CRM-Alina.
Zamiast: Python + `supabase-py` + `rrv get CRM_ALINA_SB_SECRET`.

---

## Schematy danych (kluczowe pola)

### insurance_clients
`tenant_id='11111111-1111-1111-1111-111111111111'`, `source ∈ {'manual','xlsx_import'}`,
`phones`/`emails`/`businesses` = JSON arrays, `legacy_id = 'xlsx_2025_row_N'`

### policies
`type ∈ {'OC','AC','BOTH','DOM','PODROZ','ZYCIE','FIRMA'}`,
`stage` = underscore_no_polish, `auto_details`/`home_details`/... = JSONB

### sub_agents
`group_prefix ∈ {'firmowy','wlasny','partner',null}`, `default_rates` = JSONB

---

## Sesje

### 2026-05-16 — Magiczny przycisk prod→test (pełna implementacja)

**Zrobiono:**
- Usunięto 2 false-positive zgłoszenia "czas Polska" z `public.insurance_feedback`
- Zaimplementowano pełną architekturę schema sync — wszystkie 6 plików
- `supabase/migrations/20260516_sync_prod_to_test.sql` — sync_log + 3 funkcje SQL
- `supabase/functions/sync-prod-to-test/index.ts` — Edge Function (check/sync/switch)
- `src/.../supabase.ts` — `getActiveSchema()`, `switchSchema()`, `getTestSupabaseClient()`
- `src/legacy-v1/hooks/useSchemaSyncState.ts` — hook z Realtime subscription
- `src/legacy-v1/components/TestModeBanner.tsx` — floating amber "TRYB TESTOWY"
- `src/legacy-v1/components/StatusEye.tsx` — przycisk sync + dialog potwierdzenia z listą konfliktów
- `src/legacy-v1/components/EncryptionGate.tsx` — renderuje TestModeBanner
- Utworzono `ZASADY_CRM.md` i `WIEDZA_CRM.md` (ten plik)

**Otwarte (deploy):**
- Bartek: wklej `20260516_sync_prod_to_test.sql` w Supabase Dashboard SQL Editor
- Bartek: `npx supabase functions deploy sync-prod-to-test --project-ref xqznrssrlnxqkdvisnck`
- Test lokalny (`npm run dev`) → StatusEye → "Skopiuj prod→test" → deploy FTP PO teście

**Nowa wiedza:**
- `configuration` tabela: `{id: 1, config: jsonb}` — NIE key-value, używamy jsonb merge `config || '{...}'`
- Tylko 3 tabele mają `updated_at`: insurance_clients, policies, policy_notes — konfl. detekcja tylko na nich
- `exec_sql` RPC nie istnieje — migracje DDL tylko przez Supabase CLI lub Dashboard
- Brak `SUPABASE_DB_PASSWORD` w vault — `npx supabase db push` nie zadziała bez hasła
- `START_ALINA_TEST.bat` DEPRECATED — zastąpiony przełącznikiem schema w app
- Nowy test workflow: `npm run dev` → "Skopiuj prod→test" w app → test na żywych danych → FTP
- Alina MOŻE odpalić sync (świadoma decyzja) — dostaje floating banner z ostrzeżeniem
