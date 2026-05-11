# 🕰️ TIMELINE ARCHITECTURE — model bi-temporal dla CRM-Alina

> **Status:** PROPOZYCJA do akceptacji (Bartek 2026-05-11)
> **Cel:** klient / asset (pojazd, dom, firma) / polisa / wypowiedzenie — każdy ma OŚ CZASU; stare wartości NIE znikają (stary nr tel w starej notatce dalej widoczny i prawidłowy w swoim kontekście czasowym).

## 1. Sedno problemu

XLSX → DB to dziś **flat snapshot**: jedna polisa = jeden wiersz, ostatni stan klienta nadpisuje poprzedni. Ale:
- Pojazd `GD721YL` (Volvo XC60) ma już teraz **20 polis** Roberta Starka przez lata
- Klient zmienia telefon — stara notatka „dzwoniłam na 601-XXX, nie odbiera" musi dalej pokazywać tamten numer
- Polisa wypowiadana — chain old → new, **status do potwierdzenia przez agenta**
- Za rok wznowienia: cały cykl od nowa, ale ten sam asset (auto/dom)

## 2. Tożsamości (co jest persistent vs co snapshot)

| Encja | Persistent identity | Mutuje? | Historia? |
|---|---|---|---|
| **Client** | `id` (UUID) | atrybuty TAK (phone/email/address) | `client_attribute_history` |
| **Asset** (pojazd/dom/firma…) | `id` + `identifier` (reg/adres/NIP) | status TAK (ACTIVE→SOLD) | `assets.status` + acquired_at/disposed_at |
| **Policy** | `id`, period (start_date, end_date) | po wystawieniu = immutable spec | `policy_versions` (snapshots zmian) |
| **PolicyTermination** | `id` + (old_policy, new_policy) | status TAK (DRAFT→SENT→REGISTERED→CONFIRMED) | inline (sent_at, registered_at, confirmed_at) |
| **PolicyNote** | `id` + `created_at` | immutable | dopisek nowych notatek |

## 3. Nowe tabele (Supabase `test` schema)

### 3.1 `assets` — trwały byt ubezpieczany (pojazd/dom/firma…)

```sql
CREATE TABLE test.assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  client_id    uuid NOT NULL REFERENCES test.insurance_clients(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('VEHICLE','HOME','BUSINESS','TRAVEL','LIFE','OTHER')),
  identifier   text,            -- VEHICLE: vehicle_reg; HOME: adres_normalizowany; BUSINESS: NIP+nazwa
  display_name text NOT NULL,   -- "Volvo XC60 GD721YL"
  details      jsonb DEFAULT '{}'::jsonb,  -- silnik/metraż/destynacja/itp
  status       text NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE','SOLD','DISPOSED','INACTIVE','PLANNED')),
  acquired_at  date,            -- kiedy klient nabył
  disposed_at  date,            -- kiedy sprzedał/zlikwidował
  notes        text,
  source       text DEFAULT 'manual' CHECK (source IN ('manual','xlsx_import','crm','sync')),
  legacy_id    text,            -- xlsx_2025_asset_N
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_client ON test.assets(client_id);
CREATE INDEX idx_assets_identifier ON test.assets(tenant_id, identifier);
CREATE INDEX idx_assets_status ON test.assets(status) WHERE status = 'ACTIVE';
```

**Identifier ujednolicony per typ:**
- VEHICLE → `vehicle_reg` (np. `GD721YL`)
- HOME → adres normalizowany (lowercase, bez polskich znaków): `gdansk-junony-88`
- BUSINESS → NIP (lub `NIP+nazwa` jeśli pusty)
- TRAVEL → null (zwykle jednorazowe)
- LIFE → `kind+osoba_id` (np. `NNW_SCHOOL+dziecko1`)

### 3.2 `policy_terminations` — wypowiedzenia ze statusem

