# 📋 AUDIT PLAN — naprawa importu XLSX (182 wierszy → 182 obecnie w DB)

> **Powiązany raport:** [`AUDIT_ROWS_1_10_2026-05-11.md`](./AUDIT_ROWS_1_10_2026-05-11.md) — pierwsze 10 wierszy ręcznie sprawdzone przez Opus 4.7.
> **Czytaj NAJPIERW:** [`IMPORT_AUDIT_HOWTO.md`](./IMPORT_AUDIT_HOWTO.md) — jak się podpiąć do DB, gdzie XLSX, jak działa `legacy_id`.

## 🎯 Cel
Doczyścić obecne 182 polisy importu + naprawić parser PRZED następnym wsadem (pozostałe 0 pozostałych (wszystkie 182 już w DB) z `potencjalny`). Każde uruchomienie reimportu z buggy parserem zostawia śmieci, których cleanup zajmuje więcej czasu niż naprawa parsera.

## 🚦 Stan na 2026-05-11

| Komponent | Status | Uwagi |
|---|---|---|
| DataMapper.ts | ⚠️ CODE FREEZE z bugami (IMPORT_LOGIC § warning) | parser działa, ale: pesel-kl bug, PODROZ end_date, FIRMA+auto_details konflikt |
| `services/secondaryParsers.ts` (parseCoOwnerColumn) | ❌ bug col[18] "pesel kl …" | tworzy fake coOwner z phone=peseldigits |
| `import_xlsx_to_test.py` (Python ~1100 linii) | ⚠️ tylko podstawowy | nie używa DataMapper.ts |
| `parse_coowners.py` | ⚠️ multi-osoba travel + NIP-jako-phone bugi | znane (PLAN.md § Bugi 1-3) |
| `apply_ai_parsed.py` | ✅ PATCH policies w DB | używa `ai_parsed_182.json` |
| `[STARA POLISA]` notatki | ⏸ 102 sztuk czekają na TIMELINE migration | `policy_terminations` table nie zaaplikowane |
| `[WSPOLWL/CESJA]` notatki | ✅ DELETE 54 sztuk 2026-05-11 | dane są w `coOwners[]` |

## 📅 Plan w 4 fazach

### Faza 1 — Quick cleanup obecnych 182 polis (NO schema changes, ~2h)

Skrypt: `scripts/fix_audit_rows.py` (do napisania).

**Działania (SQL UPDATE via PostgREST):**

1. **row_5 Tron fake coOwner**
   ```sql
   UPDATE test.policies
   SET firma_details = firma_details - 'coOwners'
   WHERE legacy_id = 'xlsx_2025_row_5';

   -- + dodaj notatkę (już jest z 2026-05-11)
   -- + (przyszłość) client.pesel_encrypted po EncryptionGate
   ```

2. **PODROZ end_date = date_to** (cała tabela)
   ```sql
   UPDATE test.policies
   SET policy_end_date = (travel_details->>'date_to')::date
   WHERE type='PODROZ' AND travel_details->>'date_to' IS NOT NULL;
   ```

3. **FIRMA auto_details=null** (cała tabela)
   ```sql
   UPDATE test.policies
   SET auto_details = null
   WHERE type='FIRMA' AND auto_details IS NOT NULL;
   -- ale ZAPISZ pierwszy reg/typ do firma_details.first_vehicle PRZED null'em
   ```

4. **row_9 last_name=null**
   ```sql
   UPDATE test.insurance_clients SET last_name=null
   WHERE last_name='(brak nazwiska)';
   ```

5. **Sub_agent linking** — każda polisa z col[13]≠null powinna mieć w `policy_sub_agent_shares` rekord (nawet amount=0).
   - Zbierz mapping `xlsx_row → sub_agent_name` z `ai_parsed_182.json`
   - INSERT shares (rate=null, amount=0, note='Import XLSX (lead-only)') dla brakujących

**Walidacja po Faza 1:**
- `SELECT count(*) FROM test.policies WHERE type='PODROZ' AND policy_end_date > policy_start_date + interval '60 days'` = 0
- `SELECT count(*) FROM test.policies WHERE type='FIRMA' AND auto_details IS NOT NULL` = 0
- `SELECT count(*) FROM test.insurance_clients WHERE last_name='(brak nazwiska)'` = 0

