
# Specyfikacja: Moduł Polis i Produktów (Policies Module)

**Powiązane pliki:**
- `components/PolicyFormModal.tsx`
- `components/Dashboard.tsx`
- `components/QuickViewDrawer.tsx`
- `components/InsurerSelect.tsx`
- `services/insurerRanking.ts`

## 1. Definicja Polisy
Polisa jest głównym aktywem (asset) w systemie. Może być na etapie "Oferty" (Lead) lub "Sprzedaży" (Active Policy).

## 2. Model Danych (Policy Object)
Każda polisa posiada:
- **Typ**: `OC`, `AC`, `DOM`, `ZYCIE`, `PODROZ`, `FIRMA`.
- **Etap (`stage`)**: 
  - `of_do zrobienia`, `pierwszy kontakt`, `przeł kontakt`, `oferta_wysłana` (LEADY).
  - `sprzedaż` (ZAAKCEPTOWANA/SPRZEDANA — aktualna, propozycja wznowienia OK).
  - `sprzedany` (SPRZEDANA, ale klient **sprzedał auto** — przychód/prowizja zostają, ale NIE proponujemy wznowienia, zob. § 6 `isRenewable`).
  - `ucięty kontakt` (ODRZUCONA).
  - ⚠️ **Ryzyko produkcyjne (2026-07-27, nienaprawione):** DB CHECK constraint na `policies.stage` NIE zawiera `pierwszy_kontakt`/`sprzedany` (tylko 7/9 wartości) — zapis polisy z jednym z tych dwóch etapów rzuca błąd Supabase. Szczegóły + status: `CLAUDE.md` ANTI-PATTERNS (sekcja 🔴 KRYTYCZNE).
- **Finanse**: `premium` (składka), `commission` (prowizja), `commissionRate` (stopa %), `paymentStatus` (status płatności).
- **Daty**: `policyStartDate` (Start), `policyEndDate` (Koniec - kluczowe dla wznowień).
- **Asset Intelligence**: Polisa przechowuje dane o przedmiocie (Marka, Rejestracja, Adres), które są indeksowane do szybkiego wyszukiwania.

## 3. Wymagania Funkcjonalne (PolicyFormModal)

### A. Layout "Power User" (Split View)
- **Lewa Kolumna (Dane Operacyjne):** Formularz wprowadzania danych o przedmiocie (Auto/Dom), daty, wybór towarzystwa. To jest "przestrzeń robocza".
- **Prawa Kolumna (Panel Administracyjny):**
    - **Finanse:** Kalkulator prowizji i podziału z pośrednikami (`CommissionCalculator`).
    - **Compliance:** Checklisty dokumentów (`ComplianceChecklist`).
    - **Panel Zwijany:** Użytkownik może zwinąć prawy panel, aby uzyskać więcej miejsca na formularz (np. na mniejszych ekranach laptopów).

### B. Algorytm Doboru Towarzystwa (Smart Ranking)
- System analizuje historię polis agenta (`existingPolicies`).
- Jeśli agent wybierze typ "OC", system sprawdza, które towarzystwa są najczęściej wybierane dla tego typu.
- **Kolejność wyświetlania:**
    1. Towarzystwa używane dla danego typu (sortowane malejąco wg liczby wystąpień).
    2. Pozostałe towarzystwa (sortowane alfabetycznie).

### C. Kalkulator Prowizyjny (Bi-directional Math)
Pola Składka (`premium`), Prowizja kwotowa (`commission`) i Stopa procentowa (`commissionRate`) są powiązane:
- Wpisanie **Stopy %**: Przelicza Prowizję kwotową (dokładność 1 miejsce po przecinku, np. 3.5%).
- Wpisanie **Prowizji PLN**: Przelicza Stopę % (automatycznie).
- Wpisanie **Składki**: Aktualizuje Prowizję kwotową na podstawie ustalonej stopy %.

### D. Asset Intelligence (AI)
- Formularz musi analizować historię klienta przy otwarciu.
- Jeśli klient ma już historię polis, system wyświetla kafelki "Szybki Wybór" (np. "Toyota Yaris GD12345"), które jednym kliknięciem wypełniają pola przedmiotu ubezpieczenia.

### E. Nawigacja Kontekstowa
- **Stopka:** W stopce modalu musi znajdować się wyraźny przycisk/link z nazwiskiem klienta.
- **Akcja:** Kliknięcie przenosi do pełnego profilu klienta (`ClientDetails`), zamykając modal lub pozostawiając go w tle (zależnie od trybu).

