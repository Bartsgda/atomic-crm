
# 📜 SUPREME RULES (Zasady Nadrzędne Systemu)

> **STATUS:** OBOWIĄZUJĄCE PRAWO (ENFORCED LAW)
> **CEL:** Spójność, szybkość wprowadzania danych (Mobile First) i zero irytacji użytkownika.

---

## 1. 🔢 PRAWO CYFR I WALUT (Universal Number Input Law)

Każde pole, które przyjmuje wartości liczbowe, MUSI wymuszać odpowiednią klawiaturę na urządzeniach mobilnych ORAZ ułatwiać nadpisywanie domyślnych zer.

### A. Pola Finansowe (Kwoty, Prowizje)
*   **Zastosowanie:** `premium`, `commission`, `sumInsured`.
*   **Wymagany Atrybut:** `inputMode="decimal"`
*   **Typ:** `type="number"`
*   **Krok:** `step="0.01"`
*   **Zachowanie Focus:** `onFocus={(e) => e.target.select()}`
*   **Zachowanie Klawiatury:** Klawiatura numeryczna z kropką/przecinkiem.

### B. Pola Identyfikacyjne (NIP, PESEL, Telefon, Kod Pocztowy)
*   **Zastosowanie:** `pesel`, `nip`, `regon`, `zipCode`, `phone`.
*   **Wymagany Atrybut:** `inputMode="numeric"`
*   **Typ:** `type="text"` (aby zachować zera wiodące i formatowanie myślnikami) lub `type="tel"`.
*   **Zachowanie:** Klawiatura numeryczna (0-9).

---

## 2. 📅 PRAWO DATY (One-Tap Calendar Law)

Użytkownik nie ma czasu celować w małą ikonkę kalendarza. Kliknięcie w CAŁE pole musi otwierać kalendarz.

*   **Zastosowanie:** `birthDate`, `policyStartDate`, `policyEndDate`, `nextContactDate`.
*   **Wymagany Handler:** `onClick={(e) => e.currentTarget.showPicker()}`
*   **Typ:** `type="date"`
*   **Efekt:** Dotknięcie pola tekstowego natychmiast wyzwala natywny picker daty systemu (iOS/Android).

---

## 3. 📏 PRAWO KOMPAKTOWOŚCI (Zero Scroll Law)

Elementy operacyjne (Checklisty, Tagi, Statusy) wewnątrz formularzy NIE MOGĄ wymuszać scrollowania całej strony.

*   **Zastosowanie:** Moduły Compliance, Wybór Ryzyk, Tagi Notatek.
*   **Rozwiązanie:** Stosuj układ horyzontalny (`flex-wrap`) i małe elementy typu "Chips/Pills" zamiast pionowych list checkboxów czy wielkich kart.
*   **Cel:** Agent musi widzieć formularz, kluczowe dane i checklistę na jednym ekranie bez zbędnego przewijania.

---

## 4. Protokół "Documentation First"
Każda zmiana w kodzie musi być poprzedzona aktualizacją odpowiedniego pliku specyfikacji (`_SPEC.md`).
- **NIE WOLNO** dotykać kodu `.tsx` bez uprzedniego przeczytania i zaktualizowania pliku `.md`.

## 5. Mapa Specyfikacji (Module -> Spec)
| Moduł (.tsx) | Plik Wymagań (.md) | Odpowiedzialność |
|:---|:---|:---|
| `ClientsList`, `ClientFormModal` | **`CLIENTS_SPEC.md`** | Dane osobowe, walidacja, B2B. |
| `PolicyFormModal`, `Dashboard` | **`POLICIES_SPEC.md`** | Cykl życia polisy, finanse (zgodne z Prawem nr 1). |
| `OffersBoard` | **`OFFERS_SPEC.md`** | Kanban, statusy ofertowe. |
| `TerminationsView` | **`components/Terminations/TERMINATIONS_SPEC.md`** | Rejestr wypowiedzeń. |
| `CalendarView` | **`CALENDAR_SPEC.md`** | Terminarz. |
| `Notatki` | **`NOTES_SPEC.md`** | Oś czasu, tagi. |
| `ComplianceChecklist` | **`CHECKLIST_SPECS.md`** | Szablony list kontrolnych. |

## 6. Żelazne Zasady Walidacji
1. **Klient:** Musi posiadać Imię, Nazwisko oraz MINIMUM jeden kanał kontaktu (Telefon 9 cyfr LUB Email).
2. **Polisa (Sprzedaż):** Musi posiadać Numer Polisy i Składkę > 0.
3. **Usuwanie:** Każda akcja destrukcyjna musi być chroniona przez `DeleteSafetyButton`.

## 7. Architektura Danych
- System działa w trybie **Local-First** (`localStorage`).
- ID są generowane jako UUID lub timestampowe stringi unikalne.
