
# 🚗 MOD_AUTO: Specyfikacja Modułu Komunikacyjnego

## 1. Filozofia "Hybrid First"
Ten moduł obsługuje zarówno precyzyjne dane (do kalkulacji API), jak i "brudne" dane z importu Excel.
**Kluczowa zasada:** Pole `originalProductString` (Notatki/Import) jest ZAWSZE widoczne i edytowalne, służąc jako "brudnopis" dla Agenta lub AI.

## 2. Architektura UI (Tabulacja i Sekcje)
Okno podzielone jest na logiczne bloki, które można zwijać/rozwijać (Accordion):

### A. Identyfikacja (AI Ready)
*   **Pola:** Rodzaj (Osobowy/Ciężarowy...), Marka, Model, Rejestracja, VIN.
*   **Rola AI:** Agent Karateka potrafi wyczytać te dane ze zdjęcia dowodu rejestracyjnego lub ciągu tekstowego ("Audi A4 GD12345").
*   **Auto-Parser (Legacy):** System automatycznie wykrywa słowa kluczowe w `originalProductString`:
    *   `ciężarowy`, `furgon`, `transit` -> Zaznacza **CIĘŻAROWY**.
    *   `motocykl`, `yamaha` -> Zaznacza **MOTOCYKL**.

### B. Dane Techniczne
*   **Pola:** Rok produkcji, Pojemność, Moc, Przebieg, Paliwo.
*   **Logika:** Pola numeryczne wymuszają klawiaturę `decimal` na mobile.
*   **Auto-Parser:**
    *   Wykrywa `1870 cm3` -> Wpisuje w pole Pojemność.
    *   Wykrywa `74KW` -> Wpisuje w pole Moc.
    *   Wykrywa `diesel` -> Ustawia paliwo na Diesel.

### C. Zakres i Assistance (Suwaki i Wybór)
*   **Assistance:** Wybór wariantu (Podstawowy / Rozszerzony / VIP).
*   **Holowanie:** Limity km (Polska/Europa).
*   **Auto Zastępcze:** Dni (3 / 7 / 21).
*   **Dodatki:** Opony, Szyby, Bagaż (Checkboxy).

### D. Autocasco (AC) - Sekcja Opcjonalna
*   Rozwija się tylko dla typu `AC` lub `BOTH`.
*   **Parametry:** Wariant (Kosztorys/ASO), Amortyzacja (Zniesiona/Nie), Udział Własny.

## 3. Integracja z Importem (Legacy Support)
*   Na dole formularza znajduje się sekcja **"Dane Źródłowe / Notatki"**.
*   Zawiera treść z kolumny Excela (np. "oc ac warta 500zł").
*   Agent może tu wpisać dowolne uwagi, które nie mieszczą się w sztywnych polach.
