# CRM ALINA — progres

## Faza A — fundamenty online (gotowe, 2026-04-19)

Architektura "dane żyją w Supabase" z envelope encryption, snapshotami i bug-botem.

### Bezpieczeństwo
- **Google OAuth** (AuthBarrier) — tylko autoryzowane konta tenantu Alina
- **Envelope encryption**: per-tenant DEK (AES-256-GCM) zawinięty hasłem użytkownika (PBKDF2-SHA256 600k iter). Każdy user ma własny `wrapped_dek` w `tenant_keys` — admin może odzyskać DEK i wystawić nowy wrap dla użytkownika, który zapomniał hasła.
- **Szyfrowane pola (per wiersz, DEK w pamięci sesji):**
  - Client: `pesel`, `phones`, `emails`, `street`, `city`, `zip_code`
  - Policy: `policy_number`, `vehicle_reg`, `home_details`
  - Reszta plaintext — wyszukiwanie po nazwisku/marce/kwocie działa
- **RLS** na wszystkich tabelach: `tenant_id = current_tenant_id() OR is_insurance_admin()`

### Tabele
| Tabela | Rola |
|--------|------|
| `tenants` | Rejestr tenantów (na start: Alina Insurance) |
| `sales` | Profile userów (insurance_role: owner/admin/agent/viewer) |
| `tenant_keys` | Wrapped DEK per user |
| `insurance_clients`, `policies`, `policy_notes`, `sub_agents`, `insurers`, `terminations`, `insurance_trash` | Dane CRM |
| `insurance_snapshots` | Punkty przywrócenia (pełny dump jsonb) — admin only |
| `insurance_feedback` | Zgłoszenia bug/idea z miniaturką (bug-bot) |

### Role i użytkownicy (produkcja)
- `redroadai@gmail.com` — **owner / admin**
- `alinakwidzinska@gmail.com` — **agent** (ubezpieczeniowiec, tester)

### UI
- **StatusEye** (prawy dolny róg) — jedna ikona 👁 łączy:
  - Google user (avatar + email + wyloguj)
  - Status Supabase (ping co 30s)
  - Odliczanie sesji 2h
  - "Zgłoś problem" → element picker → mini-screenshot (html2canvas, JPEG q=0.5) → modal (severity + opis) → `insurance_feedback`
- **PassphraseGate** po Google login — modal hasła odszyfrowujący DEK
- **SnapshotDialog** (admin only, ikona Camera w dock) — tworzenie i przywracanie snapów
- **Dock** w sidebarze:
  - Admin: Camera (snapshot) + Plus (dodaj klient) + Trash (nuclear reset z potwierdzeniem "USUŃ WSZYSTKO")
  - Agent: tylko Plus

### Skrypty / dane
- `scripts/bootstrap_tenant.mjs` — generuje DEK + seeduje 20 klientów / 35 polis / 15 notatek (Test123!)
- `test-data/fake_alina_seed.json` — fikcyjne dane

### Migracje SQL (zaaplikowane)
- `20260418_insurance_extension.sql`
- `20260419_fix_insurance_schema.sql`
- `20260420_tenant_keys.sql`
- `20260420_snapshots.sql`
- `20260420_feedback.sql`

## Faza B — deployment (✅ GOTOWE 2026-04-19)

Target: **Hostido podfolder** `redroad.pl/alina` (NIE subdomena — hosting klient)
Live URL: **https://redroad.pl/alina/**

### Co zrobione
- [x] Vite build z `base=/alina/` (env `VITE_BASE_PATH`)
- [x] `public/.htaccess` z RewriteBase `/alina/` + SPA fallback + security headers
- [x] **CSP override** — rodzicielski `.htaccess` redroad.pl ustawiał ciasny CSP blokujący Supabase. Nasz header `unset Content-Security-Policy` + nowy z `connect-src` do `xqznrssrlnxqkdvisnck.supabase.co` i Google OAuth.
- [x] PWA **wyłączone** w produkcji (`VitePWA({ disable: true })`) — service worker na podfolderze kolidował z hash-fragment auth flow Supabase
- [x] Sourcemaps wyłączone (`build.sourcemap: false`) — redukcja z 21 MB do 6.6 MB
- [x] Deploy przez FTP (`deploy@redroad.pl`) → `/domains/redroad.pl/public_html/alina/`
- [x] Extract w panelu DirectAdmin (SSH klucz ma passphrase — ominięte przez ręczny extract)
- [x] Google OAuth — redirect URI `https://xqznrssrlnxqkdvisnck.supabase.co/auth/v1/callback` (już był)
- [x] Supabase Auth URL Config — `Site URL = https://redroad.pl/alina/` + allow-list `/alina/**`
- [x] **Produkcja żyje** — logowanie Google + passphrase + dane z Supabase

