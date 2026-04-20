
# 🛡️ Insurance Master CRM Pro (v4.3 Stable)

Centralny system operacyjny dla nowoczesnego agenta ubezpieczeniowego.
Architektura: **Local-First (React + Vite + Gemini AI)**.

> **Ostatnia aktualizacja:** Wdrożenie Asset Intelligence (Smart Search), System Motywów (Exec/Onyx/Forest), Ulepszony Kreator Polis.

---

## 📂 Centrum Dokumentacji

### 🧠 Zarządzanie Projektem
*   **[ROADMAP.md](./ROADMAP.md)** -> **[WAŻNE]** Aktualny status prac, co zostało zrobione, a co jest w planach.
*   **[BartsGda.md](./BartsGda.md)** -> Wizja długoterminowa (Backend, AI Agents).

### 💼 Moduły Biznesowe (Specyfikacja)
*   **[REQUIREMENTS.md](./REQUIREMENTS.md)** -> Wymagania ogólne (Klient, Polisa, Asset Intelligence).
*   **[WYMAGANIA-KLIENT.md](./WYMAGANIA-KLIENT.md)** -> Panel Klienta 360°.
*   **[OFFERS_REQUIREMENTS.md](./OFFERS_REQUIREMENTS.md)** -> Tablica Kanban (Oferty).
*   **[TERMINATIONS_SPEC.md](./components/Terminations/TERMINATIONS_SPEC.md)** -> Rejestr wypowiedzeń.

### ⚙️ Design & UI
*   **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** -> Specyfikacja motywów (Exec, Onyx, Forest) i typografii.

### ⚙️ Dane & Bezpieczeństwo
*   **[BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md)** -> Procedury bezpieczeństwa i kopii zapasowych.
*   **[DATA_MAPPING.md](./DATA_MAPPING.md)** -> Struktura danych wewnątrz aplikacji.
*   **[XLSX_MAPPING.md](./XLSX_MAPPING.md)** -> Instrukcja importu z Excela.

---

## 🚀 Szybki Start

1.  **Instalacja:** `npm install`
2.  **Klucze API:** Utwórz plik `.env` i dodaj `GEMINI_API_KEY=...`
3.  **Start:** `npm run dev`

## 🛠️ Stack Technologiczny
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS.
- **AI:** Google Gemini 2.0 Flash/Pro (via `@google/genai`).
- **Icons:** Lucide React.
- **Data:** LocalStorage (Persystencja) + PapaParse/XLSX (Import).
