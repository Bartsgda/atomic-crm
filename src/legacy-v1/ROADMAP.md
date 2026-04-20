
# 🗺️ Roadmapa & Status Projektu: Insurance Master CRM Pro (v4.7)

> **Status Generalny:** System stabilny (Stable Release). Architektura Local-First w pełni funkcjonalna. Gotowy do codziennej pracy operacyjnej Agenta.

---

## 1. ✅ MODUŁY UKOŃCZONE (DEFINITION OF DONE)

### A. Fundamenty (Core)
- [x] **Baza Klientów:** Pełny CRUD, walidacja PESEL/NIP, wyszukiwanie live.
- [x] **Portfel Polis:** Obsługa wszystkich typów (OC, AC, Dom, Życie, Firma, Podróż).
- [x] **AI Business Scout:** Pobieranie danych firmy z GUS/CEIDG (via Google Grounding) na podstawie NIP/KRS.
- [x] **System Danych:** `localStorage` + Export/Import JSON (Backup) + Import XLSX (Migracja).
- [x] **Soft Refresh:** Bezpieczne przeładowanie stanu aplikacji bez twardego odświeżania przeglądarki.

### B. Procesy Sprzedażowe
- [x] **Kanban Ofert:** Tablica "Drag & Drop" do zarządzania leadami (Do zrobienia -> W toku -> Wysłane).
- [x] **Kreator Polisy v2:** Pływające okno (Modal) zamiast osobnej strony. Wielkie kafle wyboru.
- [x] **Checklisty Compliance v2:** 
    - [x] Kompaktowy wygląd (Chips).
    - [x] Podział na Wymagane/Opcjonalne.
    - [x] **Edytor Szablonów:** Agent może dodawać własne pozycje do checklisty.
- [x] **Travel Intel:** AI analizuje ryzyka dla wybranego kraju podróży.
- [x] **Asset Intelligence:** Wyszukiwarka zasobów klienta (Auta/Domy) w kreatorze polisy. One-click fill.

### C. Retencja i Bezpieczeństwo (Retention)
- [x] **Rejestr Wypowiedzeń:** Generator PDF, ewidencja wysłanych pism, statusy na polisie.
- [x] **Safety Switch:** Mechanizm "suwaka" przy usuwaniu krytycznych danych (zapobiega przypadkowym kliknięciom).
- [x] **Kalendarz v1:** Widoki Miesiąc/Tydzień/Dzień, agregacja wznowień i zadań.

### D. Notatnik 2.0 (The Brain)
- [x] **Cross-Linking:** Możliwość powiązania notatki z konkretną polisą (lub wieloma).
- [x] **Historia Kontaktu:** Oś czasu w panelu klienta 360°.
- [x] **Szybkie Akcje:** Tagi [ROZMOWA], [STATUS], [MAIL].

### E. UI/UX (Design System)
- [x] **Style Shifter:** Przełącznik motywów (Exec, Onyx, Forest).
- [x] **Skalowanie Interfejsu:** Globalna kontrola wielkości czcionki.

---

## 2. 🚧 W TRAKCIE REALIZACJI (CURRENT SPRINT)

### A. Optymalizacja UI/UX
- [ ] **Mobile View Tuning:** Poprawa wyświetlania tabel na bardzo małych ekranach.
- [ ] **Dashboard Widgets:** Dodanie wykresu słupkowego "Sprzedaż miesiąc do miesiąca".

### B. Finanse (Wymagane do v4.5)
- [ ] **Moduł Ratalny:** Oznaczanie raty 2/4 jako opłaconej. Obecnie mamy tylko status ogólny polisy.
- [ ] **Rozliczenia:** Raport prowizyjny dla Agenta (ile zarobiłem w tym miesiącu vs cel).

---

## 3. 🔮 BACKLOG & PRZYSZŁOŚĆ (BACKEND REQUIRED)

Aby wdrożyć funkcje z pliku `BartsGda.md`, musimy wyjść poza przeglądarkę.

### Faza 5: "The Synapse" (Python Backend)
Wymagany serwer (FastAPI/Django) do:
1.  **LMM (Large Multi-Modal Model):** Analiza skanów polis (OCR) i zdjęć mienia.
2.  **Asystent Głosowy:** Nagrywanie rozmów, transkrypcja Whisper, auto-notatka.
3.  **Vector DB (ChromaDB):** Wyszukiwanie semantyczne ("Znajdź klientów, którzy mają psa").
4.  **Integracja Google Calendar:** Dwukierunkowa synchronizacja spotkań.

### Faza 6: Automatyzacja
- [ ] **Auto-Mailing:** Wysyłka e-maila z ofertą bezpośrednio z CRM (SMTP).
- [ ] **SMS Gateway:** Przypomnienia SMS o racie (integracja z SMSAPI/JustSend).

---

## 4. DŁUG TECHNICZNY I OSTRZEŻENIA
1.  **Limity LocalStorage:** Baza danych w przeglądarce ma limit ok. 5-10MB. Przy bazie > 1000 klientów z dużą historią notatek, konieczna będzie migracja na **IndexedDB** (Dexie.js) lub Backend.