```sql
CREATE TABLE test.policy_terminations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  new_policy_id         uuid REFERENCES test.policies(id) ON DELETE CASCADE,
                        -- nasza nowa polisa (zastępująca)
  old_policy_id         uuid REFERENCES test.policies(id) ON DELETE SET NULL,
                        -- jeśli stara polisa też była u nas
  old_insurer_id        uuid REFERENCES test.insurers(id),
  old_insurer_name      text,
  old_policy_number     text,
  old_policy_end_date   date,
  status                text NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','SENT','REGISTERED','CONFIRMED','EXPIRED','CANCELED','NOT_REQUIRED')),
                        -- DRAFT: agent planuje
                        -- SENT: agent wysłał wypowiedzenie do TU
                        -- REGISTERED: TU potwierdziło rejestrację
                        -- CONFIRMED: agent zweryfikował i klika "OK"
                        -- EXPIRED: minął termin
                        -- NOT_REQUIRED: np. zmiana właściciela pojazdu
  termination_basis     text,   -- 'art28', 'art28a', 'zmiana_wlasciciela', 'nieoplacenie', 'zerwanie_pakietu'
  sent_at               date,
  registered_at         date,
  confirmed_at          timestamptz,
  confirmed_by_user_id  uuid,
  source_note_id        uuid REFERENCES test.policy_notes(id) ON DELETE SET NULL,
  ai_extracted          boolean DEFAULT false,
  ai_note               text,   -- co AI wykryło z notatki, do weryfikacji
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_term_new ON test.policy_terminations(new_policy_id);
CREATE INDEX idx_term_old ON test.policy_terminations(old_policy_id);
CREATE INDEX idx_term_status ON test.policy_terminations(status, confirmed_at);
CREATE INDEX idx_term_pending ON test.policy_terminations(tenant_id, status)
  WHERE status IN ('SENT','REGISTERED') AND confirmed_at IS NULL;
```

### 3.3 `client_attribute_history` — historia zmian atrybutów klienta

```sql
CREATE TABLE test.client_attribute_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  client_id             uuid NOT NULL REFERENCES test.insurance_clients(id) ON DELETE CASCADE,
  attribute             text NOT NULL
                        CHECK (attribute IN ('PHONE','EMAIL','ADDRESS','FIRST_NAME','LAST_NAME',
                                              'BUSINESS','BIRTH_DATE','PESEL','NIP')),
  value_old             jsonb,
  value_new             jsonb,
  valid_from            timestamptz NOT NULL DEFAULT now(),
  valid_to              timestamptz,   -- NULL = obecnie obowiązuje
  source                text DEFAULT 'manual'
                        CHECK (source IN ('manual','xlsx_import','crm_edit','sync','api')),
  changed_by_user_id    uuid,
  reason                text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cah_client_attr ON test.client_attribute_history(client_id, attribute);
CREATE INDEX idx_cah_current ON test.client_attribute_history(client_id, attribute)
  WHERE valid_to IS NULL;
CREATE INDEX idx_cah_at ON test.client_attribute_history(valid_from, valid_to);
```

**Zastosowanie:** w UI `Notatka 14.06.2025 → dzwoniłam na 601-XXX` pokaże nr **który był ważny 14.06.2025** (lookup w `client_attribute_history` z `valid_from ≤ note.created_at AND (valid_to IS NULL OR valid_to > note.created_at)`).

### 3.4 `policy_versions` — snapshots polisy (opcjonalne, faza 2)

```sql
CREATE TABLE test.policy_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  policy_id       uuid NOT NULL REFERENCES test.policies(id) ON DELETE CASCADE,
  version_number  int NOT NULL,
  snapshot_at     timestamptz NOT NULL DEFAULT now(),
  data            jsonb NOT NULL,             -- pełna polisa w danym momencie
  changed_fields  text[],
  reason          text,                       -- np. "aneks_powodz", "korekta_skladki"
  changed_by_user_id uuid,
  UNIQUE(policy_id, version_number)
);
```

## 4. Modyfikacje `policies` (FK do nowych encji)

```sql
ALTER TABLE test.policies
  ADD COLUMN asset_id uuid REFERENCES test.assets(id) ON DELETE SET NULL,
  ADD COLUMN previous_policy_id uuid REFERENCES test.policies(id) ON DELETE SET NULL,
      -- poprzednia polisa NASZA dla tego asseta (chain)
  ADD COLUMN renewal_of_policy_id uuid REFERENCES test.policies(id) ON DELETE SET NULL;
      -- wznowienie tej samej polisy (ten sam TU, kolejny rok)

CREATE INDEX idx_policies_asset ON test.policies(asset_id);
CREATE INDEX idx_policies_prev ON test.policies(previous_policy_id);
CREATE INDEX idx_policies_renew ON test.policies(renewal_of_policy_id);
```

## 5. Mapowanie XLSX → nowy model (backfill 182 polis)

### 5.1 Tworzenie `assets` z istniejących polis

```
Dla każdej polisy w xlsx_import:
  Jeśli type ∈ (OC,AC,BOTH) i vehicle_reg jest:
    identifier = vehicle_reg
    type = VEHICLE
  Jeśli type = DOM i home_details.address jest:
    identifier = normalize(home_details.address)  -- lowercase, ascii, no diacritics
    type = HOME
  Jeśli type = FIRMA i firma_details.description:
    identifier = NIP (jeśli jest) lub firma_details.description normalized
    type = BUSINESS
  Jeśli type = PODROZ:
    NIE tworzy assetu (jednorazowa polisa) — chyba że klient ma więcej podróży

  UPSERT po (client_id, type, identifier):
    NIE duplikuj — ten sam pojazd/dom = jeden asset
  Linkuj policies.asset_id = assets.id
```

