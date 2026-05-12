# 📋 XLSX FULL PARSE PLAN — per kolumna, kompletny mapping

> **STATUS:** AKTYWNY przy KAŻDYM imporcie/reimporcie XLSX. **NIE pomijać żadnej kolumny.**
> **Powód:** Bartek (2026-05-11) — *„trudno było przeczytać raz a dobrze cały wiersz Excela raptem 30 kolumn i pomyśleć"* — po dziadowsku 4-5 cykli naprawiania bo zignorowane były całe pola.
> **Reguła:** AI parsuje **CAŁY wiersz** (wszystkie 23 kolumny), wypisuje co znaleziono, wpisuje do struktur per typ polisy. Brak parsowania = `BRAK W XLSX:` w `ai_note`.

## 🗺️ Mapa per kolumna (XLSX → struktury CRM)

### col[0] `Imię i nazwisko`
- **Wartości:** "Imię Nazwisko", "Imię" (sam), "Imię Nazwisko _Firma X Sp. z o.o.", "Imię Nazwisko kontakt do Y"
- **Wyciągaj:** `first_name`, `last_name`, `businesses[{name, nip?, regon?}]`, `extra_note` ("kontakt do Y", "właściciel rozmowa z Z")
- **Dedup:** zapisz `legacy_id=xlsx_2025_row_N`, dedup po (PESEL/NIP z col[7]) → fallback po (first+last+phone)

### col[1] `kontakt / sprzedaż`
- **Wartości:** data YYYY-MM-DD (data utworzenia rekordu CRM, NIE startu polisy)
- **Wyciągaj:** `policies.created_at`, `clients.created_at` (min ze wszystkich polis klienta)

### col[2] `etap`
- **Wartości:** `sprzedaż` / `sprzedany` / `ucięty kontakt` / `przeł kontakt` / `czekam na dane/dokum` / `of_do zrobienia` / `of_przedst` / `rez po ofercie_kont za rok`
- **Mapuj na DB enum** (underscore + no-Polish): `sprzedaz` / `uciety_kontakt` / `przel_kontakt` / `czekam_na_dane` / `of_do_zrobienia` / `oferta_wyslana` / `rez_po_ofercie`

### col[3] `kol kont` (kolejny kontakt)
- **Wartości:** data YYYY-MM-DD
- **Wyciągaj:** `policies.next_contact_date`

### col[4] `nr tel`
- **Wartości:** 9-cyfrowy numer, czasem kilka separowane `,`/`/`/spacja, czasem z prefiksem `+48`
- **Wyciągaj:** `clients.phones[]` (array 9-cyfr). Strip prefix `+48` jeśli 11 znaków
- **Edge:** czasem w col 18 jest też telefon współwłaściciela → tam parsuj osobno

### col[5] `@` (email)
- **Wartości:** 1 lub więcej maili (rozdzielane spacją/przecinkiem/średnikiem)
- **Wyciągaj:** `clients.emails[]`. Walidacja: musi mieć `@`

### col[6] `adres`
- **Wartości:** "ZIP Miasto ul. Nazwa Numer" lub "Miasto ul. Nazwa Numer" lub samo `_` (puste)
- **Wyciągaj:** `clients.street`, `clients.city`, `clients.zip_code`
- **Edge:** pierwsza linia = miasto/zip, druga linia = adres korespondencyjny (np. row 11 ma 2 adresy)

### col[7] `pesel nip regon`
- **Wartości:** 11 cyfr (PESEL osoby), 10 cyfr (NIP firmy), 9 cyfr (REGON), pusto
- **Wyciągaj:** `clients.pesel_encrypted` (po szyfrowaniu DEK), `clients.businesses[].nip`, `regon`
- **Dedup:** PRIMARY KEY do dedupowania klientów (przed first+last)
- **⚠️ Aktualne XLSX:** PESEL `null` w 100% (usunięte przed udostępnieniem) — dedup po first+last

