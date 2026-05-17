# 🚀 CRM-Atomic (V2): Plan (Supabase + Google Sheets + Hostido)

> **Status:** REV 2 — po rozmowie 2026-04-18
> **Autor:** Sonnet (sesja Claude Code)
> **Zasada:** Ten plik nie modyfikuje żadnego istniejącego kodu V1.

## DECYZJE ZATWIERDZONE (REV 3)
- ✅ Repo sklonowane: `C:\BartsGda4\CRM-Atomic` (fork marmelab/atomic-crm)
- ✅ **MVP = tylko ubezpieczenia** (Alina). Wariant drogowy RedRoad = osobny projekt w przyszłości, klonowany od zera.
- ✅ **Schema multi-tenant-ready** (kolumna `tenant_id` + RLS), ale **na start 1 tenant**
- ✅ **Model userów: single-tenant + invitation-based**
    - Bartek (nowe dedykowane konto Google) = owner/admin projektu Supabase
    - Alina dostaje zaproszenie email → klika OAuth swoim Gmailem → rola `agent`
    - Oboje widzą tę samą bazę (Alina pracuje, Bartek ma wgląd)
- ✅ Hosting: **Hostido, podkatalog** (namiary do agenta przychodzą)
- ✅ **V1 zostaje u Aliny lokalnie** — testuje, spisuje uwagi, zanim V2 będzie gotowy
- ✅ **XLSX zostaje głównym źródłem importu** w V2 (Google Sheets Live Sync → backlog, nie MVP)
- ✅ Skany polis → Google Drive (link w rekordzie polisy)
- ✅ Gemini → AI Studio free tier, AI dogrywamy później
- ✅ Python — usuwamy w V2
- ✅ **Dane testowe fikcyjne na start**, prawdziwe polisy Aliny dogramy po security review
- ✅ **V1 pozostaje czysto client-side** — Alina klika "Wyczyść fake data" → wgrywa swój XLSX → dane lokalnie w jej przeglądarce, ZERO wysyłki do Supabase
- ✅ Email zaproszenia dla Aliny: `alinakwidzinska@gmail.com` — seed w schemie od razu
- ✅ Hosting: `redroad.pl/ALINA/` (podfolder)
- ✅ **KRYTYCZNE (V1):** Dodano mechanizm 8-godzinnego auto-wipe (RODO Compliance). [DONE 2026-04-18]
- ⚠️ **OBOWIĄZKOWE (V2):** przed każdym deployem na serwer wykonać pełny skan pod kątem sekretów (Hardcoded Secrets) i danych PII (RODO) w kodzie oraz plikach `.env`.

## AUDYT BEZPIECZEŃSTWA V1 (localStorage retention)

**Stan obecny (sprawdzony w kodzie):**
| Zachowanie | Czy jest? | Komentarz |
|---|---|---|
| Przycisk "Wyczyść wszystkie dane" | ✅ TAK | `BackupManager.tsx:113` → `storage.clearAllData()` |
| Auto-wipe po X godzinach bezczynności | ❌ NIE | localStorage persistuje wiecznie |
| Wipe po zamknięciu tabu/przeglądarki | ❌ NIE | localStorage przeżywa restart maszyny |
| Idle timer (30 min bez ruchu → logout) | ❌ NIE | |
| Hasło / PIN na wejście | ❌ NIE | Każdy kto ma dostęp do fizycznej maszyny widzi dane |
| Encrypted localStorage | ❌ NIE | Plain JSON w przeglądarce |

**Konsekwencja dla produkcji `redroad.pl/ALINA/`:**
Jeśli ktokolwiek inny użyje laptopa Aliny (lub telefonu jeśli testuje mobile) → wchodzi na adres → widzi całą jej bazę klientów. **To jest RODO problem.**

**Status Hardeningu V1 (ZAKOŃCZONO):**
1. **Session timestamp**: Implementacja w `useAutoWipe.ts` (mousedown/keydown/click monitoring).
2. **Boot check / Auto-wipe**: Hook w `App.tsx` blokuje dostęp po 8h bezczynności (Soft Wipe).
3. **Logout button**: Dostępny w Sidebar (Wyczyść Dane / Nuclear Reset).
4. **UI Consolidation**: Usunięto rozproszone skiny na rzecz centralnego `ThemeSettings` w Sidebar.

