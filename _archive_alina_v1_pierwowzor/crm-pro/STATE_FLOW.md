
# 🔄 Obieg Polisy i Spójność Stanów (State Flow Architecture)

## 1. Filozofia "Everything is an Event"
Każda kluczowa zmiana w systemie (szczególnie zmiana etapu lejka sprzedażowego) musi zostawić trwały ślad w historii klienta (Notatki). Dzięki temu budujemy liniową narrację pracy nad polisą, niezależnie od tego, z jakiego miejsca w systemie dokonano zmiany.

## 2. Punkty Wejścia (Entry Points) i Zachowanie

### A. Tablica Ofert (Kanban)
*   **Akcja:** Przeciągnięcie karty (Drag & Drop).
*   **Logika:** Wykrywa zmianę kolumny.
*   **Skutek:** Generuje notatkę `[SYSTEM] Zmiana etapu: Stary -> Nowy`.
*   **Bezpiecznik:** Anti-Bounce (ignoruje zmiany częstsze niż 60s, np. przy pomyłkowym upuszczeniu).

### B. Formularz Polisy (Modal) - **[ZAKTUALIZOWANO v6.8]**
*   **Akcja:** Kliknięcie "Zapisz".
*   **Logika (Audit):** Porównuje `initialPolicy.stage` z `currentStage`.
*   **Work Tracking:** Mierzy czas otwarcia okna.
*   **Skutek:** 
    *   Jeśli zmieniono status -> Generuje notatkę `[SYSTEM] Zmiana etapu...`.
    *   Zawsze: Rejestruje "Sesję pracy" w logach systemowych (niewidoczne dla klienta, widoczne w Audit Logu).

### C. Szybkie Akcje (Panel Klienta)
*   **Akcja:** Kliknięcie przycisku nad notatką (np. "OK", "W TOKU", "ODRZUT").
*   **Logika:** Jawna intencja użytkownika.
*   **Skutek:** Generuje notatkę z tagiem (np. `[ST: OK]`) ORAZ wymusza update polisy w tle.

## 3. Matryca Stanów (Stage Matrix)

| Status Systemowy | Etykieta UI | Znaczenie Biznesowe |
|:---|:---|:---|
| `of_do zrobienia` | **Do Zrobienia** | Lead wpadł, trzeba się zająć. |
| `przeł kontakt` | **W Toku / Kalkulacja** | Praca trwa. Negocjacje. |
| `czekam na dane` | **Czekam na Dane** | Piłeczka po stronie klienta (zdjęcia, dowód). |
| `oferta_wysłana` | **Oferta Wysłana** | Czekamy na decyzję. |
| `sprzedaż` | **Sprzedaż** | Sukces. Polisa aktywna. |
| `ucięty kontakt` | **Odrzucone** | Klient wybrał konkurencję lub zrezygnował. |
| `rez po ofercie` | **Chłodnia** | "Zadzwoń za rok". |

## 4. Przyszłość: Event Sourcing (Snapshots)
W przyszłych wersjach (Backend), zamiast nadpisywać obiekt `Policy`, będziemy zapisywać zdarzenia (`PolicyCreated`, `StageChanged`, `PremiumUpdated`). Pozwoli to na odtworzenie stanu polisy z dowolnego momentu w czasie (Time Travel).
Obecnie (Local-First) symulujemy to poprzez bogatą historię notatek `[SYSTEM]`.
