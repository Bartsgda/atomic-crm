
# 📐 UI/UX Specyfikacja: Inteligentne Listy Rozwijane (Smart Dropdowns)

## 1. Problem (The Clipping Issue)
W nowoczesnych aplikacjach (Dashboardy, Modale) kontenery często mają ustawione `overflow: hidden` lub `auto`.
Tradycyjne dropdowny używające `position: absolute` są ograniczone przez ramy swojego rodzica.
**Efekt:**
1. Lista jest "ucięta" w połowie.
2. Lista na dole ekranu otwiera się w dół i znika pod krawędzią monitora.

## 2. Rozwiązanie: Strategia "Fixed Flip"

### A. Ucieczka z Kontenera (Breakout)
Zamiast `absolute`, używamy `position: fixed`.
*   To pozycjonuje element względem **okna przeglądarki (Viewport)**, a nie rodzica.
*   Ignoruje `overflow: hidden` rodziców.
*   Wymaga dynamicznego obliczenia współrzędnych `top`, `left`, `width` w momencie otwarcia.

### B. Wykrywanie Krawędzi (Flip Logic)
Przed otwarciem listy, algorytm sprawdza dostępną przestrzeń:

```typescript
const rect = triggerElement.getBoundingClientRect();
const spaceBelow = window.innerHeight - rect.bottom;
const MENU_HEIGHT = 300; // Zakładana maks. wysokość

if (spaceBelow < MENU_HEIGHT) {
    // Otwórz do GÓRY
    style = { bottom: window.innerHeight - rect.top, left: rect.left };
} else {
    // Otwórz w DÓŁ
    style = { top: rect.bottom, left: rect.left };
}
```

## 3. Implementacja w Komponentach
Zastosowano tę logikę w kluczowych komponentach typu Select:
1.  **`InsurerSelect.tsx`** (Wybór towarzystwa)
2.  **`SearchableSelect.tsx`** (Wybór kraju)
3.  **`CalendarView.tsx`** (Dymki zdarzeń - Event Popovers)

## 4. Zasady dla Nowych Komponentów
Każdy nowy element typu "Overlay" (Tooltip, Dropdown, Menu) **MUSI**:
1.  Być renderowany w Portalu (`createPortal`) LUB używać `position: fixed`.
2.  Posiadać `z-index` warstwy najwyższej (np. `z-[9999]`).
3.  Zamykać się przy scrollowaniu głównego okna (aby uniknąć "odklejenia" od przycisku).
