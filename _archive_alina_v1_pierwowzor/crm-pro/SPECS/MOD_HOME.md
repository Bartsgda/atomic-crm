
# 🏠 MOD_HOME: Specyfikacja Modułu Nieruchomości

## 1. Specyfika Produktu
Ubezpieczenie majątku wymaga precyzyjnego określenia przedmiotu (Mieszkanie vs Dom) oraz ryzyk dodatkowych (Fotowoltaika, Garaż).

## 2. Pola Wymagane i Logika

### A. Przedmiot i Adres
*   **Typ:** Kafelki (Mieszkanie / Dom / Budowa / Letniskowy).
*   **Auto-Parser (Legacy):** System skanuje `originalProductString` w poszukiwaniu słów:
    *   `mieszkanie`, `lokal` -> **MIESZKANIE**.
    *   `dom`, `szereg` -> **DOM**.
    *   `budowa` -> **BUDOWA**.
*   **Adres:** Pełny string adresowy.

### B. Dane Techniczne (Smart Fields)
*   **Konstrukcja:** Palna / Niepalna.
*   **Rok Budowy:** (Wpływa na zużycie).
*   **Metraż:** Podstawa wyceny.
*   **Fotowoltaika (OZE):** Checkbox. Jeśli zaznaczony, AI sugeruje zwiększenie sumy ubezpieczenia.

### C. Sumy i Zakres (Rozszerzony)
*   **Mury / Stałe Elementy / Ruchomości:** Trzy osobne pola kwotowe (PLN).
*   **Budynki Gospodarcze:** Checkbox "Garaż/Budynek Gosp." (zgodnie z wymaganiem).
*   **Ryzyka:** Powódź, Kradzież, Przepięcia, OC w Życiu Prywatnym.
*   **Cesja:** Pole tekstowe dla banku (jeśli kredyt).

## 3. Pole "Import / Notatki"
*   Znajduje się w sekcji "Dodatkowe".
*   Przechowuje np. "Cesja PKO BP, klucze u sąsiada".
