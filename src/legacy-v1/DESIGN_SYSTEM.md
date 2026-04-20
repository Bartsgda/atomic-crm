
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