### Faza 2 — Parser bugfix przed reimportem (~1 dzień)

Edycja `services/dataMapper.ts` + `services/legacyParser.ts` + `services/secondaryParsers.ts`. CODE FREEZE zdjąć po Faza 1 walidacja OK.

**Bugi do naprawienia (Top 5):**

1. **Splitter notatek** (`parseNotes` w dataMapper.ts):
   - Stary regex: split tylko po `_`
   - Nowy: split po `_` LUB po dacie inline: regex `(?<=[\s;)\->_])(\d{1,2}\.\d{1,2}(?:\.\d{4})?\b)`
   - Każdy fragment z datą = osobna notatka, data z fragmentu = `created_at`

2. **Adres bez "ul." prefiksu** (`parseAddress`):
   - Zip-lookup tabela (przynajmniej dla Pomorza: 80-xxx Gdańsk, 81-xxx Gdynia, 83-xxx okolice)
   - Jeśli słowo zawiera tylko litery → ulica; reszta → numer

3. **col[18] "pesel kl …" handling** (`parseCoOwnerColumn`):
   - PRZED phone regex: wykryj `pesel kl[ient]?\s+(\d{11})` → zwróć `{type:'CLIENT_PESEL', pesel:'<11>'}`
   - Caller (`dataMapper`) wpisuje to do `client.pesel_encrypted` zamiast `coOwners[]`

4. **col[8]="?" handling** (`parseCo`):
   - Zamiast cichy fallback do POJAZD/OC → `type='OC'` ALE dodaj `aiNote: "BRAK DANYCH: col[8]=?, klasyfikacja domyślna"` w `policies.ai_note`

5. **PL plate regex w col[8] + col[19]** (`parseAutoString`):
   - Regex `(?<![A-Z0-9])([A-Z]{2,3}\s?[A-Z0-9]{4,5})(?![A-Z0-9])` + ≥1 cyfra w sufiksie
   - Blacklist: `NNW, ASS, TDI, LPG, PZU, RAV4, CX5, VIII, OC, AC`
   - Wynik → `auto_details.reg`

**Testy (vitest):**
- `parseNotes("a_b 11.06.2025 c")` → 2 notatki
- `parseAddress("80-442 Lelewela 36/140B")` → city=Gdańsk, street=ul. Lelewela 36/140B
- `parseCoOwnerColumn("pesel kl 86080119155")` → `{type:'CLIENT_PESEL', pesel:'86080119155'}`

### Faza 3 — TIMELINE_ARCHITECTURE backfill (po migration, ~4h)

**Wymagane PRZED:** apply 4 nowe tabele z `TIMELINE_ARCHITECTURE.md § 3`:
- `assets`
- `policy_terminations`
- `client_attribute_history`
- `policy_versions` (opcjonalne)

**Backfill skrypt:** `scripts/timeline_backfill.py`

1. **Assets** (~100 pojazdów/domów/firm)
   - VEHICLE: dla każdej polisy type∈{OC,AC,BOTH} z `auto_details.reg` ≠ null → UPSERT po (client_id, type='VEHICLE', identifier=reg)
   - HOME: dla każdej polisy type=DOM z `home_details.address` → UPSERT po normalized address
   - BUSINESS: dla każdej polisy type=FIRMA z NIP/nazwa → UPSERT
   - `policies.asset_id = assets.id`

2. **policy_terminations** (~102 z notatek)
   - Regex w `policy_notes.content`:
     - `[STARA POLISA] stara <TU> nr (\d+)` → old_insurer + old_policy_number
     - `[STARA POLISA] (\w+)` → old_insurer_name (gdy bez numeru)
     - `wypowiedzenie ... (zarejestrowan|wysłał|wysłana|wysłałam)` → status=REGISTERED/SENT
   - `ai_extracted=true`, `ai_note="parsed from note '<excerpt>'"`, `confirmed_at=null`

3. **client_attribute_history** INITIAL (~350 rekordów)
   - Dla każdego klienta: INSERT 3 rekordy {attribute:PHONE/EMAIL/ADDRESS, value_new:current, valid_from=client.created_at, valid_to=null}

### Faza 4 — UI flagi + reimport pozostałych 0 pozostałych (wszystkie 182 już w DB) (po Faza 2+3, ~1 dzień)

