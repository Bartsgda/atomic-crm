
# Specyfikacja: Centrum Pośredników (Sub-Agents Module)

**Powiązane pliki:**
- `components/SubAgents/SubAgentsView.tsx`
- `components/Commission/SubAgentSelect.tsx`
- `components/Commission/CommissionCalculator.tsx`
- `services/storage.ts` (metody `addSubAgent`, `updateSubAgent`)

## 1. Cel Biznesowy
Obsługa zewnętrznej sieci sprzedaży (OWCA), partnerów biznesowych (Dealerzy, Biura Nieruchomości) oraz pracowników wewnętrznych. Moduł pozwala na automatyczne wyliczanie należnych prowizji ("działki") i generowanie raportów rozliczeniowych.

## 2. Model Danych

### A. Definicja Pośrednika (`SubAgent`)
Globalny obiekt w bazie, definiujący partnera.
```typescript
interface SubAgent {
    id: string;
    name: string;          // Nazwa wyświetlana (obsługuje "pathing" np. "firmowy/Anna")
    phone?: string;
    email?: string;
    defaultRates: Record<string, number>; // Domyślne stawki % dla typów (OC: 2%, AC: 5%)
}
```

### B. Udział w Polisie (`PolicySubAgentShare`)
Konkretne rozliczenie przypisane do danej polisy.
```typescript
interface PolicySubAgentShare {
    agentId: string;
    rate: number;          // Zastosowana stawka % (może być inna niż domyślna)
    amount: number;        // Kwota PLN dla pośrednika
    note?: string;         // Notatka (np. "Gotówka", "Przelew")
}
```

## 3. Logika "Smart Grouping" (Widok Grid)
System w widoku `SubAgentsView` analizuje pole `name` pośrednika w poszukiwaniu wzorców, aby automatycznie grupować kafelki w foldery.

*   **Prefix `firmowy/`:** (np. `firmowy/Osip`) -> Grupa **FIRMOWY** (Czarna ikona, pracownicy wewnętrzni).
*   **Słowo `własny`:** (np. `Portfel Własny`) -> Grupa **WŁASNY** (Niebieska ikona, sprzedaż bezpośrednia).
*   **Brak prefixu:** -> Grupa **PARTNERZY** (Zielona ikona, zewnętrzni współpracownicy).

## 4. Widoki i Interakcje

### A. Dashboard (Grid/List)
*   **Tryb Grid:** Foldery (Grupy) -> Kafelki Agentów. Pokazuje sumaryczną prowizję grupy.
*   **Tryb List:** Klasyczna lista boczna + szczegóły po prawej.
*   **Filtry Czasowe:** Rok / Miesiąc / Tydzień.
*   **Filtry Danych:** "Tylko Aktywni" (z prowizją > 0) oraz "Ukryj Puste" (bez przypisu).

### B. Status Rozliczenia (Finanse)
System analizuje pole `paymentStatus` polisy powiązanej z pośrednikiem.
*   **Do Wypłaty (Zielony):** Prowizja z polis oznaczonych jako `PAID` (Opłacona).
*   **Oczekujące (Bursztynowy):** Prowizja z polis `UNPAID` / `PARTIAL`.
*   Na kafelku agenta widoczny jest pasek postępu "Rozliczono: X%".

### C. Raportowanie (Export)
*   Przycisk `XLSX` w szczegółach agenta generuje plik Excel.
*   Zawiera listę polis z danego okresu wraz z wyliczoną kwotą dla pośrednika.
*   Służy jako podstawa do wystawienia faktury/rachunku przez pośrednika.

## 5. Integracja z Formularzem Polisy
W modalu polisy (`PolicyFormModal` -> `CommissionCalculator`) agent ma możliwość:
1.  Wybrania pośrednika z listy.
2.  System automatycznie zaciąga `defaultRate` dla typu polisy (np. OC).
3.  System wylicza kwotę (PLN).
4.  Agent może ręcznie nadpisać stawkę lub kwotę dla tej konkretnej transakcji (nadpisanie lokalne).
5.  Kalkulator pokazuje "Zysk Netto" (Prowizja od TU minus Koszt Pośrednika).
