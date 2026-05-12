# 🔍 AUDYT WIERSZY 81-90 — OPUS GROUND TRUTH

> **Cel:** ground-truth audyt Opus 4.7 dla porównania z `AUDIT_ROWS_81_90_2026-05-11.md` (Haiku FAST). Pokaże czy Haiku można ufać.

## 🚨 Bugi (severity)

### HIGH

1. **row_82 Kluszczyńska — PESEL-KL bug** (firma_details.coOwners=[{name:"kl64", type:PERSON, phone:"920227921"}])
   - "92022792164" = PESEL klientki (col[18] "pesel kl 92022792164" w XLSX)
   - parser zrobił coOwner z `kl{ostatnie 2 cyfry}` jako name + pierwsze 9 cyfr peselu jako phone
   - **Fix:** DELETE coOwner, ZAPISZ pesel do `client.pesel_encrypted` (po DEK)
   - Notatka diagnostyczna "92022792164 - prawdopodobnie PESEL klienta" już dodana 2026-05-11 ✅
   - **Haiku znalazł ✅**

2. **row_85 Waczyński (NZOZ) — podwójny parsing home_details + firma_details**
   - `original_product_string="majątek_NZOZ"`
   - `home_details = {type:MAJATEK, extras:[NZOZ], address:"87-840 Lubień Kujawski Kłóbka 10"}`
   - `firma_details = {subType:MIENIE, description:"majatek NZOZ Kłóbka 10 - podmiot leczniczy"}`
   - **Konflikt:** type=FIRMA ale wypełnione OBA jsonby. Spec mówi że dla type=FIRMA → `auto_details=null` (zrobione), ale **nie wspomina o home_details** — to dalej wypełnione i dubluje firma_details.
   - **IMPORT_LOGIC.md krok 1** mówi że "majątek" → DOM, ale **logicznie** to FIRMA (NZOZ podmiot leczniczy = mienie firmowe). Decyzja parsera kontekstowo OK ale **zostawił home_details niepotrzebnie**
   - **Fix:** `home_details = null` dla type=FIRMA (lub przenieść `extras:[NZOZ]` i `address` do `firma_details`)
   - **Haiku znalazł połowicznie** — interpretował jako "type mismatch DOM→FIRMA", ale faktyczny bug to PODWÓJNE wypełnienie

3. **row_90 Sowa — błędne parsowanie col[18] coOwner**
   - `home_details.coOwners[0].name = "nie dopisany do polisy bo mają wpólność majątkową i tak _Jerzy Sowa"`
   - To NIE jest name! XLSX col[18] miał coś typu: `nie dopisany do polisy bo mają wspólność majątkową i tak_Jerzy Sowa 69060511750`
   - Parser nie zsplitował po `_` w col[18], wziął cały tekst PRZED `_` jako name + zostawił `_Jerzy Sowa` w name
   - PESEL `69060511750` ZAŁAPANY do osobnego pola `pesel` ✅
   - **Fix:** `name="Jerzy Sowa"`, `notes="nie dopisany do polisy bo mają wspólność majątkową"`
   - **Haiku PRZEGAPIŁ ❌**

### MEDIUM

4. **row_85 Waczyński — adres parsowany niepoprawnie**
   - `client.city="Lubień", client.street="Kujawski Kłóbka 10"`
   - Powinno być: `city="Lubień Kujawski"` (miasto dwuczłonowe), `street="Kłóbka 10"` lub `street="ul. Kłóbka 10"`
   - Parser podzielił "Lubień Kujawski" jako city="Lubień" + reszta do street
   - **Haiku PRZEGAPIŁ ❌**

5. **row_87 Stark VW Caravelle — vehicle_type=DOSTAWCZY** zamiast OSOBOWY
   - `original_product_string="samochód_GKA88830_ Volkswagen Caravelle 6.1 2.0 TDI Trendline DSG, z dowodu rej. Kombi..."`
   - VW Caravelle to **osobowy van pasażerski** (Kombi w dowodzie), NIE dostawczy. Crafter (row_88) jest dostawczy.
   - Parser przyporządkował na podstawie marki Volkswagen → DOSTAWCZY (analogia do Crafter), ale Caravelle jest osobowy
   - **Fix:** `vehicle_type="OSOBOWY"`, dodać `body_type="KOMBI"` w auto_details
   - **Haiku PRZEGAPIŁ ❌**

