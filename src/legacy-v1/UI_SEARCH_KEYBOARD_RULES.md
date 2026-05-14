# 🔍⌨️ ZASADY: pasek wyszukiwania + nawigacja klawiaturą (UI rules)

> **STATUS:** OBOWIĄZUJĄCE (ENFORCED) dla każdego widoku listowego (Dashboard polis, Klienci/Kontrahenci, Polisy, Oferty, Wypowiedzenia, Sub-Agents, Insurers).
> **CEL:** spójność UX — Bartek/Alina otwierają widok, klawiatura od razu działa, nawigują strzałkami, Enter otwiera szczegół. Bez sięgania po mysz.

## 1. Pasek wyszukiwania (Omni Search)

### Reference implementation
- **Wzorzec:** `Dashboard.tsx` § OMNI SEARCH (linia ~445)
- **Po wzorcu zaktualizowane:** `ClientsList.tsx` (2026-05-11)

### Wymagane atrybuty input + kontener

```tsx
<div className="relative flex-1 group">
  <Search
    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors"
    size={20}
  />
  <input
    ref={searchInputRef}
    type="text"
    placeholder="Szukaj: ..."
    className="w-full pl-12 pr-10 py-3.5 bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-400 dark:focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100 placeholder:font-normal placeholder:text-zinc-400"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    onKeyDown={handleSearchKeyDown}
    tabIndex={1}
    autoFocus
  />
  {searchTerm && (
    <button
      onClick={() => setSearchTerm('')}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      aria-label="Wyczyść"
    >
      <X size={14} />
    </button>
  )}
</div>
```

### Kanon klas Tailwind (NIE odstępować)

| Kontekst | Klasa | Dlaczego |
|---|---|---|
| Kontener | `relative flex-1 group` | Rozciąga się do dostępnej szerokości (jak Dashboard) |
| Ikona Search | `absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors` size={20} | Ciemnieje gdy focus |
| Input bg | `bg-zinc-100 dark:bg-zinc-800` | Subtelne tło neutral |
| Input focus bg | `focus:bg-white dark:focus:bg-zinc-900` | Białe tło sygnalizuje aktywność |
| Input border | `border-2 border-transparent` → `focus:border-indigo-400 dark:focus:border-indigo-500` | Indigo on focus (NIE blue) |
| Input padding | `pl-12 pr-10 py-3.5` | Miejsce na ikonę Search + X-clear |
| Input radius | `rounded-2xl` | Większe zaokrąglenie (kanon Dashboard) |
| Input font | `font-bold text-sm text-zinc-900 dark:text-zinc-100 placeholder:font-normal placeholder:text-zinc-400` | Tekst pogrubiony, placeholder normalny |
| X-clear bg hover | `hover:bg-zinc-200 dark:hover:bg-zinc-700` | Kontrast nad bg-zinc-100 |

### ZAKAZY

- ❌ `md:w-[400px]` lub inne ograniczenia szerokości — pasek `flex-1` ma się rozciągać
- ❌ `rounded-xl` — kanon to `rounded-2xl`
- ❌ `border-zinc-200` widoczny zawsze — kanon to `border-transparent` + indigo on focus
- ❌ `focus:border-blue-500` lub `focus:ring` — kanon to `border-indigo-400`, bez ring
- ❌ `shadow-sm bg-white` — kanon to `bg-zinc-100`
- ❌ `py-3` — kanon to `py-3.5`

## 2. Autofocus + nawigacja klawiaturą

### Wymagane state + refs

```tsx
const searchInputRef = useRef<HTMLInputElement>(null);
const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
```

### useEffects (3 sztuki)