Opcjonalne (dyskusyjne):
- Idle timer 30 min → "Za chwilę sesja wygaśnie, kliknij aby kontynuować"
- Prosty PIN przy starcie (np. 4-cyfrowy, szyfruje localStorage AES-GCM via WebCrypto) — dodaje warstwę przed "ktoś przypadkowy otworzy kartę"

---

## 0. KONTEKST I DECYZJE WSTĘPNE

### Stan obecny (v6.9, React + localStorage)
- React 19 + Vite + Gemini AI + Tailwind
- Baza: `localStorage` (klucz `InsuranceMaster_Core_V4_Final`), limit ~5-10 MB
- Import: XLSX (23 kolumny legacy, eksport z Google Sheets)
- Autoryzacja: brak (single-user, lokalnie)
- Folder `python/` — PyQt6 porzucone (wygląd toporny), usunąć w V2

### Docelowa architektura V2
```
┌────────────────────────────────────────────────────────┐
│  Przeglądarka (dowolne urządzenie)                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ React SPA (Atomic CRM fork + moduły CRM-ALINA)   │  │
│  │  • Google OAuth2 login (Supabase Auth)           │  │
│  │  • React Admin + shadcn/ui                       │  │
│  │  • Moduły własne: 5 Filarów, Karateka AI, Kanban │  │
│  └────────┬────────────────────┬────────────────────┘  │
└───────────┼────────────────────┼───────────────────────┘
            │                    │
      REST/Realtime        OAuth + Sheets API
            │                    │
┌───────────▼───────────┐  ┌─────▼──────────────────────┐
│  SUPABASE (cloud)     │  │  GOOGLE WORKSPACE          │
│  • Postgres (schema)  │  │  • Sheets (źródło legacy)  │
│  • Auth (Google)      │  │  • Drive (skany polis)     │
│  • Storage (PDF)      │  │  • Calendar (wznowienia)   │
│  • Edge Functions     │  │  • Gmail (follow-up)       │
│    (Gemini proxy,     │  └────────────────────────────┘
│     Sheets sync)      │
└───────────────────────┘
            │
      static build (dist/)
            │
┌───────────▼───────────────────────────────────────────┐
│  HOSTIDO SN3 (shared hosting, LiteSpeed)              │
│  • crm.redroad.pl (subdomena) → dist/ upload via FTP  │
│  • Node.js NIE — ale SPA tak (pliki statyczne)        │
└────────────────────────────────────────────────────────┘
```

### Kluczowe decyzje

| Pytanie | Decyzja | Uzasadnienie |
|---|---|---|
| Fork Atomic CRM czy migracja obecnego? | **FORK Atomic CRM** + portowanie naszych modułów | Supabase+Auth+Kanban+Deals już zbudowane, MIT, shadcn spójny styl |
| Hosting Node.js? | **NIE** (Hostido wycofało) | Tylko static SPA, API = Supabase |
| Backup przy migracji? | **Kopia całego folderu + git branch** przed startem | |
| Co z `python/` | **Usunąć w V2** (nie migrujemy) | PyQt porzucone |
| Google Auth | **Tymczasowo: Twój Gmail** → później: per-agent | Alina nie musi na początku mieć konta |
| Źródło danych | **Google Sheets link (live sync)** zamiast XLSX upload | Agenci edytują w Sheetsach, CRM czyta |

---

## 1. FAZA 1 — Przygotowanie (1-2 dni)

### 1.1. Safety first
- [ ] `xcopy C:\BartsGda4\CRM-ALINA C:\BartsGda4\CRM-ALINA-V1-BACKUP /E /I`
- [ ] Commit obecnego stanu (V1) na gałąź `v1-legacy` w gicie
- [ ] Stworzyć nowe repo `crm-alina-v2` (fork Atomic CRM)

### 1.2. Konta i klucze
- [ ] Projekt w Supabase.com (darmowy tier = 500MB DB, 1GB storage, 50k MAU)
- [ ] Google Cloud Project → OAuth 2.0 Client ID (redirect: `https://<supabase>.supabase.co/auth/v1/callback`)
- [ ] Enable: Sheets API, Drive API, Calendar API, Gmail API (read)
- [ ] Zapisać klucze w `.env.local` V2 (nie commit!)
- [ ] Rejestracja subdomeny `crm.redroad.pl` na Hostido + SSL

