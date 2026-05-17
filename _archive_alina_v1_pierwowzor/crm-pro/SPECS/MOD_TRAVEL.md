
# ✈️ MOD_TRAVEL: Specyfikacja Modułu Turystycznego

## 1. Dynamika Wyjazdu
Moduł musi być szybki ("Last Minute"). Kluczowe są daty i cel.

## 2. Interfejs Użytkownika

### A. Kierunek i Czas (Slider & Select)
*   **Kraj Docelowy:** Lista wyboru z wyszukiwarką (AI podpowiada ryzyka dla danego kraju, np. "USA = wysokie koszty leczenia").
*   **Strefa:** Europa / Świat.
*   **Długość Wyjazdu:** **SUWAK (Slider)** od 1 do 30+ dni. Pozwala szybko określić ramy czasowe bez klikania w kalendarz (alternatywnie).

### B. Ryzyka (Aktywność)
*   **Cel:** Wypoczynek / Praca / Narty (Sporty zimowe).
*   **Choroby Przewlekłe:** Checkbox (Krytyczne dla osób starszych).
*   **Klauzula Alkoholowa:** Checkbox.

### C. Uczestnicy
*   Liczba osób (Input liczbowy).
*   Możliwość wklejenia listy imion w pole "Notatki / Import".

## 3. Rola AI (Travel Intel)
*   Po wybraniu Kraju, AI (w tle) sprawdza ryzyka medyczne i sugeruje odpowiednią Sumę KL (Koszty Leczenia), np. dla USA minimum 100k USD.
