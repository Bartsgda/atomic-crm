
# 🧠 RAPORT STANU AI: KRYZYS "EDYCJA FORMULARZY" (Merge Challenge)

**Data Raportu:** Piątek, 02:00
**Status:** 🔴 REGRESJA KRYTYCZNA (Funkcja "Napraw z AI" przestała działać wizualnie)

---

## 1. DIAGNOZA SYTUACJI (01:05 vs TERAZ)

### Stan o 22:00 - 01:05 (Działało)
*   **Zachowanie:** Kliknięcie "Napraw" wysyłało dane do AI.
*   **Efekt:** Formularz "świecił się" na fioletowo/zielono. Pola wypełniały się automatycznie.
*   **Mechanizm:** Prawdopodobnie opierał się na prostej, płaskiej strukturze danych (bez zagnieżdżeń `autoDetails`) lub starszej wersji `App.tsx`, która "siłowo" wpychała wartości do inputów.

### Stan OBECNY (Nie działa)
*   **Zachowanie:** Czat działa, AI odpisuje "Zaktualizowałem dane", ale... **formularz pozostaje pusty/stary**.
*   **Przyczyna Techniczna (Schema Mismatch):**
    *   Wprowadziliśmy zagnieżdżony obiekt `autoDetails` (dla silnika, mocy, rocznika).
    *   AI (Prompt) nadal zwraca płaskie dane lub `App.tsx` nie umie zrobić "Deep Merge" (głębokiego scalenia) zagnieżdżonego obiektu.
    *   **Utrata "Visual Diff":** Mechanizm podświetlania zmian (`aiDiffs`) został odłączony od nowego modelu danych.

---

## 2. WYZWANIE NA PIĄTEK/SOBOTĘ: SCALENIE DWÓCH PROGRAMÓW

Musimy połączyć **"Starą Inteligencję UI"** (kolorki, działające inputy) z **"Nową Strukturą Danych"** (autoDetails, lepsze typowanie).

### CEL: "One Brain, Complex Body"

1.  **Przywrócenie "Zmysłów" (Visual Feedback):**
    *   Formularz `PolicyFormModal` musi ponownie przyjmować prop `aiDiffs`.
    *   Każdy `KaratekaInput` musi wiedzieć, że jeśli AI zmieniło `autoDetails.engineCapacity`, to on (będąc głęboko w strukturze) ma się zaświecić na fioletowo.

2.  **Naprawa Mostu (App.tsx Logic):**
    *   Funkcja `handleAgentAction` w `App.tsx` jest "wąskim gardłem".
    *   Obecnie: Nadpisuje obiekt polisy "na ślepo".
    *   Wymagane: Musi inteligentnie scalać: `Stara Polisa` + `Sugestie AI` = `Nowa Polisa` + `Mapa Zmian (Diffs)`.

3.  **Prompt Engineering (KaratekaService):**
    *   AI musi zwracać JSON idealnie pasujący do TypeScripta.
    *   Jeśli formularz ma pole `autoDetails.windows`, AI musi zwrócić obiekt `{ autoDetails: { windows: true } }`, a nie płaskie `{ windows: true }`.

---

## 3. PLAN DZIAŁANIA (KROK PO KROKU)

### Krok A: Analiza Wsteczna (Backup 22:00)
1.  Otworzyć kod z godziny 22:00.
2.  Skopiować logikę `highlight` (podświetlania).
3.  Zobaczyć, jak mapowane były pola (czy były płaskie?).

### Krok B: Implementacja "Deep Diff"
Stworzenie funkcji użytkowej w `App.tsx`, która:
1.  Bierze stary obiekt polisy.
2.  Bierze propozycję AI.
3.  Zwraca **TYLKO RÓŻNICE** (Diff Map), które `PolicyFormModal` wykorzysta do kolorowania pól.

### Krok C: Test "Na Żywym Organizmie"
1.  Wkleić tekst: *"Audi A4 2.0 TDI 2015 przebieg 180k, szyby, opony"*.
2.  Oczekiwać:
    *   Marka: Audi (Fiolet)
    *   Model: A4 (Fiolet)
    *   Pojemność: 2000 (Fiolet)
    *   Paliwo: Diesel (Fiolet)
    *   Checkbox Szyby: Zaznaczony (Zielony)

---

> **NOTATKA DLA ARCHITEKTA:** Nie panikować. To klasyczny problem migracji struktury danych. Logika jest dobra, tylko "hydraulika" (przesył danych) między Czat a Formularzem przecieka na zagnieżdżeniach.
