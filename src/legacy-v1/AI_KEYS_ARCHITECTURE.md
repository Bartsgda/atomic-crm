# Architektura kluczy AI (CRM-ALINA) — envelope encryption współdzielonym DEK

> Audyt dokumentacyjny 2026-07-25 (Bartek). Opisuje jak klucze API (Gemini) są
> przechowywane, szyfrowane i udostępniane frontowi CRM-ALINA. Read-only — nie
> zmienia kodu. Wpięty do indeksu `src/legacy-v1/CLAUDE.md` 2026-07-27 (sekcja „🤖 AI Asystent i bezpieczeństwo”).

## 1. Cel i zasada

Klucz API do Gemini (a w przyszłości: dowolna liczba kluczy per przeznaczenie)
**nigdy nie ląduje w bundlu JS ani w rrv-runtime frontu** — bundle jest publiczny
(precedens: `LEAK_GEMINI_REDROAD`, klucz konta redroadai@ już raz wyciekł przez
front, patrz `[[project_crm_ai_gemini_client_side_2026_07_24]]` w MEMO).

Zamiast tego klucz jest **szyfrowany tym samym mechanizmem co dane klientów
(PESEL, telefony, notatki)** — envelope encryption z DEK (Data Encryption Key)
odwiniętym hasłem aplikacji Aliny (PassphraseGate). Klucz:

- w spoczynku w bazie: zaszyfrowany blob (Google/atakujący z dostępem do DB go
  nie odczyta bez hasła aplikacji),
- w przeglądarce: odszyfrowany **dopiero po podaniu hasła**, żyje **tylko w
  pamięci sesji** (moduł-level `let` w `apiKeyStore.ts`, nie `localStorage`),
- czyszczony przy każdym zablokowaniu/wylogowaniu (idle timeout, sleep/hibernate,
  bfcache restore, wylogowanie — patrz § 5 poniżej).

To jest **rozszerzenie** istniejącego envelope encryption z
`services/crypto.ts` / `services/supabaseStorage.ts` (które szyfruje pola PII
klientów), nie osobny system.

## 2. Pełny flow (diagram tekstowy)

```
┌─────────────────────────── ZAPIS (admin) ───────────────────────────┐
│                                                                       │
│  Droga A: panel UI              Droga B: CLI backup                  │
│  Settings → AiKeysPanel.tsx     SET_AI_KEY.bat → set_ai_key.mjs      │
│  (admin już zalogowany,         (service_role, tylko hasło           │
│   ma DEK w pamięci)              wpisywane interaktywnie)            │
│         │                                │                           │
│         │ encryptField(                  │ deriveKEK(passphrase,     │
│         │   JSON.stringify(config),      │   salt z tenant_keys)     │
│         │   dek)                         │ unwrapDEK(...) → dek      │
│         │                                │ encryptField(JSON, dek)   │
│         ▼                                ▼                           │
│         └──────────► upsert public.tenant_config.encrypted_ai_config ┘
│                       (RLS: write tylko is_insurance_admin())
└───────────────────────────────────────────────────────────────────────┘

┌─────────────────────────── ODCZYT (Alina/admin loguje się) ─────────┐
│                                                                       │
│  EncryptionGate.tsx montuje PassphraseGate (bez DEK w pamięci)       │
│         │                                                            │
│         │ user wpisuje hasło aplikacji                               │
│         ▼                                                            │
│  PassphraseGate.handleSubmit():                                      │
│    1. deriveKEK(passphrase, salt, iterations)  [crypto.ts]           │
│    2. unwrapDEK(wrapped_dek, kek) → dek        [crypto.ts]           │
│    3. SELECT tenant_config.encrypted_ai_config WHERE tenant_id=...   │
│    4. decryptField(encrypted_ai_config, dek) → JSON                  │
│    5. apiKeyStore.setConfig(JSON.parse(json))  [best-effort,         │
│       błąd tylko console.warn — NIE blokuje logowania]               │
│         │                                                            │
│         ▼                                                            │
│  onUnlocked(dek) → EncryptionGate.handleUnlocked():                  │
│    supabaseStorage.setDEK(dek)  [żeby móc (de)szyfrować pola PII]    │
│    setUnlocked(true)                                                 │
│         │                                                            │
│         ▼                                                            │
│  Konsumenci w pamięci sesji (żaden nie widzi surowego bazowego bloba):│
│    geminiService.ts, chatService.ts, ocrService.ts,                  │
│    ai/KaratekaService.ts, ai/agents/ClientAgent.ts                   │
│    → apiKeyStore.get(purpose) + apiKeyStore.getModel(purpose)        │
└───────────────────────────────────────────────────────────────────────┘

┌─────────────────────────── LOCK / LOGOUT ────────────────────────────┐
│  EncryptionGate.lock() — wywoływane przez:                           │
│    • idle timeout 30 min (mousedown/keydown/touchstart/scroll)       │
│    • sleep/hibernate detection (visibilitychange, gap > 5 min)       │
│    • bfcache restore (pageshow, e.persisted)                         │
│    • auth state change → brak sesji / handleLogout()                 │
│  → supabaseStorage.setDEK(null) + apiKeyStore.clear()                │
│    (klucz AI znika z pamięci RAZEM z DEK — jedna operacja czyści oba)│
└───────────────────────────────────────────────────────────────────────┘
```

