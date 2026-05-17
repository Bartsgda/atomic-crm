
export interface KaratekaSuggestion {
    fieldKey: string; // np. 'vehicleBrand' lub 'autoDetails.engineCapacity'
    suggestedValue: any;
    reasoning?: string;
    confidence: number;
}

export interface KaratekaResponse {
    suggestions: KaratekaSuggestion[];
    comment: string; // Komentarz ogólny (np. "Znalazłem błąd w marce")
}

export interface VisualDiffState {
    originalValue: any; // Wartość przed interwencją AI (przekreślona)
    aiValue: any;       // Sugestia AI (fioletowa)
    userCorrection?: any; // Poprawka użytkownika na sugestię AI (zielona)
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MANUAL_OVERRIDE';
}

export type FormMap = Record<string, string>; // Klucz pola -> Opis dla AI
