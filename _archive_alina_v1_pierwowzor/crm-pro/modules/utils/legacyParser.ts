
import { VehicleSubType } from '../../types';
import { normalizeAgentInput } from '../../data/normalizationDictionary';

// SŁOWNIKI REGEX
export const PARSER_PATTERNS = {
    // --- AUTO ---
    // Agresywny regex na polskie tablice: 2-3 litery, spacja lub brak, cyfry/litery
    // FIX v6.6: Wymuszamy obecność PRZYNAJMNIEJ JEDNEJ CYFRY (\d) w drugiej grupie.
    // Dzięki temu słowa "MOTOCYKL", "HONDA", "MAZDA" nie są brane za rejestrację.
    REG_NUMBER: /(?:^|[\s_])([A-Z]{1,3})\s?([A-Z0-9]*\d[A-Z0-9]*)(?:$|[\s_])/i,
    
    VEHICLE_TYPE: {
        // FIX: Dodano marki ciężarówek oraz literówki (ciezarowy)
        CIEZAROWY: /ciężarowy|ciezarowy|dostawczy|furgon|iveco|transit|sprinter|ducato|boxer|jumper|master|movano|crafter|transporter|vito|caddy|man|scania|daf|actros|tgx|tgl|volvo fh|renault trucks/i,
        MOTOCYKL: /motocykl|motor|skuter|yamaha|honda cbr|kawasaki|suzuki gsx|ktm|junak|romet|vespa|piaggio/i,
        QUAD: /quad|atv|can-am|can am|bombardier|cfmoto|polaris/i,
        CIAGNIK: /ciągnik|ciagnik|siodłowy|rolniczy|ursus|zetor|new holland/i,
        PRZYCZEPA: /przyczepa|przyczepka|naczepa|kemping|camping/i,
        AUTOBUS: /autobus|bus \d+ os/i,
    },
    FUEL: {
        DIESEL: /diesel|olej|tdi|hdi|dci|cdti/i,
        LPG: /lpg|gaz/i,
        HYBRYDA: /hybryda|hybrid|phev|hev/i,
        ELEKTRYK: /elektryk|electric|ev/i,
        BENZYNA: /benzyna|pb|petrol/i
    },
    SPECS: {
        // Łapie: 1870 cm3, 1.9 tdi, 2.0, 1998ccm, 999 m3 (błąd w danych usera)
        CAPACITY: /(\d{3,5})\s*(cm3|ccm|m3)|(\d\.\d)\s*(tdi|hdi|tsi|tfsi|cdti)/i,
        // Łapie: 74KW, 150KM, 150 KM
        POWER: /(\d{2,3})\s*(kw|km)/i,
        // Łapie: prod 2006, 2006r, samo 2006 w kontekście (musi być 19xx lub 20xx)
        YEAR: /(?:prod\.?|rok|budowa)?\s*\b(19|20)\d{2}\b/i
    },

    // --- DOM ---
    HOME_TYPE: {
        MIESZKANIE: /mieszkanie|lokal|kamienica|blok/i,
        DOM: /dom[ _]|domu|jednorodzinny|bliźniak|szereg/i,
        BUDOWA: /budowa|budowie/i,
        LETNISKOWY: /letniskowy|domek/i
    },
    HOME_SPECS: {
        AREA: /(\d+([.,]\d{1,2})?)\s*(m2|mkw|metr)/i,
    }
};

/**
 * Zaawansowany parser dla "brudnych" stringów z Excela (Auta).
 * Strategia: Wyciągnij to co pewne (Rejestracja, Rok, Pojemność), 
 * usuń to ze stringa, a resztę potraktuj jako Markę/Opis.
 */
