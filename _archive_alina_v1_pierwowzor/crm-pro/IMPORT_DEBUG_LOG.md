
# 🐛 RAPORT DIAGNOSTYCZNY IMPORTU (v6.1)

**Status:** KRYTYCZNY BŁĄD KLASYFIKACJI
**Objawy:** Rekordy nieruchomości ("dom_", "mieszkanie_") trafiają do sekcji "Pojazdy".

## 1. Analiza Przyczyny (Root Cause Analysis)
Funkcja `parseAutoString` w pliku `legacyParser.ts` posiadała zbyt agresywny fallback:

```typescript
// STARY KOD (BŁĘDNY):
else result.autoDetails.vehicleType = 'OSOBOWY'; 
// ^ To sprawiało, że każdy string niepasujący do ciężarówki/motocykla stawał się osobówką.
// Ponieważ "dom_Długa" nie jest ciężarówką, system uznawał go za auto osobowe.
```

## 2. Wdrożone Rozwiązanie (Fix)

### A. Zmiana w `legacyParser.ts`
Usunięto domyślne przypisanie `OSOBOWY`. Jeśli parser nie znajdzie słów kluczowych pojazdu, zwraca `undefined`.

### B. Zmiana Priorytetów w `DataMapper.ts`
Zmieniono kolejność warunków `if/else`.
1.  **Legacy Map** (Sztywne definicje z plików `trailer.ts`, `quad.ts`).
2.  **Nieruchomości** (Regex: `dom`, `mieszkanie`, `ul.`).
3.  **Podróże** (Regex: `podróż`, `turyst`).
4.  **Pojazdy** (Dopiero teraz uruchamiamy `parseAutoString`).

## 3. Weryfikacja (Test Case)
*   **Input:** `dom_Płocka 60`
*   **Stara logika:** Brak mapy -> Regex Dom (może pominięty) -> Parser Auta -> Brak cech ciężarówki -> OSOBOWY -> BŁĄD.
*   **Nowa logika:** Brak mapy -> Regex Dom (Priorytet) -> TYP: DOM -> SUKCES.
