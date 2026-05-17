
import { TravelParticipant } from '../../types';

// SŁOWNIK UCZESTNIKÓW PODRÓŻY (HARDCODED)
// Służy do mapowania "brudnych" ciągów z kolumny "współwł." na strukturę uczestników.
// Klucz: Dokładny tekst z Excela (kolumna 18).
// Wartość: Lista obiektów TravelParticipant.

export const TRAVEL_PARTICIPANTS_MAP: Record<string, TravelParticipant[]> = {
    // PRZYKŁADY (Możesz tu dodawać kolejne przypadki z Excela):
    
    "Jan Kowalski + Anna Nowak": [
        { fullName: "Jan Kowalski" },
        { fullName: "Anna Nowak" }
    ],
    
    "Rodzina Nowaków (2+2)": [
        { fullName: "Jan Nowak" },
        { fullName: "Ewa Nowak" },
        { fullName: "Dziecko 1", notes: "Uzupełnić dane" },
        { fullName: "Dziecko 2", notes: "Uzupełnić dane" }
    ],

    "Grupa szkolna - lista w załączniku": [
        { fullName: "GRUPA SZKOLNA", notes: "Lista w załączniku" }
    ],

    // Tutaj wklejaj problematyczne ciągi z Excela:
    // "BRUDNY_STRING_Z_EXCELA": [{ fullName: "Poprawne Imię" }],
};
