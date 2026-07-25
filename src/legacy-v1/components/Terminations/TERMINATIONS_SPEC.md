
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
| `reason` | `'koniec_okresu' \| 'zbycie_pojazdu' \| 'podwojne_oc' \| 'inne'` | ⭐ **2026-07-25.** Powód wypowiedzenia, wybierany w `TerminationFormModal.tsx`. Brak = stare rekordy sprzed tej zmiany. |
| `saleDate` | ISO Date | ⭐ **2026-07-25.** Data sprzedaży pojazdu — wypełniane WYŁĄCZNIE gdy `reason === 'zbycie_pojazdu'`. Tylko lokalnie/w stanie, zob. § 6. |

## 3. Formularz (`TerminationFormModal.tsx`) — powód i zbycie pojazdu (2026-07-25)

Dropdown „Podstawa / Powód" (4 opcje, `TerminationReason`): koniec okresu (Art. 28) · zbycie pojazdu — sprzedaż auta (Art. 31) · podwójne OC (Art. 28a) · inne. Wybór **automatycznie ustawia `Policy.terminationBasis`** (mapowanie w `terminationBasisFromReason()`, eksportowane z `TerminationFormModal.tsx` — jedyne źródło prawdy, używane przez WSZYSTKICH wołających `onConfirm`) — pierwsze realne miejsce w aplikacji, gdzie to pole faktycznie się zmienia (wcześniej zawsze domyślne Art. 28 z importu/tworzenia polisy, nigdy nieedytowalne).

### A. „Zbycie pojazdu" — dodatkowe pola (warunkowe)
Gdy wybrany powód to `zbycie_pojazdu`, formularz pokazuje dodatkowo:
- **Data sprzedaży auta** (`saleDate`, `type=date`).
- **Skorygowana prowizja (PLN)** — pole ręczne (**decyzja Bartka, twarda**: Alina wpisuje prawdziwą kwotę z rozliczenia towarzystwa), ale program podpowiada wartość startową z proporcji: `commission * (dni od policyStartDate do saleDate) / (dni od policyStartDate do policyEndDate)`, zaokrąglone do 2 miejsc, clamp do `[0, commission]`. Przelicza się na żywo przy zmianie daty sprzedaży, dopóki Alina nie wpisze własnej wartości ręcznie (wtedy przestaje nadpisywać). Brak `commission`/dat → sugestia `0`/puste (nie wywala błędu).

### B. Payload `onConfirm` (breaking change 2026-07-25)
`onConfirm` zmieniony z `(actualDate: string) => void` na `(payload: TerminationConfirmPayload) => void`, gdzie `TerminationConfirmPayload = { actualDate, reason, saleDate?, commissionCorrection? }` (`saleDate`/`commissionCorrection` tylko gdy `reason === 'zbycie_pojazdu'`). **Dwa wołające** (oba zaktualizowane): `ClientDetails.tsx` → `handleRegisterTermination` (przycisk akcji na karcie polisy) i `PolicyFormModal.tsx` → `handleTerminationConfirm` (przycisk „Wypowiedzenie"/„Zgłoś Zbycie" w `ReadOnlyView` — WCZEŚNIEJ był to pusty stub, który tylko zamykał modale bez żadnej rejestracji; teraz w pełni funkcjonalny, lustrzane odbicie logiki z `ClientDetails.tsx`).

## 4. Auto-status i korekta prowizji przy zbyciu pojazdu (2026-07-25, decyzje Bartka — twarde)

Po zatwierdzeniu formularza z powodem `zbycie_pojazdu`, na powiązanej polisie (przez `onUpdatePolicy`/`onSave`, w zależności od wołającego):
- `stage` ustawiane na **`'sprzedany'`** (auto zbyte — zob. `POLICIES_SPEC.md § 7`, `isRenewable`: taka polisa **znika z propozycji wznowień**, ale nadal liczy się jako sprzedana w finansach — `isSold` bez zmian).
- `commissionCorrection` ustawiane na wartość z formularza (`Policy.commissionCorrection`, opcjonalne — `undefined`/`null` = brak korekty, liczy się pełna `commission`).
- `terminationBasis` ustawiane na `ART_31` (zawsze, niezależnie od reason — zob. § 3).