6. **row_83 Waczyński Mazda — model zawiera rocznik**
   - `vehicle_model="CX-5 15-17"` — "15-17" to rocznik (2015-2017), nie część modelu
   - Parser AI napisał `ai_note: "Rocznik z modelu '15-17' = 2015-2017"` — zauważył, ale nie wyciągnął do `year_range` lub `year=2015`
   - **Fix:** `model="CX-5"`, `auto_details.year_range_from=2015`, `year_range_to=2017` (lub `year=2015` min)
   - **Haiku PRZEGAPIŁ ❌**

7. **row_88 Stark VW Crafter — status w original_product_string**
   - `original_product_string="...1968 ccm, **wypowiedzenie do PZU zarejestrowane**"`
   - "wypowiedzenie do PZU zarejestrowane" nie należy do nazwy produktu, to status notatkowy z col[8]
   - Parser zostawił wszystko w raw bez wyciągnięcia do `policy_terminations.status='REGISTERED'` + `old_insurer_name='PZU'`
   - **Fix:** po wyparsowaniu auto_details, ostatnia fraza zawierająca słowa-klucze (wypowiedzenie/zarejestrowane) → osobna notatka lub policy_terminations entry
   - **Haiku PRZEGAPIŁ ❌**

### LOW

8. **row_81 Zieja — notatka 2025-11-21 ze sklejonym tekstem**
   - "rozmawiałam z klientką... **10.10.2025 polisa podpisana zdalnie**, zdjęcia pojazdu załącz"
   - Splitter notatek zgubił datę `10.10.2025` (inline, bez separatora `_` na początku)
   - **Haiku znalazł podobny pattern dla row_86/87** (✅) ale nie dla row_81

9. **row_81 Zieja — notatka "[STARA POLISA] TUW nie na to auto_błąd agenta" 2025-10-08**
   - Notatka mówi o **innej polisie** (auto), pod kontekstem klientki Zieja, ale `linked_policy_ids` wskazuje na polisę DOM
   - Cross-linking notatki: kontekst auta przy klientce która ma DOM
   - Możliwe że klientka ma też polisę OC której nie ma w batch (row >90), notatka dotyczy tamtej
   - **Haiku PRZEGAPIŁ ❌**

10. **Systemowy bug sub_agent linking** — row_81 jedynie z `shares=[]`, reszta ma shares ale gdy commission=null shares brakuje (pattern z poprzednich audytów)

## 📋 Wiersz po wierszu

### row_81 — Ewa Zieja (DOM, przel_kontakt)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original_product_string | "dom_Południowa 33" | ✅ DOM |
| home_details | address="96-515 Granice Południowa 33" | ✅ |
| client | Ewa Zieja, tel/email/adres OK | ✅ |
| start/end | 2026-08-10/2027-08-10 (przyszła polisa, OK dla DOM) | ✅ |
| notatki | 4 noty: 1 STATUS, 3 ROZMOWA | ⚠️ #1 odnosi się do auta, #3 ma datę inline 10.10.2025 |
| shares | [] | ❌ systemowy |

### row_82 — Julia Kluszczyńska (FIRMA, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original_product_string | "OC_przedsiębiorcy" | ✅ FIRMA (OC bifurcation) |
| firma_details.coOwners | **[{name:"kl64", phone:"920227921"}]** | ❌❌ **PESEL-KL BUG** |
| premium/commission | 1379 / 55.16 (4%) | ✅ |
| shares | 4% Firmowy (ogólny) | ✅ |
| insurer | Generali | ✅ |
| notatki | 3: ROZMOWA + 2× STATUS (1 z 2026-05-11 dodana ręcznie) | ✅ |

### row_83 — Bartosz Waczyński (BOTH, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "samochód_GD758YK_Mazda CX-5 15-17" | ✅ |
| vehicle | Mazda / CX-5 15-17 / GD758YK | ⚠️ "15-17"=rocznik w name |
| premium/commission | 2797 / 55.94 (2%) | ✅ |
| shares | 2% Własny | ✅ |
| insurer | MTU | ✅ |
| notatki | 2× STATUS [STARA POLISA] (TUZ + Hestia AC/OC) | ⚠️ "wypowiedzenie do Hestii zarejestrowane" do TIMELINE |

