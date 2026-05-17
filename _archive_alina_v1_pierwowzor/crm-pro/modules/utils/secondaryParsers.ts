
import { CoOwner, TravelParticipant } from '../../types';

/**
 * Parsuje kolumnę "stara polisa" (kolumna 17).
 * Wyciąga: Nazwę TU, Wartość Pojazdu, Typ Wartości (Netto/Brutto).
 */
export const parseOldPolicyInfo = (raw: string) => {
    if (!raw) return { oldInsurer: undefined, vehicleValue: undefined, valueType: undefined };
    
    const text = raw.toLowerCase();
    const result: any = { oldInsurer: undefined, vehicleValue: undefined, valueType: undefined };

    // 1. Wykrywanie Ubezpieczyciela
    if (text.includes('pzu')) result.oldInsurer = 'PZU';
    else if (text.includes('warta') || text.includes('hdi')) result.oldInsurer = 'Warta';
    else if (text.includes('hestia') || text.includes('ergo')) result.oldInsurer = 'Ergo Hestia';
    else if (text.includes('generali') || text.includes('proama')) result.oldInsurer = 'Generali';
    else if (text.includes('allianz')) result.oldInsurer = 'Allianz';
    else if (text.includes('wiener')) result.oldInsurer = 'Wiener';
    else if (text.includes('compensa')) result.oldInsurer = 'Compensa';
    else if (text.includes('interrisk')) result.oldInsurer = 'Interrisk';
    else if (text.includes('uniqa') || text.includes('axa')) result.oldInsurer = 'Uniqa';
    else if (text.includes('link4') || text.includes('link 4')) result.oldInsurer = 'Link4';
    else if (text.includes('tuz')) result.oldInsurer = 'TUZ';
    else if (text.includes('balcia')) result.oldInsurer = 'Balcia';
    else if (text.includes('wefox')) result.oldInsurer = 'Wefox';
    else if (text.includes('euroins') || text.includes('euro inc')) result.oldInsurer = 'Euroins';

    // 2. Wykrywanie Wartości i Typu (Netto/Brutto)
    // Regex łapie: "56730 netto", "85 365 zł", "SU 400 tys"
    const valueMatch = text.match(/(\d[\d\s]+)\s*(netto|brutto|zł|pln|tys)/i);
    
    if (valueMatch) {
        let amountStr = valueMatch[1].replace(/\s/g, ''); // Usuń spacje: "56 730" -> "56730"
        let amount = parseFloat(amountStr);
        const suffix = valueMatch[2].toLowerCase();

        // Obsługa "tys"
        if (suffix.includes('tys')) {
            amount *= 1000;
        }

        if (!isNaN(amount) && amount > 1000) { // Ignoruj małe liczby (to mogą być numery polisy)
            result.vehicleValue = amount;
            if (text.includes('netto')) result.valueType = 'NETTO';
            else result.valueType = 'BRUTTO'; // Domyślnie brutto jeśli nie ma netto
        }
    }

    return result;
};

/**
 * Parsuje kolumnę "współwłaściciel" (kolumna 18).
 * Wyciąga: Leasingi, Banki (Cesje), Osoby z PESEL, oraz kontakty (TEL/EMAIL).
 */
