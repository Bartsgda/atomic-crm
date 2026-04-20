
# Specyfikacja: Moduł Prowizji i Pośredników (Commissions & Sub-Agents)

**Powiązane pliki:**
- `components/Commission/CommissionCalculator.tsx`
- `components/Commission/SubAgentSelect.tsx`
- `components/PolicyFormModal.tsx`

## 1. Cel Biznesowy
Obsługa modelu MLM / OWCA / Tip-serwis. Agent często otrzymuje "temat" od innego pośrednika (np. dealera aut, agenta nieruchomości, kolegi) i musi oddać część prowizji.

## 2. Baza Pośredników (SubAgents)
System utrzymuje niezależną bazę pośredników.
- **Dane:** Imię/Nazwa (wymagane), Telefon, E-mail.
- **Inteligencja Stawek (Default Rates):** Dla każdego pośrednika system pamięta domyślną stawkę prowizyjną (np. 4%) w zależności od typu polisy (`PolicyType`).
  - Np. Asia: OC=2%, Życie=10%.
  - Np. Dealer BMW: OC=1%, AC=3%.

## 3. Matematyka Podziału (The Split Logic)
Kalkulator działa w układzie kaskadowym:

1.  **Input:** Składka Polisy (np. 1000 zł).
2.  **Input:** Prowizja Całkowita (To, co towarzystwo przelewa Agentowi Głównemu, np. 10% = 100 zł).
3.  **Input (Opcjonalny):** Wybór Pośrednika.
    *   Jeśli wybrano, system pobiera jego domyślną stawkę % dla danego typu polisy.
    *   Oblicza kwotę dla Pośrednika (np. 4% od składki = 40 zł).
4.  **Wynik (Netto):** Prowizja Agenta = Prowizja Całkowita - Prowizja Pośrednika (100 - 40 = 60 zł).

## 4. Wymagania UI/UX
- **Mikro-Notatka:** Przy polu pośrednika mały przycisk (dymek) pozwalający wpisać notatkę rozliczeniową (np. "Przelew na Revolut").
- **Edycja Live:** Agent może ręcznie nadpisać kwotę lub procent dla pośrednika w konkretnej transakcji, nie zmieniając jego ustawień globalnych.
- **Czytelność:** Musi być jasne, ile agent zarobi "na rękę" (Netto).