**Dla pozostałych powodów** (`koniec_okresu`/`podwojne_oc`/`inne`): `stage` **bez zmian** — zachowanie identyczne jak przed 2026-07-25 (tylko `isTerminationSent=true` + `terminationId` + rejestracja w `terminations`). Jedyna różnica: `terminationBasis` teraz też zawsze synchronizowane z wybranym powodem (art. 28/28a/other).

## 5. Finanse — `effectiveCommission` (2026-07-25)

Wszędzie, gdzie liczona jest suma prowizji AGENTA (nie pośrednika/partnera — to osobna, niezależna pula, zob. `CLAUDE.md § Model prowizji`) dla sprzedanych polis, użyty jest wzorzec `p.commissionCorrection ?? p.commission` zamiast gołego `p.commission`:
- `Dashboard.tsx` → `stats.totalCommission` (nagłówek Pulpitu).
- `components/Finance/FinanceView.tsx` → `agentPart`/`incomeNet`/`revenueGross` (miesięczny raport). `costPartners`/`subAgentCommission`/`subAgentSplits` (pula pośrednika) — **bez zmian**, korekta dotyczy WYŁĄCZNIE prowizji agenta.
- `components/SubAgents/SubAgentsView.tsx` — sprawdzone: `p.commission` używane tam tylko jako kryterium filtra „ukryj polisy blisko zera" (`hideZeroPremium`), NIE jako suma finansowa (realna suma per-pośrednik liczy się z `p.subAgentSplits[].amount`, zupełnie inne pole) — **celowo nietknięte**.

## 6. Persystencja Supabase (`services/supabaseStorage.ts`)

- **`terminations` tabela** (`addTerminationRecord`/`rowToTermination`): kolumna `article` (istniała już wcześniej, była zawsze hardcoded `'28'`) **reużyta** — teraz zapisuje realny kod wg powodu (`art28`/`art28a`/`art31`/`other`, zob. `reasonToArticleCode()`/`articleCodeToReason()`) i jest odczytywana z powrotem jako `TerminationRecord.reason` przy reloadzie. Zero zmian schematu DB.
- **`saleDate` i `Policy.commissionCorrection` — TYLKO lokalnie/w stanie sesji, NIE persystowane do Supabase** (brak kolumn `sale_date`/`commission_correction`, wymagałoby migracji poza zakresem tej zmiany). To ten sam, wcześniej istniejący gap co `Policy.isTerminationSent`/`terminationId`/`terminationBasis` — żadne z nich nie ma mapowania w `policyToRow`/`rowToPolicy`, więc też nie przetrwają odświeżenia strony/relogowania. Local-first `services/storage.ts` (`StorageManager`, nieużywany w runtime ale utrzymywany dla parytetu) persystuje WSZYSTKO — to zwykły JSON, bez mapowania kolumn.

## 7. Generator PDF (`TerminationPreview.tsx`)
- Generuje dokument zgodny z wymogami prawnymi (Art. 28, 28a, 31) — czyta `policy.terminationBasis`, które od 2026-07-25 jest faktycznie ustawiane (zob. § 3). **Kod `TerminationPreview.tsx` nie wymagał zmian** — mechanizm wyboru artykułu już istniał, tylko nikt wcześniej nie ustawiał `terminationBasis` inaczej niż domyślne Art. 28.
- Pobiera dane adresowe Towarzystwa z pliku `towarzystwa.ts`.
- Obsługuje tryb drukowania (`@media print`).

## 8. Zasady Bezpieczeństwa
- Usunięcie wypowiedzenia z rejestru jest akcją destrukcyjną.
- Wymaga użycia `DeleteSafetyButton` (suwak/potwierdzenie).
- Usunięcie rekordu musi zaktualizować flagę `isTerminationSent` na powiązanej polisie na `false`.
