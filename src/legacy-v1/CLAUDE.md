# CLAUDE.md — Mapa dokumentacji `src/legacy-v1/` (Insurance Master CRM Pro)

> **AI: czytaj NAJPIERW. To jest indeks 38 plików `.md` w tym folderze, podzielony na "co czytać kiedy".**
>
> **Anti-pattern (lekcja 2026-05-11):** AI zignorował te MD i napisał **własny mapper XLSX od zera w Pythonie** zamiast użyć gotowego `DataMapper.ts` + `DataImporter.tsx`. Efekt: 4 cykle naprawiania błędów (regex pojazdów, BOTH false-positives, dedup klientów po first+last zamiast PESEL/NIP, daty `created_at`, prowizje pośredników niepobierane z `policy_sub_agent_shares`). Wszystko było opisane w `XLSX_MAPPING.md` + `IMPORT_LOGIC.md` + `CLIENTS_SPEC.md` + `COMMISSIONS_SPEC.md`. **Zawsze NAJPIERW spec, potem kod.**

---

## 🎯 Jeśli robisz X — przeczytaj NAJPIERW te:

### 📥 Import danych z XLSX
0. **[IMPORT_AUDIT_HOWTO.md](./IMPORT_AUDIT_HOWTO.md)** — ⭐ **CZYTAJ ZAWSZE NAJPIERW** gdy robisz audyt/reimport. Połączenie do Alina Supabase (NIE brain!), `legacy_id` mapping, 10 pułapek typu „wczytałem zły XLSX/zły URL/zła schema".
1. **[XLSX_MAPPING.md](./XLSX_MAPPING.md)** — mapowanie 23 kolumn Excela na pola CRM (col[0]→firstName/lastName, col[1]→**`createdAt`**, col[7]→PESEL/NIP dedup, col[8]→`co` (typ+pojazd), col[15]→`subAgentCommission` jako pole na polisie)
2. **[IMPORT_LOGIC.md](./IMPORT_LOGIC.md)** — ⚠️ **CODE FREEZE** na `DataMapper.ts` + `legacyParser.ts`. Pipeline kategoryzacji: DOM → PODROZ → FIRMA → OC bifurcation (działal/zawod/lekarz → FIRMA; inaczej AUTO) → ZYCIE → POJAZD fallback. Zasada "First Word Rule".
2b. **[AUDIT_ROWS_1_10_2026-05-11.md](./AUDIT_ROWS_1_10_2026-05-11.md)** — raport ręcznego audytu pierwszych 10 wierszy (Opus 4.7). Top 10 bugów importu.
2c. **[AUDIT_PLAN.md](./AUDIT_PLAN.md)** — plan napraw w 4 fazach (cleanup → parser bugfix → TIMELINE backfill → UI flagi + reimport).
3. **[DATA_MAPPING.md](./DATA_MAPPING.md)** — struktura w aplikacji
4. **[LEGACY_DATA_SPEC.md](./LEGACY_DATA_SPEC.md)** — dane historyczne z `data/legacy/*.ts` (hardcoded mapy z `aiNote`)
5. **[REVERSE_ARCH_SPEC.md](./REVERSE_ARCH_SPEC.md)** — eksport XLSX (Hybrid Excel)
6. **[IMPORT_DEBUG_LOG.md](./IMPORT_DEBUG_LOG.md)** — historia edge cases (literówki "podroz", "dom?")
7. **Kod (gotowy mapper, NIE pisać od zera):**
   - `services/dataMapper.ts` (671 linii)
   - `services/legacyParser.ts` (174 linii)
   - `components/DataImporter.tsx` (1009 linii) — UI button "Import XLSX"

### 👤 Klient
- **[CLIENTS_SPEC.md](./CLIENTS_SPEC.md)** — dane osobowe, walidacja (imie+nazwisko + min 1 kontakt), B2B (`businesses[]`)
- **[WYMAGANIA-KLIENT.md](./WYMAGANIA-KLIENT.md)** — Panel Klienta 360° (techniczna)
- **[CLIENT_PANEL_REQUIREMENTS.md](./CLIENT_PANEL_REQUIREMENTS.md)** — Panel 360° (biznesowa)
- **Dedup:** po PESEL/NIP (col[7]), nie po first+last. Bartek 2026-05-11: "Stark = 1 klient z 20 polisami".

### 📋 Polisa
- **[POLICIES_SPEC.md](./POLICIES_SPEC.md)** — cykl życia, typy (OC/AC/BOTH/DOM/PODROZ/ZYCIE/FIRMA), stage enum (`uciety_kontakt`/`przel_kontakt`/`sprzedaz`/`oferta_wyslana`/`of_do_zrobienia`/`czekam_na_dane`/`rez_po_ofercie` — underscore, no Polish)
- **[AI_PARSING_RULES.md](./AI_PARSING_RULES.md)** — Deep Analysis dla AI
- **[STATE_FLOW.md](./STATE_FLOW.md)** — obieg polisy, spójność stanów