### Infrastruktura CONSIS zaktualizowana
- `.mcp.json` — zarejestrowany `RedRoad-Hostido` MCP (5 narzędzi)
- `BAZA_WIEDZY/HOSTING/HOSTIDO.md` — poprawiony SSH port (22→64321), klucz (`id_ed25519_clean`), FTP user, dodany klucz vault `HOSTIDO_SSH_KEY_PASS`
- `BAZA_WIEDZY/HOSTING/WEBD.md` — nowy, info że webd.pl zamknięty (koniec abonamentu 2026-03-26)
- `hostido_server.py` — obsługa kluczy SSH z passphrase (`HOSTIDO_SSH_KEY_PASS`) + próbuje Ed25519/RSA/ECDSA

## Faza C (planowana) — offline & UX

- Service Worker + IndexedDB cache
- Write queue przy braku internetu → auto-push po powrocie
- Toast po każdym zapisie do Supabase
- Import XLSX z prawdziwymi danymi (dry-run + walidacja)

## Faza D — izolowane środowisko testowe (✅ GOTOWE 2026-05-01)

Implementacja izolacji schematowej (`test`) zamiast osobnego projektu, aby zachować spójność Google OAuth i łatwość zarządzania.

### Co zrobione
- [x] **Schema-level Isolation**: Dodanie wsparcia dla dynamicznych schematów w `getSupabaseClient`.
- [x] **Config Switch**: Nowy plik `.env.alina.test` celujący w schemat `test`.
- [x] **DDL Stabilization**: Skrypt `FIX_TEST_SCHEMA_LEGACY.sql` naprawiający braki w kolumnach legacy (`v1_original_id`) w schemacie `test`.
- [x] **Security Sync**: Synchronizacja tabel `tenants` i `tenant_keys` (bez kolumny `updated_at`, której brak w projekcie ALINA) w celu poprawnego działania `PassphraseGate`.
- [x] **Verification**: Skrypt `verify_test_schema.mjs` do audytu stabilności środowiska testowego.
- [x] **Documentation**: Utworzenie `DOCS_TEST_ENVIRONMENT.md` opisującego architekturę połączenia.

## Faza E — security + UX feedback (sesja 2026-05-04)

### Sekrety do rrv vault (DOM, opus)
- [x] `.env.alina.{prod,test}` + `.env.e2e` + `scratch/{probe_supabase,run_migrations}.js` — plaintext Supabase keys → markery `<rrv:CRM_ALINA_*>`
- [x] **`switch_env.ps1` v2** — przy `START_ALINA_*.bat` ekspanduje markery przez `rrv get` i zapisuje plaintext do gitignored `.env.development.local` (Vite to czyta). Tryby: `prod` / `test` / `e2e` / `dev`.
- [x] Vault: `CRM_ALINA_SB_SECRET`, `CRM_ALINA_SB_PUBLISHABLE`, `CRM_ALINA_SUPABASE_URL`, `CRM_ALINA_E2E_SERVICE_ROLE`, `CRM_ALINA_E2E_SB_PUBLISHABLE`. Usunięte duplikaty `SB_PUBLISHABLE_KEY`, `VITE_SB_PUBLISHABLE_KEY`.
- [x] `git reset --soft b63466f` cofnął 4 brudne lokalne commity (NIGDY nie pushowane). Czysty stan jako `8e48385` na `origin/main`.
- [ ] **Otwarte (weekend)**: rotacja kluczy alina prod (HTTP 200 nadal), reflog purge, sweep konwersacji Claude/Antigravity.