### row_84 — Mariola Salamonik (OC PRZYCZEPA, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "Przyczepa_GD075YX" | ✅ OC |
| auto_details.vehicle_type | PRZYCZEPA | ✅ |
| vehicle_reg | GD075YX | ✅ |
| brand/model | null/null (XLSX brak) | ⚠️ ai_note potwierdza BRAK W XLSX |
| premium/commission | 144 / 5.76 (4%) | ✅ |
| shares | 4% Własny | ✅ |
| insurer | Generali | ✅ |
| notatki | 11 notatek (DUŻO) — kontekst klientki, mix polis (DOM/ZYCIE/OC) | ⚠️ niektóre notatki cross-linked do innych polis tej klientki |

### row_85 — Jarosław Waczyński (FIRMA majątek NZOZ, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "majątek_NZOZ" | ⚠️ keyword "majątek" w IMPORT_LOGIC § krok 1 → DOM, ale logicznie FIRMA |
| type | FIRMA | ✅ (decyzja kontekstowa OK) |
| home_details | {type:MAJATEK, extras:[NZOZ], address:"87-840 Lubień Kujawski Kłóbka 10"} | ❌ **NIE POWINNO BYĆ wypełnione dla type=FIRMA** |
| firma_details | {subType:MIENIE, description:"majatek NZOZ..."} | ✅ |
| client adres | city="Lubień", street="Kujawski Kłóbka 10" | ❌ "Lubień Kujawski" to miasto dwuczłonowe |
| premium/commission | 912 / 72.96 (8% — wyższa stawka MIENIE) | ✅ |
| shares | 8% Własny | ✅ |
| insurer | Warta | ✅ |

### row_86 — Robert Stark — Piaggio Vespa motocykl (OC, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "motocykl_GKAE29L_ Piaggio/ Vespa" | ✅ |
| vehicle | Piaggio / Vespa / GKAE29L, MOTOCYKL, benzyna | ✅ |
| premium/commission | 94 / 3.76 (4%) | ✅ |
| shares | 4% Własny | ✅ |
| insurer | Warta | ✅ |
| notatki | DUŻO — wspólne z innymi polisami Starka (cross-linked) | ✅ |

### row_87 — Robert Stark — VW Caravelle (BOTH, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "samochód_GKA88830_ Volkswagen Caravelle 6.1 2.0 TDI Trendline DSG, z dowodu rej. Kombi..." | ✅ raw zachowany |
| vehicle | Volkswagen / Caravelle 6.1 2.0 TDI Trendline DSG / GKA88830 | ✅ brand+model+reg |
| vehicle_type | **DOSTAWCZY** | ❌ powinno być OSOBOWY (Caravelle to van pasażerski/kombi) |
| auto_details | fuel=diesel, engine_cc=2000, ac.kind=kosztorys, extras=["napęd 4x4"] | ✅ |
| premium/commission | 4531 / 181.24 (4%) | ✅ |
| shares | 4% Własny | ✅ |
| insurer | Warta | ✅ |

### row_88 — Robert Stark — VW Crafter (BOTH, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "samochód_GKA84750_OC/AC kosztorys/ASS/Szyby_Volkswagen Crafter_ciężarowy_olej napędowy_2012_1968 ccm, **wypowiedzenie do PZU zarejestrowane**" | ⚠️ ostatnia fraza to status, nie nazwa produktu |
| vehicle | Volkswagen / Crafter / GKA84750, CIEZAROWY | ✅ |
| auto_details | ac.ass=Standard, kind=kosztorys, szyby=true, fuel=diesel, year=2012, cc=1968 | ✅ |
| premium/commission | 2362 / 94.48 (4%) | ✅ |
| shares | 4% Własny | ✅ |
| insurer | HDI | ✅ |

### row_89 — Robert Stark — CFMOTO QUAD (AC, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "samochód_GD86S1_CFMOTO CForce 1000 Overland_2025_poj silnika 962 ccm" | ✅ |
| vehicle | CFMOTO / CForce 1000 Overland / GD86S1, QUAD, 2025, 962cc, benzyna | ✅ |
| ai_note | "Tablica 'GD86S1' nietypowa (5 znakow) - moze GD86S1X" | ✅ flag |
| auto_details.coOwners | [{name:"Santander Leasing... 80-280 Gdańsk ul. Cypriana Norwida 4", type:LEASING, regon:"01216226500658"}] | ✅ **POPRAWNIE!** parser dla leasingu zadziałał dobrze |
| ownershipType | LEASING | ✅ |
| type | AC (świadoma decyzja — samo AC bo OC ma osobno) | ✅ |
| premium/commission | 1743 / 69.72 (4%) | ✅ |
| shares | 4% Własny | ✅ |
| insurer | PZU | ✅ |

