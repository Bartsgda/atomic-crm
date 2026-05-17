
# Specyfikacja: Rejestr Wypowiedzeń (Terminations Registry)

**Powiązane pliki:**
- `components/Terminations/TerminationsView.tsx`
- `components/TerminationPreview.tsx`
- `components/TerminationFormModal.tsx`

## 1. Cel modułu
Systematyczne zbieranie informacji o wszystkich wysłanych wypowiedzeniach polis OC/AC. Chroni przed automatycznym wznowieniem.

## 2. Model danych (TerminationRecord)
| Pole | Typ | Opis |
|:---|:---|:---|
| `id` | String | Unikalny ID rekordu z prefiksem `wypow_`. |
| `sentAt` | ISO Date | Data i godzina systemowa rejestracji (nieedytowalna). |
| `actualDate` | ISO Date | Data widniejąca na dokumencie (może być inna niż systemowa, edytowalna). |
| `policyId` | UUID | Ścisłe powiązanie 1:1 z ID polisy. |
| `localPath` | String | Ścieżka do pliku na dysku (opcjonalne). |
| `cloudLink` | String | Link do chmury (opcjonalne). |

## 3. Generator PDF (`TerminationPreview`)
- Generuje dokument zgodny z wymogami prawnymi (Art. 28, 28a, 31).
- Pobiera dane adresowe Towarzystwa z pliku `towarzystwa.ts`.
- Obsługuje tryb drukowania (`@media print`).

## 4. Zasady Bezpieczeństwa
- Usunięcie wypowiedzenia z rejestru jest akcją destrukcyjną.
- Wymaga użycia `DeleteSafetyButton` (suwak/potwierdzenie).
- Usunięcie rekordu musi zaktualizować flagę `isTerminationSent` na powiązanej polisie na `false`.
