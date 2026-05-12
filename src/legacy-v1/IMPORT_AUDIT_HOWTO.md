# 🧰 IMPORT AUDIT — HOWTO (onboarding dla AI)

> **Cel:** jak audytować import XLSX vs DB **w 5 minut zamiast 2 godzin**. Spisane po sesji 2026-05-11 gdzie Opus 4.7 zmarnował czas na: szukanie XLSX, błędną Supabase URL, mylenie schemy, nieznajomość `legacy_id` mapping, brak skryptu audytowego.
>
> **TLDR:** XLSX `BAZA_bez_pesel.xlsx/potencjalny` → DB `CRM_ALINA_SUPABASE_URL` schema `test` → `legacy_id='xlsx_2025_row_N'` (1-based). Pełny dump + diff w 1 skrypcie Python.

## 1. Konfiguracja połączenia (5 minut)

### XLSX źródłowy
- **Plik:** `C:/BartsGda4/CRM-ALINA/DANE-POZNIEJ-USUN/BAZA_bez_pesel.xlsx`
- **Arkusz:** `potencjalny` (NIE „KLIENCI", NIE inny plik z `python/`)
- **Wymiary:** `ws.max_row=1019` ALE **tylko 182 wierszy z danymi** (od xlsx row 3 do row 184), reszta to puste wiersze do końca arkusza. 23 kolumny.
- **Header:** wiersz **2** (wiersz 1 jest pusty); dane od wiersza **3** (= xlsx_2025_row_1 w DB)
- **PESEL:** wszystkie `null` (usunięte przed udostępnieniem) → dedup po (first+last+phone)

### Supabase
- **URL:** `$env:CRM_ALINA_SUPABASE_URL` = `https://xqznrssrlnxqkdvisnck.supabase.co`
  - ❌ NIE używaj `$env:SUPABASE_URL` (`fdijzgzcbibwvguygaof…`) — to projekt brain/CONSIS
- **Klucz:** `$env:CRM_ALINA_SB_SECRET` (sb_secret_*)
- **Schema:** `test` (NIE `public`) — przekaż przez header `Accept-Profile: test`
  - Schemy wystawione w REST: `public, storage, graphql_public, brain, ai_projects` + `test` (jest, ale czasem trzeba zweryfikować)

### Legacy ID mapping
- `legacy_id = 'xlsx_2025_row_N'` gdzie **N = 1-based pozycja wpisu w importie** (NIE numer wiersza XLSX!)
- XLSX wiersz 3 (1. wpis danych) = `xlsx_2025_row_1`
- XLSX wiersz 4 = `xlsx_2025_row_2` itd.
- **W PostgREST sortowanie alfabetyczne stringów:** `row_1, row_10, row_11, …, row_2, row_20, …` — dla pierwszych 10 wierszy w kolejności XLSX użyj `legacy_id=in.(xlsx_2025_row_1,xlsx_2025_row_2,...,xlsx_2025_row_10)`

### Pola w DB (ważne specyfiki)

| Tabela | Pole | Uwagi |
|---|---|---|
| `insurance_clients` | `pesel_encrypted` (NIE `pesel`) | NIE plaintext, szyfrowane DEK |
| `insurance_clients` | `phones`, `emails` | JSON-string array (parsuj jako `json.loads`) |
| `insurance_clients` | `businesses` | JSON list `[{name, nip}]` |
| `policies` | `auto_details`, `home_details`, `travel_details`, `firma_details`, `life_details` | JSONB, puste = `{}` lub `null` |
| `policy_notes` | `linked_policy_ids` (JSON array), `client_id` (FK) | **brak `policy_id` bezpośrednio** — używaj `client_id=in.(...)` + filtruj po `linked_policy_ids` array contains policy_id |
| `policy_sub_agent_shares` | `policy_id`, `sub_agent_id`, `rate`, `amount` | **DWIE niezależne pule prowizji** (agent + pośrednik), NIE odejmować |
| `sub_agents` | `group_prefix ∈ {firmowy, wlasny, partner}` | underscore + no Polish |
| `policies` | `stage` | underscore + no Polish: `sprzedaz / uciety_kontakt / przel_kontakt / czekam_na_dane / of_do_zrobienia / oferta_wyslana / rez_po_ofercie` |
| `policies` | `type` | `OC / AC / BOTH / DOM / PODROZ / ZYCIE / FIRMA` |

## 2. Skrypt audytowy (gotowy boilerplate)

```python
import os, urllib.request, json

URL = os.environ['CRM_ALINA_SUPABASE_URL']
KEY = os.environ['CRM_ALINA_SB_SECRET']

def q(path, schema='test'):
    """PostgREST query, schema='test' default."""
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        headers={
            'apikey': KEY,
            'Authorization': f'Bearer {KEY}',
            'Accept-Profile': schema,
        })
    return json.loads(urllib.request.urlopen(req).read())

# Pierwsze 10 wierszy importu (XLSX rows 3-12)
legacy_ids = [f'xlsx_2025_row_{i}' for i in range(1, 11)]
policies = q(f"policies?select=*&legacy_id=in.({','.join(legacy_ids)})&order=legacy_id")
client_ids = list({p['client_id'] for p in policies if p.get('client_id')})
policy_ids = [p['id'] for p in policies]

clients = q(f"insurance_clients?select=*&id=in.({','.join(client_ids)})")
# Notatki: TYLKO przez client_id (policy_notes nie ma policy_id), filtruj client-side po linked_policy_ids
notes = q(f"policy_notes?select=*&client_id=in.({','.join(client_ids)})&order=created_at")
shares = q(f"policy_sub_agent_shares?select=*&policy_id=in.({','.join(policy_ids)})")

# Lookup tables
insurers = {i['id']: i['name'] for i in q("insurers?select=id,name")}
sub_agents = {s['id']: s for s in q("sub_agents?select=id,name,group_prefix")}
```

### XLSX boilerplate

```python
import openpyxl

wb = openpyxl.load_workbook(
    'C:/BartsGda4/CRM-ALINA/DANE-POZNIEJ-USUN/BAZA_bez_pesel.xlsx',
    data_only=True)
ws = wb['potencjalny']  # NIE 'KLIENCI'

# Pierwsze 10 wpisów danych (xlsx rows 3-12 = legacy row_1..row_10)
HEADERS = ['imie_naz','kontakt','etap','kol_kont','tel','email','adres','pesel_nip_regon',
           'co','start_pol','nr_pol','gdzie','przyp','kogo','prow','rozl','niepok',
           'pol_AC_pak','wsp_cesja','rezyg_strata','poprawki','TER','wzn']

for r in range(3, 13):  # rows 3-12 = legacy 1..10
    row = {HEADERS[c]: ws.cell(row=r, column=c+1).value for c in range(23)}
    legacy_id = f'xlsx_2025_row_{r-2}'
    # … porównaj z DB[legacy_id]
```

## 3. Pułapki, których nie powtarzaj

### ❌ Powiel: wczytanie złego XLSX
- `Baza_CRM_Python_20260216_0035.xlsx` (w `python/`) ma tylko 9 kolumn — to nie ten plik
- Inny pliki w `SOR/` to nie CRM, ignoruj

### ❌ Powiel: użycie złego Supabase URL
- `$env:SUPABASE_URL` to brain/CONSIS (`fdijzgzcbibwvguygaof`) — **NIE Alina**
- Alina = `xqznrssrlnxqkdvisnck` (przez `$env:CRM_ALINA_SUPABASE_URL`)
- Symptom złej URL: `404 Could not find the table 'public.policies'` (bo brain ma `brain.*` schemę a nie `public.policies`)

### ❌ Powiel: schema='test' jako query param
- Trzeba **header** `Accept-Profile: test` (nie `?schema=test`)
- Symptom: 406 `Invalid schema: test` gdy schemy nie ma w `db_schema` ale request leci na `public` → faktycznie schema nie jest aktywna w REST

### ❌ Powiel: join sub_agents w `policy_sub_agent_shares?select=*,sub_agents(...)`
- Wymaga skonfigurowanego FK relationship w PostgREST (czasem nie widać)
- Symptom: 400 Bad Request bez czytelnego komunikatu
- Fix: 2 zapytania osobno (`sub_agents?select=*` → map by id, dołącz client-side)

### ❌ Powiel: `policy_id=in.(...)` na `policy_notes`
- Tabela `policy_notes` **NIE ma kolumny `policy_id`** — używa `linked_policy_ids` (JSON array) + `client_id`
- Fix: query po `client_id=in.(...)` + client-side filter `linked_policy_ids` zawiera policy_id

### ❌ Powiel: zakładanie `pesel` w `insurance_clients`
- Pole nazywa się `pesel_encrypted` (szyfrowane DEK)
- Symptom: 400 Bad Request na `select=pesel`

### ❌ Powiel: piszanie ścieżek z backslashami w Python f-string
- `f'C:\Users\Barts\file.json'` → `SyntaxError: unicodeescape \U…`
- Fix: raw string `r'C:\Users\Barts\file.json'` lub forward slash `'C:/Users/Barts/file.json'`

### ❌ Powiel: pisanie do `/tmp/` lub `cwd` git-basha
- git-bash dla Windows nie ma `/tmp/`, a `cwd` resetuje się między tool calls
- Fix: zapis do `$HOME` (`C:/Users/Barts/`) lub `C:/BartsGda4/CRM-Atomic/`

### ❌ Powiel: PostgREST `LIKE 'xlsx_2025_row_*'` jako wildcard
- PostgreSQL używa `%` jako wildcard, w REST URL-encoded jako `%25`
- Poprawnie: `legacy_id=like.xlsx_2025_row_%25`
- Lepiej: `legacy_id=in.(xlsx_2025_row_1,...,xlsx_2025_row_10)` — explicit, brak escape problemów

## 4. Mapy danych (do referencji)

### XLSX 23 kolumny → CRM (pełna mapa w `XLSX_FULL_PARSE_PLAN.md` § Mapa per kolumna)

| Idx | XLSX header | CRM field | Edge cases |
|---|---|---|---|
| 0 | imie_naz | first_name, last_name + biz/notatka | "Imię Nazwisko kontakt do Y" → [KONTEKST] notatka |
| 1 | kontakt | `created_at` | **NIE start polisy!** |
| 2 | etap | stage (underscore_no_polish) | mapping w STAGE_MAP |
| 3 | kol_kont | next_contact_date | |
| 4 | tel | phones[] | 9 cyfr, strip `+48`, separator `,`/`/` |
| 5 | email | emails[] | walidacja `@` |
| 6 | adres | street, city, zip | "ZIP City ul. Street" lub bez "ul." → bug parsera |
| 7 | pesel_nip_regon | pesel_encrypted / businesses[].nip | obecnie wszystko null |
| 8 | co | type + details | KEYWORD pipeline DOM→PODROZ→FIRMA→OC bif→ZYCIE→POJAZD |
| 9 | start_pol | policy_start_date | + end = start + 1y, ale **PODROZ jednorazowe** |
| 10 | nr_pol | policy_number | |
| 11 | gdzie | insurer_id (lookup) | "brak"/"?" → null; alias `hestia`→`Ergo Hestia` |
| 12 | przyp | premium | |
| 13 | kogo | sub_agent (group_prefix) | `firmowy`/`firmowy/Beata`/`własny`/`Imię Nazwisko` |
| 14 | prow | commission | **pełna prowizja agenta** (NIE −pośrednik) |
| 15 | rozl | policy_sub_agent_shares.amount | **osobna pula** (NIE odejmuj) |
| 16 | niepok | (stara składka) | brak pola — notatka `[STARA_SKLADKA]` |
| 17 | pol_AC_pak | policy_terminations.old_* | **czeka na TIMELINE migration** |
| 18 | wsp_cesja | coOwners[] per typ polisy | ⚠️ "pesel kl 11cyfr" = client.pesel, NIE coOwner |
| 19 | rezyg_strata | policy_notes[] | split po `_` z datami + tag detection |
| 20 | poprawki | documentsStatus | |
| 21 | TER | portalStatus | TAK/NIE/? |
| 22 | wzn | payment_status | PAID/UNPAID/PARTIAL |

### Stage mapping (XLSX → DB enum)

| XLSX | DB |
|---|---|
| sprzedaż / sprzedany | `sprzedaz` |
| ucięty kontakt | `uciety_kontakt` |
| przeł kontakt | `przel_kontakt` |
| czekam na dane/dokum | `czekam_na_dane` |
| of_do zrobienia | `of_do_zrobienia` |
| of_przedst / oferta wyslana | `oferta_wyslana` |
| rez po ofercie_kont za rok | `rez_po_ofercie` |

## 5. Sygnały „import po dziadowsku" do wyłapania w audycie

1. **`type='OC'` z `auto_details={}`** — fallback POJAZD/OC dla col[8]='?'
2. **`type='FIRMA'` z `auto_details≠null`** — niespójność model (FIRMA powinien używać firma_details)
3. **`type='PODROZ'` z `policy_end_date - policy_start_date > 60 dni`** — bug roczny end_date
4. **`firma_details.coOwners[*].phone =~ /^\d{9}$/` i `name =~ /^kl\d+/`** — pesel-kl bug (phone=peseldigits)
5. **`last_name='(brak nazwiska)'`** — placeholder zamiast null
6. **`policy_notes.content` zawiera datę typu `\d{1,2}\.\d{1,2}\.\d{4}` w środku** — splitter zgubił datę
7. **`policy_sub_agent_shares` puste ALE `policies.commission > 0`** — bug linking shares
8. **`insurer_id=null` ALE `policies.stage='sprzedaz'` AND `policy_number≠null`** — sold policy bez TU = bug
9. **`auto_details.reg=null` AND `type∈{OC,AC,BOTH}`** — pojazd bez rejestracji (czasami OK gdy XLSX nie miał)
10. **`businesses[].nip=null` AND `businesses≠[]`** — firma bez NIP (do uzupełnienia z GUS API)

## 6. Pliki referencyjne (gdzie szukać czego)

| Co | Plik |
|---|---|
| Pełna mapa XLSX 23 kolumn | [`XLSX_FULL_PARSE_PLAN.md`](./XLSX_FULL_PARSE_PLAN.md) |
| Pipeline kategoryzacji DOM→PODROZ→FIRMA→… | [`IMPORT_LOGIC.md`](./IMPORT_LOGIC.md) |
| Edge cases historyczne | [`IMPORT_DEBUG_LOG.md`](./IMPORT_DEBUG_LOG.md) |
| Model prowizji (dwa strumienie) | [`CLAUDE.md § Model prowizji`](./CLAUDE.md) + [`COMMISSIONS_SPEC.md`](./COMMISSIONS_SPEC.md) |
| 4 nowe tabele Timeline | [`TIMELINE_ARCHITECTURE.md`](./TIMELINE_ARCHITECTURE.md) |
| Raport pierwszego audytu 10 wierszy | [`AUDIT_ROWS_1_10_2026-05-11.md`](./AUDIT_ROWS_1_10_2026-05-11.md) |
| Plan napraw w 4 fazach | [`AUDIT_PLAN.md`](./AUDIT_PLAN.md) |

---

**Utworzony:** 2026-05-11 (Opus 4.7 — żeby następna sesja CC nie marnowała godziny na konfigurację, którą już raz rozgryzł)
