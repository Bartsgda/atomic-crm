
# ❤️ MOD_LIFE: Specyfikacja Modułu Życiowego

## 1. Wrażliwość Danych
Moduł skupia się na sumach ubezpieczenia i wymogach formalnych (ankieta medyczna).

## 2. Struktura Formularza

### A. Typ Polisy
*   Kafelki: Indywidualna / Grupowa Otwarta / Szkolna (NNW).

### B. Zakres Ochrony
*   **Śmierć (Główna):** Kwota PLN.
*   **Opcje Dodatkowe:** Poważne zachorowanie, Szpital, Uszczerbek (NNW).

### C. Compliance (Wymogi)
*   **Ankieta Medyczna:** Checkbox "Wypełniona".
*   **Uposażeni:** Checkbox "Wskazano".

## 3. Pole Hybrydowe (Import)
*   Pole "Notatki / Szczegóły" służy do wpisania nietypowych warunków (np. "Karencja 3 miesiące", "Wyłączenie kręgosłupa").
*   Jest to kluczowe przy imporcie starych baz, gdzie szczegóły polisy życiowej były często w jednym długim ciągu tekstowym.