### 5.2 Tworzenie `policy_terminations` z notatek

```
Dla każdej polisy z policy_notes zawierającą frazy:
  ['wypowiedzenie zarejestrowane', 'wyp zarejestrowane', 'wypowiedz', 'wysłałam wypowiedzenie',
   'zarejestrowano wypowiedz', 'wypowiedzenie do <TU>']
  oraz st_pol (stara polisa) wymieniony:

  Utwórz policy_terminations:
    new_policy_id   = polisa.id
    old_insurer_name = wyciągnięty z st_pol (regex 'stara <TU>' lub 'w <TU>')
    old_policy_number = wyciągnięty z st_pol (numer polisy)
    status          = REGISTERED (gdy notatka mówi "zarejestrowane")
                      | SENT (gdy "wysłałam")
                      | DRAFT (gdy tylko st_pol bez wzmianki)
    ai_extracted    = true
    ai_note         = "AI parsed: '<fragment notatki>' - sprawdź"
    source_note_id  = id notatki z której wyciagnięto
    confirmed_at    = NULL  → wymaga potwierdzenia agenta
```

### 5.3 Tworzenie `client_attribute_history` (historia zmian)

```
Dla każdego klienta:
  Wpisz INITIAL snapshot z valid_from = client.created_at, valid_to = NULL:
    {attribute: 'PHONE', value_new: phones}
    {attribute: 'EMAIL', value_new: emails}
    {attribute: 'ADDRESS', value_new: {street, city, zip}}
  Każda przyszła zmiana = nowy rekord (poprzedni dostaje valid_to = now()).
```

## 6. UI implications (faza 2, po schemacie)

- **Dashboard Towarzystwa** → CRUD insurers (Bartek 2026-05-11: "ma być możliwość poprawiania danych")
- **Karta Klienta** → zakładka "Atrybuty w czasie" pokazuje historię phone/email/address
- **Karta Klienta** → zakładka "Assets" lista pojazdów/domów z ich timeline polis
- **Karta Asseta** → wszystkie polisy chronologicznie, wznowienia, wypowiedzenia
- **Dashboard wypowiedzeń** → lista `policy_terminations` z `status IN (SENT, REGISTERED) AND confirmed_at IS NULL` — Alina widzi co czeka na jej potwierdzenie
- **Notatki** → przy starym numerze tel pokaże "wówczas: 601-XXX (zmieniony 12.10.2025)"

## 7. Anti-patterns

- ❌ **Trigger UPDATE na insurance_clients** → automatyczny insert do `client_attribute_history`. Nie. Zmiany robi APP (z user_id, reason).
- ❌ **CASCADE DELETE asset → policies**. Asset usunięty = nie znika historia polis. `ON DELETE SET NULL`.
- ❌ **Auto-confirm terminations po N dniach**. Status zostawia agent ręcznie (rygor compliance).
- ❌ **assets.identifier nie-unique per tenant**. UNIQUE(tenant_id, type, identifier) — jedna tablica = jeden asset.

## 8. Plan wdrożenia

1. ✅ **Akceptacja schematu** (Bartek review tego pliku)
2. ⏭ **Migration SQL** — utworzenie 4 tabel + ALTER policies (z gen_random_uuid jeśli pgcrypto włączone)
3. ⏭ **Backfill assets** dla 182 polis xlsx_import (Python skrypt: ~100 assetów VEHICLE/HOME/BUSINESS)
4. ⏭ **Backfill policy_terminations** (AI parse 100 polis z st_pol, ~21 explicit + 79 implicit DRAFT)
5. ⏭ **Backfill client_attribute_history** (99 klientów × 3-4 atrybuty = ~350 rekordów INITIAL)
6. ⏭ **Provider supabaseStorage.ts** — czytanie nowych tabel + mapowanie do legacy types
7. ⏭ **UI** (faza 2) — dashboards, edycja insurers, timeline view

---

**Utworzony:** 2026-05-11 (Bartek prosi pomyśleć przed UI; schema gotowa NA WZNOWIENIA)
**Decyzja modelu:** prosty SCD2 (`valid_from/to + is_current`) na atrybutach klienta + relacje asset_id/previous_policy_id na polisach. NIE pełny bi-temporal (system_time + business_time) — overkill, JSONB snapshots wystarczą.