### F. Walidacja i UI States
- **Blokada Zapisu**: Przycisk "Zapisz Polisę" musi być **nieaktywny (disabled)**, dopóki nie zostanie wybrany Klient (`selectedClient !== null`).
- **Sprzedaż**: Wymagany numer polisy i składka > 0 (walidacja przy `onSubmit`).
- **Oferta**: Numer polisy opcjonalny (można wpisać nr kalkulacji).

## 4. Dashboard & Table Visualization (Aktualizacja v6.5)

### A. Kolumna "Klient" (Contact Focus)
- **Cel:** Szybka weryfikacja tożsamości i kontaktu bez wchodzenia w szczegóły.
- **Zawartość:** Awatar, Imię Nazwisko.
- **Zmiana:** Zamiast nazwy Towarzystwa (przeniesiona), wyświetlane są dane kontaktowe: Telefon (z ikoną słuchawki) lub E-mail (z ikoną koperty) w kolorze szarym (subtelnym).

### B. Kolumna "Przedmiot" (Context Merge)
- **Cel:** Kompletna informacja o produkcie w jednym miejscu.
- **Zawartość:** 
    1. Nazwa Przedmiotu (np. "Toyota Yaris").
    2. Numer rejestracyjny / polisy.
    3. **Towarzystwo:** Wyświetlane jako mały "badge" (skrót do 7 znaków) pod nazwą przedmiotu.
    4. **Składka:** Wyświetlana obok Towarzystwa.

### C. Kolumna "Notatki" (Expanded Context)
- **Szerokość:** Zwiększona, aby pomieścić więcej treści.
- **Formatowanie:** Tekst wielowierszowy (multiline), zawijanie wierszy (word-wrap).
- **Widoczność:** Minimum 200 znaków widocznych od razu. Brak agresywnego ucinania ("...").
- **Hover:** Najechanie myszką pokazuje "dymek" z pełną historią ostatnich notatek.

### D. Sortowanie (Interactive Headers)
- Nagłówki tabeli są klikalne.
- Obsługiwane klucze sortowania: Klient, Składka/Przedmiot, Status, Data Końca.
- Domyślny sort: Po dacie końca (rosnąco) - najpierw wygasające.

## 5. Zasady Logiki Biznesowej (Wyjątki)

### A. Polisy Turystyczne (`PODROZ`)
- **Brak Wznowień:** Polisy te są z definicji jednorazowe. System **MUSI** wykluczać typ `PODROZ` z wszelkich widoków "Wznowienia" (Renewals) oraz liczników na Sidebarze.
- **Brak Chłodni:** Nie istnieje status "Chłodnia / Ponów za rok" dla wyjazdów turystycznych. Po zakończeniu okresu ochrony polisa staje się historyczna i nie wymaga dalszych akcji.

## 6. Paleta Kolorów Statusów (`stage`) — domyślna, ujednolicona 2026-07-25 (edytowalna od § 8)

Domyślne (fallback) źródło prawdy dla kolorów/nazw: `STATUS_CONFIG` w `constants.ts`. Kolorystyka domyślna 1:1 z oryginalnego dropdownu statusów Aliny w Excelu (kolumna 2 "etap" → `stage`, zob. `XLSX_MAPPING.md`). **Od § 8 (Edytor Statusów) Alina może nadpisać label/kolor KAŻDEGO wiersza tej tabeli w Ustawieniach** — poniższa tabela to nadal DOMYŚLNY punkt startowy (i to, co widać zanim cokolwiek nadpisze), nie sztywny stan końcowy.

| `stage` (kod) | Etykieta UI | Kolor | Uwaga |
|---|---|---|---|
| `czekam na dane/dokum` | Czekam na Dane | **Cyan** | |
| `przeł kontakt` | Kalkulacja / W toku | **Blue** | |
| `of_przedst` / `oferta_wysłana` | Oferta Wysłana | **Lime** | dwa klucze, ten sam realny etap |
| `sprzedaż` | Sprzedane | **Green** | sukces — polisa sprzedana |
| `rez po ofercie_kont za rok` | Chłodnia (Za rok) | **Slate** (jasny szary) | |
| `of_do zrobienia` | Do Zrobienia | **Yellow** | |
| `pierwszy kontakt` | Pierwszy Kontakt | **Rose** (różowy/łososiowy) | ⭐ Dodane 2026-07-25 (wcześniej brakowało w enumie). Lead świeży, jeszcze niedzwoniony. Rozpoznawane przy imporcie XLSX jako `"pierwszy kontakt"` lub `"pierwszy_kontakt"` (`dataMapper.ts`). W `PolicyFormModal.tsx` w dropdownie "Etap Sprzedaży" zaraz po "Do zrobienia". |
| `ucięty kontakt` | Odrzucone / Ucięte | **Amber** (brąz/ochra) | |
| `sprzedany` | Sprzedany (Auto) | **Violet**, biały tekst | ⚠️ INNY status niż `sprzedaż` — klient sprzedał auto, polisa nieaktualna. Logika `isSold` (ClientDetails/Dashboard/ClientsList) nadal grupuje `sprzedaż`+`sprzedany`+`sprzedaz` razem do liczenia "sprzedanych polis"/przychodu (ZASADY_CRM §3, **bez zmian** — przychód historyczny zostaje). Ale **nie proponujemy wznowienia** dla `sprzedany` — zob. § 7 `isRenewable`. |
| `zbycie_pojazdu` | Zbycie | **Orange** | fallback, spoza oryginalnej listy Aliny |
| `inne` | Inne | **Zinc** (szary neutralny) | fallback / catch-all przy imporcie nierozpoznanych wartości |