### 1.3. Hostido SN3 — weryfikacja
- [ ] Sprawdzić w panelu: wsparcie HTTPS, SPA rewrites (.htaccess), limit storage, FTP
- [ ] Test: upload pustego `index.html` z React Router → czy `/clients` nie daje 404
  (wymaga reguły rewrite w .htaccess: `RewriteRule . /index.html [L]`)
- [ ] **Fallback**: jeśli SN3 nie dźwignie, przenieść na Vercel/Netlify (darmowe, auto-deploy z GitHub) — i tak Supabase jest w chmurze

---

## 2. FAZA 2 — Schema Supabase (3-5 dni)

### 2.1. Projekt tabel (mapowanie z obecnych typów)

Źródło: `crm-pro/types.ts` + `DATA_MAPPING.md` + `XLSX_MAPPING.md`

```sql
-- AUTH (wbudowane w Supabase)
-- auth.users (id, email, ...)

-- PROFILE AGENTA (rozszerzenie user)
create table profiles (
  id uuid primary key references auth.users,
  full_name text,
  role text check (role in ('admin','agent','sub_agent')) default 'agent',
  default_commission_rates jsonb,  -- { OC: 12, AC: 15, DOM: 18 }
  created_at timestamptz default now()
);

-- KLIENCI
create table clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),  -- który agent
  first_name text not null,
  last_name text not null,
  phones text[] default '{}',
  emails text[] default '{}',
  street text, city text, zip_code text,
  pesel_encrypted text,  -- 🔒 pgcrypto, NIE plain
  birth_date date,
  gender text,
  type text check (type in ('PERSON','COMPANY')) default 'PERSON',
  businesses jsonb default '[]',  -- [{ nip, regon, krs, name, address }]
  rodo_consent boolean default false,
  source text,  -- 'manual','sheets_import','legacy_xlsx'
  legacy_id text,  -- ID z starego CRM (deduplikacja)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- POLISY
create table policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  owner_id uuid references profiles(id),
  type text check (type in ('OC','AC','BOTH','DOM','ZYCIE','PODROZ','FIRMA')),
  stage text,  -- 'of_do zrobienia','przel kontakt','oferta_wyslana','sprzedaz','uciety kontakt'
  insurer_name text,
  policy_number text,
  premium numeric(10,2),
  commission numeric(10,2),
  commission_rate numeric(5,2),
  payment_status text,
  policy_start_date date,
  policy_end_date date,
  -- Asset Intelligence (5 Filarów)
  vehicle_brand text, vehicle_model text, vehicle_reg text,
  auto_details jsonb,   -- engineCapacity, productionYear, fuelType, insuranceItems, aiNote
  home_details jsonb,   -- address, construction, sumInsured, cession
  life_details jsonb,
  travel_details jsonb,
  -- Meta
  original_product_string text,  -- hybrydowe legacy
  ai_note text,
  checklist jsonb default '{}',  -- { rodo_123: true }
  termination_id uuid references terminations(id),
  calculations jsonb default '[]',  -- Bitwa Ofert
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- NOTATKI
create table notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  linked_policy_ids uuid[] default '{}',
  content text not null,
  tag text,  -- 'ROZMOWA','STATUS','MAIL','SYSTEM','AUDYT'
  reminder_date timestamptz,
  reminder_status text,  -- 'PRZYPOMNIENIE','UKONCZONE','ANULOWANE'
  history jsonb default '[]',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- POSREDNICY
create table sub_agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  name text not null,
  phone text, email text,
  default_rates jsonb default '{}',  -- { OC: 2, AC: 5 }
  group_prefix text,  -- 'firmowy','wlasny', null
  created_at timestamptz default now()
);

create table policy_sub_agent_shares (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references policies(id) on delete cascade,
  sub_agent_id uuid references sub_agents(id),
  rate numeric(5,2),
  amount numeric(10,2),
  note text
);

-- WYPOWIEDZENIA
create table terminations (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references policies(id) on delete cascade,
  sent_date date,
  document_date date,
  pdf_storage_path text,  -- Supabase Storage
  created_at timestamptz default now()
);

-- TOWARZYSTWA (45+ seed + custom)
create table insurers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) null,  -- null = global seed
  name text not null,
  contact_name text, contact_phone text, contact_email text,
  is_visible boolean default true,
  is_custom boolean default false
);

-- CHECKLISTY (szablony)
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  policy_type text,
  items jsonb default '[]'  -- [{ id, label, isRequired }]
);

-- AUDIT LOG
create table activity_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  entity_type text, entity_id uuid,
  action text,
  diff jsonb,
  created_at timestamptz default now()
);

-- SHEETS SYNC (metadane linków)
create table sheet_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  spreadsheet_id text,
  sheet_name text,
  column_mapping jsonb,  -- { 8: "type", 19: "notes" }
  last_synced_at timestamptz,
  last_synced_row int default 0
);
```

