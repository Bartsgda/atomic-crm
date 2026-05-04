# CRM ALINA — następna sesja (TODO)

**Status produkcji:** ✅ https://redroad.pl/alina/ — żyje. Admin: `redroadai@gmail.com`, Agent: `alinakwidzinska@gmail.com`, hasło szyfrowania: `Test123!`.

> 📜 **Pełen log sesji 2026-05-04** w `PROGRESS.md § Faza E` (sekrety→rrv, fixy F1/F3/F4, admin_reply feature).

## 🎯 Priorytet — Alina ZGŁASZA NA ŻYWO

Status 2026-05-04: **Alina aktywnie używa, ma 3 zgłoszenia w `insurance_feedback`** (nie tylko fake'i).
- [x] F1 — rok ochrony od daty startu (`PolicyFormModal`) ✓ commit `12295ab`
- [x] F3 — TAB tylko po inputach w „Nowy Klient" (`ClientFormModal`) ✓ commit `12295ab`
- [x] F4 — domyślnie Kanban po loginie (`legacy-v1/App.tsx:39`) ✓ commit `12295ab`
- [x] Lista zgłoszeń z checkboxami + admin_reply w StatusEye ✓ commit `f582d6d`+`ad2fe56`
- [ ] **F2 — „klient klik → wszystko się rozmyło"** ⏸ czeka na reprodukcję od Aliny (mail draft u/4→`r-391496440917209547`)

## 🐛 Do naprawy (znane usterki)

- [ ] **BackupManager "Generate Demo" crash na policy_notes** (HTTP 400) — seed generuje payload niekompatybilny z naszym mapper'em. Agent ma ukryte, ale dla admina warto naprawić albo wywalić.
- [ ] **Screenshot w feedback = null** (html2canvas nie łapie wszystkich elementów — problem z overflow/filter CSS). Do zbadania na realnym przykładzie od Aliny.
- [ ] **Chunk `index-*.js` = 3.5 MB** (ostrzeżenie vite). Zrobić code splitting przez `manualChunks` (np. osobno `supabase-js`, `lucide-react`, `html2canvas`, V1 moduły).

## ✨ Nowe funkcje — Faza C

### C.1 Admin Inbox — przegląd feedbacku
Panel gdzie admin widzi listę zgłoszeń z `insurance_feedback`:
- Filtry: status (open/seen/done), severity, user
- Kliknięcie → modal z screenshotem, page_label, page_context, message
- Przyciski: oznacz jako `seen`/`done`/`rejected`
- Odpowiedź do usera (nowa kolumna `admin_reply` + edge function wysyłająca email)

### C.2 Offline queue
- Service Worker (Workbox) cache'uje assety
- IndexedDB kolejka write-actions gdy offline
- Auto-push przy `online` event
- Wskaźnik w StatusEye: 🟡 "3 zmiany w kolejce"

### C.3 Admin recovery kluczy
UI dla ownera (Bartek):
- Lista userów + ich `tenant_keys` (wrapped_dek + is_recovery)
- Przycisk "Zresetuj hasło" — wprowadź swoje hasło admin → wyciągnij DEK → zaszyfruj nowym tymczasowym hasłem dla Aliny → wpisz nowy rekord
- UX "zapomniałem hasła" dla Aliny w PassphraseGate → "Skontaktuj się z administratorem" (już jest komunikat, brakuje backendu)

### C.4 Import XLSX Aliny (prawdziwe dane)
- Rozszerzyć DataImporter o **dry-run preview** (walidacja PESEL, daty, kwoty, dedupe po PESEL) przed commitem
- Logi do `insurance_activity_log`
- Przed importem — **snapshot** (już jest feature) jako rollback point

### C.5 Podstrona `/alina/` domyślnie → Kanban (Panel Ofert) — ✅ ZROBIONE 2026-05-04
~~Zmiana jednej linii: `useState<Page>('dashboard')` → `useState<Page>('offers')`.~~ Commit `12295ab`.

## 🚀 Deployment pipeline (optional, faza D)

- [ ] GitHub Actions: `push main` → `npm ci && VITE_BASE_PATH=/alina/ npm run build` → FTP upload → log
- [ ] Automatic extract przez SSH (po dodaniu `HOSTIDO_SSH_KEY_PASS` do vault)
- [ ] Smoke test post-deploy (`curl -w %{http_code} https://redroad.pl/alina/` → expect 200)
- [ ] Rollback: zachować 3 ostatnie ZIP-y w `/alina/backups/` + skrypt restore

## 🔐 Bezpieczeństwo — TODO

- [x] ~~Sekrety Supabase z plaintext `.env.alina.*` → `rrv` vault~~ ✓ 2026-05-04 (`CRM_ALINA_*` markery `<rrv:NAZWA>`, `switch_env.ps1` v2)
- [ ] **Rotacja kluczy alina prod** (sb_secret_* + sb_publishable_*) — HTTP 200 nadal aktywne mimo migracji do vault. Dashboard `xqznrssrlnxqkdvisnck` → API Keys → Roll → update vault na DOM/MSI/TOMEK.
- [ ] **Rotate hasło FTP** `RedRoad_Deploy_2026!` (było plaintext w `WEB_MASTER/.env`)
- [ ] **SSH key passphrase** do rrv (`HOSTIDO_SSH_KEY_PASS`) — dla SSH deploy automation (jeśli kiedyś chcemy auto-deploy)
- [ ] Rozważyć encryption PESEL **po stronie PostgreSQL** (pgcrypto + `encrypt_pesel()` function) — obecnie tylko client-side AES-GCM
- [ ] Audit log dla zmian ról w `sales` (insurance_role changes → trigger → `insurance_activity_log`)

## 🛠 Workflow lokalnego testu (sesja 2026-05-04)

**TL;DR:** push do git ≠ deploy. Wszystkie commity idą na GitHub `Bartsgda/CRM-Atomic`, ale `redroad.pl/alina/` zmienia się tylko gdy Bartek **manualnie** zbuduje + wgra przez DirectAdmin.

### Schema separation (jeden projekt Supabase, dwie schemy)

| Tryb | Schema | URL Supabase | Komenda |
|---|---|---|---|
| **prod (live)** | `public` | `xqznrssrlnxqkdvisnck.supabase.co` | `START_ALINA_PROD.bat` |
| **test (piaskownica)** | `test` (`VITE_SUPABASE_SCHEMA=test`) | ten sam projekt | `START_ALINA_TEST.bat` |
| **e2e (lokalny)** | – | `127.0.0.1:54341` | `switch_env.ps1 -Mode e2e` |
| **dev (lokalny)** | – | `127.0.0.1:54321` | `switch_env.ps1 -Mode dev` |

### Sekret w vault (`rrv`)
Pliki `.env.alina.{prod,test}` + `.env.e2e` zawierają tylko **markery** `<rrv:NAZWA>`, np. `VITE_SB_SECRET_KEY=<rrv:CRM_ALINA_SB_SECRET>`. `switch_env.ps1` ekspanduje je przez `rrv get` i zapisuje plaintext do gitignored `.env.development.local` (Vite tylko ten plik czyta). Wymaga `rrv login` aktywnego.

### Snapshot prod → test (gdy chcesz odświeżyć piaskownicę)
1. SQL Editor `xqznrssrlnxqkdvisnck` → wklej `supabase/migrations/20260504_feedback_admin_reply.sql` → Run (raz)
2. SQL Editor → wklej `scratch/seed_test_from_prod.sql` → Run (truncate+insert dla `tenants/sales/clients/policies/insurance_notes/insurance_feedback`, dynamicznie po wspólnych kolumnach)

### Deploy (manualny)
```
VITE_BASE_PATH=/alina/ npm run build
# ZIP dist/
# FTP upload deploy@redroad.pl → /domains/redroad.pl/public_html/alina/
# DirectAdmin → File Manager → Extract
```
**`RedRoad-Hostido` MCP ISTNIEJE** (`HOSTIDO_FTP_*` w vault) ale **NIE używamy go do automatycznego deploy CRM-ALINA** — Bartek robi ręcznie. AI nie pushuje na serwer.

## 📋 Konfiguracja produkcyjna — cheat sheet

| | Wartość |
|---|---|
| URL | https://redroad.pl/alina/ |
| Supabase project | `xqznrssrlnxqkdvisnck` |
| Tenant ID | `11111111-1111-1111-1111-111111111111` (Alina Insurance) |
| Remote path | `/domains/redroad.pl/public_html/alina/` (via `deploy@redroad.pl`) |
| Build cmd | `VITE_BASE_PATH=/alina/ npm run build` |
| Deploy | FTP upload ZIP + ręczne extract w DirectAdmin (NIE auto przez MCP) |
| Admin | `redroadai@gmail.com` (owner) |
| Agent | `alinakwidzinska@gmail.com` (agent) |
| rrv klucze | `CRM_ALINA_SB_SECRET`, `CRM_ALINA_SB_PUBLISHABLE`, `CRM_ALINA_SUPABASE_URL`, `CRM_ALINA_E2E_SERVICE_ROLE`, `CRM_ALINA_E2E_SB_PUBLISHABLE` |

## 📚 Pliki referencyjne

- [PROGRESS.md](./PROGRESS.md) — pełen log faz A/B/C/D/E
- [public/.htaccess](./public/.htaccess) — CSP override + SPA rewrite dla `/alina/`
- [switch_env.ps1](./switch_env.ps1) — loader sekretów z rrv (4 tryby)
- [scripts/bootstrap_tenant.mjs](./scripts/bootstrap_tenant.mjs) — seed 20 klientów
- [scripts/deploy_hostido.ps1](./scripts/deploy_hostido.ps1) — legacy, NIE używane (manual deploy)
- [supabase/migrations/](./supabase/migrations/) — tenant_keys, snapshots, feedback, **20260504_feedback_admin_reply**
- [scratch/seed_test_from_prod.sql](./scratch/seed_test_from_prod.sql) — snapshot piaskownica
- [`../CONSIS BartsGda/BAZA_WIEDZY/HOSTING/HOSTIDO.md`](../CONSIS BartsGda/BAZA_WIEDZY/HOSTING/HOSTIDO.md) — hosting reference
