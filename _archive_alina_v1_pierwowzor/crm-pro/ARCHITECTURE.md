
# 🏗️ Architektura Systemu i Standardy Deweloperskie

## 1. Filozofia "Local-First"
System działa całkowicie w przeglądarce klienta.
*   **Baza Danych:** `localStorage` (poprzez `services/storage.ts`).
*   **Stan Aplikacji:** React State + Context (w przyszłości).
*   **Import/Export:** JSON i XLSX to jedyne sposoby wymiany danych ze światem zewnętrznym.

## 2. Struktura Modułów (Folder Structure)
Dążymy do struktury domenowej (Feature-First). Każdy duży moduł biznesowy powinien mieć swój folder w `components/`.

```text
crm-pro/
├── components/
│   ├── Insurers/           # <--- MODUŁ (Domenowy)
│   │   ├── InsurersView.tsx    # Główny widok (Page)
│   │   ├── InsurerRow.tsx      # Komponent podrzędny
│   │   └── insurerUtils.ts     # Logika lokalna dla modułu
│   ├── Clients/            # <--- MODUŁ
│   ├── Policies/           # <--- MODUŁ
│   └── Shared/             # Komponenty współdzielone (np. Modal, Button)
├── services/               # Logika globalna (Storage, AI, Import)
├── data/                   # Stałe, Słowniki, Mocki
└── types.ts                # Globalne definicje typów (KRYTYCZNE)
```

## 3. Protokół Dodawania Nowego Modułu

### Krok 1: Definicja Typów (`types.ts`)
Zanim napiszesz linię kodu UI, zdefiniuj dane.
```typescript
// types.ts
export interface NewModuleItem {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}
```

### Krok 2: Warstwa Danych (`services/storage.ts`)
Dodaj metody CRUD do managera pamięci.
```typescript
// storage.ts
class StorageManager {
  // ...
  async addNewModuleItem(item: NewModuleItem) { ... }
  async getModuleItems() { ... }
}
```

### Krok 3: Widok Główny (`components/NewModule/NewModuleView.tsx`)
Stwórz główny komponent widoku.
*   Pamiętaj o obsłudze stanu ładowania (`if (!state) return <Loading />`).
*   Używaj `useEffect` do pobrania danych przy starcie.

### Krok 4: Rejestracja w Routingu (`App.tsx`)
1.  Dodaj nowy typ strony w `type Page = ... | 'new-module'`.
2.  Dodaj warunek renderowania w `main`:
    ```tsx
    {currentPage === 'new-module' && <NewModuleView ... />}
    ```

### Krok 5: Nawigacja (`Sidebar.tsx`)
Dodaj przycisk w menu bocznym.

---

## 4. Żelazne Zasady UI (The Supreme Rules)

1.  **Tabela vs Kafelki:**
    *   Jeśli danych jest > 10 i są tekstowe -> **TABELA**.
    *   Jeśli dane są wizualne lub jest ich mało -> **KAFELKI (Grid)**.

2.  **Inputy Mobilne:**
    *   Każde pole liczbowe (PLN, Telefon, PESEL) musi mieć:
        `type="number"` (lub text z patternem) ORAZ `inputMode="numeric"`.

3.  **Kolory Semantyczne:**
    *   🔴 **Red:** Błąd, Usunięcie, Ważny Termin, Brak.
    *   🟢 **Emerald:** Sukces, Pieniądze (Wpływ), Sprzedaż.
    *   🔵 **Blue:** Informacja, Edycja, Link.
    *   ⚫ **Zinc-900/950:** Główne akcje, Nagłówki.

4.  **Bezpieczeństwo (Safety First):**
    *   Każdy przycisk `Usuń` musi używać komponentu `DeleteSafetyButton`.
    *   Nie używamy natywnego `window.confirm` dla operacji krytycznych na danych.

## 5. Praca z AI (Gemini)
*   **Prompting:** Zawsze podawaj kontekst pliku (`types.ts`, `storage.ts`) przy proszeniu o zmiany.
*   **Ograniczenia:** AI w trybie przeglądarkowym nie widzi systemu plików. Musisz "karmić" je treścią plików.