### Fixy z `insurance_feedback` (3 uwagi Aliny + 1 Bartka, commit `12295ab`)
- [x] **F1 (bug)** — `policyEndDate` przeliczony od `policyStartDate` przez useEffect-watcher (`PolicyFormModal.tsx`). Skip przy initial load żeby nie nadpisać istniejących polis. Rok ochrony = startDate + 1 rok − 1 dzień.
- [x] **F3 (idea)** — TAB w „Nowy Klient" skacze tylko po `input/select/textarea` (`ClientFormModal.tsx`, onKeyDown na `<form>`), pomija ikony i divy.
- [x] **F4 (Bartek)** — domyślna strona po loginie = Kanban (`legacy-v1/App.tsx:39 useState<Page>('offers')`).
- [ ] **F2 (bug)** — „klient klik → wszystko się rozmyło" — wymaga reprodukcji od Aliny (pyta w drafcie maila u/4 → r-391496440917209547).

### Lista zgłoszeń + admin_reply (commit `f582d6d` + `ad2fe56`)
- [x] **Migracja** `20260504_feedback_admin_reply.sql` — `admin_reply` / `admin_reply_at` / `admin_reply_by` w `public` + `test` schema (DO block sprawdza istnienie). Plus 2 RPC: `toggle_my_feedback_resolved(uuid)` (user toggle status `open<->done` na własnym), `set_feedback_admin_reply(uuid, text)` (admin pisze odpowiedź). Duplikaty RPC w schemie `test` (PostgREST routuje schema z `VITE_SUPABASE_SCHEMA`).
- [x] **Service** `feedbackCapture.ts` — `listFeedback`, `toggleMyFeedbackResolved`, `setFeedbackAdminReply`, `isInsuranceAdmin` (cache 60s).
- [x] **UI `StatusEye.tsx`** — w panel-Eye nowy przycisk **„Moje zgłoszenia (N)"** / **„Wszystkie zgłoszenia"** dla admina, badge z liczbą open. Modal listy: severity badge, checkbox toggle (tylko swoje), data, message, `element_label`, `admin_reply`. Admin: widzi `user_email` + textarea admin_reply + Zapisz. User (Alina): admin_reply jako bąbelek „Odpowiedź".

### Workflow lokalnego testu (NIE deploy!)

**Schema separation:** ten sam projekt Supabase `xqznrssrlnxqkdvisnck`, dwie schemy:
- `public` = **prod** (alina.prod live na redroad.pl/alina/) — Alina realnie tu zgłasza, dodaje klientów/polis
- `test` = **piaskownica** (`VITE_SUPABASE_SCHEMA=test`) — bezpieczna do eksperymentów, struktura z `combined_migrations_test.sql`

**Lokalny test workflow:**
```
cd C:\BartsGda4\CRM-Atomic
.\START_ALINA_TEST.bat        # schema='test', port 5173
# → switch_env.ps1 expanduje rrv markery → .env.development.local (gitignored)
# → npm run dev
```
Login: admin `redroadai@gmail.com` lub agent `alinakwidzinska@gmail.com` / `Test123!`.

**Snapshot prod → test** (gdy chcesz odświeżyć piaskownicę realnymi danymi):
1. SQL Editor Supabase → wklej `supabase/migrations/20260504_feedback_admin_reply.sql` → Run (raz, dodaje admin_reply column w obu schemach)
2. SQL Editor → wklej `scratch/seed_test_from_prod.sql` → Run (truncate+insert dla `tenants`/`sales`/`clients`/`policies`/`insurance_notes`/`insurance_feedback`, dynamicznie po wspólnych kolumnach, ON CASCADE — bezpieczne, dotyczy tylko schemy `test`)

### ⚠️ Deploy ≠ git push

Komity (`12295ab`, `f582d6d`, `ad2fe56`) idą do **`origin/main` GitHub** — to **NIE jest deploy**. Wersja na `redroad.pl/alina/` zmienia się tylko gdy Bartek **manualnie**:
1. `cd CRM-Atomic && VITE_BASE_PATH=/alina/ npm run build`
2. ZIP `dist/`
3. FTP upload `deploy@redroad.pl` → `/domains/redroad.pl/public_html/alina/`
4. Extract w DirectAdmin

**NIE używamy** `RedRoad-Hostido` MCP do automatycznego deploy aliny — Bartek ma swój manualny flow z DirectAdmin extract (`HOSTIDO_SSH_KEY_PASS` w vault, ale używany rzadko, nie do CRM-ALINA).