### 2.2. Row Level Security (RLS)
**KAŻDA tabela** ma RLS: agent widzi tylko swoje `owner_id`, admin widzi wszystko.

### 2.3. pgcrypto dla PESEL
Rozszerzenie `pgcrypto` + klucz w Supabase Vault. PESEL nigdy w czystym tekście, nigdy nie leci do Gemini (zasada z `CLIENT_MASTER_PROMPT.md`).

---

## 3. FAZA 3 — Fork Atomic CRM (3-4 dni)

### 3.1. Start
```bash
git clone https://github.com/marmelab/atomic-crm crm-alina-v2
cd crm-alina-v2
npm install
# Supabase init (CLI)
npx supabase init
npx supabase link --project-ref <ref>
```

### 3.2. Co zostaje z Atomic CRM (out-of-the-box)
- ✅ React Admin + shadcn/ui (spójny UI, chipy, tabele)
- ✅ Google OAuth via Supabase
- ✅ Kanban Deals (→ mapujemy na "Oferty")
- ✅ Contacts (→ Klienci)
- ✅ Tasks + Notes
- ✅ Import/Export CSV
- ✅ Dashboard
- ✅ Multi-tenant (my = Alina, później inne agentki)

### 3.3. Co dopisujemy (portujemy z V1)
| Z V1 (React local) | Do V2 (Atomic fork) | Spec źródło |
|---|---|---|
| 5 Filarów formularze (Auto/Home/Life/Travel) | Nowe resources w React Admin | `ARCHITECTURE_5_PILLARS.md` + `SPECS/MOD_*.md` |
| Compliance Checklists (chips) | Custom component w PolicyShow | `CHECKLIST_SPECS.md` |
| CommissionCalculator + Sub-Agents | Osobny resource | `COMMISSIONS_SPEC.md` + `SUB_AGENTS_SPEC.md` |
| Terminations PDF generator | Edge Function (ReportLab via Deno PDF lib) | `TERMINATIONS_SPEC.md` |
| Karateka AI (Gemini) | Edge Function proxy (klucz po stronie Supabase, nie w przeglądarce!) | `AI_ARCHITECTURE.md` + `AI_CRM_MASTERPLAN.md` |
| LegacyParser (XLSX dirty data) | Zostawiamy dla jednorazowej migracji z XLSX, potem DEAD | `IMPORT_LOGIC.md` + `AI_PARSING_RULES.md` |
| Reverse Rate algorithm | Edge Function (post-migracja, policzy stawki sub-agentów) | `ALGORITHM_RATES.md` |
| Asset Intelligence (smart fill) | React Admin autocomplete po historii | `POLICIES_SPEC.md` §3.D |
| Anti-Bounce 60s | Trigger Postgres | `OFFERS_SPEC.md` §4 |

### 3.4. Design System — czy zostawić Onyx/Forest/Exec?
Atomic CRM ma własne motywy (shadcn). **Decyzja**: na start zostawić defaulty shadcn, Bartek zobaczy, potem ewentualnie portować Onyx (ciemny) — skill Tailwind przenosi się 1:1.

---

## 4. FAZA 4 — Google Sheets (live sync zamiast XLSX) (2-3 dni)

### 4.1. Model
Zamiast "upload XLSX 1x" → **link do Sheets + auto-sync co 15 min / na żądanie**.

```
[Alina w Google Sheets]  ──→  Edge Function pull (cron 15m)  ──→  Supabase tables
                                        │
                                        ▼
                              Parser z V1 (legacyParser.ts portowany)
                                  DataMapper + 6-krokowy pipeline
                                        │
                                        ▼
                              Upsert po legacy_id (dedup)
                              + zapis do sheet_sources.last_synced_row
```

