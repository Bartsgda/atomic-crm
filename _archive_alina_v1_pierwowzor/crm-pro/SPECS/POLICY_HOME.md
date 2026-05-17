
# Specyfikacja: Moduł Mieszkaniowy (DOM)

## 1. Cel
Zabezpieczenie interesów klienta i banku (cesja). Rozróżnienie między "Mieszkaniem" a "Domem Jednorodzinnym" (ryzyka zewnętrzne).

## 2. Pola Danych (HomeDetails)

### A. Przedmiot Ubezpieczenia
*   **Typ:** `Mieszkanie` | `Dom Jednorodzinny` | `Dom w Budowie` | `Domek Letniskowy`.
*   **Konstrukcja:** `Niepalna (Murowana)` | `Palna (Drewno/Kanadyjka)`.
*   **Rok Budowy:** (Wpływa na zużycie techniczne).
*   **Metraż:** (Do weryfikacji sumy).

### B. Sumy Ubezpieczenia
*   **Mury:** Kwota (PLN).
*   **Stałe Elementy:** Kwota (PLN).
*   **Ruchomości Domowe:** Kwota (PLN).

### C. Ryzyka Dodatkowe (Krytyczne)
*   **Powódź:** Tak/Nie (Wymagana weryfikacja strefy zalewowej).
*   **Kradzież z włamaniem:** Tak/Nie (Wymagane 2 zamki atestowane lub monitoring).
*   **Przepięcia:** Tak/Nie.
*   **OC w Życiu Prywatnym:** Tak/Nie (Suma np. 50 000 zł, 100 000 zł).
*   **OC Najemcy:** (Jeśli klient wynajmuje).

### D. Cesja Praw (Kredyt Hipoteczny)
*   **Bank:** Nazwa banku.
*   **Numer Umowy Kredytowej:** String.
