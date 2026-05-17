
import { CleanData } from './types';

export const TRAILER_MAP: Record<string, CleanData> = {
    // --- PRZYCZEPY (FOOD TRUCKI, KEMPINGI, LEKKIE) ---
    "firma_przyczepa ThePhoenixBarber": {
        type: 'FIRMA', // Traktujemy jako majątek firmowy
        businessType: 'MAJATEK',
        vehicleBrand: 'Przyczepa',
        autoDetails: { 
            vehicleType: 'PRZYCZEPA',
            insuranceItems: 'Gastronomiczna / Usługowa',
            aiNote: 'Klient wstrzymuje się ze względu na koszt. Oferta PZU/Generali.'
        }
    },
    "przyczepa_GDA25PP": {
        type: 'OC',
        vehicleReg: 'GDA25PP',
        autoDetails: { vehicleType: 'PRZYCZEPA' }
    },
    "Przyczepa_GD075YX": {
        type: 'OC',
        vehicleReg: 'GD075YX',
        autoDetails: { vehicleType: 'PRZYCZEPA' }
    },
    "przyczepa_GD4X797_Temared 8 14B SGV": {
        type: 'OC',
        vehicleBrand: 'Temared',
        vehicleModel: '8 14B SGV',
        vehicleReg: 'GD4X797',
        autoDetails: { vehicleType: 'PRZYCZEPA' }
    },
    "przyczepka_GKATJ79SAM model SAM prod 2009": {
        type: 'OC',
        vehicleBrand: 'SAM',
        vehicleModel: 'SAM',
        vehicleReg: 'GKATJ79',
        autoDetails: { 
            vehicleType: 'PRZYCZEPA',
            productionYear: '2009'
        }
    }
};