```tsx
// 1) Autofocus na search po mount
useEffect(() => {
  const t = setTimeout(() => searchInputRef.current?.focus(), 50);
  return () => clearTimeout(t);
}, []);

// 2) Reset zaznaczenia przy zmianie searcha (lub innych filtrów)
useEffect(() => { setSelectedRowIndex(-1); }, [searchTerm /*, inne filtry */]);

// 3) Scroll do zaznaczonego wiersza
useEffect(() => {
  if (selectedRowIndex >= 0) {
    document.querySelector(`[data-row-idx="${selectedRowIndex}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}, [selectedRowIndex]);
```

### Handler klawiszowy (na input)

```tsx
const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const total = processedList.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setSelectedRowIndex(i => Math.min(i + 1, total - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setSelectedRowIndex(i => (i <= 0 ? -1 : i - 1));
  } else if (e.key === 'Enter' && selectedRowIndex >= 0) {
    e.preventDefault();
    const item = processedList[selectedRowIndex];
    if (item) onNavigate('item-details', { item });
    setSelectedRowIndex(-1);
  } else if (e.key === 'Escape') {
    setSelectedRowIndex(-1);
    if (searchTerm) setSearchTerm('');
  }
};
```

### Wiersz tabeli — wymagane atrybuty

```tsx
{processedList.map((item, idx) => {
  const isSelected = idx === selectedRowIndex;
  return (
    <tr
      key={item.id}
      data-row-idx={idx}
      className={`transition-all group cursor-pointer ${
        isSelected
          ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-inset ring-indigo-400'
          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800'
      }`}
      onClick={() => onNavigate('item-details', { item })}
    >
      {/* ... */}
    </tr>
  );
})}
```

### Klawisze (kontrakt)

| Klawisz | Akcja |
|---|---|
| **↓** | Następny wiersz (od -1 = poza listą) |
| **↑** | Poprzedni wiersz; gdy na -1 wraca focus do search (bez akcji) |
| **Enter** | Otwiera szczegół zaznaczonego wiersza, czyści zaznaczenie |
| **Esc** | Czyści zaznaczenie. Drugi Esc czyści search |
| **Tab** | Search input ma `tabIndex={1}` — pierwszy w kolejności focus |

## 3. Strzałki sortowania w nagłówkach kolumn

### Kanon ikon (z `lucide-react`)

```tsx
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const SortIcon = ({ k }: { k: SortKey }) => {
  if (sortKey !== k) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
  return sortDir === 'asc'
    ? <ArrowUp size={12} className="ml-1 text-zinc-900 dark:text-white" />
    : <ArrowDown size={12} className="ml-1 text-zinc-900 dark:text-white" />;
};
```

| Stan | Ikona | Klasa |
|---|---|---|
| Kolumna **NIEAKTYWNA** | `<ArrowUpDown />` | `ml-1 opacity-30` |
| Aktywna **ASC** | `<ArrowUp />` | `ml-1 text-zinc-900 dark:text-white` |
| Aktywna **DESC** | `<ArrowDown />` | `ml-1 text-zinc-900 dark:text-white` |

### ZAKAZY

- ❌ Pojedynczy `<ArrowDown opacity-20>` dla nieaktywnej kolumny (stara konwencja) — kanon to `<ArrowUpDown opacity-30>`
- ❌ `size={10}` lub `size={14}` — kanon to `size={12}`

## 4. Anti-patterns

- ❌ Każdy widok ma własny styl search → spójność cierpi
- ❌ Brak `autoFocus` → user musi kliknąć w pole
- ❌ Bez `tabIndex={1}` → Tab focusuje przypadkowy element
- ❌ Bez `data-row-idx` → scrollIntoView nie znajdzie wiersza
- ❌ `selectedRowIndex` bez resetu na zmianę filtra → strzałka pokazuje pozycję ze starej listy

## 5. Checklist przy dodawaniu nowego widoku listowego

- [ ] `searchInputRef` + `useState selectedRowIndex`
- [ ] 3 useEffect (autofocus / reset / scroll)
- [ ] `handleSearchKeyDown` z 4 klawiszami (↓ ↑ Enter Esc)
- [ ] Input z `ref`, `onKeyDown`, `tabIndex={1}`, `autoFocus`
- [ ] Kanon klas Tailwind (rounded-2xl, bg-zinc-100, indigo focus)
- [ ] `<tr data-row-idx={idx} className={isSelected ? indigo-50 ring : hover}>`
- [ ] X-clear button z `aria-label`
- [ ] `<SortIcon>` na każdej sortowanej kolumnie (ArrowUpDown nieaktywne, ArrowUp/Down aktywne)

---

**Utworzony:** 2026-05-11
**Źródło wzorca:** `Dashboard.tsx` (polisy/pojazdy) — pełen flex search + 4 klawisze + ArrowUpDown
**Aktualizacja:** `ClientsList.tsx` zsynchronizowany (autofocus, klawisze, kanon klas, ArrowUpDown)
**TODO:** zsynchronizować pozostałe listy (`OffersBoard`, `TerminationsView`, `SubAgentsView`, `Insurers/`) z tym kanonem.