export const parseCoOwnerColumn = (raw: string): { coOwners: CoOwner[], ownershipType?: 'LEASING' | 'KREDYT' | 'PRYWATNA', assignment?: string } => {
    if (!raw) return { coOwners: [] };
    
    let text = raw.trim();
    const result: { coOwners: CoOwner[], ownershipType?: 'LEASING' | 'KREDYT' | 'PRYWATNA', assignment?: string } = { coOwners: [] };

    // --- NEW: EXTRACT CONTACT INFO FIRST (Before cleaning) ---
    let detectedPhone: string | undefined = undefined;
    let detectedEmail: string | undefined = undefined;

    // Email Regex
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
        detectedEmail = emailMatch[0];
        text = text.replace(detectedEmail, ''); // Remove extracted email to clean name later
    }

    // Phone Regex (9 digits, optional spaces/dashes, maybe 'tel')
    // Matches: 500123456, 500 123 456, 500-123-456, tel 500...
    const phoneMatch = text.match(/(?:tel\.?|kom\.?|telefon)?\s?(\d{3}[-\s]?\d{3}[-\s]?\d{3})/i);
    if (phoneMatch) {
        detectedPhone = phoneMatch[1].replace(/[-\s]/g, ''); // Clean to 9 digits
        text = text.replace(phoneMatch[0], ''); // Remove extracted phone
    }

    // 1. Wykrywanie LEASINGU
    if (/leasing/i.test(text)) {
        result.ownershipType = 'LEASING';
        result.coOwners.push({
            name: text.trim(),
            type: 'LEASING',
            notes: 'Dane z importu',
            phone: detectedPhone,
            email: detectedEmail
        });
        return result;
    }

    // 2. Wykrywanie CESJI (Bank)
    if (/cesia|cesja/i.test(text)) {
        result.assignment = text.trim();
        
        // Split logic for multi-entity string
        if (text.includes('+') || text.includes('oraz')) {
             const parts = text.split(/\+|\boraz\b/);
             parts.forEach(part => {
                 if (!/cesia|cesja/i.test(part)) {
                     const person = parsePersonString(part, detectedPhone, detectedEmail);
                     if (person) result.coOwners.push(person);
                 }
             });
        }
        return result;
    }

    // 3. Wykrywanie OSOBY (PESEL)
    const peselMatch = text.match(/\d{11}/);
    if (peselMatch) {
        const pesel = peselMatch[0];
        let name = text.replace(pesel, '')
                       .replace(/pesel/gi, '')
                       .replace(/ubezpieczon[y|a|i]/gi, '')
                       .replace(/współwłaściciel/gi, '')
                       .replace(/tel\.?\s?/gi, '') // Remove leftover labels
                       .trim();
        
        name = name.replace(/^[-_,:;]+/, '').trim();

        if (name.length > 2) {
            result.coOwners.push({
                name: name,
                pesel: pesel,
                type: 'PERSON',
                phone: detectedPhone,
                email: detectedEmail
            });
        }
        return result;
    }

    // 4. Fallback: Sam tekst (np. imię i nazwisko bez peselu)
    // Clean text further before saving
    let cleanName = text.replace(/tel\.?\s?/gi, '').replace(/^[-_,:;]+/, '').trim();
    
    if (cleanName.length > 3) {
        if (cleanName.includes('?')) return result; // Ignore junk
        
        result.coOwners.push({
            name: cleanName,
            type: 'PERSON',
            phone: detectedPhone,
            email: detectedEmail
        });
    }

    return result;
};

/**
 * Specjalny parser dla uczestników wyjazdu (TRAVEL).
 * Dzieli tekst po przecinkach, plusach, "i", "oraz".
 */
export const parseTravelParticipants = (raw: string): TravelParticipant[] => {
    if (!raw) return [];
    
    // Lista separatorów: przecinek, plus, średnik, " i ", " oraz "
    const parts = raw.split(/,|\+|;| i | oraz | \/ /gi);
    
    const participants: TravelParticipant[] = [];
    
    parts.forEach(part => {
        let name = part.trim();
        // Usuwanie śmieci
        name = name.replace(/\(.*\)/, '').trim(); // Usuń nawiasy np. (dziecko)
        name = name.replace(/\d+/, '').trim(); // Usuń cyfry
        
        if (name.length > 2) {
            participants.push({ fullName: name });
        }
    });

    return participants;
};

// Helper dla pojedynczej osoby
const parsePersonString = (str: string, phone?: string, email?: string): CoOwner | null => {
    const peselMatch = str.match(/\d{11}/);
    if (peselMatch) {
        return {
            name: str.replace(peselMatch[0], '').replace(/pesel/gi, '').trim(),
            pesel: peselMatch[0],
            type: 'PERSON',
            phone,
            email
        };
    }
    const clean = str.trim();
    if (clean.length > 3) return { name: clean, type: 'PERSON', phone, email };
    return null;
}