export const parseAutoString = (raw: string) => {
    if (!raw) return {};
    
    // KROK 0: Normalizacja Słownikowa (Nowość v6.3)
    // Zamienia "samoch" na "samochód", usuwa podłogi itp.
    let processingText = normalizeAgentInput(raw);
    
    // SAFETY GUARD: Jeśli tekst zawiera wyraźne słowa kluczowe domu, to NIE JEST AUTO.
    if (/(dom|mieszkanie|lokal|budowa|działka|nieruchomość|ul\.|al\.)/i.test(processingText)) {
        return {}; 
    }

    const result: any = {
        vehicleReg: '',
        vehicleBrand: '',
        autoDetails: {}
    };

    // 1. WYCIĄGANIE REJESTRACJI (Najważniejsze)
    const regMatch = processingText.match(PARSER_PATTERNS.REG_NUMBER);
    if (regMatch) {
        // Grupa 1 (wyróżnik) + Grupa 2 (reszta)
        const candidate = (regMatch[1] + regMatch[2]).toUpperCase();
        
        // Dodatkowe zabezpieczenie: Rejestracja rzadko jest rokiem (chyba że zabytek, ale tu zakładamy standard)
        // Oraz musi zawierać cyfrę (wymuszone przez regex, ale dla pewności)
        if (!/^(19|20)\d{2}$/.test(candidate) && candidate.length >= 4 && /\d/.test(candidate)) {
            result.vehicleReg = candidate;
            // Zastąp rejestrację SPACJĄ, aby nie skleić wyrazów
            processingText = processingText.replace(regMatch[0], ' '); 
        }
    }

    // 2. DETEKCJA DANYCH TECHNICZNYCH (Wyciągnij i zastąp spacją)
    const textLower = processingText.toLowerCase();

    // Typ
    if (PARSER_PATTERNS.VEHICLE_TYPE.CIEZAROWY.test(textLower)) result.autoDetails.vehicleType = 'CIEZAROWY';
    else if (PARSER_PATTERNS.VEHICLE_TYPE.MOTOCYKL.test(textLower)) result.autoDetails.vehicleType = 'MOTOCYKL';
    else if (PARSER_PATTERNS.VEHICLE_TYPE.QUAD.test(textLower)) result.autoDetails.vehicleType = 'QUAD';
    else if (PARSER_PATTERNS.VEHICLE_TYPE.CIAGNIK.test(textLower)) result.autoDetails.vehicleType = 'CIAGNIK';
    else if (PARSER_PATTERNS.VEHICLE_TYPE.PRZYCZEPA.test(textLower)) result.autoDetails.vehicleType = 'PRZYCZEPA';
    else if (PARSER_PATTERNS.VEHICLE_TYPE.AUTOBUS.test(textLower)) result.autoDetails.vehicleType = 'AUTOBUS';

    // Paliwo
    if (PARSER_PATTERNS.FUEL.DIESEL.test(textLower)) result.autoDetails.fuelType = 'DIESEL';
    else if (PARSER_PATTERNS.FUEL.LPG.test(textLower)) result.autoDetails.fuelType = 'LPG';
    else if (PARSER_PATTERNS.FUEL.HYBRYDA.test(textLower)) result.autoDetails.fuelType = 'HYBRYDA';
    else if (PARSER_PATTERNS.FUEL.ELEKTRYK.test(textLower)) result.autoDetails.fuelType = 'ELEKTRYK';
    else if (PARSER_PATTERNS.FUEL.BENZYNA.test(textLower)) result.autoDetails.fuelType = 'BENZYNA';

    // Pojemność
    const capMatch = processingText.match(PARSER_PATTERNS.SPECS.CAPACITY);
    if (capMatch) {
        const val = capMatch[1] || capMatch[3];
        if (val) {
            result.autoDetails.engineCapacity = val.replace('.', '');
            processingText = processingText.replace(capMatch[0], ' ');
        }
    }

    // Moc
    const powerMatch = processingText.match(PARSER_PATTERNS.SPECS.POWER);
    if (powerMatch) {
        result.autoDetails.enginePower = powerMatch[1];
        processingText = processingText.replace(powerMatch[0], ' ');
    }

    // Rok
    const yearMatch = processingText.match(PARSER_PATTERNS.SPECS.YEAR);
    if (yearMatch) {
        result.autoDetails.productionYear = yearMatch[1] || yearMatch[0];
        // Nie usuwamy roku całkowicie
    }

    // 3. CZYSZCZENIE "ŚMIECI" BY UZYSKAĆ MARKĘ
    let cleanBrand = processingText
        .replace(/samochód[\s]+|pojazd[\s]+|motocykl[\s]+|autobus[\s]+|przyczepa[\s]+|przyczepka[\s]+|quad[\s]+|ciężarowy[\s]+|ciezarowy[\s]+/gi, ' ') 
        .replace(/oc\/ac|oc|ac|nnw|ass|szyby|pakiet|kosztorys|serwis|pełen|opony|samo ac|komunikacyjne/gi, ' ') 
        .replace(/benzyna|diesel|olej napędowy/gi, ' ') 
        .replace(/[,/+]/g, ' ') 
        .replace(/\s+/g, ' ') 
        .trim();

    cleanBrand = cleanBrand.replace(/^samo\s/i, '');
    cleanBrand = cleanBrand.replace(/^osob\s/i, ''); 

    // Ostatnie czyszczenie, jeśli rejestracja została w nazwie (np. duplikat)
    if (result.vehicleReg) {
        cleanBrand = cleanBrand.replace(new RegExp(result.vehicleReg, 'gi'), '');
    }

    result.vehicleBrand = cleanBrand.trim() || raw; 

    return result;
};

export const parseHomeString = (raw: string) => {
    if (!raw) return {};
    const text = normalizeAgentInput(raw).toLowerCase();
    const result: any = {};

    if (PARSER_PATTERNS.HOME_TYPE.BUDOWA.test(text)) result.objectType = 'BUDOWA';
    else if (PARSER_PATTERNS.HOME_TYPE.LETNISKOWY.test(text)) result.objectType = 'LETNISKOWY';
    else if (PARSER_PATTERNS.HOME_TYPE.MIESZKANIE.test(text)) result.objectType = 'MIESZKANIE';
    else if (PARSER_PATTERNS.HOME_TYPE.DOM.test(text)) result.objectType = 'DOM';
    
    const areaMatch = text.match(PARSER_PATTERNS.HOME_SPECS.AREA);
    if (areaMatch) {
        const areaStr = areaMatch[1].replace(',', '.');
        result.area = parseFloat(areaStr);
    }

    const yearMatch = text.match(PARSER_PATTERNS.SPECS.YEAR);
    if (yearMatch) {
        result.yearBuilt = yearMatch[1] || yearMatch[0];
    }

    return result;
};