Zastosowanie: `ClientDetails.tsx`, `Dashboard.tsx`, `PolicyFormModal.tsx`, `QuickViewDrawer.tsx`, `OffersBoard.tsx` (kolumny Kanban + strefy drop "Odrzuć"/"Sprzedaj") czerpią kolor wyłącznie z `STATUS_CONFIG`. Osobny, zsynchronizowany hardcoded zestaw: `NoteSelectors.tsx` → `SALES_STAGES` (selektor "Etap Sprzedaży" w toolbarze notatek — pełne solidne tło zamiast pastelowego, więc kolory dobrane osobno, ale z tej samej rodziny barw).

## 7. `isSold` vs `isRenewable` — sprzedaż zostaje, wznowienie nie zawsze (2026-07-25)

Dwa oddzielne pojęcia w `services/clientInsights.ts` (eksportowane, jedyne źródło prawdy — nie duplikować logiki lokalnie tam, gdzie chodzi o wznowienie):

- **`isSold(policy)`** — `stage` ∈ {`sprzedaż`, `sprzedany`, `sprzedaz`}. Polisa wygenerowała przychód/prowizję. Używane wszędzie tam, gdzie liczy się **finanse** (Dashboard, FinanceView, liczniki `_v`/`_p`/`_l` w `ClientsList.tsx`) — **BEZ ZMIAN**, `sprzedany` nadal się liczy jako sprzedana polisa.
- **`isRenewable(policy)`** = `isSold(policy) && stage !== 'sprzedany'` — polisa sprzedana i **nadal aktualna** (jest co wznawiać). `sprzedany` oznacza: agent dzwonił w sprawie wznowienia i dowiedział się, że klient **sprzedał auto** — nie ma sensu dalej proponować wznowienia nieistniejącego już pojazdu, ale historyczny przychód z tamtej sprzedaży pozostaje w finansach.

**Gdzie `isRenewable` jest używane** (wznowienie/kontakt telefoniczny, NIE finanse):
- `services/clientInsights.ts` → `upcomingRenewals()` — sygnał "Wznowienie" dla proaktywnego okienka.
- `components/ClientDetails.tsx` → `PolicyCardItem`: `renewalBadge` ("ZA X DNI"/"PO TERMINIE") i przycisk "Wznowienie" (RefreshCcw) pokazują się tylko dla `isRenewable`. Dla `sprzedany` w miejscu przycisku wznowienia jest neutralny przycisk "Kalkulacja" (ten sam co dla niesprzedanych — Alina może dopisać notatkę) + mały badge "AUTO SPRZEDANE" (fiolet, zamiast licznika dni).
- `components/CalendarView.tsx` → generowanie eventu "WZNOWIENIA" (koniec ochrony) w `events` (`useMemo`) — pomija polisy `sprzedany`.
- `components/ClientsList.tsx` → `_upcoming` (kolumna "Wznowienia" na liście klientów) filtruje przez `isRenewable`, nie przez wszystkie `SOLD_STAGES`.

**NIE dotyczy** (świadomie, zostają na `isSold`): `coverageGaps()`/`missingData()` w `clientInsights.ts`, liczniki `_v`/`_p`/`_l` (typy sprzedanych polis) w `ClientsList.tsx`, wszystkie widoki finansowe/prowizyjne.

**Kafelek sprzedanej polisy — badge statusu zamiast statusu płatności (2026-07-27):** w dolnym rzędzie akcji karty (`ClientDetails.tsx` → `PolicyCardItem`, widoczny tylko gdy `isSold`) obok przycisku "WYŚLIJ DOKI"/"WYSŁANO" był wcześniej status płatności (Opłacona/Nieopłacona, z pola `policy.paymentStatus`). Zamieniony na badge **stanu polisy** (`stage`, kolory z Edytora Statusów przez `getStatusDisplay` — § 8) — czyli na kafelku sprzedanej polisy od razu widać `sprzedaż` (zielony) vs `sprzedany` (fioletowy, "auto sprzedane") bez rozwijania karty. ⚠️ Pole `paymentStatus` samo w sobie NIE zniknęło z modelu danych (dalej ustawiane/zapisywane), ale po tej zmianie **nie ma już żadnego miejsca na tej karcie**, gdzie Alina widzi status płatności na pierwszy rzut oka — zweryfikowane grepem (`paymentStatus`/"Nieopłacona"/"Opłacona" nie występują nigdzie indziej w `ClientDetails.tsx`). Jeśli to nieświadoma regresja (nie duplikacja) — do potwierdzenia z Bartkiem, czy status płatności ma wrócić w innym miejscu karty.

