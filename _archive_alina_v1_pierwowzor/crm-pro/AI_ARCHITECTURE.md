
# 🧠 AI Architecture & Brain Core (v2.0)

> **Filozofia:** AI nie jest tylko chatbotem. Jest administratorem bazy danych z interfejsem naturalnym.
> **Tryb Pracy:** "Direct DB Manipulation" (Bezpośrednia operacja na JSON).

## 1. Struktura Katalogów (`/crm-pro/ai/`)

```text
/ai
├── prompts/              # Pliki tekstowe z instrukcjami (System Prompts)
│   ├── MASTER_PLANNER.md # Główny mózg - decyduje co zrobić
│   └── FIELD_MAPPER.md   # Jak mapować "Mazda" -> vehicleBrand
├── agents/               # Specjaliści (Logika)
│   ├── ClientAgent.ts    # Parsowanie danych osobowych
│   └── PolicyAgent.ts    # Parsowanie danych pojazdów/nieruchomości
├── core/                 # Silnik wykonawczy
│   └── ActionExecutor.ts # (W planach) Wykonywanie sekwencji na Storage
├── KaratekaService.ts    # API Facade (Punkt wejścia dla UI)
└── KaratekaTypes.ts      # Definicje typów JSON
```

## 2. Przepływ Sterowania (The Flow)

1.  **Input:** "Dodaj Jana Nowaka i ofertę na Mazdę CX-5"
2.  **Planowanie (LLM):** Model generuje **Plan Transakcyjny** (JSON Array).
    ```json
    {
      "plan": [
        { "op": "CREATE_CLIENT", "id": "temp_c1", "data": { "lastName": "Nowak", ... } },
        { "op": "CREATE_POLICY", "id": "temp_p1", "clientId": "temp_c1", "data": { "brand": "Mazda", ... } },
        { "op": "NAVIGATE", "target": "client-details", "contextId": "temp_c1" }
      ]
    }
    ```
3.  **Egzekucja (App/Window):**
    *   System iteruje po planie.
    *   Podmienia tymczasowe ID (`temp_c1`) na prawdziwe UUID z bazy.
    *   Wykonuje operacje na `storage`.
    *   Loguje postęp w konsoli.

## 3. Uprawnienia Agenta
Agent ma prawo do:
*   `storage.addClient()`
*   `storage.addPolicy()`
*   `storage.addNote()`
*   `storage.update...()`

## 4. Pamięć Kontekstowa
Agent musi wiedzieć, na czym "stoi".
*   Jeśli otwarta jest polisa -> Kontekst to Polisa.
*   Jeśli otwarty jest klient -> Kontekst to Klient.
*   Jeśli User pisze "zmień to" -> AI wie co to jest "to".

---
*Status: Wdrożono podstawowy Executor w KaratekaService.*