## 3. Model danych

**Tabela** `public.tenant_config` (migracja
`supabase/migrations/20260725000001_tenant_config_api_key.sql`):

| Kolumna | Typ | Opis |
|---|---|---|
| `tenant_id` | `uuid` PK, FK → `public.tenants(id)` | jeden wiersz per tenant (dla Aliny: `11111111-1111-1111-1111-111111111111`, stała hardcoded w kilku miejscach — patrz § 6) |
| `encrypted_ai_config` | `text` | JSON `{keys:[{purpose,label,key,model}]}` zaszyfrowany DEK (envelope, format `Base64(IV[12] ‖ ciphertext+GCM-tag)` z `encryptField`) |
| `updated_at` | `timestamptz` | trigger `set_updated_at_insurance` (istniejąca funkcja) |

⚠️ Komentarz nagłówkowy migracji (linia 7) mówi o kolumnie `encrypted_api_key`,
ale realna kolumna nazywa się **`encrypted_ai_config`** — drobny drift
komentarz/kod w samym pliku migracji, nieszkodliwy (kod wszędzie używa
poprawnej nazwy), ale myli przy czytaniu migracji w oderwaniu od reszty.

**RLS:**
- `SELECT` — `tenant_id = current_tenant_id() OR is_insurance_admin()` (każdy
  zalogowany user swojego tenanta może odczytać zaszyfrowany blob — potrzebne
  żeby PassphraseGate mógł go odszyfrować po stronie klienta).
- `INSERT`/`UPDATE` — tylko `is_insurance_admin() AND tenant_id = current_tenant_id()`
  (zapisuje wyłącznie admin — w praktyce Bartek/konto redroadai@).
- `GRANT select, insert, update TO authenticated` — RLS i tak ogranicza zapis do
  admina; grant sam w sobie nie otwiera nic dodatkowego.
- Funkcje pomocnicze `current_tenant_id()` / `is_insurance_admin()` są zdefiniowane
  poza zakresem tego audytu (nie czytane).

**Klient Supabase użyty do odczytu/zapisu:** zarówno `PassphraseGate.tsx` jak i
`AiKeysPanel.tsx` używają `getPublicSupabaseClient()` (nie `getSupabaseClient()`),
czyli klienta **zawsze przypiętego do schematu `public`** — niezależnie od
przełącznika CRM test/public (`getActiveSchema()`/`switchSchema()`). Innymi
słowy: **`tenant_config` (i `tenant_keys`, i `passphrase_lockouts`) zawsze żyją w
schemacie `public`**, nawet gdy Alina pracuje w trybie danych `test`
(`src/components/atomic-crm/providers/supabase/supabase.ts`).

