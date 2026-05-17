
# Specyfikacja: Notatki i Oś Czasu (Notes Module v2.2)

**Powiązane pliki:**
- `components/Notatki.tsx`
- `components/ClientDetails.tsx` (Parent)
- `components/NoteTagRenderer.tsx`
- `components/Dashboard.tsx`

## 1. Definicja Notatki
Notatka to podstawowa jednostka interakcji z klientem.
- **Pola**: `content`, `tag`, `reminderDate`, `linkedPolicyIds` (tablica powiązań), `history` (edycje).

## 2. Context Awareness (Świadomość Kontekstu)
Komponent notatek w `ClientDetails` jest świadomy tego, co robi użytkownik.
- **Active Policy ID:** Jeśli użytkownik kliknął w kartę polisy (filtrowanie), ID tej polisy jest przekazywane do komponentu notatek.
- **Auto-Linking:** Każda nowa notatka utworzona w tym trybie automatycznie otrzymuje `linkedPolicyIds` ustawione na wybraną polisę, nawet jeśli użytkownik nie użyje hashtaga `#`.

## 3. Smart Tags & Automation (Szybki Status)
Nad edytorem znajdują się przyciski szybkich akcji (`handleQuickStatus`), które wykonują podwójną pracę: dodają notatkę i aktualizują status polisy.

| Przycisk | Tag | Treść (Prefix) | Skutek w Polisie (`stage`) |
|:---|:---|:---|:---|
| **OK** | `STATUS` | `[ST: OK]` | `sprzedaż` (Sukces) |
| **W TOKU** | `ROZMOWA` | `[ST: W TOKU]` | `przeł kontakt` |
| **ODRZUT** | `DECISION_OFFER` | `Odrzuca...` | `ucięty kontakt` |

## 4. Cross-Linking (Hashtagi - Manual)
- Użytkownik może wpisać `#` w treści notatki.
- System wyświetla listę podpowiedzi (Polisy klienta: `#Audi_A4`, `#Dom_Długa`).
- Wybranie obiektu dodaje jego ID do `linkedPolicyIds`.

## 5. Wygląd i UX (Clean View Protocol)
- **Formatowanie:** Tekst notatki obsługuje proste tagi renderowane jako kolorowe "pastylki" (`NoteTagRenderer`).
- **Filtr Popover (Dashboard/Kanban):** Dymki podglądu (Hover) **MUSZĄ** ukrywać notatki techniczne (`[SYSTEM]`, `AUDYT`, `STATUS`), pokazując tylko wpisy ręczne Agenta.
- **Filtr Listy (Clients List):** Kolumna "Ostatnia notatka" w tabeli klientów również pomija logi systemowe, prezentując ostatnią merytoryczną interakcję.