### 💰 Prowizje i pośrednicy (KOMPLET)
- **[COMMISSIONS_SPEC.md](./COMMISSIONS_SPEC.md)** — ⚠️ **UWAGA**: SPEC opisuje kaskadowy split ("Agent = Całkowita − Pośrednik") ale to STARY/teoretyczny model. **Faktyczny model w `FinanceView.tsx` (production):** **dwie niezależne pule prowizji** (patrz niżej).
- **[SUB_AGENTS_SPEC.md](./SUB_AGENTS_SPEC.md)** — Centrum Pośredników (MLM/OWCA/Tip-serwis), `group_prefix` ∈ {`firmowy`, `wlasny`, `partner`} (DB check constraint)
- **[ALGORITHM_RATES.md](./ALGORITHM_RATES.md)** — "Reverse Rate" (analiza wsteczna prowizji z istniejących danych)

#### 🔑 Model prowizji (Bartek 2026-05-11)

**Agent i pośrednik dostają DWIE OSOBNE prowizje od towarzystwa, NIE dzielą jednej puli.**

- XLSX col 14 `prow` → `commission` = **pełna prowizja agenta** (np. 4% od składki)
- XLSX col 15 `rozl` → `subAgentCommission` / `policy_sub_agent_shares.amount` = **osobna prowizja pośrednika** (np. też 4% od składki, niezależnie)
- Często `commission == rozl` (oba 4%) — to NIE błąd, to dwa równoległe strumienie

Jak liczy `FinanceView.tsx`:
```js
incomeNet     += agentPart                  // pełne 4% agenta na czysto (NIE odejmuje pośrednika)
revenueGross  += agentPart + partnerPart    // suma obu pul (np. 8% łącznie)
costPartners  += partnerPart                // tylko prowizja pośrednika (do osobnego rozliczenia/przelewu)
```

Rola `group_prefix` w SubAgents:
- **`wlasny`** = Alina sama jest pośrednikiem (np. polecony przez nią) → dostaje **OBA** strumienie 4%+4%
- **`firmowy`** = inny agent w agencji (Hejka, Beata, Osip…) → drugie 4% wraca wewnątrz firmy
- **`partner`** = zewnętrzny finder (dealer aut, kolega, agent nieruchomości) → drugie 4% wypłacane na zewnątrz (Tip-serwis)

#### Schema DB (test)
**`policy_sub_agent_shares`** (tabela: policy_id, sub_agent_id, rate, amount, note). Provider `supabaseStorage.ts` MUSI to pobierać w `init()` i mapować na `subAgentSplits` w `rowToPolicy` (legacy zawiera fallback `subAgentCommission` jako pole na polisie).

### 📝 Notatki
- **[NOTES_SPEC.md](./NOTES_SPEC.md)** — oś czasu, tagi, separatory `_` w XLSX (1. wiersz najstarszy, kolejne uzupełniane)

### 🎯 Oferty (Kanban)
- **[OFFERS_SPEC.md](./OFFERS_SPEC.md)** — Centrum Ofert v2.1
- **[OFFERS_REQUIREMENTS.md](./OFFERS_REQUIREMENTS.md)** — wymagania
- **[OFFERS_ROADMAP.md](./OFFERS_ROADMAP.md)** — plan rozwoju

### 📅 Terminarz
- **[CALENDAR_SPEC.md](./CALENDAR_SPEC.md)** — Calendar Module v2.0
- **[CHECKLIST_SPECS.md](./CHECKLIST_SPECS.md)** — Smart Compliance Checklists

### 🎨 UI/UX
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — motywy (Exec/Onyx/Forest), typografia
- **[UI_UX_DROPDOWN_FIX.md](./UI_UX_DROPDOWN_FIX.md)** — Smart Dropdowns
- **[UI_SEARCH_KEYBOARD_RULES.md](./UI_SEARCH_KEYBOARD_RULES.md)** — ⭐ pasek wyszukiwania + autofocus + nawigacja ↓↑Enter/Esc + ikony sortowania ArrowUpDown (kanon: Dashboard pojazdów; ClientsList zsynchronizowany 2026-05-11)

### 🏛️ Architektura
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — system + standardy deweloperskie
- **[ARCHITECTURE_5_PILLARS.md](./ARCHITECTURE_5_PILLARS.md)** — 5 Filarów Prawdy
- **[AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md)** — Brain Core v2.0
- **[REQUIREMENTS.md](./REQUIREMENTS.md)** — hub wymagań