### col[8] `co` — KLUCZ KLASYFIKACJI
**Pipeline (pierwsze dopasowanie wygrywa):**
1. **DOM:** `dom`, `mieszkanie`, `lokal`, `majątek`, `budowa`, `garaż`, `domek`, `nieruchomość` → `type=DOM` + `home_details`
2. **PODROŻ:** `podróż`, `podroz`, `wyjazd`, `turyst` → `type=PODROZ` + `travel_details`
3. **FIRMA:** `firma`, `biznes`, `ocpd`, `flota` → `type=FIRMA` + `firma_details` (subType: MIENIE/FLOTA/OC_DZIALALNOSCI)
4. **OC bifurcation:** `OC ` + (`działalności`, `przedsiębiorcy`, `zawodowe`, `lekarz`, `NZOZ`, `spedytor`) → `type=FIRMA`; inaczej `type=OC` (auto)
5. **ZYCIE:** `życie`, `zycie`, `nnw`, `zdrowie`, `szpital` → `type=ZYCIE` + `life_details`
6. **AC/BOTH (pojazd):** w stringu wyraźnie `AC/OC` / `OC/AC` / `pakiet` + `AC` → `type=BOTH`; samo `AC` → `type=AC`; reszta → `type=OC` (auto)

**Detale z `co` per typ:**
- **VEHICLE:** `brand` (Volvo, BMW…), `model` (XC60, R 125 RT…), `reg` (PL tablica `[A-Z]{2,3}\s?[A-Z0-9]{4,5}` z ≥1 cyfrą), `engine_cc` (`1968 cm3`, `cm³`, `ccm`), `power_km/power_kw` (`102KM`, `74kW`), `year` (`prod 2017`, `MR'15`, `rocznik 2019`), `fuel` (`benzyna`, `diesel`/`olej napędowy`, `LPG`, `hybryda`), `vehicle_type` (z marki: Transporter→DOSTAWCZY, Crafter→CIEZAROWY, Yamaha/BMW R/KTM→MOTOCYKL, CFMOTO/CAN-AM→QUAD, Temared→PRZYCZEPA)
- **AC details:** `kind` (`kosztorys` / `serwis` / `pakiet`), `ass` (`Złoty`, `Standard`, `Złoty+`), `szyby`, `opony`, `extras[]`, `su_netto`/`su_brutto` (sum insured z `SU 38 tys brutto`)
- **HOME:** `address` (po `dom_/mieszkanie_`), `type` (DOM/MIESZKANIE/MAJATEK/BUDOWA/DOMEK), `area_m2`, `year_built`, `su` (`SU 100 tys`)
- **TRAVEL:** `destination` (Malta, Grecja Santorinii, Włochy, Dubaj…), `date_from`, `date_to` (z `30.08-05.09.2025`)
- **FIRMA:** `description`, `subType` (MIENIE/FLOTA/OC_DZIALALNOSCI), `fleet_count`

### col[9] `start polisy`
- **Wartości:** data YYYY-MM-DD
- **Wyciągaj:** `policies.policy_start_date`, oraz `policies.policy_end_date = start + 1 year`

### col[10] `nr pol`
- **Wartości:** numer polisy (długi int/string)
- **Wyciągaj:** `policies.policy_number` (po szyfrowaniu DEK)

### col[11] `gdzie` (towarzystwo)
- **Wartości:** Warta, TUZ, Generali, HDI, PZU, Compensa, MTU24, MTU, Wiener, Link4, Ergo Hestia, Interrisk, Pevno, `brak`, `?`
- **Wyciągaj:** `policies.insurer_name` + lookup w `insurers` → `policies.insurer_id`
- **Aliasy:** `hestia` → `Ergo Hestia`, `pzu` → `PZU SA`
- **Dodaj automatycznie do `insurers` tabeli** jeśli nie ma (zrobiłem 2026-05-11: HDI, MTU, MTU24, Pevno)

### col[12] `przyp` (przypis składki)
- **Wartości:** liczba PLN (składka roczna)
- **Wyciągaj:** `policies.premium`

### col[13] `kogo` (źródło / pośrednik)
- **Wartości:** `firmowy` / `firmowy/Beata` / `firmowy/Hejka/Baza od Beci` / `własny` / `wlasny->rozliczona po zerwaniu` / `Imię Nazwisko` (zewn. partner)
- **Wyciągaj:** `sub_agents.name` + `group_prefix` (`firmowy`/`wlasny`/`partner`) + `notes`
- **Dedup:** po (name, group_prefix); 28 unikalnych w obecnym XLSX
- **Link:** `policy_sub_agent_shares` (policy ↔ sub_agent + rate + amount)

