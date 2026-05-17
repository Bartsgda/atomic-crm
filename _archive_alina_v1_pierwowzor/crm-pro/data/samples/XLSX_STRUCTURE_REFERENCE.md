
# 📂 WZORZEC DANYCH IMPORTOWYCH (XLSX SOURCE OF TRUTH)

Ten plik służy jako referencja dla parserów. Każda zmiana w logice importu musi być zgodna z tym układem kolumn.

## UKŁAD KOLUMN (0-Based Index)

| ID | Nazwa Kolumny | Przykładowa Wartość (Raw) | Typ Docelowy | Logika Parsowania |
|:---|:---|:---|:---|:---|
| 0 | **Imię i nazwisk** | `Jan Kowalski` | `Client.lastName` | Split po spacji. Pierwszy człon to nazwisko (chyba że firma). |
| 8 | **co** | `dom_Długa 5` | `Policy.type` | **Kluczowa kolumna.** Decyduje o typie. |
| | | `samochód_GD12345` | | |
| | | `przyczepa_GDA222` | | |
| 17 | **stara polisa** | `PZU 123456` | `Policy.oldInsurer` | Szukamy słów kluczowych (PZU, Warta). |
| 19 | **not** | `ubezp pod cesję` | `ClientNote` | Głębszy kontekst (Deep Context). |

## PRZYKŁADY KONFLIKTOWE (EDGE CASES)

### Przypadek 1: Dom mylony z autem
*   **Input (Col 8):** `mieszkanie_Ciechanowska 3B`
*   **Błąd:** Parser aut nie widzi słowa "mieszkanie" i domyślnie ustawia `OSOBOWY`.
*   **Rozwiązanie:** Regex `HOME_TYPE` w `DataMapper` musi być wykonany *przed* `parseAutoString`.

### Przypadek 2: Przyczepa
*   **Input (Col 8):** `przyczepa_GDA25PP`
*   **Rozwiązanie:** Słowo "przyczepa" musi trafić do `TRAILER_MAP` lub zostać wykryte przez regex.

### Przypadek 3: Quad
*   **Input (Col 8):** `pojazd_Quad GKAL82R`
*   **Rozwiązanie:** Słowo "Quad" (case-insensitive) musi nadpisać typ na `QUAD`.
