
# 📘 INSURANCE MASTER CRM PRO - MASTER MANUAL (v4.9)

Centralne repozytorium zasad, wymagań i procesów.

---

## 🚨 1. ARCHITEKTURA (KRYTYCZNE)
*   **Lokalizacja Kodu:** Cały kod źródłowy znajduje się w folderze **`/crm-pro/`**.
*   **Root Warning:** Katalog główny (`/`) służy tylko do konfiguracji Vite i mostkowania. **Nie twórz tam komponentów.**
*   **Baza Danych:** `localStorage` (Klucz: `InsuranceMaster_Core_V4_Final`).

## 2. 🏛️ FILOZOFIA UI (Design Laws)
1.  **Compact First:** Unikaj pustych przestrzeni. Tabele > Listy. Chips > Karty.
2.  **Number Inputs:** Pola liczbowe MUSZĄ mieć `inputMode="decimal"` dla mobile.
3.  **Safety Switch:** Usuwanie krytycznych danych wymaga "suwaka" (`DeleteSafetyButton`).
4.  **Zero Scroll Checklists:** Listy kontrolne muszą mieścić się na ekranie.

## 3. 💼 PROCESY BIZNESOWE

### A. Klient (360°)
*   Walidacja: Imię + Nazwisko + (Telefon LUB Email).
*   B2B: Możliwość dodania wielu firm do jednej osoby.

### B. Towarzystwa i Produkty
*   **Baza Towarzystw:** 
    *   Wbudowana lista 45+ podmiotów (PZU, Warta, marki typu Proama).
    *   **Insurer Manager:** Użytkownik może włączać/wyłączać widoczność firm oraz dodawać własne (Custom) poprzez przycisk "Zarządzaj Listą".
    *   Dane kontaktowe (Opiekun) są edytowalne dla każdej firmy.
*   **Cykl Polisy:** Lead -> Kalkulacja -> Oferta Wysłana -> Sprzedaż -> Wypowiedzenie.

### C. Wypowiedzenia (Terminations)
*   Generator PDF zgodnie z Art. 28/28a.
*   Ewidencja w osobnym rejestrze (`TerminationsView`).

### D. Rozliczenia (Commissions)
*   Obsługa modelu MLM (Pośrednik).
*   Kalkulator kaskadowy: Składka -> Prowizja Agenta -> Prowizja Pośrednika.

## 4. 🤖 AI & AUTOMATYZACJA (Gemini)
*   **GUS Scout:** Pobieranie danych firmy z CEIDG/KRS po NIP.
*   **Auto-Status:** Zmiana statusu polisy na podstawie treści notatki.

## 5. ⚠️ ROZWIĄZYWANIE PROBLEMÓW (Troubleshooting)
*   **Brak Towarzystwa na liście:** Wejdź w "Towarzystwa" -> "Zarządzaj Listą" i odhacz brakującą firmę lub dodaj własną.
*   **Podwójny klik:** W Dashboardzie otwiera "Centrum Operacyjne Polisy" (Modal VIEW).

---
*Ostatnia aktualizacja: 2023-10-27 (Post-Rebuild)*