### col[14] `prow` (prowizja agenta)
- **Wartości:** liczba PLN — **PEŁNA prowizja agenta od towarzystwa** (NIE po odjęciu pośrednika!)
- **Wyciągaj:** `policies.commission`, `policies.commission_rate = commission/premium*100`
- **⚠️ MODEL:** agent + pośrednik = DWA niezależne strumienie od TU. NIE odejmować

### col[15] `rozl` (rozliczenie pośrednika)
- **Wartości:** liczba PLN — osobna prowizja pośrednika (często równa col 14)
- **Wyciągaj:** `policy_sub_agent_shares.amount`, `rate = amount/premium*100`

### col[16] `sta pol/ moja of` (stara składka / moja oferta)
- **Wartości:** liczba PLN — referencyjna kwota (porównanie do oferty)
- **Wyciągaj:** `policies.notes` jako `[STARA_SKLADKA] N zl` (lub w `policy_versions` snapshot)
- **TODO:** dedykowane pole `old_premium`?

### col[17] `st pol` (stara polisa)
- **Wartości:** `stara PZU 1098320345`, `stara Warta`, `Compensa 119344516/22014`, `wznowienie`, `pierwsza polisa`, `brak`
- **Wyciągaj:**
  - `policy_terminations.old_insurer_name` (PZU/Warta/Compensa…)
  - `policy_terminations.old_policy_number` (regex `\d{8,15}` lub `\w-\d+`)
  - `policy_terminations.status = DRAFT` (gdy `stara X` bez wzmianki o wypowiedzeniu w col 19); `REGISTERED` (gdy notatka mówi `wypowiedzenie zarejestrowane`); `NOT_REQUIRED` (gdy `pierwsza polisa`/`nowy pojazd`)
  - **TIMELINE_ARCHITECTURE** → tabela `policy_terminations` (4 nowe tabele, czeka na migration)

### col[18] `wsp` (współwłaściciele) — ⭐ kompleks
- **Wartości:**
  - Leasing: `Stellantis Financial Services Sp. z o.o.`, `PKO Leasing ... REGON ...`, `Pekao Leasing NIP ...`
  - Bank/cesja: `cesja na PKO BP`
  - Małżonek: `Magdalena Zaborowska` (sam name) lub `Magdalena Zaborowska 81020601325` (name + PESEL)
  - **Multi-osoba travel:** `ubezpieczeni ->84062612148 Mariola, 79100403550 Rafał, ...` (split po przecinku, każdy fragment ma PESEL+imię)
  - **Multi-osoba travel z prefixem:** `współubezpieczeni: Piotr Zuchniarz 87030214159, Maja Zuchniarz 10251901805`
  - **Uposażony życie:** `uposażony Mariusz Jakimski pesel 76100801951`
  - **Pytania/niewiadome:** `czy Jerzy Sowa jest współwłaścicielem?` → `ai_note: do potwierdzenia`
- **Wyciągaj** (per typ polisy):
  - **OC/AC/BOTH** → `auto_details.coOwners[]`, `auto_details.ownershipType` (LEASING/KREDYT/PRYWATNA), `auto_details.assignment` (bank cesja)
  - **DOM** → `home_details.coOwners[]`, `home_details.assignmentBank` (hipoteka)
  - **PODROZ** → `travel_details.coOwners[]` lub raczej `travel_details.insured_persons[]` (multi-osoba!)
  - **ZYCIE** → `life_details.uposazony` (1 osoba) lub `life_details.related_persons[]`
  - **FIRMA** → `firma_details.coOwners[]` (leasingi firmowe)
- **Detale per CoOwner:** `name`, `pesel?`, `nip?`, `regon?`, `type` (PERSON/LEASING/BANK), `phone?`, `email?`, `address?`, `notes?`
- **⚠️ Bugi parsera 2026-05-11** (do dopracowania):
  1. **NIP łapie się jako phone** (Pekao Leasing 7121016682 → phone=712101668) — fix: ekstrahuj NIP/REGON PRZED phone regex
  2. **Wielo-osobowe travel** sczepiane w 1 osobę — fix: rozpoznać markery `ubezpieczeni`, `współubezpieczeni`, `->`, splitować po przecinkach
  3. **Doczepione cyfry do nazwy** (`Kamila Figur 63`) — fix: czystsze regex po peselu/telefonie