## 4. Multi-key: `purpose` + `model`

`AiConfig.keys: AiKeyEntry[]`, każdy wpis: `{ purpose, label?, key, model }`
(`services/apiKeyStore.ts`).

- **`purpose`** — dowolny string, konwencja: `"main"` (czat/NLP/Karateka),
  `"ocr"` (skany dokumentów). Nowe przeznaczenia można dodać bez zmiany schematu
  (to tylko klucz w JSON-ie, nie kolumna DB).
- **`model`** — z katalogu `MODEL_OPTIONS` (`gemini-3.1-flash-lite` [default],
  `gemini-3.1-flash`, `gemini-3.5-flash`, `gemma-3-27b-it`), osobny per `purpose`.
- **Odczyt przez konsumentów:**
  - `apiKeyStore.get(purpose="main")` — dokładne dopasowanie `purpose` z
    niepustym `key`; jeśli brak → **pierwszy dowolny** klucz z niepustym `key`
    (fallback "any"); jeśli i tego brak → `process.env.API_KEY` (**tylko dev/
    localhost**, w buildzie przeglądarki `process` zwykle nie istnieje —
    otoczone `try/catch`).
  - **Wyjątek (S5, naprawa audytu bezpieczeństwa 2026-07-25):** dla
    `purpose="ocr"` fallback "any"/`process.env.API_KEY` jest CELOWO wyłączony
    — brak dokładnego dopasowania `purpose="ocr"` zwraca `null` twardo. Powód:
    OCR (skany dowodów/dokumentów tożsamości) nie może po cichu polecieć
    kluczem `"main"` — miesza limity/rozliczenia i utrudnia audyt „co poszło
    którym kluczem". Konsument (`ocrService.ts`) już dziś obsługuje `null`
    (pokazuje `console.warn` + zwraca `null`, UI ma pokazać „skonfiguruj klucz
    OCR"). Fallback "any" zostaje bez zmian dla wszystkich pozostałych
    `purpose` (w tym `"main"`).
  - `apiKeyStore.getModel(purpose="main")` — model z wpisu o danym `purpose`
    albo `DEFAULT_MODEL`.
- **Konsumenci** (5 miejsc, wszystkie w pamięci sesji, żaden nie czyta bazy
  bezpośrednio): `services/geminiService.ts`, `services/chatService.ts`
  (`purpose="main"`), `services/ocrService.ts` (`purpose="ocr"`),
  `ai/KaratekaService.ts`, `ai/agents/ClientAgent.ts` (oba bez jawnego
  `purpose` → domyślnie `"main"`).

## 5. Dwie drogi zapisu

### A) Panel admina — `components/Settings/AiKeysPanel.tsx`

Ścieżka normalna, dla admina zalogowanego w przeglądarce (ma DEK w pamięci
przez `supabaseStorage`, zaimportowany tu przez alias `services/storage.ts`
→ `export const storage = supabaseStorage; export { supabaseStorage };`
— to re-export, nie osobna implementacja).

Flow `handleSave()`:
1. Buduje `AiConfig` z lokalnego stanu `rows` (pomija wiersze z pustym `key`).
2. `apiKeyStore.setConfig(config)` — **efekt natychmiastowy w sesji**, działa
   nawet bez zapisu do bazy (np. testowanie klucza przed zapisem).
3. `supabaseStorage.getDEK()` — jeśli `null` (baza niedoszyfrowana), błąd UI
   „Zaloguj się (odblokuj bazę) aby zapisać" i **stop** (nie próbuje zapisu).
4. `encryptField(JSON.stringify(config), dek)` → Base64 envelope.
5. `upsert` do `tenant_config` (`onConflict: "tenant_id"`) przez
   `getPublicSupabaseClient()` — RLS wymusza `is_insurance_admin()`; błąd RLS
   (`42501` / regex na "row-level security|policy|permission|denied") mapowany
   na komunikat „Tylko administrator może zapisać klucze."

UI: input `type="password"` z przełącznikiem podglądu (Eye/EyeOff), `autoComplete="off"`,
nota RODO w panelu ("klucze nie opuszczają przeglądarki" — w sensie: nie w
plaintext, poza szyfrowanym transportem do `tenant_config`).

### B) CLI backup — `scripts/set_ai_key.mjs` + `SET_AI_KEY.bat`

Ścieżka awaryjna/bootstrap — do użycia **z terminala Bartka**, gdy panel jest
niedostępny albo trzeba ustawić klucz zanim admin pierwszy raz się zaloguje w
przeglądarce z tym hasłem. `SET_AI_KEY.bat` robi `rrv export-env --format ps`
(wstrzykuje sekrety z vault) → `node scripts/set_ai_key.mjs`.

Różnice względem panelu:
- Używa **`CRM_ALINA_SB_SECRET`** (service_role, z vault) zamiast publishable
  key + sesji przeglądarki — omija RLS bezpośrednio przez REST (`prefer:
  resolution=merge-duplicates`).
- Sam **odtwarza** `deriveKEK`/`unwrapDEK`/`encryptField` w Node
  (`node:crypto` `webcrypto`) — to świadomy **mirror** logiki z `crypto.ts`
  (komentarz w pliku: "mirror services/crypto.ts"), nie import (Node CLI poza
  bundlem Vite). Zmiana algorytmu w `crypto.ts` wymaga ręcznej synchronizacji
  tutaj.
- Interaktywnie pyta **tylko o hasło aplikacji** (ukryte, `readline` z
  wyciszonym stdout) — email (`CRM_AI_KEY_EMAIL`, default `redroadai@gmail.com`)
  i sam klucz Gemini (`CRM_ALINA_GEMINI_KEY` / fallback `GEMINI_API_KEY_1/2`)
  bierze z env (vault), żeby nie trafiły do historii powłoki/rozmowy z AI.
- Pobiera `user_id` przez Admin Auth API (`/auth/v1/admin/users`) po e-mailu,
  potem `tenant_keys` (wrapped_dek/kdf_salt/kdf_iterations) dla tego usera —
  odtwarza DEK lokalnie, żeby móc zaszyfrować config tym samym kluczem co
  przeglądarka.
- **Zapisuje TYLKO jeden wpis `purpose: "main"`** (`label: "Główny (CLI)"`,
  model zahardkodowany `"gemini-3.1-flash-lite"`) — patrz ryzyko w § 6.

## 6. Punkty uwagi / założenia (dla następnej sesji)

1. **CLI nadpisuje, nie scala.** `set_ai_key.mjs` robi `upsert` całego wiersza
   `tenant_config` z configiem zawierającym wyłącznie klucz `"main"`. Jeśli
   admin wcześniej dodał w panelu drugi wpis (np. `"ocr"`), **uruchomienie
   `SET_AI_KEY.bat` po fakcie bezpowrotnie go skasuje** (nadpisze cały JSON,
   nie merguje po `purpose`). Nie ma dziś ostrzeżenia w skrypcie o tym ryzyku.
2. **Fallback iteracji PBKDF2 się różni** między miejscami, gdy `tenant_keys.kdf_iterations`
   jest `NULL`: `PassphraseGate.tsx` → `310_000`, `set_ai_key.mjs` → `600_000`.
   W praktyce nieszkodliwe dopóki `kdf_iterations` jest zawsze wypełnione przy
   inicjalizacji konta (poza zakresem tego audytu — prawdopodobnie
   `scripts/bootstrap_tenant.mjs`), ale to rozbieżność do pilnowania, gdyby
   kiedyś kolumna została puste.
3. **Ładowanie klucza AI w `PassphraseGate` jest best-effort.** Błąd
   odszyfrowania/parsowania `encrypted_ai_config` (np. zepsuty JSON, DEK z
   innej epoki) loguje tylko `console.warn` i **nie blokuje** odblokowania
   aplikacji — user wchodzi do CRM, ale funkcje AI po prostu nie mają klucza
   (`apiKeyStore.get()` zwróci `null`, konsumenci pokażą swój własny błąd "brak
   klucza").
4. **`tenant_config` (i `tenant_keys`, `passphrase_lockouts`) zawsze w schemacie
   `public`**, niezależnie od przełącznika danych CRM test/public — bo
   `PassphraseGate`/`AiKeysPanel` używają `getPublicSupabaseClient()`, nie
   `getSupabaseClient()`. Ktoś budujący nową funkcję AI-key-aware w trybie
   `test` powinien to mieć na uwadze (klucz i tak przyjdzie z `public`).
   Zob. `src/components/atomic-crm/providers/supabase/supabase.ts`.
5. **Jeden wiersz = jeden tenant = jeden DEK.** Dziś jest tylko tenant Aliny
   (`11111111-1111-1111-1111-111111111111`), hardcoded jako fallback w 4
   miejscach niezależnie (`supabaseStorage.ts`, `EncryptionGate.tsx`,
   `AiKeysPanel.tsx`, `set_ai_key.mjs`) — każde czyta `VITE_SUPABASE_TENANT_ID`
   z env, z tym samym literałem jako fallback. Multi-tenant (gdyby kiedyś
   powstał) wymagałby przeglądu wszystkich czterech miejsc.
6. **Klucz AI dzieli DEK z danymi klienta** — to świadoma decyzja (jeden sekret
   do zapamiętania przez Alinę), ale też oznacza: **rotacja/reset hasła
   aplikacji = trzeba też ponownie zaszyfrować `tenant_config`** (tak jak każde
   inne zaszyfrowane pole), inaczej stary blob zostanie nieodczytywalny nowym
   DEK. Nie widziałem w przeczytanych plikach automatycznego re-encrypt przy
   zmianie hasła — jeśli taki flow istnieje, żyje poza tym zestawem plików.
7. **`apiKeyStore` jest module-level singleton (nie React context/store)** —
   działa bo JS moduł jest per-tab, ale oznacza że wielokrotny import w
   różnych częściach drzewa komponentów dzieli ten sam stan bez potrzeby
   Context Providera. Naturalna konsekwencja: nie da się mieć dwóch różnych
   "sesji" kluczy w jednej karcie przeglądarki (nie jest to potrzebne dziś).

## Pliki źródłowe (odczytane w tym audycie)

- `src/legacy-v1/services/crypto.ts` — envelope encryption (deriveKEK/unwrapDEK/encryptField/decryptField/looksEncrypted)
- `src/legacy-v1/services/apiKeyStore.ts` — magazyn kluczy w pamięci sesji
- `src/legacy-v1/components/PassphraseGate.tsx` — odblokowanie DEK + załadowanie klucza AI
- `src/legacy-v1/components/EncryptionGate.tsx` — cykl życia DEK (unlock/lock/idle/suspend/bfcache)
- `src/legacy-v1/services/supabaseStorage.ts` — `SupabaseStorageManager.{setDEK,hasDEK,getDEK}` (linie ~346-352)
- `src/legacy-v1/services/storage.ts` — alias/re-export `supabaseStorage` (linie 761/766-767)
- `supabase/migrations/20260725000001_tenant_config_api_key.sql` — tabela + RLS
- `src/legacy-v1/components/Settings/AiKeysPanel.tsx` — panel admina
- `scripts/set_ai_key.mjs` + `SET_AI_KEY.bat` — CLI backup
- `src/components/atomic-crm/providers/supabase/supabase.ts` — `getPublicSupabaseClient` vs `getSupabaseClient` (kontekst schematu)
