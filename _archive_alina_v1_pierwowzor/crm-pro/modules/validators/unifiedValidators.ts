
// CENTRALNY MODUŁ WALIDACJI DANYCH
// Używany do "Traffic Lights" (wizualizacji) oraz blokady zapisu (Submit Guard)

export const Validators = {
    
    // --- 1. IDENTYFIKATORY ---

    isPeselValid: (pesel: string): boolean => {
        if (!pesel) return false;
        const clean = pesel.replace(/\D/g, '');
        if (clean.length !== 11) return false;
        
        // Algorytm wag (uproszczony do sumy kontrolnej)
        const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(clean[i]) * weights[i];
        }
        const controlDigit = (10 - (sum % 10)) % 10;
        return controlDigit === parseInt(clean[10]);
    },

    isNipValid: (nip: string): boolean => {
        if (!nip) return false;
        const clean = nip.replace(/\D/g, '');
        if (clean.length !== 10) return false;

        const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(clean[i]) * weights[i];
        }
        const controlDigit = sum % 11;
        return controlDigit === parseInt(clean[9]);
    },

    isRegonValid: (regon: string): boolean => {
        if (!regon) return false;
        const clean = regon.replace(/\D/g, '');
        return clean.length === 9 || clean.length === 14; 
    },

    isKrsValid: (krs: string): boolean => {
        if (!krs) return false;
        const clean = krs.replace(/\D/g, '');
        return clean.length === 10;
    },

    isZipCodeValid: (zip: string): boolean => {
        if (!zip) return false;
        // Format XX-XXX
        return /^\d{2}-\d{3}$/.test(zip);
    },

    // --- 2. KONTAKT ---

    isEmailValid: (email: string): boolean => {
        if (!email) return false; // Pusty nie jest poprawny (jeśli jest wpisywany)
        return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
    },

    isPhoneValid: (number: string, prefix: string = '+48'): boolean => {
        if (!number) return false;
        const cleanNumber = number.replace(/\D/g, '');
        
        if (!cleanNumber) return false;

        if (prefix === '+48' || prefix === 'PL') {
            // Polska: Dokładnie 9 cyfr
            return cleanNumber.length === 9;
        } else {
            // Zagranica: Luźniej, ale bez przesady (standard ITU to max 15, min zazwyczaj 7)
            return cleanNumber.length >= 7 && cleanNumber.length <= 15;
        }
    }
};

// --- FORMATERY (INPUT MASKING) ---
// Służą do fizycznego wycinania liter/znaków podczas pisania
export const Formatters = {
    
    // Tylko cyfry (dla REGON, KRS, Telefon, PESEL)
    onlyDigits: (val: string, maxLength?: number): string => {
        if (!val) return '';
        let clean = val.replace(/\D/g, ''); // Wywal wszystko co nie jest cyfrą
        if (maxLength && clean.length > maxLength) {
            clean = clean.substring(0, maxLength);
        }
        return clean;
    },

    // Kod Pocztowy (XX-XXX) - wymusza myślnik, blokuje litery
    zipCode: (val: string): string => {
        if (!val) return '';
        const clean = val.replace(/\D/g, ''); // Tylko cyfry
        
        if (clean.length > 2) {
            return `${clean.slice(0, 2)}-${clean.slice(2, 5)}`;
        }
        return clean;
    },

    // NIP (XXX-XXX-XX-XX) - formatowanie z myślnikami dla czytelności
    nip: (val: string): string => {
        if (!val) return '';
        const v = val.replace(/\D/g, '').substring(0, 10); 
        if (v.length > 8) return `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6, 8)}-${v.slice(8, 10)}`;
        if (v.length > 6) return `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}`;
        if (v.length > 3) return `${v.slice(0, 3)}-${v.slice(3)}`;
        return v;
    }
};

// Pomocnik do stylów CSS (Traffic Lights)
export const getValidationStatusClass = (isValid: boolean, isEmpty: boolean, baseClass: string) => {
    if (isEmpty) return baseClass; // Neutralny (szary/biały)
    
    if (isValid) {
        return `${baseClass} border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300`;
    } else {
        return `${baseClass} border-red-500 ring-2 ring-red-500/10 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-300`;
    }
};