### col[19] `not` (notatki) — ⭐ kopalnia danych
- **Wartości:** wieloliniowe notatki separowane `_` (chronologicznie OD najstarszej DO najnowszej)
- **Wyciągaj:**
  - **Daty:** każdy fragment ma datę na początku (`14.06.2025`, `[2025-05-10]`, `11.06 i 16.06.2025`) → `policy_notes.created_at`
  - **Tag detection:**
    - `nie odbiera`, `abonent niedostepny` → `STATUS`
    - `oferta`, `kalkulacja`, `wysłałam ofertę` → `OFERTA`
    - `rezygnacja`, `odmowa`, `drogo`, `inny agent` → `DECISION_PRICE`
    - `polisa wysłana`, `podpisał`, `sprzedan` → `STATUS`
    - reszta → `ROZMOWA`
  - **Wzmianki o wypowiedzeniu** → `policy_terminations.status` + `source_note_id`
  - **Wzmianki o ludziach** (`rozmawiałam z mężem`, `partnerką`, `dziecko`, `kontakt do X`) → `notes.related_persons` lub link do `coOwners`
  - **Wzmianki o miejscach** (`wyjazd na narty do Włoch`, `klient w trasie`) → `travel_details` enrichment
  - **Cytaty cen** (`oferta z Warty 3559 zł`) → historia ofert
  - **AI Note (Bartka kontekst):** `klient z Osipa`, `klient od Tomka`, `z bazy od Beci` → metadata żeby Alina widziała kto polecił

### col[20] `dok` (dokumenty)
- **Wartości:** `przesłany skan polisy`, `brakuje dowodu rej.`, pusto
- **Wyciągaj:** `policies.documentsStatus` (lub `checklist.documents_received: bool`)

### col[21] `załączono dok do portalu TU`
- **Wartości:** `TAK`, `NIE`, `?`, pusto
- **Wyciągaj:** `policies.portalStatus` (lub `checklist.portal_uploaded: bool`)

### col[22] `płatność`
- **Wartości:** `TAK`, `opłacona`, `NIE`, `paid`, `unpaid`
- **Wyciągaj:** `policies.payment_status` ∈ `PAID` / `UNPAID` / `PARTIAL`

## 🔁 Checklist przed re-importem

- [ ] **TRUNCATE all 5 tabel** w `test` schema (nie zostawiać śmieci)
- [ ] **Source = `xlsx_import`** (NIE `xlsx_import_2026_05_10` — `source` check constraint)
- [ ] **Stage enum** → underscore + no-Polish (mapping w `STAGE_MAP`)
- [ ] **`group_prefix`** → `firmowy`/`wlasny`/`partner`/null (NIE `własny`/`partnerzy`)
- [ ] **`type`** → wszystkie 7 typów: `OC` / `AC` / `BOTH` / `DOM` / `PODROZ` / `ZYCIE` / `FIRMA`
- [ ] **`created_at`** = col[1] (kontakt) NIE col[9] (start polisy) — Finance View grupuje po created_at
- [ ] **Dedup klientów** po PESEL/NIP → fallback (first+last+phone) → ostatecznie nie duplikować Roberta Starka (20 polis = 1 klient)
- [ ] **Sub-agent dedup** po (name, group_prefix); shares.sub_agent_id = canonical UUID
- [ ] **Insurers backfill** dla brakujących TU (HDI, MTU, MTU24, Pevno — już dodane)
- [ ] **`policy_sub_agent_shares`** = osobna pula (NIE odejmować od commission agenta)
- [ ] **Parse col[18] przez `parse_coowners.py`** → `auto/home/travel/life/firma_details.coOwners[]`
- [ ] **Parse col[17]** → `policy_terminations` (po TIMELINE_ARCHITECTURE migration)
- [ ] **Parse col[19] notatek** wieloliniowo z datami + tagami
- [ ] **PESEL_encrypted** → przez DEK gdy będzie udostępniony
- [ ] **AI parse `co` przez Sonnet/Gemini Flash** (NIE regex od zera) — vehicle_type/brand/model/year/cc/kw/fuel/ac_details

