
# System Requirements: Insurance Master CRM Pro (Hub)

> **UWAGA:** Ten plik jest spisem treści (Index). Szczegółowe wymagania zostały przeniesione do dedykowanych plików SPEC dla każdego modułu.

## 🗂️ Mapa Specyfikacji

1. **Klient i Kontakty:** Zobacz **[`CLIENTS_SPEC.md`](./CLIENTS_SPEC.md)**
   - Formularz klienta, walidacja, B2B.

2. **Polisy i Dashboard:** Zobacz **[`POLICIES_SPEC.md`](./POLICIES_SPEC.md)**
   - Cykl życia produktu, statusy, raty, asset intelligence.

3. **Oferty (Kanban):** Zobacz **[`OFFERS_SPEC.md`](./OFFERS_SPEC.md)**
   - Proces ofertowania, widok tablicy, celebracje.

4. **Wypowiedzenia:** Zobacz **[`components/Terminations/TERMINATIONS_SPEC.md`](./components/Terminations/TERMINATIONS_SPEC.md)**
   - Rejestr, generowanie PDF, powiązania.

5. **Notatki i Oś Czasu:** Zobacz **[`NOTES_SPEC.md`](./NOTES_SPEC.md)**
   - Tagowanie, powiązania (hashtagi), historia.

6. **Kalendarz:** Zobacz **[`CALENDAR_SPEC.md`](./CALENDAR_SPEC.md)**
   - Agregacja zdarzeń, widoki czasu.

7. **Checklisty Compliance:** Zobacz **[`CHECKLIST_SPECS.md`](./CHECKLIST_SPECS.md)**
   - Wymogi RODO/APK, edytor szablonów.

---

## 📜 ZASADY WIZUALNE (VISUAL LAWS) - NIEZMIENNE

### 1. Struktura Checklist (Compliance) - **ZMIANA v4.7**
- **Zasada "Compact First":** Checklisty NIE MOGĄ zajmować dużej powierzchni. Stosujemy **Chips/Pills** (małe pigułki) ułożone obok siebie (flex-wrap).
- **Kategoryzacja Kolorystyczna:** 
    - Sekcja Krytyczna (Wymagane) = Akcenty Czerwone.
    - Sekcja Opcjonalna = Akcenty Szare/Neutralne.
- **Edytowalność:** UI musi zawierać przycisk (Settings/Gear) pozwalający Agentowi na definicję własnych wymagań w locie (modal-in-modal lub expand).

### 2. Formularze Mobilne
- **Klawiatura:** Pola liczbowe (PLN, PESEL, Telefon) muszą wymuszać klawiaturę numeryczną (`inputMode="decimal"` / `"numeric"`).
- **Daty:** Kliknięcie w pole daty otwiera natywny kalendarz systemowy (`showPicker()`).

---

## Główne Założenia Architektoniczne

### 1. Architektura Danych
- **Clients**: Dane osobowe (Klucz: ID).
- **Policies**: Portfel ubezpieczeniowy (Relacja 1:N).
- **Notes**: Oś czasu kontaktów.
- **Templates**: Konfiguracja checklist użytkownika.

### 2. Bezpieczeństwo
- Dane przechowywane lokalnie (`localStorage`).
- Zakaz wysyłania PESEL do AI.
- Usuwanie krytycznych danych chronione przez `DeleteSafetyButton`.
