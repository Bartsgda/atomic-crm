
# 🎨 Insurance Master Design System (v4.2)

System obsługuje dynamiczną zmianę motywów ("Skinów") w czasie rzeczywistym, opartą na zmiennych CSS i Tailwind.

## 1. Dostępne Presety (Motywy)

### A. EXEC (Executive Blue)
*   **Inspiracja:** Salesforce, LinkedIn, Bankowość.
*   **Vibe:** Profesjonalizm, Zaufanie, Korporacja.
*   **Technikalia:**
    *   Theme: `Light`
    *   Primary Color: `#2563eb` (Blue-600)
    *   Density: `Comfortable`
    *   Font Scale: `1.0`

### B. ONYX (Dark Ops)
*   **Inspiracja:** Linear, Vercel, Terminale hackerskie.
*   **Vibe:** Skupienie, Nocna zmiana, High-Tech.
*   **Technikalia:**
    *   Theme: `Dark`
    *   Primary Color: `#f4f4f5` (Zinc-100) lub `#ef4444` (Red-500) jako akcent.
    *   Density: `Compact`
    *   Font Scale: `0.95`

### C. FOREST (Eco Calm)
*   **Inspiracja:** Evernote, Aplikacje FinTech (Mint).
*   **Vibe:** Spokój, Harmonia, Czytelność.
*   **Technikalia:**
    *   Theme: `Light`
    *   Primary Color: `#059669` (Emerald-600)
    *   Density: `Comfortable`
    *   Font Scale: `1.05`

## 2. Architektura CSS
Zmiana stylu odbywa się poprzez wstrzyknięcie zmiennych CSS do `:root`.

## 3. Żelazne Zasady UI (The Supreme UI Laws)

### A. Prawo Jednego Inputa (The One Input Law)
Wszystkie pola tekstowe, liczbowe i daty MUSZĄ używać ujednoliconego zestawu klas, aby uniknąć problemów z kontrastem (np. czarny tekst na czarnym tle).

**Standardowa Klasa (`STANDARD_INPUT_CLASS`):**
```css
w-full p-2.5 rounded-xl text-sm font-bold outline-none transition-all
bg-white dark:bg-zinc-950               /* Tło: Jasne / Bardzo Ciemne */
border border-zinc-300 dark:border-zinc-700 /* Ramka: Kontrastowa */
text-zinc-900 dark:text-zinc-100        /* Tekst: Czarny / Biały */
focus:ring-2 focus:ring-primary         /* Akcent: Zgodny z motywem */
placeholder:text-zinc-400               /* Placeholder: Szary */
```

### B. Wybór Daty (Date Pickers)
Pola daty muszą posiadać `cursor-pointer` i otwierać natywny kalendarz systemowy po kliknięciu w dowolny obszar pola (`onClick={e => e.currentTarget.showPicker()}`).

## 4. Personalizacja czcionki — "Designer Czcionek" (2026-07-25)

Rozszerzenie istniejącego systemu motywów (Sekcja 1-2), NIE równoległy system. Panel `ThemeSettings.tsx` (sekcja pod "Skalowanie Czcionki") pozwala Alinie ustawić globalnie:

