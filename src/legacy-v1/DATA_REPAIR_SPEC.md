
# 🛠️ Specyfikacja: Centrum Naprawy Danych (Data Repair Center)

**Wersja:** 2.1 (Deep Regex Update)
**Powiązane pliki:**
- `components/DataRepair/DataRepairView.tsx`
- `data/normalizationDictionary.ts`

## 1. Cel Biznesowy
Moduł służy do utrzymania higieny bazy danych, która jest zasilana z "brudnych" źródeł (importy Excel, ręczne wpisywanie). System automatycznie wykrywa anomalie, błędy formatowania oraz literówki i sugeruje masowe lub pojedyncze poprawki.

## 2. Architektura Normalizacji (`normalizationDictionary.ts`)

Silnik normalizacji działa w **3 fazach**, aby uniknąć błędów nadgorliwości (np. zamiany `4MOT` na `4motocykl`).

### Faza 1: Korekta Frazowa (Context Aware Regex)
Najpierw przetwarzane są całe zbitki słowne, aby zrozumieć kontekst.
*   **Pojemność:** `poj`, `pojemnosc`, `poj silnika` -> Zmieniane na ujednolicone **`poj. silnika`**.
    *   *Zabezpieczenie:* Regex sprawdza, czy słowo "silnika" już istnieje, aby nie stworzyć `poj. silnika silnika`.
*   **Rejestracja:** `pierwsza`, `pierwsza rej`, `pierw. rej.` -> Zmieniane na **`pierw rej`**.
*   **Produkcja:** `prod`, `produkcji` -> Zmieniane na **`prod.`**.
    *   *Zabezpieczenie:* Regex `(?!\.)` pilnuje, aby nie dodać drugiej kropki (`prod..`).

### Faza 2: Naprawa Formatowania (Spacing)
Naprawa błędów sklejania tekstu z liczbami (częsty błąd w Excelu).
*   `pierw rej2008` -> `pierw rej 2008`
*   `prod.2017` -> `prod. 2017`
*   `poj. silnika1900` -> `poj. silnika 1900`

### Faza 3: Mapowanie Słownikowe (Dictionary Lookup)
Dopiero na końcu analizowane są pojedyncze słowa, które nie zostały wyłapane przez frazy.
*   Zawiera bezpieczne skróty: `samoch` -> `samochód`, `osob` -> `osobowy`.
*   Wykluczenia: Usunięto niebezpieczne skróty jak `mot` (psuło `4MOT`) czy `poj` (obsłużone w Fazie 1).

## 3. Kategorie Napraw (UI Tabs)

### A. Korekty (Typos & Structure)
Analizuje pole `originalProductString` w poszukiwaniu błędów zapisu.
1.  **Literówki:** Np. `samocho`, `podroz`, `watra` (Warta).
2.  **Skróty:** Standaryzacja żargonu wg zasad z sekcji 2.
3.  **Struktura (Brak `_`):**
    *   System wymusza separator `_` po typie pojazdu (np. `samochód_GD123`).
    *   **Wyjątek:** Fraza `samochód ciężarowy` jest traktowana jako poprawny typ i nie wymaga podkreślnika pomiędzy słowami.

### B. Procesowe (Anomalie Logiczne)
Wykrywa polisy, które "utknęły" w systemie.
*   **Zombie Travel:** Polisa turystyczna w statusie "Chłodnia" (Turystyka nie ma wznowień).
*   **Stale Calc:** Kalkulacja otwarta od > 120 dni.
*   **Ghost Lead:** Nowy temat bez kontaktu od > 30 dni.

### C. Jakość Danych (Quality)
Walidacja twarda danych klienta.
*   **PESEL:** Sprawdzenie długości (11 cyfr).
*   **Telefon:** Sprawdzenie długości (min. 9 cyfr).
*   **Email:** Sprawdzenie formatu (@ i kropka).

## 4. Interfejs Użytkownika
*   **Context Popover:** Najechanie myszką na wiersz błędu pokazuje "dymek" z oryginalnymi danymi z importu oraz historią notatek, co pozwala Agentowi podjąć decyzję bez wchodzenia w szczegóły.
*   **One-Click Fix:** Przycisk "Popraw" natychmiast aplikuje zmianę w bazie (`localStorage`).
*   **Batch Fix:** Przycisk "Popraw Wszystkie" dla danej kategorii.

## 5. Zasady Rozwoju
1.  Nie dodawać do `AGENT_ABBREVIATIONS` słów krótszych niż 4 litery, chyba że są unikalne.
2.  Wszelkie zmiany dat/liczb muszą być obsługiwane przez Regex w Fazie 1 lub 2.
3.  Przed wdrożeniem nowej reguły, sprawdź czy nie psuje nazw modeli (np. "Partner", "Master", "Focus").
