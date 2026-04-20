# 📂 Inwentaryzacja Ikon & Propozycje Wizualne

Dokumentacja aktualnych zasobów graficznych systemu **ALINA V1** oraz propozycje modernizacji UI.

## 📋 Aktualny Zestaw (Lucide React)
Obecnie używamy biblioteki `lucide-react`. Poniżej lista zmapowana na funkcje:

| Kategoria | Ikony | Przeznaczenie |
| :--- | :--- | :--- |
| **Nawigacja** | `Home`, `Trello`, `Calendar`, `Users` | Dashboard, Tablica, Kalendarz, Klienci |
| **Ubezpieczenia** | `Car`, `Heart`, `Plane`, `Building2`, `Stethoscope` | Auto, Życie, Turystyka, Majątek, Zdrowie |
| **System/Hardening** | `Shield`, `Zap`, `CloudDownload`, `Save`, `Trash2` | Bezpieczeństwo, Szybkie Akcje, Sync, Reset |
| **Narzędzia** | `Palette`, `Activity`, `FileSpreadsheet`, `Bug`, `PenTool` | Motywy, Logi, Import, Tester, Form Builder |

---

## 💎 Propozycja 1: "Neon-Glass Modern"
Zamiast płaskich, szarych ikon, proponuję wprowadzenie **półprzezroczystych tła (blur)** i subtelnego **neonowego poświatu** dla aktywnych kategorii.

### Główne założenia:
*   **Dynamiczna Grubość:** Zmniejszenie `strokeWidth` do `1.5` dla lżejszego, "Apple-style" looku.
*   **System Kolorystyczny:**
    *   `Emerald` dla Życia/Zdrowia.
    *   `Sky` dla Auta/Majątku.
    *   `Amber` dla Systemu/Narządzi.
*   **Micro-Animations:** Ikona `Zap` (Szybkie Akcje) oraz `Refresh` pulsująca podczas synchronizacji.

---

## 🔥 Propozycja 2: "Symmetric Hardening UI"
Przeniesienie akcji krytycznych do pływającego menu **Quick Access Hub**.

![Premium Sidebar Proposal](file:///C:/Users/Barts/.gemini/antigravity/brain/7dc3c4a3-9f50-438c-8093-60cbd6728777/premium_sidebar_icons_proposal_1776547808197.png)

### Zmiany w kodzie:
1.  **Grupowanie:** Zmiana `NavButton` na wersję z gradientowym tłem (Backdrop filter).
2.  **Kontrast:** Ciemniejszy Sidebar (Zinc-950) vs Jaśniejszy Main Content dla lepszej separacji.

---

## 🛠️ Planowane testy w folderze `/test`:
- `IconStressTest.tsx`: Renderowanie wszystkich 32 ikon z różnymi wagami linii.
- `ThemePreview.tsx`: Podgląd jak ikony zachowują się w trybach `Warm`, `Midnight` i `Zinc`.