1. **Rodzaj czcionki** (`UiPreferences.fontFamily`) — 5 opcji z `constants.ts` → `FONT_FAMILY_OPTIONS` (od 2026-07-27 dołożona 5., wcześniej było 4):
   - `system` (domyślna) — natywna czcionka systemu (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`)
   - `humanist` — **Inter** (`"Inter Variable"`, już samo-hostowana w projekcie przez `@fontsource-variable/inter`, ZERO CDN)
   - `serif` — **Georgia** (systemowa szeryfowa)
   - `accessible` — **Tahoma** (szerokie znaki, wysoka czytelność — accessibility/dysleksja-friendly)
   - `comic` — **Comic Sans MS** (`"Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive` — zaokrąglona, nieformalna, "lżejsza w odbiorze"; systemowa/fallback stack, zero CDN jak reszta)
   - Wszystkie 5 opcji działa offline — brak zależności od zewnętrznego CDN (zgodnie z zasadą CSP/offline tego modułu; istniejący import Google Fonts w `src/index.css` dla EB Garamond/Manrope jest osobną, wcześniejszą sprawą i nie jest przez Designer Czcionek wykorzystywany).
2. **Pogrubienie** (`UiPreferences.fontBold`) — globalny przełącznik, wymusza `font-weight: 700` na CAŁEJ aplikacji (w tym Sidebar/chrome) przez atrybut `[data-app-font-bold="true"]` w `v1-themes.css`.
3. **Kolor tekstu** (`UiPreferences.fontColor`) — `<input type="color">`, stosowany TYLKO do treści (`<main>`, klasa `.app-content-font`), NIE do Sidebar/chrome. Pusty string = automatyczny (kolor motywu). Bez `!important` — elementy z własną jawną klasą koloru Tailwind (np. status "sprzedaż" = zielony, "wygasa" = czerwony) zachowują swój kolor; nadpisywane jest tylko dziedziczone tło tekstu.
4. **Rozmiar bazowy** — reużywa istniejące `UiPreferences.fontScale` (root `font-size` w px, rem-based skaluje całą appkę) — 3 szybkie przyciski Normalny (1.0) / Duży (1.15) / Bardzo Duży (1.3), spięte z istniejącym suwakiem "SKALA INTERFEJSU" (zakres rozszerzony z 0.85–1.15 na 0.85–1.3).

**Mechanizm (spójny z istniejącym `--primary-color`/`data-v1-skin`):** `App.tsx` → `applyTheme()` ustawia CSS custom properties (`--app-font-family`, `--app-font-weight`, `--app-font-color`) oraz atrybut `data-app-font-bold` na `document.documentElement`, identycznie jak dla `--primary-color`. Zapis do localStorage przez ten sam `storage.saveUiPrefs()`/`PREFS_KEY = "InsuranceMaster_UI_Prefs"` co reszta `UiPreferences` — przetrwa reload, ładowany przy starcie w `refreshData()`.

**Czytelność (PESEL / nr rejestracyjny):** niezależnie od Designera, PESEL (nagłówek `ClientDetails.tsx`, `QuickViewDrawer.tsx`) i numer rejestracyjny pojazdu (badge na karcie polisy w `ClientDetails.tsx`, chipy w `Notatki.tsx`) są renderowane z wyraźnie większą czcionką (`text-sm`/`text-xs` `font-black tabular-nums` zamiast `text-[9-10px]`) — to są najważniejsze dane operacyjne dla Aliny.

## 6. Paleta Kolorów Statusów Polisy (`stage`) — 2026-07-25

Ujednolicona wg oryginalnej palety Aliny z dropdownu statusów w Excelu (nie dobierana dowolnie). Jedyne źródło prawdy: `STATUS_CONFIG` w `constants.ts` (pełna tabela mapowania → `POLICIES_SPEC.md § 6`).

Skrót: `czekam na dane` = cyan · `przeł kontakt` = blue · `oferta` (`of_przedst`/`oferta_wysłana`) = lime · `sprzedaż` = green · `rez po ofercie` (chłodnia) = slate (jasny szary) · `of_do zrobienia` = yellow · `ucięty kontakt` = amber (brąz) · `sprzedany` = violet z **białym tekstem** (jedyny status z ciemnym solid tłem zamiast pastelowego — INNY status niż `sprzedaż`, nie mylić).

Zasada kontrastu (Prawo Czytelności Statusów): jasne tła (yellow/lime/cyan/slate) → ciemny tekst danego koloru (np. `text-yellow-800`); ciemne/nasycone tła (tylko `sprzedany` na `bg-violet-700`) → `text-white`. Tryb ciemny: każdy wpis ma warianty `dark:bg-*-900/20` / `dark:text-*-300` / `dark:border-*-800`, poza `sprzedany` który zostaje solidny (`dark:bg-violet-600`) żeby biały tekst zawsze miał kontrast.

Drugi, zsynchronizowany zestaw kolorów (solid pill, nie pastelowy): `NoteSelectors.tsx` → `SALES_STAGES` (selektor "Etap Sprzedaży" w pasku narzędzi notatek).

## 7. Edytor Statusów — Alina personalizuje nazwy/kolory (2026-07-25)

Zmiana podejścia: zamiast jednej sztywnej palety (§ 6) dobieranej przez nas, Alina ma w Ustawieniach (`ThemeSettings.tsx`, sekcja pod "Designer Czcionek" — od 2026-07-25 wewnątrz `SettingsModal.tsx`, zob. § 8) panel **`components/Settings/StatusEditor.tsx`** — dla KAŻDEGO statusu ustawia własną wyświetlaną nazwę i dwa kolory (tło + tekst, `<input type="color">`), z podglądem na żywo i przyciskiem "Reset" (powrót do domyślnego).

**Twardy niezmiennik:** klucz `stage` (np. `"rez po ofercie_kont za rok"`) **NIGDY** się nie zmienia — to mapowanie do importu XLSX/bazy. Edytor operuje WYŁĄCZNIE na warstwie nadpisania label/kolor, nigdy na kluczu.

**Architektura (analogiczna do `UiPreferences`/Designer Czcionek — nie równoległy mechanizm):**
- Model: `StatusCustomization = Record<string, {label?, bg?, fg?}>` (`types.ts`), hex kolory.
- Storage: `storage.getStatusOverrides()` / `saveStatusOverrides()` — **oba providery** (`services/storage.ts` `StorageManager` — legacy/local, ORAZ `services/supabaseStorage.ts` `SupabaseStorageManager` — **ten faktycznie używany w runtime** przez `export const storage = supabaseStorage`). Klucz localStorage: `InsuranceMaster_StatusConfig`. TODO (przyszłość): Supabase `tenant_config` dla trwałości cross-device — na razie localStorage wystarcza (jak `InsuranceMaster_UI_Prefs_v2`).
- Helper: **`services/statusDisplay.ts` → `getStatusDisplay(stage)`** — merguje domyślny `STATUS_CONFIG` (§ 6) z override. Zwraca domyślne klasy Tailwind (`color`/`bg`/`border`, bez zmian w JSX) PLUS `style`/`colorStyle`/`bgStyle`/`borderStyle` (inline hex, puste `{}` gdy brak override). Inline `style` ma pierwszeństwo nad klasą Tailwind dla tej samej właściwości CSS — więc istniejący JSX z `${x.color} ${x.bg} ${x.border}` zostaje NIETKNIĘTY, dokłada się tylko `style={x.style}` (jeden element z 3 klasami naraz) lub `style={x.colorStyle}`/`bgStyle`/`borderStyle` osobno (layouty rozbite na wiele elementów, np. kolumny Kanban w `OffersBoard.tsx`).
- **WSZYSTKIE miejsca renderujące status** czytają przez `getStatusDisplay()`, NIE bezpośrednio `STATUS_CONFIG[stage]`: `ClientDetails.tsx` (badge karty polisy + badge "AUTO SPRZEDANE"), `Dashboard.tsx` (filter chips + kolumna Status w tabeli), `OffersBoard.tsx` (dropdown zmiany etapu, notatka systemowa zmiany etapu, kolumny Kanban), `PolicyFormModal.tsx` (badge w `ReadOnlyView` + notatka systemowa), `QuickViewDrawer.tsx` (lista "Procesowane Oferty"), `AdvancedFilters.tsx` (chipy filtra etapu — wcześniej pokazywały SUROWY klucz stage jako label, teraz custom/domyślny label), `NoteSelectors.tsx` (`SALES_STAGES` — label only, kolory zostają solid/hardcoded, inny styl niż pastelowe badge). `ClientsList.tsx`/`Notatki.tsx` sprawdzone — nie renderują badge'a statusu (tylko liczą etapy do `_offers`/`_upcoming`), więc nic do zmiany.
- `Object.keys(STATUS_CONFIG)` nadal jedyne źródło **listy kluczy** stage (struktura się nie zmienia edytorem) — tylko label/kolor per klucz idzie przez `getStatusDisplay`.

## 8. Panel Ustawień jako modal na pełny ekran (2026-07-25)

Wcześniej `ThemeSettings` (+ `StatusEditor` z § 7, + `AiKeysPanel`) renderowały się **inline wciśnięte w wąski Sidebar**, zdublowane w DWÓCH miejscach kodu (osobno dla skinu `luxury-gold` i pozostałych). Po dojściu Designer Czcionek + Edytora Statusów treści zrobiło się za dużo na sidebar. Zamienione na **jeden fullscreen modal**: nowy plik `components/Settings/SettingsModal.tsx`, renderowany RAZ w `Sidebar.tsx` (poza `<nav>`, na końcu `<aside>`), sterowany tym samym propem `showThemeSettings`/`onToggleTheme` co wcześniej (bez zmian logiki przełącznika — `onToggleTheme` to `setShowThemeSettings(!showThemeSettings)`, więc bezpiecznie użyty też jako `onClose`).

**Konwencja modala** — 1:1 skopiowana z `ClientFormModal.tsx` (NIE nowa estetyka): `fixed inset-0 z-[100]` + backdrop `bg-zinc-950/80 backdrop-blur-md` + karta `max-w-4xl max-h-[90vh] rounded-[1.75rem] shadow-2xl` + header (tytuł "Ustawienia / Wygląd" + podtytuł + przycisk `X`) + `flex-1 overflow-y-auto` na treść + **stopka `shrink-0` z dwoma przyciskami (dodane 2026-07-27, patrz niżej)**.

**Ciemne tło treści (świadoma decyzja, nie przeoczenie):** `ThemeSettings`/`StatusEditor`/`AiKeysPanel` mają kolorystykę na sztywno ciemną (zero klas `dark:` w tamtych plikach — projektowane pod ciemny Sidebar). Żeby nie przerabiać ich stylów, obszar treści modala ma **stałe** ciemne tło (`bg-zinc-950`, nie `dark:bg-zinc-950`) — wygląda identycznie jak wcześniej w sidebarze, niezależnie od jasnego/ciemnego motywu aplikacji. Header modala JEST theme-aware (`bg-zinc-50 dark:bg-zinc-950`), jak reszta chrome modali w module.

`AiKeysPanel` nadal renderowany tylko dla `isAdmin` (bez zmian warunku).

### 8a. Anuluj / Zatwierdź — snapshot i rollback (2026-07-27)

Treść tego modala zapisuje się NA BIEŻĄCO (live), nie na "Zapisz": `ThemeSettings` → `onUpdate(prefs)` (natychmiast do App+localStorage), `StatusEditor` → `storage.saveStatusOverrides(...)` na każdą zmianę koloru/nazwy statusu. Dodano stopkę z dwoma przyciskami, żeby dało się cofnąć eksperymentowanie:

- **Snapshot przy otwarciu** (`useRef`, raz na mount): `prefs` z propa + `storage.getStatusOverrides()`.
- **„Anuluj"** — przywraca oba snapshoty (`onUpdate(snapshot)` + `saveStatusOverrides(snapshot)`), potem zamyka.
- **„Zatwierdź"** — po prostu zamyka (zmiany już zapisane live, nic do zrobienia).
- **Spójna semantyka (jedna, celowa):** X w rogu, klawisz **Esc** i **klik w backdrop** = to samo co „Anuluj" (cofają + zamykają). Jedyny sposób wyjścia BEZ cofania to jawny przycisk „Zatwierdź". Uzasadnienie w komentarzu na górze `SettingsModal.tsx`: przypadkowy Esc/klik-obok podczas eksperymentowania z kolorami ma cofać, nie zostawiać niechcianych zmian — to najbardziej intuicyjny odruch przy "cancel dialog".
- **Odświeżenie widoku po cofnięciu statusów:** nie wymagało dodatkowego `key`/licznika. `StatusEditor` (i `getStatusDisplay()` używane wszędzie indziej) czyta `storage.getStatusOverrides()` świeżo przy KAŻDYM mouncie/wywołaniu (brak cache'u) — a ponieważ „Anuluj" zawsze kończy się `onClose()`, `SettingsModal`+`StatusEditor` unmountują się w całości (`{showThemeSettings && <SettingsModal/>}` w `Sidebar.tsx`). Przy następnym otwarciu `StatusEditor` mountuje się od nowa i czyta już cofnięte dane.
- `AiKeysPanel` (admin) świadomie pominięty w snapshot/rollback — ma własny, osobny explicit Save.

## 9. Terminarz — kolorystyka i czytelność (redesign 2026-07-25)

> Nota porządkowa (2026-07-27): ta sekcja straciła nagłówek w trakcie wcześniejszych edycji tego dnia (kolizja z równoległymi zmianami § 6-8a) — treść merytoryczna bez zmian, tylko przywrócony nagłówek/numeracja.

`components/CalendarView.tsx` był zbudowany na sztywnym `red-600`/`red-50` dla WSZYSTKIEGO — nagłówka, przycisku "Dzisiaj", oznaczenia "dziś" w siatce i każdego wznowienia niezależnie od terminu. Efekt: ekran "krzyczał czerwienią" i tekst tonął w kolorze. Naprawione zgodnie z zasadami z sekcji 1-3 tego dokumentu:
- **"Dziś" w siatce** (kółko dnia, tło komórki) → `bg-primary`/neutralny `zinc`, NIE czerwień (to nawigacja, nie alarm).
- **Branding/chrome** (nagłówek, przycisk "Dzisiaj", ikona modala, focus ring) → `text-primary`/`focus:ring-primary`, zgodnie z "Prawo Jednego Inputa" (§ 3.A powyżej).
- **Czerwień jako akcent** — zarezerwowana dla zdarzeń realnie pilnych (dziś / po terminie); wznowienia w przyszłości dostają neutralne tło + `border-primary`. Szczegóły reguły: `CALENDAR_SPEC.md § 4`.
- **Rozmiar czcionek** kafelków dnia i list w Agendzie podniesiony (`text-[8px]` → `text-[10-11px]` w siatce; nazwisko klienta wyodrębnione jako osobna, pogrubiona linia `text-sm font-black` zamiast ginąć w tle jako `text-[10px]` obok tytułu zdarzenia).
- Dark mode dodany do wariantów kolorów zdarzeń (`getEventStyle`) i popovera hover — wcześniej brakowało `dark:` wariantów dla rose/amber/purple/blue.

Nie jest to równoległy system — reużywa istniejące `--primary-color`/`.text-primary`/`.bg-primary`/`.border-primary` (App.tsx) ustawiane per motyw (Exec/Onyx/Forest), zgodnie z sekcją 1-2 wyżej.
