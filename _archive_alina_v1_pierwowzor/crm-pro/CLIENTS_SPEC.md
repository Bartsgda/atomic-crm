
# Specyfikacja: Moduł Klientów (Clients Module v2.0)

**Powiązane pliki:**
- `components/ClientsList.tsx`
- `components/ClientFormModal.tsx`
- `ai/prompts/CLIENT_MASTER_PROMPT.md`

## 1. Definicja i Rola
Klient jest główną encją w systemie. Może być Osobą Fizyczną lub Firmą.
System traktuje dane klienta jako "Prawdę Ostateczną" (Single Source of Truth) dla wszystkich polis.

## 2. Architektura Formularza (Flow Agenta)
Formularz został podzielony na sekcje zgodnie z naturalnym przepływem rozmowy sprzedażowej.

### SEKCJA 1: TOŻSAMOŚĆ (Identity)
*   **Kolejność:** Imię -> Nazwisko.
*   **Wymagalność:** Obydwa pola są krytyczne.
*   **Formatowanie:** Auto-kapitalizacja pierwszej litery (Jan Kowalski).

### SEKCJA 2: KONTAKT (Contact)
*   **Telefony:**
    *   Struktura: Prefiks (Select) + Numer (Input).
    *   **Walidacja:** Pole `value` musi zawierać od 7 do 9 cyfr.
    *   **Maskowanie:** `inputMode="numeric"`. System automatycznie usuwa spacje i myślniki podczas pisania.
    *   **Multi:** Możliwość dodania wielu numerów (Przycisk "+ Dodaj").
*   **E-maile:**
    *   Walidacja: Regex formatu e-mail.
    *   Opcjonalność: Wymagany MINIMUM jeden kontakt (Telefon LUB Email).

### SEKCJA 3: ADRES (Address)
*   **Status:** Otwarta domyślnie (`defaultOpen={true}`).
*   **Pola:** Ulica, Kod Pocztowy (Maska XX-XXX), Miejscowość.
*   **Tab Order:** Po wpisaniu telefonu, `TAB` przenosi do Ulicy.

### SEKCJA 4: DANE OSOBISTE (Personal Data) - **STREFA CHRONIONA**
*   **Status:** Zamknięta domyślnie.
*   **Pola:** PESEL, Data Urodzenia, Płeć.
*   **Logika PESEL:**
    *   Wpisanie poprawnego PESEL automatycznie wypełnia Datę Urodzenia i Płeć.
    *   **ŚWIĘTA ZASADA:** Pole PESEL jest "Local-Only". Nigdy nie jest wysyłane do AI w celu "poprawy" lub "analizy".

### SEKCJA 5: FIRMY (B2B)
*   **Status:** Zamknięta domyślnie.
*   **Funkcja:** "Pobierz z GUS" (ikona Różdżki).
    *   Agent wpisuje NIP.
    *   System (AI + Grounding) pobiera dane z rejestrów publicznych.
    *   **Wynik:** Auto-uzupełnienie Nazwy, Adresu, REGON, KRS.

## 3. Protokół Edycji i Poprawy Danych (AI Assistance)
Moduł posiada wbudowanego Agenta AI (`KaratekaService`), który pomaga w "sprzątaniu" danych, ale działa na **Restrykcyjnych Zasadach**.

### Scenariusz: "Szybki Wrzut"
1. Agent wkleja "brudny" tekst do czatu: *"klient adam nowak gdansk 500100200"*.
2. AI analizuje tekst.
3. AI zwraca JSON z polami: `firstName`, `lastName`, `city`, `phone`.
4. **FILTR BEZPIECZEŃSTWA:** Przed wysłaniem tekstu do AI, kod klienta (`ClientAgent.ts`) skanuje ciąg w poszukiwaniu 11 cyfr (PESEL). Jeśli znajdzie, **MASKUJE JE** (`***********`) przed wysłaniem requestu.

## 4. Walidacja Blokująca (Save Guard)
Przycisk "Zapisz" nie zadziała, jeśli:
1.  Brak Imienia LUB Nazwiska.
2.  Brak jakiegokolwiek kontaktu (Telefon/Email).
3.  PESEL jest wpisany, ale niepoprawny (suma kontrolna).
4.  Kod pocztowy ma zły format.

## 5. UI/UX Detale
- **Focus Ring:** Nagłówki sekcji mają wyraźną ramkę przy nawigacji klawiaturą.
- **Mobile:** Wszystkie pola liczbowe wymuszają klawiaturę numeryczną.
- **Błędy:** Komunikaty błędów pojawiają się bezpośrednio pod polem oraz w globalnym pasku alertów na górze modalu.
