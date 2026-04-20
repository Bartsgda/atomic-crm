
import { CleanData } from './types';

export const BUSINESS_MAP: Record<string, CleanData> = {
    // --- OC DZIAŁALNOŚCI / ZAWODOWE ---
    "OC_działalności gospodarczej": { 
        type: 'FIRMA', 
        businessType: 'OC_DZIALALNOSCI',
        aiNote: 'Ogólne OC firmy.'
    },
    "OC_przedsiębiorcy": { 
        type: 'FIRMA', 
        businessType: 'OC_DZIALALNOSCI',
        aiNote: 'OC Przedsiębiorcy.'
    },
    "OC zawodowe_obowiązkowe NZOZ_dla podmiotów leczniczycz Kłóbka 10+ ubezp kosztów prawnych 60 tys i dobrowolne OC dodatkowe na 200 tys.": {
        type: 'FIRMA',
        businessType: 'OC_ZAWODOWE',
        propertyAddress: 'Kłóbka 10', // Wyciągnięte z tekstu
        aiNote: 'Obowiązkowe OC Podmiotu Leczniczego (NZOZ). Zawiera Klauzulę Kosztów Prawnych (60k) i Dobrowolne (200k).'
    },
    "OCPD": {
        type: 'FIRMA',
        businessType: 'OCPD', // Przewoźnik
        aiNote: 'Ubezpieczenie Odpowiedzialności Cywilnej Przewoźnika.'
    },
    
    // --- INNE FIRMOWE ---
    "firma_Deja Vu ": {
        type: 'FIRMA',
        vehicleBrand: 'Deja Vu',
        aiNote: 'Działalność gospodarcza (nazwa własna).'
    },
    "firma_Betop By": {
        type: 'FIRMA',
        vehicleBrand: 'Betop By',
        aiNote: 'Firma budowlana/usługowa.'
    }
};
