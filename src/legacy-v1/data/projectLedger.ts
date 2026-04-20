
export interface Requirement {
    id: string;
    category: 'CORE' | 'UI' | 'SECURITY' | 'AI' | 'BUSINESS';
    title: string;
    description: string;
    status: 'ACTIVE' | 'PENDING' | 'DONE';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface HistoryEntry {
    date: string;
    version: string;
    action: 'ADDED' | 'MODIFIED' | 'COMPLETED' | 'CRITICAL_FIX';
    description: string;
}

export const PROJECT_HISTORY: HistoryEntry[] = [
    {
        date: '2026-02-09',
        version: '6.5.0',
        action: 'COMPLETED',
        description: 'SYSTEM SNAPSHOT: Pełna stabilizacja wersji 6.5.0. Wdrożono: Centrum Pośredników (Multi-Level), Centrum Naprawy Danych (Regex Deep Clean) oraz Dashboard v2.'
    },
    {
        date: '2026-02-09',
        version: '6.4.5',
        action: 'ADDED',
        description: 'SUB-AGENTS MODULE: Wdrożono logikę prowizji kaskadowych, domyślne stawki per agent oraz grupowanie "Smart Grouping" (Firmowy/Własny/Partnerzy).'
    },
    {
        date: '2026-02-09',
        version: '6.4.0',
        action: 'ADDED',
        description: 'SECURITY PROTOCOL: Added CLIENT_MASTER_PROMPT.md with strict "NO PESEL" rules for AI. Updated Client Specs.'
    },
    {
        date: '2026-02-09',
        version: '6.3.1',
        action: 'CRITICAL_FIX',
        description: 'UX CORRECTION: Swapped Identity fields. Order is now First Name -> Last Name.'
    },
    {
        date: '2026-02-09',
        version: '6.3.0',
        action: 'MODIFIED',
        description: 'UX OPTIMIZATION: Client Form reordered to match Agent Flow (Identity -> Contact -> Address[Open] -> Personal -> Business).'
    },
    {
        date: '2026-02-09',
        version: '6.2.1',
        action: 'ADDED',
        description: 'INPUT MASKS: Added strict Formatters for Phone, ZipCode, NIP, REGON, KRS, PESEL.'
    },
    {
        date: '2026-02-08',
        version: '6.0.0',
        action: 'COMPLETED',
        description: 'DEEP CONTEXT ANALYSIS: Wdrożono logikę łączenia danych z kolumny produktowej i notatek. Dodano plik AI_PARSING_RULES.md.'
    },
    { 
        date: '2023-10-27', 
        version: '4.9.1', 
        action: 'CRITICAL_FIX', 
        description: 'USABILITY: Naprawa wyszukiwarki (ignorowanie polskich znaków) oraz wymuszenie otwierania kalendarza systemowego w polach daty.' 
    },
    { 
        date: '2023-10-27', 
        version: '4.9.0', 
        action: 'COMPLETED', 
        description: 'INSURERS RESTORE: Przywrócono pełną bazę 45+ towarzystw. Dodano Panel Zarządzania (Włącz/Wyłącz/Dodaj) w TowarzystwaView.' 
    },
    { 
        date: '2023-10-27', 
        version: '4.8.5', 
        action: 'CRITICAL_FIX', 
        description: 'ARCH_LOCK: Dodano AI_ARCHITECT_WARNING.md w root. Zabezpieczenie przed edycją plików poza katalogiem /crm-pro/.' 
    },
    { 
        date: '2023-10-27', 
        version: '4.8.1', 
        action: 'CRITICAL_FIX', 
        description: 'REQ_013: Naprawiono błąd pustego ekranu Towarzystw (Race Condition w useEffect). Dodano przycisk "Przywróć domyślne".' 
    },
    { 
        date: '2023-10-27', 
        version: '4.8.0', 
        action: 'COMPLETED', 
        description: 'REQ_012: Zunifikowany cykl życia produktu. Modal "Zarządzaj" pozwala na pełną edycję zachowując historię ID.' 
    },
    { 
        date: '2023-10-27', 
        version: '4.5.2', 
        action: 'CRITICAL_FIX', 
        description: 'ROZDZIELENIE TREŚCI: Przywrócono oryginalną Wizję (AI/Backend) do zakładki "Wizja". Wymagania UI (Przyciski/Kanban) pozostają w zakładce "Wymagania".' 
    }
];

export const REQUIREMENTS_LEDGER: Requirement[] = [
    {
        id: 'REQ_022',
        category: 'BUSINESS',
        title: 'Sub-Agent Hierarchy & Settlement',
        description: 'System obsługuje strukturę MLM/OWCA. Każdy Pośrednik ma domyślne stawki % dla typów polis. Raport XLSX generuje gotowe rozliczenie.',
        status: 'DONE',
        priority: 'HIGH'
    },
    {
        id: 'REQ_023',
        category: 'CORE',
        title: 'Data Repair Center',
        description: 'Moduł higieny bazy. Wykrywanie "Zombie Travel" (turystyka w chłodni), "Ghost Leads" i korekta literówek (Regex + Dictionary).',
        status: 'DONE',
        priority: 'HIGH'
    },
    {
        id: 'UI_006',
        category: 'UI',
        title: 'Dashboard Table Redesign',
        description: 'Kolumna Klient: Kontakt (tel/mail) na szaro zamiast nazwy TU. Kolumna Przedmiot: Zawiera nazwę TU (badge) i Składkę. Kolumna Notatki: Szersza, multiline (200 znaków), hover dla historii.',
        status: 'DONE',
        priority: 'HIGH'
    },
    {
        id: 'UX_007',
        category: 'UI',
        title: 'Interactive Sorting',
        description: 'Nagłówki tabeli Dashboardu są klikalne (Sortowanie: Klient, Składka, Status, Koniec). Domyślne sortowanie po dacie końca.',
        status: 'DONE',
        priority: 'MEDIUM'
    },
    {
        id: 'UX_008',
        category: 'UI',
        title: 'Deep Linking Navigation',
        description: 'Dwuklik w Dashboardzie otwiera Panel Klienta i automatycznie podświetla wybraną polisę (Highlight & Scroll).',
        status: 'DONE',
        priority: 'HIGH'
    },
    {
        id: 'SEC_001',
        category: 'SECURITY',
        title: 'PESEL AI Firewall',
        description: 'Absolutny zakaz przekazywania numerów PESEL do API AI. Wartość musi być maskowana lub wycinana przed wysłaniem promptu.',
        status: 'ACTIVE',
        priority: 'HIGH'
    },
    {
        id: 'UI_005',
        category: 'UI',
        title: 'Client Form Flow',
        description: 'Kolejność pól: 1. Imię -> 2. Nazwisko -> 3. Kontakt. Sekcja Adres OTWARTA domyślnie.',
        status: 'ACTIVE',
        priority: 'HIGH'
    },
    {
        id: 'REQ_021',
        category: 'AI',
        title: 'Deep Context Parsing',
        description: 'AI musi analizować notatki w poszukiwaniu danych brakujących w nazwie produktu (np. silnik, paliwo) oraz flagować anomalie w polu aiNote.',
        status: 'DONE',
        priority: 'HIGH'
    },
    { 
        id: 'REQ_015', 
        category: 'UI', 
        title: 'Inteligentne Wyszukiwanie', 
        description: 'Wyszukiwarki (Select) muszą ignorować polskie znaki (ą=a) i wielkość liter.', 
        status: 'DONE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_016', 
        category: 'UI', 
        title: 'Aktywne Pola Daty', 
        description: 'Kliknięcie w dowolny obszar pola daty musi natychmiast otwierać natywny kalendarz systemu operacyjnego.', 
        status: 'DONE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_001', 
        category: 'CORE', 
        title: 'Architektura Local-First (/crm-pro)', 
        description: 'Cały kod MUSI znajdować się w podkatalogu /crm-pro. Root jest tylko loaderem.', 
        status: 'ACTIVE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_014', 
        category: 'BUSINESS', 
        title: 'Zarządzanie Towarzystwami', 
        description: 'Użytkownik musi mieć kontrolę nad listą dostępnych towarzystw (włączanie/wyłączanie z pełnej bazy 45+ firm).', 
        status: 'DONE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_002', 
        category: 'UI', 
        title: 'Safety Switch (Compact Mode)', 
        description: 'Przyciski usuwania NIE MOGĄ być wielkimi oknami. Mają być małym, dyskretnym przełącznikiem "Slide to Unlock" (Micro-Popover).', 
        status: 'DONE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_009', 
        category: 'UI', 
        title: 'Wygląd Modułu Ofert (Kanban)', 
        description: 'Oferty muszą być w układzie Kanban. Karty mają pokazywać kontekst z notatek.', 
        status: 'DONE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_012', 
        category: 'BUSINESS', 
        title: 'Unified Product Lifecycle', 
        description: 'Produkt (Polisa/Oferta) ma jedno ID przez cały cykl życia. Edycja nie może tworzyć duplikatów. Historia notatek musi podążać za ID.', 
        status: 'DONE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_003', 
        category: 'SECURITY', 
        title: 'Audit Log (Czarna Skrzynka)', 
        description: 'Rejestrowanie każdej operacji w tle.', 
        status: 'DONE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_005', 
        category: 'AI', 
        title: 'Ochrona Danych (PESEL)', 
        description: 'Zakaz wysyłania PESEL do chmury.', 
        status: 'ACTIVE', 
        priority: 'HIGH' 
    },
    { 
        id: 'REQ_008', 
        category: 'CORE', 
        title: 'Vision History Guarantee', 
        description: 'Użytkownik musi widzieć co się zmieniło w wymaganiach.', 
        status: 'DONE', 
        priority: 'HIGH' 
    }
];

export const VISION_MARKDOWN = `
# Autonomiczny System Operacyjny Agenta

> **"Nie sprzedajemy polis. Zarządzamy relacjami i ryzykiem zanim klient o tym pomyśli."**

## 1. LMM & Data Mining
**Cel:** Przemielenie plików lokalnych w poszukiwaniu ukrytych powiązań.
*   Analiza plików (skany, notatki) pod kątem relacji (Rodzina, Pasje, Sąsiedzi).
*   Wykrywanie zależności ("Rybki i Babcia").

## 2. Asystent Głosowy (Real-time)
**Cel:** Koniec z klepaniem notatek.
*   Słuchanie, transkrypcja i automatyczne planowanie zadań w kalendarzu na podstawie kontekstu rozmowy.

## 3. Business Intelligence
**Cel:** Automatyczny wywiad gospodarczy.
*   Automatyczny skan NIP/KRS/CEIDG w celu oceny potencjału klienta (Majątek, Flota, Zatrudnienie).

## 4. OSINT (Etyczny)
**Cel:** Wyłapywanie "Momentów Życiowych".
*   Etyczny monitoring social media (wykrywanie podróży, narodzin dzieci, zakupu aut) w celu proaktywnej sprzedaży.

### Status: W FAZIE PROJEKTOWEJ (BACKEND WYMAGANY)
`;
