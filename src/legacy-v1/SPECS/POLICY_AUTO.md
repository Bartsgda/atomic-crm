
# Specyfikacja: Moduł Komunikacyjny (AUTO)

## 1. Cel
Precyzyjne określenie zakresu ochrony pojazdu, wykraczające poza standardowe "Full Pakiet". Agent musi widzieć na pierwszy rzut oka limity odpowiedzialności.

## 2. Pola Danych (AutoDetails)

### A. Sekcja Assistance (Kluczowa)
*   **Wariant:** `Podstawowy` | `Rozszerzony` | `Maksymalny (VIP)`.
*   **Limit Holowania (Polska):** `Brak` | `100 km` | `200 km` | `500 km` | `Bez Limitu`.
*   **Limit Holowania (Europa):** `Brak` | `500 km` | `1000 km` | `Bez Limitu`.
*   **Auto Zastępcze:** `Brak` | `Po wypadku (3 dni)` | `Awaria/Wypadek (7 dni)` | `Max (do 21 dni)`.

### B. Dodatki (Add-ons)
*   **Opony:** Tak/Nie (Limit kwotowy np. 500 zł).
*   **Szyby:** Tak/Nie (Suma ubezpieczenia np. 3000 zł, Udział własny?).
*   **Bagaż:** Tak/Nie.
*   **NNW Kierowcy/Pasażerów:** Suma Ubezpieczenia (np. 10 000 zł).

### C. Warunki AC (Autocasco)
*   **Wariant:** `Kosztorys` | `Serwis (ASO)` | `Serwis (Partnerski)`.
*   **Amortyzacja:** `Zniesiona` | `Potrącana`.
*   **Udział Własny:** `0 zł` | `500 zł` | `1000 zł`.
*   **Stała Suma Ubezpieczenia:** Tak/Nie.

## 3. Logika Walidacji
*   Jeśli wybrano AC -> Wymagane zdjęcia (4 strony + VIN + Deska).
*   Jeśli wybrano Zniżki -> Weryfikacja historii UFG (checkbox).
