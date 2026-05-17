
# 🧠 AI PARSING RULES & DIRECTIVES (Deep Analysis v2.1)

> **DATA AKTUALIZACJI:** 2026.02.08
> **STATUS:** KRYTYCZNY (Zbiór zasad dla modeli AI przetwarzających dane legacy)

## 1. STRATEGIA PARSOWANIA "DIRTY DATA" (XLSX)

### A. Problem Separatorów
Dane w kolumnie 8 ("CO") są często wprowadzane przez ludzi bez zachowania standardu.
*   `_` (Podłoga) - Standard systemowy.
*   ` ` (Spacja) - Częsty zamiennik.
*   `+` (Plus) - Często oznacza "oraz" lub sklejenie.
*   `/` (Slash) - Często oddziela OC/AC.

**Rozwiązanie:** Parser w `legacyParser.ts` wykonuje najpierw **NORMALIZACJĘ**: zamienia wszystkie dziwne znaki na spacje, a następnie szuka wzorców (Regex).

### B. Hierarchia Wykrywania (Priority Pipeline)
1.  **Sztywna Mapa (`legacy/*.ts`):** Sprawdź, czy cały ciąg jest znany i zmapowany ręcznie. (Dla przypadków beznadziejnych).
2.  **Regex Typu Nieruchomości:** Szukaj słów `dom`, `mieszkanie`. Jeśli znaleziono -> To jest DOM.
3.  **Regex Typu Podróży:** Szukaj słów `podróż`, `wyjazd`. Jeśli znaleziono -> To jest PODRÓŻ.
4.  **Regex Pojazdu (Fallback):** Jeśli powyższe zawiodą, uruchom `parseAutoString`.
    *   Wyszukaj Rejestrację (Format: `GD 12345` lub `W0...`).
    *   Wyszukaj pojemność/rok.
    *   Wszystko co zostanie -> Traktuj jako Markę/Model.

---

## 2. FORMATOWANIE `insuranceItems`
Nie pozwalamy na "ścianę tekstu". Opisy wyposażenia i cech muszą być ustrukturyzowane.

**Format:** `Klucz: Wartość;`

*   ❌ **ŹLE:** "3 miejsca, pakiet do leasingu, manual"
*   ✅ **DOBRZE:** `Miejsca: 3; Skrzynia: Manualna; Status: Leasing;`

---

## 3. LOGIKA PALIWOWA (Tech-to-Fuel Mapping)
AI musi automatycznie wnioskować rodzaj paliwa na podstawie oznaczeń silnika.

*   `TFSI`, `TSI`, `Ecoboost`, `PureTech` ➡️ **BENZYNA**
*   `TDI`, `HDI`, `MJ` (MultiJet), `CDTI`, `D-4D` ➡️ **DIESEL**
*   `M-Hybrid`, `mHEV`, `PHEV`, `miękka hybryda` ➡️ **HYBRYDA**
*   `EV`, `Electric`, `ZE` ➡️ **ELEKTRYK**

---

## 4. OBSŁUGA "NIEZNANYCH MAREK" (G3EF Protocol)
Jeśli rekord zawiera tylko numer rejestracyjny (np. `samochód_G3EF`) i nie da się wywnioskować marki z notatek:

1.  **Marka:** `Nieznana`
2.  **aiNote:** `BRAK DANYCH: Wymagane sprawdzenie w bazie UFG po numerze rejestracyjnym [NR_REJ].`
