
# 🕵️ Algorytm "Reverse Rate" (Analiza Wsteczna Prowizji)

## 1. Cel Biznesowy
Automatyczne odtworzenie modelu rozliczeniowego z pośrednikami (Sub-Agents) na podstawie danych historycznych z Excela.
Zamiast ręcznie konfigurować, że "Pośrednik X ma 5% na OC", system analizuje setki starych transakcji i sam "uczy się" tej reguły.

## 2. Źródło Wiedzy (Insight Agentki)
W starych plikach Excel, w kolumnie "Rozliczenie" (lub "Prowizja"), wartości często nie były wpisywane "z palca" (np. `50`), ale jako formuła (np. `=C2*0.05`).
Nawet jeśli parser Excela zwraca nam wynik liczbowy, relacja między **Składką (Premium)** a **Wypłatą (SubCommission)** jest stała.

## 3. Logika Algorytmu (`legacyRateExtractor.ts`)

### KROK 1: Analiza Transakcyjna
Dla każdej zaimportowanej polisy, która ma przypisanego pośrednika:
1.  Pobierz `Premium` (Składka) i `SubCommission` (Kwota dla pośrednika).
2.  Jeśli obie wartości > 0, oblicz Rzeczywistą Stawkę:
    $$ Rate = (SubCommission / Premium) * 100 $$
3.  Zaokrąglij wynik do 1 miejsca po przecinku (np. 5.0%, 12.5%).

### KROK 2: Agregacja (Grupowanie)
Zbieramy wyniki w mapie:
`AgentID -> TypPolisy (OC/AC/DOM) -> ListaWykrytychStawek[]`

Przykład dla Agenta Marka (OC):
`[5.0, 5.0, 5.0, 5.0, 2.5, 5.0, 5.0]`

### KROK 3: Wykrywanie Dominanty (Mode)
Algorytm szuka wartości najczęstszej.
*   W powyższym przykładzie 5.0% wystąpiło 6 razy, a 2.5% raz (anomalia).
*   **Wniosek:** Domyślna stawka Marka na OC to **5%**.

### KROK 4: Aktualizacja Bazy
System aktualizuje rekord `SubAgent` w bazie, wpisując wykrytą wartość do `defaultRates['OC']`.

## 4. Precyzja Finansowa (Zasada 2 Miejsc)
W całym systemie (UI, Kalkulatory, Export) stosujemy sztywne zaokrąglanie:
`Math.round(value * 100) / 100`.
Gwarantuje to, że `1/3 * 100` da `33.33`, a nie `33.333333`.
