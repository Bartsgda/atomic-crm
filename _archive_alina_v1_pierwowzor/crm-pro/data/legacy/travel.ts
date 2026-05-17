
import { CleanData } from './types';

export const TRAVEL_MAP: Record<string, CleanData> = {
    // --- 1. MALTA (Przełom miesięcy) ---
    "podróżne_Malta 30.08-05.09.2025": { 
        type: 'PODROZ', 
        destinationCountry: 'Malta', 
        travelStartDate: '2025-08-30',
        travelEndDate: '2025-09-05',
        travelDetails: { zone: 'EUROPA', durationDays: 7 } 
    },
    // --- 2. GRECJA ---
    "podróż_Grecja, Santorinii 30.06-07.07.2025": { 
        type: 'PODROZ', 
        destinationCountry: 'Grecja', 
        travelStartDate: '2025-06-30',
        travelEndDate: '2025-07-07',
        travelDetails: { zone: 'EUROPA', durationDays: 8 }, 
        aiNote: 'Santorini' 
    },
    // --- 3. NORWEGIA (Ten sam miesiąc) ---
    "podróżne_Norwegia 19-24.08.2025": { 
        type: 'PODROZ', 
        destinationCountry: 'Norwegia', 
        travelStartDate: '2025-08-19',
        travelEndDate: '2025-08-24',
        travelDetails: { zone: 'EUROPA', durationDays: 6 } 
    },
    // --- 4. WŁOCHY (Literówka "podrózna" i format daty dzień.mies-dzień.mies) ---
    "podrózna_Włochy 12.10-02.11.2025": { 
        type: 'PODROZ', 
        destinationCountry: 'Włochy', 
        travelStartDate: '2025-10-12',
        travelEndDate: '2025-11-02',
        travelDetails: { zone: 'EUROPA', durationDays: 22 }, 
        aiNote: 'Kamila dołącza do Figura.' 
    },
    // --- 5. DUBAJ (ZEA) ---
    "podróż_Emiraty Arabskie, Dubaj 02.11-09.11.2025": { 
        type: 'PODROZ', 
        destinationCountry: 'Zjedn. Emiraty Arabskie', 
        travelStartDate: '2025-11-02',
        travelEndDate: '2025-11-09',
        travelDetails: { zone: 'SWIAT', durationDays: 8 }, 
        aiNote: 'Dubaj' 
    },
    // --- 6. INDONEZJA ---
    "podróż_Indonezja 15-20.11.2025": { 
        type: 'PODROZ', 
        destinationCountry: 'Indonezja', 
        travelStartDate: '2025-11-15',
        travelEndDate: '2025-11-20',
        travelDetails: { zone: 'SWIAT', durationDays: 6 } 
    },
    // --- 7. WŁOCHY NARTY (Data na początku stringa) ---
    "podróż_05-13.12.2025 Włochy_600 tys": { 
        type: 'PODROZ', 
        destinationCountry: 'Włochy', 
        travelStartDate: '2025-12-05',
        travelEndDate: '2025-12-13',
        travelDetails: { zone: 'EUROPA', durationDays: 9, sumMedical: 600000 }, 
        aiNote: 'Wyjazd na narty' 
    },
    // --- 8. HISZPANIA ---
    "podróż_Hiszpania_Palma de Mallorca_06-16.07.2025": { 
        type: 'PODROZ', 
        destinationCountry: 'Hiszpania', 
        travelStartDate: '2025-07-06',
        travelEndDate: '2025-07-16',
        travelDetails: { zone: 'EUROPA', durationDays: 11 }, 
        aiNote: 'Majorka' 
    },
    // --- 9. GENERYCZNE / BEZ DAT W TYTULE ---
    "podróżne": { 
        type: 'PODROZ', 
        destinationCountry: 'Świat (Nieokreślony)', 
        aiNote: 'Brak kraju w tytule. Sprawdź notatki.' 
    },
    "podróżna_Włochy": { 
        type: 'PODROZ', 
        destinationCountry: 'Włochy' 
    },
    "podróżna_Włochy_kontynuacja": { 
        type: 'PODROZ', 
        destinationCountry: 'Włochy', 
        aiNote: 'KONTYNUACJA. Klient przebywa za granicą.' 
    },
    "podróżna_Włochy_278": { 
        type: 'PODROZ', 
        destinationCountry: 'Włochy', 
        aiNote: 'Wariant niższy' 
    }
};