### 🛠️ Naprawa / dane
- **[DATA_REPAIR_SPEC.md](./DATA_REPAIR_SPEC.md)** — Centrum Naprawy Danych
- **[BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md)** — JSON backup
- **[TIMELINE_ARCHITECTURE.md](./TIMELINE_ARCHITECTURE.md)** — ⭐ **NOWY 2026-05-11**: model bi-temporal (assets, policy_terminations, client_attribute_history, policy_versions). Stary tel/email NIE znika z notatek; pojazd ma timeline polis; wznowienia/wypowiedzenia jako persistent encje ze statusami

### 📜 Zasady / przepływy
- **[SUPREME_RULES.md](./SUPREME_RULES.md)** — ⚠️ **ENFORCED LAW** (7 zasad): inputMode dla cyfr, onClick→showPicker dla dat, `flex-wrap` zamiast scroll, **#4 Documentation First** (nie dotykaj `.tsx` bez przeczytania `.md`), Mapa Modul→Spec
- **[AI_CRM_MASTERPLAN.md](./AI_CRM_MASTERPLAN.md)** — Agent Karateka v2.0

### 📊 Status i kronika
- **[ROADMAP.md](./ROADMAP.md)** — co zrobione, co w planach
- **[BartsGda.md](./BartsGda.md)** — wizja długoterminowa (Backend + AI Agents)
- **[PROJECT_CHRONICLE.md](./PROJECT_CHRONICLE.md)** — historia projektu
- **[AI_PROGRESS_LOG.md](./AI_PROGRESS_LOG.md)** — raport stanu AI
- **[FAILURE_REPORT.md](./FAILURE_REPORT.md)** — porażki wdrożeniowe (czytaj żeby nie powtórzyć)
- **[REQUIREMENTS_LEDGER.md](./REQUIREMENTS_LEDGER.md)** — Autonomiczny System Operacyjny

---

## 📌 ZASADY NADRZĘDNE (skrót z [SUPREME_RULES.md](./SUPREME_RULES.md))

1. **Prawo Cyfr i Walut** — `inputMode="decimal"` dla kwot, `inputMode="numeric"` dla NIP/PESEL/tel/zip
2. **Prawo Daty** — kliknięcie w CAŁE pole → `e.currentTarget.showPicker()` (jednodotyk)
3. **Prawo Kompaktowości** — `flex-wrap` chips zamiast pionowych checkbox list
4. **Documentation First** — **NIE wolno dotknąć `.tsx` bez przeczytania `.md`**
5. **Mapa Moduł → Spec** (patrz tabela w SUPREME_RULES § 5)
6. **Żelazne walidacje:** klient = imie+nazwisko+min1kontakt; polisa sprzedana = numer+składka>0; każde DELETE → `DeleteSafetyButton`
7. **Local-First** + UUID/timestamp ID

## 🚨 ANTI-PATTERNS (lekcje 2026-05-11)

- ❌ **NIE pisać własnego mappera XLSX w Pythonie** — używaj `DataMapper.ts` + UI button "Import XLSX"
- ❌ **NIE robić dedup po (first_name, last_name)** — używaj PESEL/NIP (col[7])
- ❌ **NIE ustawiać `created_at = policy_start_date`** — `created_at` = data **kontaktu** (col[1]), nie startu polisy (col[9] może być w przyszłości)
- ❌ **NIE używać regex substring `'ac' in low and 'oc' in low`** dla BOTH — łapie `Classic`/`Black`/`samochód`. Tylko explicit `AC/OC` slash combo lub `\bAC\b + \bOC\b` word boundaries
- ❌ **`VEHICLE_REG` regex z samym `\b`** — `_` jest word-char, blokuje boundary. Użyj `(?<![A-Z0-9])...(?![A-Z0-9])` + ≥1 cyfra w sufiksie + PLATE_BLACKLIST (NNW/ASS/TDI/LPG/PZU/RAV4/CX5/VIII)
- ❌ **`subAgentSplits: []` hardcode w `rowToPolicy`** — musi pobierać `policy_sub_agent_shares` w `init()` i mapować
- ❌ **Odejmować prowizję pośrednika od prowizji agenta** — to DWIE niezależne pule od towarzystwa (`commission` i `rozl` w XLSX są niezależne, często równe np. 4% i 4%). Agent dostaje swoje 4% na czysto, pośrednik osobno 4%. `incomeNet = commission` (NIE `commission − partner`). Patrz § "Model prowizji" wyżej
- ❌ **`PolicyFormModal` w `useEffect [isOpen]` nie czyścił `selectedClient` gdy plus `+` z Sidebar dla nowej polisy** (Pojazdy/Majątek/Życie/Turystyczne) — `key={policy-modal-${dataVersion}}` nie wymusza remountu między otwarciami, więc `selectedClient` z poprzedniego użycia pozostawał ("ostatni klient"). Fix 2026-05-11: dodano `else { setSelectedClient(null); setSearchClientTerm(''); setIsClientDropdownOpen(true); }` w branchach `initialClient | initialPolicy | renewalSource | ELSE`.
- ❌ **DB enum CHECK constraints** (przed insertem sprawdź): `policies.stage`, `policies.type`, `sub_agents.group_prefix`, `insurance_clients.source` — wszystko underscore + no Polish chars
- ❌ **`START_ALINA_TEST.bat` bez `switch_env.ps1 test`** — vite ładuje stary `.env.development.local` (schema=public) zamiast test. Naprawione 2026-05-11.
- ❌ **Sesja przeżywająca Sleep/Hibernate kompa** (security bug 2026-05-11):
  - `createClient()` bez `auth: { storage }` → defaults `persistSession=true` w localStorage, JWT na rok
  - `supabaseStorage.getSessionExpiry` zwraca `+365 dni`
  - React state `unlocked=true` w `EncryptionGate` przeżywa suspend (Chrome nie killuje procesu)
  - Po wybudzeniu = pełen dostęp bez passphrase
  - **Fix:** `EncryptionGate` dodano:
    1. `IDLE_TIMEOUT_MS = 30min` — listener `mousedown/keydown/touchstart/scroll` resetuje timer, po idle → `lock()`
    2. `visibilitychange` listener — jeśli gap od ostatniej aktywności >5 min, lock
    3. `pageshow` listener z `e.persisted=true` (bfcache restore) → lock