1. **Flagi "wymaga uzupełnienia"** w widoku klienta:
   - `auto_details.reg=null` ALE type∈{OC,AC,BOTH}
   - `businesses[].nip=null` ALE businesses≠[]
   - `policy_sub_agent_shares` puste ALE col[13]≠null
   - `type=null` lub `ai_note CONTAINS 'BRAK DANYCH'`

2. **Dashboard "TODO"** — lista klientów posortowana wg liczby flag

3. **Reimport** pozostałych 0 pozostałych (wszystkie 182 już w DB) z `BAZA_bez_pesel.xlsx` (rows 12-1019):
   - PRZED: zweryfikuj że Faza 2 parser bugfix przeszedł testy
   - DRY-RUN: zapisz do JSON, ręcznie zsprawdź losowych 10 wierszy
   - Zaimportuj z `legacy_id='xlsx_2025_row_N'` (N=11..1019)
   - Po imporcie powtórz audyt na próbce 20 losowych

## 🚧 Decyzje do podjęcia (czekają na Bartka)

- [ ] **Czy iść z Faza 1 teraz?** (cleanup 182 polis bez parser changes)
- [ ] **Czy apply TIMELINE migration?** (4 nowe tabele + ALTER policies)
- [ ] **Czy DataMapper.ts edytować** (zdjąć CODE FREEZE) czy pisać nowy parser obok?
- [ ] **Sub_agent linking** — przez `policies.sub_agent_id` (single FK) czy `policy_sub_agent_shares` z amount=0?
- [ ] **PESEL encryption** — czy mamy DEK gotowy do batch update `pesel_encrypted` dla wierszy gdzie wyciągnęliśmy z col[18] "pesel kl …"?

## 📝 Pliki do utworzenia / zmodyfikowania

| Plik | Co | Faza |
|---|---|---|
| `scripts/fix_audit_rows.py` | quick cleanup 5 SQL UPDATE + sub_agent linking | 1 |
| `services/dataMapper.ts` | splitter notatek, parser adresu, type=null dla "?" | 2 |
| `services/legacyParser.ts` | regex PL reg + blacklist | 2 |
| `services/secondaryParsers.ts` | "pesel kl" handling w parseCoOwnerColumn | 2 |
| `src/__tests__/parser.test.ts` | testy vitest dla 5 bugów | 2 |
| `supabase/migrations/20260512_timeline.sql` | 4 nowe tabele z `TIMELINE_ARCHITECTURE.md` | 3 |
| `scripts/timeline_backfill.py` | assets + policy_terminations + client_attribute_history | 3 |
| `components/ClientDetails.tsx` (lub nowy) | flagi "wymaga uzupełnienia" | 4 |

---

## ✅ Status 2026-05-15 (paralel 5× Sonnet)

| Faza | Status | Notatka |
|---|---|---|
| Audyt 1-182 | ✅ KOMPLETNY (2026-05-11) | 18 plików AUDIT_ROWS |
| Faza 1 — SQL cleanup | ⚠️ wykonane przez agenta #1 | sprawdź `scripts/fix_audit_rows.py` |
| Faza 2 — Parser bugfix (4 bugi) | ⚠️ wykonane przez agenta #2 | `dataMapper.ts` |
| Faza 2 — BUG #3 + wzorzec #18 | ⚠️ wykonane przez agenta #3 | `secondaryParsers.ts` + `dataMapper:565` |
| Faza 3 — Provider schema v2 | ⚠️ wykonane przez agenta #4 | `supabaseStorage.ts` |
| Tests vitest | ⚠️ wykonane przez agenta #5 | `src/__tests__/parser.test.ts` |
| Faza 4 — UI flagi + reimport | ⏸ czeka na nowy XLSX (weekend) | |

**Decyzje podjęte w sesji:**
1. Sub_agent linking → `policy_sub_agent_shares` z amount=0 (spójne ze schema v2)
2. Provider mapping row_110 → `insured_persons` table (nie `life_details JSONB`)
3. PESEL Gabriel Zaklicki → `insured_persons.pesel_encrypted=NULL` + `notes='PESEL_PENDING_DEK'`

---

**Utworzony:** 2026-05-11 (Opus 4.7 — po audycie ręcznym wierszy 1-10)
