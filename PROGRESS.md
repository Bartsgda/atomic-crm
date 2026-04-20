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