### 4.2. Flow autoryzacji (etap 1: Twój Gmail)
1. Alina wchodzi na CRM → loguje się Google OAuth (**Twoim Gmail na start**)
2. System prosi o zakres `https://www.googleapis.com/auth/spreadsheets.readonly`
3. Alina wkleja link do arkusza → system odczytuje spreadsheet_id
4. Zapis do `sheet_sources` + pierwszy sync (pełny)
5. Cron Edge Function co 15 min ciągnie nowe wiersze (od `last_synced_row`)

### 4.3. Flow docelowy (etap 2: własny Gmail Aliny)
Bez zmian kodowych — tylko przepięcie OAuth w Google Cloud Console (dodanie jej emaila jako test user → produkcja).

### 4.4. Bi-directional czy read-only?
**MVP: read-only** (Alina edytuje w Sheets, CRM tylko czyta).
Później: write-back przez Supabase trigger → Edge Function → Sheets API (ryzyko konfliktów, wymaga lockingu).

---

## 5. FAZA 5 — Migracja danych (2-3 dni)

### 5.1. Źródła
1. **localStorage V1** (jeśli Alina używa aktualnej wersji) → export JSON
2. **Istniejące XLSX** (23 kolumny) → jednorazowo przez starego `DataImporter`
3. **Google Sheets live** → ciągły sync (faza 4)

### 5.2. Plan
- [ ] Skrypt `migrate-localstorage.ts` — czyta backup JSON V1, upsertuje do Supabase z zachowaniem ID jako `legacy_id`
- [ ] Skrypt `migrate-xlsx.ts` — portowany `DataMapper` + `legacyParser` z V1, dry-run z raportem
- [ ] **Reverse Rate** uruchomić po migracji sub-agentów (auto-wypełni `defaultRates`)
- [ ] Weryfikacja: liczba rekordów V1 = V2, spot-check 10 losowych polis

### 5.3. Checklist integralności
- [ ] Wszystkie PESEL zaszyfrowane przez pgcrypto (0 plain)
- [ ] Wszystkie notatki `[SYSTEM]` zachowane (audit trail)
- [ ] `linked_policy_ids` po UUID, nie starym stringu
- [ ] Wypowiedzenia PDF w Supabase Storage z ACL = private

---

## 6. FAZA 6 — Deploy (1-2 dni)

### 6.1. Build pipeline
```bash
npm run build  # → dist/
```

### 6.X. OSTATNI KROK PRZED DEPLOYEM (Security Scan)
Przed każdym wypchnięciem kodu na serwer (FTP / Vercel), model AI musi wykonać:
1. **Skan sekretów**: `grep` pod kątem `SERVICE_ROLE_KEY`, `PRIVATE_KEY`, haseł w plikach `.env` i `.ts`.
2. **Skan PII**: weryfikacja czy w folderze `src/` lub `public/` nie zostały omyłkowo pliki `.csv` / `.xlsx` z prawdziwymi danymi klientów.
3. **Weryfikacja kluczy Supabase**: upewnienie się, że w kodzie frontendowym są używane TYLKO klucze publiczne (`anon`), a klucze administracyjne (`service_role`) są wyłącznie po stronie serwera/Edge Functions.

### 6.2. Hostido SN3 (jeśli zadziała)
1. FTP upload `dist/*` do `public_html/crm/`
2. `.htaccess`:
   ```apache
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```
3. SSL: Let's Encrypt z panelu Hostido
4. Test: `crm.redroad.pl/clients` nie daje 404

### 6.3. Fallback — Vercel
Jeśli Hostido boli: `vercel --prod` z głównego repo. Auto-deploy na push do `main`. Darmowe dla hobby.

### 6.4. Supabase — cloud vs self-hosted
**Start: cloud** (darmowe, 0 utrzymania). Jeśli baza urośnie > 500 MB lub potrzeby compliance → Supabase self-hosted na VPS (Hetzner €5/msc, docker-compose).

---

## 7. PLAN TESTÓW (równolegle)

Każda faza kończy się testami E2E:
- [ ] Login Google → redirect → dashboard
- [ ] Utworzenie klienta + polisy + notatki + przypomnienia → wszystko w DB + widoczne
- [ ] Import ze Sheets → 100 wierszy → dedup OK → brak duplikatów po 2. syncu
- [ ] Bitwa ofert + wygrana kalkulacja → status `sprzedaz`
- [ ] Generator PDF wypowiedzenia → plik w Storage → download
- [ ] Karateka AI: wklej "Jan Kowalski 500100200 Audi A4" → tworzy klienta + polisę → PESEL nie leci do Gemini