- ❌ **Licznik prób PassphraseGate w React state** (do 2026-07-23 F5 = reset = brak limitu zgadywania). Od 2026-07-23 stan blokady jest **server-side**: `public.passphrase_lockouts` + RPC `register_passphrase_failure()`/`reset_passphrase_lockout()` (SECURITY DEFINER; zwykły user nie ma INSERT/UPDATE na tabeli). Progi eskalacji: **3 próby → 1 min, 6 → 5 min, 9 → hard lock** (zdejmuje wyłącznie admin: `node scripts/unlock_passphrase.mjs <email>`; bez arg = lista blokad). Migracja: `supabase/migrations/20260723000001_passphrase_lockout.sql`. NIE wracać do licznika client-side.

## 🔑 KRYTYCZNE PLIKI (kod, nie spec)

| Plik | Co robi | Linii |
|---|---|---|
| `services/dataMapper.ts` | Mapper XLSX → struktury Client/Policy/Note | 671 |
| `services/legacyParser.ts` | Hardcoded legacy maps z `data/legacy/*.ts` | 174 |
| `services/supabaseStorage.ts` | Provider Supabase (init/save) - **MUSI pobierać `policy_sub_agent_shares`** | ~900 |
| `services/policyMerger.ts` | Merge polis przy duplikatach | ? |
| `services/reverseMapper.ts` | Export polisa → wiersz XLSX | ? |
| `services/geminiService.ts` | NLP query + ofertowy AI search | 123 |
| `components/DataImporter.tsx` | UI "Import XLSX" button | 1009 |
| `components/Finance/FinanceView.tsx` | Per-miesiąc raport (grupuje po `p.createdAt`) | 426 |
| `components/Commission/CommissionCalculator.tsx` | Kaskadowy split prowizji | 245 |
| `components/SubAgents/SubAgentsView.tsx` | Centrum Pośredników | 623 |

## 🗂️ Per-tabela DB (Supabase `test` schema)

- **`insurance_clients`** — `source ∈ {'manual','xlsx_import',...}`, `tenant_id='11111111-1111-1111-1111-111111111111'`, `phones`/`emails` = JSON list, `businesses` = JSON list
- **`policies`** — `type ∈ {'OC','AC','BOTH','DOM','PODROZ','ZYCIE','FIRMA'}`, `stage` = underscore_no_polish, `auto_details`/`home_details`/`travel_details`/`firma_details`/`life_details` = JSONB, `legacy_id` = `'xlsx_2025_row_N'`
- **`policy_notes`** — `tag ∈ {'STATUS','OFERTA','DECISION_PRICE','ROZMOWA'}`, `linked_policy_ids` = JSON array, `created_at` dziedziczy datę z notatki (chronologia)
- **`sub_agents`** — `group_prefix ∈ {'firmowy','wlasny','partner',null}`, `default_rates` = JSONB `{OC: N, AC: N}`
- **`policy_sub_agent_shares`** — relacja N:M policy↔sub_agent z `rate`/`amount`/`note`. **Provider musi to query'ować w init().**

---

**Utworzony:** 2026-05-11 po lekcji XLSX import (4 cykle napraw przez ignorowanie tych spec).
**Mantra:** *"Documentation First"* (SUPREME_RULES #4).
