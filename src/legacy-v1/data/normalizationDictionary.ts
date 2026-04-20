
// SŁOWNIK NORMALIZACJI DANYCH
// Służy do:
// 1. Standaryzacji żargonu (np. "prod" -> "prod.")
// 2. Wykrywania błędów ortograficznych w Centrum Naprawy

export const AGENT_ABBREVIATIONS: Record<string, string> = {
    // --- STANDARYZACJA SKRÓTÓW (Bezpieczne) ---
    // UWAGA: Usunięto 'mot', 'prod', 'poj' - są obsługiwane przez Regexy poniżej, 
    // aby unikać błędów typu "4MOT" -> "4motocykl" lub "prod.."
    
    'produkcji': 'prod.',
    'produkcja': 'prod.',
    
    'pojemnosc': 'poj. silnika',
    'pojemność': 'poj. silnika',
    
    'pierwsza': 'pierw',
    
    'rejestracja': 'rej',
    'rejestracyjna': 'rej',
    'rejestr': 'rej',
    'rej.': 'rej',

    // --- KATEGORIE I INNE ---
    'samoch': 'samochód',
    'samoch.': 'samochód',
    // 'osob': 'osobowy', // Wyłączone, bo często jest częścią innych słów
    'osob.': 'osobowy',
    'cięż': 'ciężarowy',
    'ciez': 'ciężarowy',
    'przycz': 'przyczepa',
    'nacz': 'naczepa',
    // 'mot': 'motocykl', // WYŁĄCZONE: Psuje 4MOT -> 4motocykl
    'moto': 'motocykl',
    'skut': 'skuter',
    
    'mieszk': 'mieszkanie',
    'miesz': 'mieszkanie',
    'lok': 'lokal',
    'bud': 'budynek',
    'gosp': 'gospodarczy',
    'ruch': 'ruchomości',
    
    'podr': 'podróż',
    'wyj': 'wyjazd',
    'zagr': 'zagraniczny',
    
    'ubezp': 'ubezpieczenie',
    'ub': 'ubezpieczenie',
    'pol': 'polisa',
    'kont': 'kontynuacja',
    'wzn': 'wznowienie',
    'szk': 'szkoda'
};

export const COMMON_TYPOS: Record<string, string> = {
    'samochod': 'samochód',
    'samocho': 'samochód',
    'osobwy': 'osobowy',
    'ciezarowy': 'ciężarowy',
    'podroz': 'podróż',
    'podrozne': 'podróżne',
    'podrózne': 'podróżne',
    'majatek': 'majątek',
    'garaz': 'garaż',
    'garazowy': 'garażowy',
    'dzialalnosc': 'działalność',
    'dzial': 'działalność',
    'spolka': 'spółka',
    'cywilna': 'cywilna',
    'odpowiedzialnosc': 'odpowiedzialność',
    
    'watra': 'Warta',
    'alians': 'Allianz',
    'alianz': 'Allianz',
    'ergohestia': 'Ergo Hestia',
    'compensa': 'Compensa',
    'generalli': 'Generali'
};

// Funkcja pomocnicza do "leczenia" tekstu
export const normalizeAgentInput = (raw: string): string => {
    if (!raw) return '';
    
    let text = raw;

    // --- ETAP 1: KOREKTA FRAZ (Regexy Kontekstowe) ---

    // 1. POJEMNOŚĆ SILNIKA
    // Łapie: "poj", "poj.", "pojemność"
    // "pojemnosc 1.6" -> "poj. silnika 1.6"
    // "poj silnika" -> "poj. silnika" (nie duplikuje!)
    text = text.replace(/\bpoj(?:emno[sś][cć]|\.)?(?:\s+silnika)?\b/gi, 'poj. silnika');

    // 2. PIERWSZA REJESTRACJA
    // Łapie: "pierwsza", "pierwsza rej", "pierwsza rejestracja", "pierw rej"
    text = text.replace(/\bpierw(?:sza|sz[ay])?(?:\s+reje?s?t?r?a?c?j?a?\.?|\s+rej\.?)?\b/gi, 'pierw rej');

    // 3. ROK PRODUKCJI
    // Łapie: "prod", "prod.", "produkcji"
    // Ważne: (?!\.) zapobiega zamianie "prod." na "prod.."
    text = text.replace(/\bprod(?:ukcj[ia])?\.?(?!\.)\b/gi, 'prod.');

    // --- ETAP 2: NAPRAWA FORMATOWANIA (Spacje) ---

    // Naprawa "pierw rej2008" -> "pierw rej 2008"
    text = text.replace(/(pierw rej|prod\.)(\d)/gi, '$1 $2');

    // Naprawa "poj. silnika1900" -> "poj. silnika 1900"
    text = text.replace(/(poj\. silnika)(\d)/gi, '$1 $2');

    // --- ETAP 3: MAPOWANIE POJEDYNCZYCH SŁÓW (Słownik) ---
    // Używamy funkcji callback, aby podmieniać tylko pełne słowa
    return text.replace(/([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ.]+)/g, (word) => {
        const lower = word.toLowerCase();
        const lowerNoDot = lower.replace(/\.$/, '');
        
        // Pomijamy słowa, które już wyglądają na poprawione (np. "prod.")
        if (word === 'prod.' || word === 'poj.') return word;

        // Priorytet dla dokładnego dopasowania
        if (AGENT_ABBREVIATIONS[lower]) return AGENT_ABBREVIATIONS[lower];
        if (AGENT_ABBREVIATIONS[lowerNoDot]) return AGENT_ABBREVIATIONS[lowerNoDot];
        
        if (COMMON_TYPOS[lower]) return COMMON_TYPOS[lower];
        if (COMMON_TYPOS[lowerNoDot]) return COMMON_TYPOS[lowerNoDot];
        
        return word;
    });
};
