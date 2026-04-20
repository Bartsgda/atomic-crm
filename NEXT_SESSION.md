# CRM ALINA — następna sesja (TODO)

**Status produkcji:** ✅ https://redroad.pl/alina/ — żyje. Admin: `redroadai@gmail.com`, Agent: `alinakwidzinska@gmail.com`, hasło szyfrowania: `Test123!`.

## 🎯 Priorytet — testy użytkownika

Zanim cokolwiek kodujesz — **Alina musi przetestować na fikcyjnych danych** (20 klientów, 35 polis, 15 notatek już są w bazie).

1. Zaproś `alinakwidzinska@gmail.com` do logowania
2. Daj jej hasło `Test123!`
3. Niech klika "Zgłoś problem" (ikona oka → 🎯) przy każdej uwadze — trafi do `insurance_feedback`
4. Zbierz zgłoszenia → poprawki w kolejnej sesji

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

### C.5 Podstrona `/alina/` domyślnie → Kanban (Panel Ofert)
Feedback od Bartka: domyślnie po loginie ma być kanban ofert, nie dashboard. Zmiana jednej linii: `useState<Page>('dashboard')` → `useState<Page>('offers')`.

## 🚀 Deployment pipeline (optional, faza D)

- [ ] GitHub Actions: `push main` → `npm ci && VITE_BASE_PATH=/alina/ npm run build` → FTP upload → log
- [ ] Automatic extract przez SSH (po dodaniu `HOSTIDO_SSH_KEY_PASS` do vault)
- [ ] Smoke test post-deploy (`curl -w %{http_code} https://redroad.pl/alina/` → expect 200)
- [ ] Rollback: zachować 3 ostatnie ZIP-y w `/alina/backups/` + skrypt restore

## 🔐 Bezpieczeństwo — TODO

- [ ] **Rotate hasło FTP** `RedRoad_Deploy_2026!` (było plaintext w `WEB_MASTER/.env`)
- [ ] **SSH key passphrase** do rrv (`HOSTIDO_SSH_KEY_PASS`) — dla SSH deploy automation
- [ ] Rozważyć encryption PESEL **po stronie PostgreSQL** (pgcrypto + `encrypt_pesel()` function) — obecnie tylko client-side AES-GCM
- [ ] Audit log dla zmian ról w `sales` (insurance_role changes → trigger → `insurance_activity_log`)

## 📋 Konfiguracja produkcyjna — cheat sheet

| | Wartość |
|---|---|
| URL | https://redroad.pl/alina/ |
| Supabase project | `xqznrssrlnxqkdvisnck` |
| Tenant ID | `11111111-1111-1111-1111-111111111111` (Alina Insurance) |
| Remote path | `/domains/redroad.pl/public_html/alina/` (via `deploy@redroad.pl`) |
| Build cmd | `VITE_BASE_PATH=/alina/ npm run build` |
| Deploy | FTP upload ZIP + ręczne extract w DirectAdmin |
| Admin | `redroadai@gmail.com` (owner) |
| Agent | `alinakwidzinska@gmail.com` (agent) |

## 📚 Pliki referencyjne

- [PROGRESS.md](./PROGRESS.md) — co zrobione w fazach A/B
- [public/.htaccess](./public/.htaccess) — CSP override + SPA rewrite dla `/alina/`
- [scripts/bootstrap_tenant.mjs](./scripts/bootstrap_tenant.mjs) — seed 20 klientów
- [scripts/deploy_hostido.ps1](./scripts/deploy_hostido.ps1) — manualny deploy (legacy, użyj MCP Hostido po dodaniu passphrase)
- [supabase/migrations/20260420_*.sql](./supabase/migrations/) — tenant_keys, snapshots, feedback
- [`../CONSIS BartsGda/BAZA_WIEDZY/HOSTING/HOSTIDO.md`](../CONSIS%20BartsGda/BAZA_WIEDZY/HOSTING/HOSTIDO.md) — hosting reference
