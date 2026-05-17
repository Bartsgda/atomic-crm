
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
        version: '6.9.0',
        action: 'COMPLETED',
        description: 'AUDIT TRAIL UX: Wdrożono filtrowanie logów systemowych w Panelu Klienta (Toggle), Dymkach Dashboardu i Liście Klientów. Poprawiono czytelność historii.'
    },
    {
        date: '2026-02-09',
        version: '6.8.0',
        action: 'ADDED',
        description: 'OFFER COMPARATOR: Wdrożono moduł "Bitwa Ofert" (PolicyCalculation). Agent może zapisać wiele wariantów w jednej polisie i wybrać zwycięzcę.'
    },
    {
        date: '2026-02-09',
        version: '6.7.0',
        action: 'COMPLETED',
        description: 'UX UPDATE: OffersBoard Drop Zones & Anti-Bounce logic. Notes Context linking.'
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
        id: 'REQ_024',
        category: 'BUSINESS',
        title: 'Offer Comparator (Offer Battle)',
        description: 'Możliwość dodania wielu kalkulacji do jednej polisy ofertowej (Insurer, Premium, Notes). Agent wybiera zwycięzcę jednym kliknięciem.',
        status: 'DONE',
        priority: 'HIGH'
    },
    {
        id: 'UX_010',
        category: 'UI',
        title: 'Kanban Drop Zones',
        description: 'Tablica ofert musi posiadać wyraźne strefy zrzutu (Drop Zones) na dole ekranu dla akcji "Sprzedaj" i "Odrzuć", aby przyspieszyć decyzje.',
        status: 'DONE',
        priority: 'HIGH'
    },
    {
        id: 'LOG_001',
        category: 'CORE',
        title: 'Anti-Bounce History Logic',
        description: 'System nie może generować notatek systemowych [SYSTEM], jeśli zmiana statusu nastąpiła szybciej niż 60s od poprzedniej (korekta pomyłki).',
        status: 'DONE',
        priority: 'MEDIUM'
    },
    {
        id: 'UX_011',
        category: 'UI',
        title: 'Contextual Note Linking',
        description: 'Jeśli użytkownik ma wybraną polisę w Panelu Klienta, nowa notatka musi być do niej automatycznie podpięta bez konieczności wpisywania #hashtaga.',
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
