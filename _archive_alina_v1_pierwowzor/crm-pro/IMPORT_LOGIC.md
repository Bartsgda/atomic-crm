
# 🧠 LOGIKA IMPORTU DANYCH (IMPORT LOGIC CORE)

> **⚠️ WARNING: CODE FREEZE**
> Logika importu w `DataMapper.ts` oraz `legacyParser.ts` jest **KRYTYCZNA i ZATWIERDZONA**.
> Nie wprowadzaj zmian w kolejności warunków `if/else` bez wyraźnego polecenia Operatora.
> Obecny stan obsługuje specyficzne edge-cases (OC Działalności, dom ze znakiem zapytania, literówki w słowie podróż).

## 1. Filozofia "First Word Rule" (Zasada Pierwszego Słowa)
Analiza danych wykazała, że ludzie wprowadzający dane w Excelu najczęściej zaczynają wpis od kategorii, ale często dodają "szum".

**Algorytm czyszczenia prefiksu:**
1. Pobierz ciąg do pierwszego separatora (`_` lub spacja).
2. Usuń znaki specjalne (`?`, `.`, `,`).
3. Zamień na małe litery.
   *   `dom?` -> `dom`
   *   `Samochód_` -> `samochód`
   *   `OC...` -> `oc`

## 2. Priorytetyzacja (Pipeline Wykrywania)

System sprawdza warunki w ściśle określonej kolejności. Jeśli warunek jest spełniony, reszta jest pomijana.

### KROK 0: Hardcoded Legacy Map (Absolutny Priorytet)
Przed uruchomieniem jakiejkolwiek logiki, sprawdzamy czy CAŁY ciąg tekstowy znajduje się w słownikach `crm-pro/data/legacy/*.ts`.
*   **Dlaczego:** Niektóre wpisy są nielogiczne dla maszyny (np. "firma_przyczepa" to technicznie przyczepa, ale biznesowo majątek firmowy). Mapa ręczna nadpisuje wszystko.
*   **Obsługa Notatek:** Jeśli wpis w mapie posiada `aiNote`, jest on dodawany do notatki klienta.

### KROK 1: Nieruchomości (DOM)
*   **Słowa klucze:** `dom`, `mieszkanie`, `lokal`, `budowa`, `majątek`.
*   **Dlaczego:** Te słowa są jednoznaczne. Jeśli ciąg zaczyna się od "mieszkanie", to na 100% nie jest to samochód.

### KROK 2: Podróże
*   **Słowa klucze:** `podróż`, `podroz` (literówki), `wyjazd`, `turyst`.
*   **Dlaczego:** Specyficzny produkt, łatwy do wyizolowania.

### KROK 3: Firma (Jako Kategoria)
*   **Słowa klucze:** `firma`, `biznes`, `ocpd`, `flota`.
*   **Dlaczego:** Oddzielamy klienta biznesowego od indywidualnego.

### KROK 4: Pułapka "OC" (The Bifurcation)
To najbardziej skomplikowany punkt. Prefiks `OC` jest dwuznaczny.
*   **Analiza:** System sprawdza, co występuje PO słowie `OC`.
    *   Jeśli znajdzie: `działalno`, `przedsiębiorc`, `zawodow`, `lekarz`, `spedytor` -> Kategoria **FIRMA**.
    *   W przeciwnym razie -> Kategoria **AUTO** (OC Komunikacyjne).

### KROK 5: Życie
*   **Słowa klucze:** `życie`, `nnw`, `zdrowie`.

### KROK 6: Pojazdy (Fallback / Domyślne)
Jeśli żaden z powyższych warunków nie został spełniony, system zakłada, że jest to **POJAZD**.
*   **Dlaczego:** Agenci często wpisują samą markę ("Toyota Yaris") lub numer rejestracyjny ("GD12345") bez prefiksu "samochód".
*   **Podtypy:** W tym kroku sprawdzamy dodatkowo czy to nie jest `ciężarowy`, `motocykl`, `przyczepa` lub `quad` (analiza treści).

## 3. Parsowanie Detali (Deep Context)
Niezależnie od kategorii, system zawsze uruchamia `parseAutoString` (dla aut) lub `parseHomeString` (dla domów), aby wyciągnąć dane techniczne (pojemność, rok, metraż) z głównego ciągu znaków.

---
*Dokumentacja zgodna ze stanem kodu na dzień: 2026-02-08 (v6.2)*