## 8. Edytor Statusów — Alina ustawia własne nazwy/kolory (2026-07-25)

Zamiast sztywnej palety z § 6 dobieranej przez nas, Alina personalizuje **wyświetlaną nazwę i kolory** (tło + tekst) każdego statusu w Ustawieniach → panel `components/Settings/StatusEditor.tsx` (wpięty w `ThemeSettings.tsx` obok "Designer Czcionek"). Podgląd na żywo + przycisk "Reset" per status.

**Twardy niezmiennik (nie do naruszenia):** klucz `stage` (np. `"rez po ofercie_kont za rok"`) — mapowanie do importu XLSX (§ „XLSX_MAPPING.md") i bazy — **NIGDY się nie zmienia**. Edytor nadpisuje WYŁĄCZNIE `label`/kolory, nigdy klucz.

**Model i przepływ:**
- `StatusCustomization = Record<stage, {label?, bg?, fg?}>` (hex) — `types.ts`.
- Zapis: `storage.getStatusOverrides()` / `saveStatusOverrides()` (localStorage, klucz `InsuranceMaster_StatusConfig`) — analogicznie do `UiPreferences`/Designer Czcionek, NIE równoległy mechanizm. Zaimplementowane w **obu** providerach (`services/storage.ts` legacy `StorageManager` + `services/supabaseStorage.ts` `SupabaseStorageManager` — **ten drugi jest faktycznie używany w runtime**, `export const storage = supabaseStorage`). TODO (przyszłość, nie teraz): Supabase `tenant_config` dla trwałości cross-device.
- Odczyt/merge: `services/statusDisplay.ts` → `getStatusDisplay(stage)` — jedyny poprawny sposób odczytu statusu do wyświetlenia (label + kolor). Merguje `STATUS_CONFIG[stage]` (§ 6, fallback) z override. Zwraca zarówno domyślne klasy Tailwind (`color`/`bg`/`border`, dark-mode aware, bez zmian) jak i `style`/`colorStyle`/`bgStyle`/`borderStyle` (inline hex — wygrywa nad klasą Tailwind dla tej samej właściwości CSS, więc jest to bezpieczny dodatek, nie przebudowa istniejącego JSX).
- **Wszystkie miejsca renderujące status w aplikacji przepięte na `getStatusDisplay()`** (zamiast bezpośrednio `STATUS_CONFIG[stage]`): `ClientDetails.tsx` (badge karty polisy + badge "AUTO SPRZEDANE" z § 7), `Dashboard.tsx` (filter chips + kolumna Status), `OffersBoard.tsx` (dropdown zmiany etapu, tekst notatki systemowej `[SYSTEM] Zmiana etapu`, nagłówki kolumn Kanban), `PolicyFormModal.tsx` (badge w `ReadOnlyView` + notatka systemowa zmiany etapu + **combo "Etap Sprzedaży" w formularzu edycji, 2026-07-27** — do tej daty był bezbarwnym natywnym selectem, jedynym miejscem renderującym `stage` bez `getStatusDisplay()`; teraz `<select>` pokazuje na żywo kolor aktualnie wybranego etapu, każdy `<option>` ma własny kolor tła/tekstu z palety § 6/override Aliny z § 8 — szczegóły DESIGN_SYSTEM.md § 7), `QuickViewDrawer.tsx` (lista "Procesowane Oferty"), `AdvancedFilters.tsx` (chipy filtra — wcześniej pokazywały surowy klucz `stage` jako etykietę), `NoteSelectors.tsx` → `SALES_STAGES` (tylko label — kolory tam zostają solid/hardcoded, inny styl niż pastelowe badge, celowo nieobjęte edytorem). `ClientsList.tsx`/`Notatki.tsx` sprawdzone — nie renderują badge'a statusu (tylko liczą etapy), nic do zmiany.
- `Object.keys(STATUS_CONFIG)` nadal jedyne źródło **listy kluczy** `stage` (struktura nie zmienia się edytorem — dochodzi/ubywa statusów tylko przez zmianę `SalesStage` w kodzie, zob. § pierwszy kontakt wyżej) — Edytor Statusów iteruje po tej liście.
