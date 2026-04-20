
# 🥋 AI CRM MASTERPLAN (Agent Karateka v2.0)

> **Status:** WERSJA ROBOCZA / IMPLEMENTACJA
> **Cel:** Przekształcenie pasywnego formularza w aktywnego Asystenta Globalnego, który "widzi" cały system.

---

## 1. Architektura "Globalnego Mózgu"

Agent Karateka wychodzi z modalu polisy. Staje się bytem nadrzędnym (Floating Window) dostępnym w `App.tsx`.

### Struktura Plików (Refaktoryzacja)
*   `/ai/KaratekaService.ts` -> **Orkiestrator**. Decyduje, którego agenta specjalistycznego użyć.
*   `/ai/agents/ClientAgent.ts` -> **Specjalista ds. Ludzi**. Parsuje luźne ciągi ("Jan Nowak 500100200") na obiekt `Client`.
*   `/ai/agents/PolicyAgent.ts` -> **Specjalista ds. Produktów**. Analizuje skany, Excel-stringi i dobiera parametry pojazdu.
*   `/ai/agents/ScheduleAgent.ts` -> **Specjalista ds. Czasu**. Oblicza daty relatywne ("za 3 dni", "przed świętami").

---

## 2. Zasady Promptowania i Danych (Strict Rules)

Aby AI skutecznie wypełniało formularze, musimy nadać polom unikalne, semantyczne ID i mapować je w promptach.

### A. Formularz Klienta (`ClientAgent`)
AI musi rozumieć intencję "Dodaj klienta".
*   **Prompt Input:** "dodaj klienta Jan Kowalski 45454543, oferta pojazd Nissan Quaszkaj CWL2945 2009r. 1,5, przeb 68k, szyby, AC OC"
*   **Oczekiwany Output (JSON):**
    ```json
    {
      "action": "CREATE_CLIENT_WITH_POLICY",
      "clientData": {
        "firstName": "Jan",
        "lastName": "Kowalski",
        "phones": ["45454543"]
      },
      "policyData": {
        "type": "BOTH", // AC OC
        "vehicleBrand": "Nissan Qashqai",
        "vehicleReg": "CWL2945",
        "autoDetails": {
           "productionYear": "2009",
           "engineCapacity": "1500",
           "mileage": 68000,
           "windows": true
        }
      }
    }
    ```

### B. Obsługa Czasu (Naprawa)
AI **NIE MA** obliczać konkretnych dat (np. "24.01.2026"). AI ma zwracać **offset** (przesunięcie).
*   User: "zadzwoń za 3 dni"
*   AI Output: `{ "reminderOffset": 3 }`
*   System (JS): `addDays(new Date(), 3)` -> To gwarantuje poprawność kalendarza.

---

## 3. Protokół Audytu (Naprawa "Znikających Uwag")

Problem: Użytkownik robi analizę (13 poprawek), potem pisze na czacie. Przy zapisie, notatka zawiera tylko czat.
**Rozwiązanie:** `AuditBuffer`.
1.  Analiza statyczna (kliknięcie przycisku) -> Zapis wyniku do `useRef<string>`.
2.  Czat z AI -> Dopisanie do `chatLog`.
3.  **ZAPIS:** `FinalNote = AuditBuffer + ChatLog`.

---

## 4. Zadania do Wykonania (To-Do)

### Faza 1: Fundamenty (ZROBIONE)
- [x] Utworzenie `ClientAgent.ts`.
- [x] Separacja logiki dat (Offset zamiast Date String).
- [x] Globalne okno Agenta w prawym dolnym rogu.

### Faza 2: Integracja UI (W TOKU)
- [ ] Podpięcie Agenta pod formularz klienta (`ClientFormModal`).
- [ ] Nauczenie Agenta struktury pól formularza klienta (adres, pesel, zgody).
- [ ] Testowanie scenariusza "Szybki Wrzut": Notatka -> Utworzenie Klienta -> Utworzenie Oferty.

### Faza 3: Zaawansowane (PLAN)
- [ ] Analiza kontekstu: Agent widzi, że użytkownik jest w zakładce "Wypowiedzenia" i sugeruje odpowiednie akcje.