## 🛠️ Aktualne pliki

- `parse_xlsx.ts` (legacy) — `dataMapper.ts` + `legacyParser.ts` + `secondaryParsers.ts`
- `import_xlsx_to_test.py` — moja Python implementacja (~1100 linii, podstawowa)
- `ai_parse_xlsx.py` — Gemini Flash batch parser
- `ai_parsed_182.json` — wynik AI parse (182 entries)
- `parse_coowners.py` — port `secondaryParsers.parseCoOwnerColumn`
- `apply_ai_parsed.py` — PATCH policies w DB z `ai_parsed_182.json`

## 🚨 KRYTYCZNY ZAKAZ (lekcja Bartka 2026-05-11)

**NIGDY nie wrzucaj surowej zawartości kolumn XLSX do `policy_notes` z prefixami `[WSPOLWL/CESJA]`/`[STARA POLISA]`/`[KONTEKST]`** jako "tymczasowe rozwiązanie". To było mój pierwszy import — wepchnąłem 54 notatki `[WSPOLWL/CESJA]` które:
- Były **redundant** z `coOwners[]` (po parsowaniu)
- **Zaciemniały oś czasu** notatek klienta (mieszane "fake" wpisy z prawdziwymi rozmowami)
- Dla 6 wierszy gdzie parser nie wyciągnął coOwnera (`pesel kl`, `czy X jest właścicielem?`, `15.09.2025 klient podpisał gdzie indziej`, `regon bez nazwy`) **tekst NIE był informacją o współwłaścicielu** — np. row 116 to faktycznie status DECISION_PRICE (rezygnacja) + pytanie do agenta o właścicieli (rodzice?)

**Każdy znak z XLSX musi być sklasyfikowany PRZED zapisem:**
- col[18] `wsp` → `parse_coowners.py` → albo `coOwners[]` (structurd) albo `clients.pesel_encrypted` (gdy `pesel kl`) albo notatka tag=STATUS (gdy pytanie/niewiadome) albo notatka tag=DECISION_PRICE (gdy status klienta)
- col[17] `st pol` → `policy_terminations.old_*` (po TIMELINE migration) NIE `policy_notes [STARA POLISA]`
- col[19] `notatki` → split po `_` z datami, każdy fragment z tag detection (STATUS/OFERTA/DECISION_PRICE/ROZMOWA)

**Czyszczenie 2026-05-11:**
- DELETE 54 `[WSPOLWL/CESJA]` notatek (dane są w `coOwners[]`)
- Dodano 6 notatek **STATUS/DECISION_PRICE** dla wierszy gdzie `parse_coowners.py` skipped (z konkretną treścią + tagiem, NIE jako fake-coowner)
- Pozostaje 102 `[STARA POLISA]` (czekają na migration `policy_terminations` w TIMELINE_ARCHITECTURE)

## ⏭ Bugi/dopracowania (do następnej iteracji)

1. **`parse_coowners.py`** — multi-osoba travel split (`ubezpieczeni ->PESEL Imię, PESEL Imię, ...`), NIP/REGON przed phone regex, czystsze regex po peselu
2. **`policy_terminations` backfill** — po TIMELINE_ARCHITECTURE migration (4 nowe tabele)
3. **`assets` backfill** — pojazd/dom/firma jako persistent entity, link `policies.asset_id`
4. **`client_attribute_history` INITIAL** — snapshot phone/email/address
5. **Atomic-crm `/contacts/` port CoOwner** — gdy Atomic stanie się głównym UI
6. **Encrypt phones/emails/vehicle_reg** przez DEK (obecnie plaintext w test schema)
7. **AI parse PESEL z col[19] notatek** (wzmianki "z mężem PESEL X")
8. **Recall co-owner contact:** kto jest co-owner gdzie → widok dla Aliny

---

**Utworzony:** 2026-05-11 (Bartek: *„trudno było przeczytać raz a dobrze cały wiersz Excela raptem 30 kolumn"*)
**Aktualizacja:** każdy reimport zaczyna się od **CZYTANIA TEGO PLIKU** + checklist. NIE pisać kodu bez tego.