---

## 8. KOLEJNOŚĆ PRACY (optymalna)

```
Tydzień 1:  Faza 1 (backup, konta) + Faza 2 (schema)
Tydzień 2:  Faza 3 (fork + core moduły: Klienci, Polisy, Oferty)
Tydzień 3:  Faza 3 cd. (5 Filarów, Commissions, Terminations)
Tydzień 4:  Faza 4 (Sheets sync) + Faza 5 (migracja danych)
Tydzień 5:  Faza 6 (deploy) + testy E2E + szkolenie Aliny
```

Ścieżka krytyczna: **Schema Supabase (2.1)** — jeśli źle zaprojektowana, wszystko dalej się sypie. Zaplanować 1 dzień na review schemy zanim ruszymy UI.

---

## 9. KOSZTY (szacunek miesięczny)

| Pozycja | Koszt | Uwagi |
|---|---|---|
| Supabase Free | 0 zł | Do 500 MB, 50k MAU, 2 GB bandwidth |
| Supabase Pro | ~110 zł ($25) | Gdy przekroczymy free |
| Hostido SN3 | obecny | już płacone |
| Domena `crm.redroad.pl` | 0 | subdomena |
| Google Cloud (OAuth + Sheets API) | 0 zł | Free tier wystarcza |
| Gemini API | ~20-50 zł | zależnie od użycia |
| **RAZEM start** | **~20-50 zł/msc** | |

---

## 10. RYZYKA I MITYGACJE

| Ryzyko | P | Mitygacja |
|---|---|---|
| Hostido nie uciągnie SPA | Niskie | Fallback Vercel (darmowe) |
| Schema źle zaprojektowana | Średnie | Review + migracje Supabase CLI |
| Migracja gubi dane | Średnie | Dry-run + backup V1 zachowany zawsze |
| Gemini API klucz wycieka | Niskie | Edge Function proxy (klucz server-side) |
| PESEL wycieka | Niskie | pgcrypto + test pentest przed produkcją |
| Alina nie ogarnie nowego UI | Średnie | Atomic CRM = standardowy React Admin, intuicyjny |
| Sheets API quota (500 req/100s) | Niskie | Cron 15m + incremental sync |

---

## 11. CO NIE ROBIMY W V2 (backlog V3)

- ❌ OSINT / social listening (`BartsGda.md` Faza 4)
- ❌ Asystent głosowy / Whisper
- ❌ Vector DB + RAG
- ❌ SMS Gateway
- ❌ Write-back do Sheets (bi-directional)
- ❌ Portal klienta (Alina+jej klient loguje się i widzi polisy)

---

## 12. PYTANIA DO BARTKA (przed startem)

1. **Atomic CRM fork** czy własny React Admin od zera?
   → Rekomendacja: fork (oszczędza 3-4 tygodnie)
2. **Hostido SN3 — tak czy Vercel od razu?**
   → Rekomendacja: Vercel na developer preview, Hostido na produkcję gdy będzie gotowa
3. **Kiedy Alina ma "wejść"** — po MVP (po Fazie 4) czy dopiero po fulllu (Faza 5)?
4. **Skany polis** — w Supabase Storage czy Google Drive (link)?
   → Rekomendacja: Drive (0 kosztów, Alina ma już konto)
5. **Multi-tenant od początku** czy single-user i potem refactor?
   → Rekomendacja: multi od początku (RLS kosztuje mało, refactor dużo)

---

## 13. NASTĘPNY KROK

Po zatwierdzeniu tego planu:
1. Kopia `CRM-ALINA` → `CRM-ALINA-V1-BACKUP`
2. Nowy folder `C:\BartsGda4\crm-alina-v2` (fork Atomic CRM)
3. Zaczynamy od **Fazy 1 + 2** (sekcja 1 i 2 tego dokumentu)

---

*Plan oparty na pełnej lekturze 58 plików .md z V1, zachowuje wszystkie reguły biznesowe z `SUPREME_RULES.md`, `ARCHITECTURE_5_PILLARS.md` i pakietu SPECS.*
