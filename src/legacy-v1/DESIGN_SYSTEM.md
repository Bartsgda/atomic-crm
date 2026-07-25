
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

1. **Rodzaj czcionki** (`UiPreferences.fontFamily`) — 4 opcje z `constants.ts` → `FONT_FAMILY_OPTIONS`:
   - `system` (domyślna) — natywna czcionka systemu (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`)
   - `humanist` — **Inter** (`"Inter Variable"`, już samo-hostowana w projekcie przez `@fontsource-variable/inter`, ZERO CDN)
   - `serif` — **Georgia** (systemowa szeryfowa)
   - `accessible` — **Tahoma** (szerokie znaki, wysoka czytelność — accessibility/dysleksja-friendly)
   - Wszystkie 4 opcje działają offline — brak zależności od zewnętrznego CDN (zgodnie z zasadą CSP/offline tego modułu; istniejący import Google Fonts w `src/index.css` dla EB Garamond/Manrope jest osobną, wcześniejszą sprawą i nie jest przez Designer Czcionek wykorzystywany).
2. **Pogrubienie** (`UiPreferences.fontBold`) — globalny przełącznik, wymusza `font-weight: 700` na CAŁEJ aplikacji (w tym Sidebar/chrome) przez atrybut `[data-app-font-bold="true"]` w `v1-themes.css`.
3. **Kolor tekstu** (`UiPreferences.fontColor`) — `<input type="color">`, stosowany TYLKO do treści (`<main>`, klasa `.app-content-font`), NIE do Sidebar/chrome. Pusty string = automatyczny (kolor motywu). Bez `!important` — elementy z własną jawną klasą koloru Tailwind (np. status "sprzedaż" = zielony, "wygasa" = czerwony) zachowują swój kolor; nadpisywane jest tylko dziedziczone tło tekstu.
4. **Rozmiar bazowy** — reużywa istniejące `UiPreferences.fontScale` (root `font-size` w px, rem-based skaluje całą appkę) — 3 szybkie przyciski Normalny (1.0) / Duży (1.15) / Bardzo Duży (1.3), spięte z istniejącym suwakiem "SKALA INTERFEJSU" (zakres rozszerzony z 0.85–1.15 na 0.85–1.3).

**Mechanizm (spójny z istniejącym `--primary-color`/`data-v1-skin`):** `App.tsx` → `applyTheme()` ustawia CSS custom properties (`--app-font-family`, `--app-font-weight`, `--app-font-color`) oraz atrybut `data-app-font-bold` na `document.documentElement`, identycznie jak dla `--primary-color`. Zapis do localStorage przez ten sam `storage.saveUiPrefs()`/`PREFS_KEY = "InsuranceMaster_UI_Prefs"` co reszta `UiPreferences` — przetrwa reload, ładowany przy starcie w `refreshData()`.

**Czytelność (PESEL / nr rejestracyjny):** niezależnie od Designera, PESEL (nagłówek `ClientDetails.tsx`, `QuickViewDrawer.tsx`) i numer rejestracyjny pojazdu (badge na karcie polisy w `ClientDetails.tsx`, chipy w `Notatki.tsx`) są renderowane z wyraźnie większą czcionką (`text-sm`/`text-xs` `font-black tabular-nums` zamiast `text-[9-10px]`) — to są najważniejsze dane operacyjne dla Aliny.

## 5. Terminarz — kolorystyka i czytelność (redesign 2026-07-25)

`components/CalendarView.tsx` był zbudowany na sztywnym `red-600`/`red-50` dla WSZYSTKIEGO — nagłówka, przycisku "Dzisiaj", oznaczenia "dziś" w siatce i każdego wznowienia niezależnie od terminu. Efekt: ekran "krzyczał czerwienią" i tekst tonął w kolorze. Naprawione zgodnie z zasadami z sekcji 1-3 tego dokumentu:
- **"Dziś" w siatce** (kółko dnia, tło komórki) → `bg-primary`/neutralny `zinc`, NIE czerwień (to nawigacja, nie alarm).
- **Branding/chrome** (nagłówek, przycisk "Dzisiaj", ikona modala, focus ring) → `text-primary`/`focus:ring-primary`, zgodnie z "Prawo Jednego Inputa" (§ 3.A powyżej).
- **Czerwień jako akcent** — zarezerwowana dla zdarzeń realnie pilnych (dziś / po terminie); wznowienia w przyszłości dostają neutralne tło + `border-primary`. Szczegóły reguły: `CALENDAR_SPEC.md § 4`.
- **Rozmiar czcionek** kafelków dnia i list w Agendzie podniesiony (`text-[8px]` → `text-[10-11px]` w siatce; nazwisko klienta wyodrębnione jako osobna, pogrubiona linia `text-sm font-black` zamiast ginąć w tle jako `text-[10px]` obok tytułu zdarzenia).
- Dark mode dodany do wariantów kolorów zdarzeń (`getEventStyle`) i popovera hover — wcześniej brakowało `dark:` wariantów dla rose/amber/purple/blue.

Nie jest to równoległy system — reużywa istniejące `--primary-color`/`.text-primary`/`.bg-primary`/`.border-primary` (App.tsx) ustawiane per motyw (Exec/Onyx/Forest), zgodnie z sekcją 1-2 wyżej.