### row_90 — Katarzyna Sowa (DOM, sprzedaz)

| Aspekt | Stan | Werdykt |
|---|---|---|
| original | "dom_Jeziorna 12, 84-206 Zbychowo" | ✅ |
| home_details | address="Zbychowo ul. Jeziorna 12 (84-206)", extras=["drewniany"] | ✅ |
| home_details.coOwners[0] | **name="nie dopisany do polisy bo mają wpólność majątkową i tak _Jerzy Sowa"**, pesel="69060511750" | ❌ **PARSER NIE ZSPLITOWAŁ col[18] po `_`** |
| client adres | Gdynia ul. Okrzeyi 3/18 (≠ adres domu Zbychowo) | ✅ OK, klient mieszka gdzie indziej niż ubezp. dom |
| premium/commission | 686 / 41.16 (6%) | ✅ |
| shares | 6% Firmowy (ogólny) | ✅ |
| insurer | TUZ | ✅ |
| notatki | 7 — ostatnia "Pytanie czy Jerzy Sowa jest wspolwlascicielem - DO POTWIERDZENIA" 2026-05-11 (dodana ręcznie/AI) | ✅ |

## 🆚 Porównanie z Haiku

**Haiku znalazł:**
- ✅ row_82 PESEL-KL bug (HIGH)
- ✅ row_85 type FIRMA vs majątek (oznaczone jako "type mismatch", ale faktyczny bug to PODWÓJNE details)
- ✅ row_86/87 splitter notatek (HIGH dla "klient miał polisę OC w PZU która przedłużyła się 20.07.2025") — ja tego nie wyłapałem bo nie skupiłem się na notatkach Stark
- ⚠️ row_4 Salamonik przyczepa bez marki (LOW, OK info)

**Haiku PRZEGAPIŁ (5 bugów):**
- ❌ row_90 błędne parsowanie coOwner "Jerzy Sowa" (HIGH)
- ❌ row_85 błędny adres "Lubień" vs "Lubień Kujawski" (MEDIUM)
- ❌ row_87 vehicle_type DOSTAWCZY zamiast OSOBOWY (MEDIUM)
- ❌ row_83 model "CX-5 15-17" zawiera rocznik (MEDIUM)
- ❌ row_88 status "wypowiedzenie do PZU zarejestrowane" w original_product_string (MEDIUM)
- ❌ row_85 podwójny home_details + firma_details parsing (HIGH — Haiku znalazł symptom, nie root cause)

**Verdict Haiku:**
- **Recall ≈ 30-40%** (2-3 z 8 prawdziwych bugów HIGH/MEDIUM)
- **Precision ≈ wysoka** — co Haiku zgłaszał było faktycznie bugiem (false positives ≈ 0)
- **Wniosek:** Haiku można używać do **wstępnego skanu** ale jego output to dolna granica — **musi być uzupełniony Sonnetem lub Opusem** dla prawdziwego pokrycia. NIE używać samego Haiku dla audytu produkcyjnego.

## ✅ Co zaaplikować w skrypcie

```python
# 1. row_82 PESEL-KL cleanup (analog do row_5 Tron)
fix_row(82, action='delete_coowner_pesel_kl', pesel='92022792164')

# 2. row_85 home_details cleanup dla FIRMA
fix_row(85, action='clear_home_details_for_firma')

# 3. row_85 adres
fix_row(85, action='set_address', city='Lubień Kujawski', street='Kłóbka 10')

# 4. row_87 Caravelle vehicle_type
fix_row(87, action='set_vehicle_type', value='OSOBOWY', body_type='KOMBI')

# 5. row_83 Mazda year extraction
fix_row(83, action='set_model_and_year', model='CX-5', year_from=2015, year_to=2017)

# 6. row_88 wypowiedzenie cleanup
fix_row(88, action='strip_status_from_original', remove='wypowiedzenie do PZU zarejestrowane')

# 7. row_90 Sowa coOwner cleanup
fix_row(90, action='set_coowner', name='Jerzy Sowa', pesel='69060511750',
        notes='nie dopisany do polisy bo mają wspólność majątkową')
```

---

**Utworzony:** 2026-05-11 23:55 (Opus 4.7 — ground truth dla porównania z Haiku FAST)
