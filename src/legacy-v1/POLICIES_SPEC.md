
# Specyfikacja: Moduł Polis i Produktów (Policies Module)

**Powiązane pliki:**
- `components/PolicyFormModal.tsx`
- `components/Dashboard.tsx`
- `components/QuickViewDrawer.tsx`
- `components/InsurerSelect.tsx`
- `services/insurerRanking.ts`

## 1. Definicja Polisy
Polisa jest głównym aktywem (asset) w systemie. Może być na etapie "Oferty" (Lead) lub "Sprzedaży" (Active Policy).

## 2. Model Danych (Policy Object)
Każda polisa posiada:
- **Typ**: `OC`, `AC`, `DOM`, `ZYCIE`, `PODROZ`, `FIRMA`.
- **Etap (`stage`)**: 
  - `of_do zrobienia`, `przeł kontakt`, `oferta_wysłana` (LEADY).
  - `sprzedaż` (ZAAKCEPTOWANA/SPRZEDANA).
  - `ucięty kontakt` (ODRZUCONA).
- **Finanse**: `premium` (składka), `commission` (prowizja), `commissionRate` (stopa %), `paymentStatus` (status płatności).
- **Daty**: `policyStartDate` (Start), `policyEndDate` (Koniec - kluczowe dla wznowień).
- **Asset Intelligence**: Polisa przechowuje dane o przedmiocie (Marka, Rejestracja, Adres), które są indeksowane do szybkiego wyszukiwania.

## 3. Wymagania Funkcjonalne (PolicyFormModal)

### A. Layout "Power User" (Split View)
- **Lewa Kolumna (Dane Operacyjne):** Formularz wprowadzania danych o przedmiocie (Auto/Dom), daty, wybór towarzystwa. To jest "przestrzeń robocza".
- **Prawa Kolumna (Panel Administracyjny):**
    - **Finanse:** Kalkulator prowizji i podziału z pośrednikami (`CommissionCalculator`).
    - **Compliance:** Checklisty dokumentów (`ComplianceChecklist`).
    - **Panel Zwijany:** Użytkownik może zwinąć prawy panel, aby uzyskać więcej miejsca na formularz (np. na mniejszych ekranach laptopów).

### B. Algorytm Doboru Towarzystwa (Smart Ranking)
- System analizuje historię polis agenta (`existingPolicies`).
- Jeśli agent wybierze typ "OC", system sprawdza, które towarzystwa są najczęściej wybierane dla tego typu.
- **Kolejność wyświetlania:**
    1. Towarzystwa używane dla danego typu (sortowane malejąco wg liczby wystąpień).
    2. Pozostałe towarzystwa (sortowane alfabetycznie).

### C. Kalkulator Prowizyjny (Bi-directional Math)
Pola Składka (`premium`), Prowizja kwotowa (`commission`) i Stopa procentowa (`commissionRate`) są powiązane:
- Wpisanie **Stopy %**: Przelicza Prowizję kwotową (dokładność 1 miejsce po przecinku, np. 3.5%).
- Wpisanie **Prowizji PLN**: Przelicza Stopę % (automatycznie).
- Wpisanie **Składki**: Aktualizuje Prowizję kwotową na podstawie ustalonej stopy %.

### D. Asset Intelligence (AI)
- Formularz musi analizować historię klienta przy otwarciu.
- Jeśli klient ma już historię polis, system wyświetla kafelki "Szybki Wybór" (np. "Toyota Yaris GD12345"), które jednym kliknięciem wypełniają pola przedmiotu ubezpieczenia.

### E. Nawigacja Kontekstowa
- **Stopka:** W stopce modalu musi znajdować się wyraźny przycisk/link z nazwiskiem klienta.
- **Akcja:** Kliknięcie przenosi do pełnego profilu klienta (`ClientDetails`), zamykając modal lub pozostawiając go w tle (zależnie od trybu).

### F. Walidacja i UI States
- **Blokada Zapisu**: Przycisk "Zapisz Polisę" musi być **nieaktywny (disabled)**, dopóki nie zostanie wybrany Klient (`selectedClient !== null`).
- **Sprzedaż**: Wymagany numer polisy i składka > 0 (walidacja przy `onSubmit`).
- **Oferta**: Numer polisy opcjonalny (można wpisać nr kalkulacji).

## 4. Dashboard & Table Visualization (Aktualizacja v6.5)

### A. Kolumna "Klient" (Contact Focus)
- **Cel:** Szybka weryfikacja tożsamości i kontaktu bez wchodzenia w szczegóły.
- **Zawartość:** Awatar, Imię Nazwisko.
- **Zmiana:** Zamiast nazwy Towarzystwa (przeniesiona), wyświetlane są dane kontaktowe: Telefon (z ikoną słuchawki) lub E-mail (z ikoną koperty) w kolorze szarym (subtelnym).

### B. Kolumna "Przedmiot" (Context Merge)
- **Cel:** Kompletna informacja o produkcie w jednym miejscu.
- **Zawartość:** 
    1. Nazwa Przedmiotu (np. "Toyota Yaris").
    2. Numer rejestracyjny / polisy.
    3. **Towarzystwo:** Wyświetlane jako mały "badge" (skrót do 7 znaków) pod nazwą przedmiotu.
    4. **Składka:** Wyświetlana obok Towarzystwa.

### C. Kolumna "Notatki" (Expanded Context)
- **Szerokość:** Zwiększona, aby pomieścić więcej treści.
- **Formatowanie:** Tekst wielowierszowy (multiline), zawijanie wierszy (word-wrap).
- **Widoczność:** Minimum 200 znaków widocznych od razu. Brak agresywnego ucinania ("...").
- **Hover:** Najechanie myszką pokazuje "dymek" z pełną historią ostatnich notatek.

### D. Sortowanie (Interactive Headers)
- Nagłówki tabeli są klikalne.
- Obsługiwane klucze sortowania: Klient, Składka/Przedmiot, Status, Data Końca.
- Domyślny sort: Po dacie końca (rosnąco) - najpierw wygasające.

## 5. Zasady Logiki Biznesowej (Wyjątki)

### A. Polisy Turystyczne (`PODROZ`)
- **Brak Wznowień:** Polisy te są z definicji jednorazowe. System **MUSI** wykluczać typ `PODROZ` z wszelkich widoków "Wznowienia" (Renewals) oraz liczników na Sidebarze.
- **Brak Chłodni:** Nie istnieje status "Chłodnia / Ponów za rok" dla wyjazdów turystycznych. Po zakończeniu okresu ochrony polisa staje się historyczna i nie wymaga dalszych akcji.
