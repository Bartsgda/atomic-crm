
import { CleanData } from './types';

export const AUTO_MAP: Record<string, CleanData> = {
    // --- MAN TGL ---
    "samochód ciężarowy_OC łyse_EZG24Y7 MAN TGL_2012 4580 cm3 162 kW 11990": {
        type: 'OC', vehicleReg: 'EZG24Y7', vehicleBrand: 'MAN', vehicleModel: 'TGL',
        autoDetails: { 
            vehicleType: 'CIEZAROWY', 
            productionYear: '2012', 
            engineCapacity: '4580', 
            enginePower: '162', 
            fuelType: 'DIESEL',
            insuranceItems: 'OC Łyse; DMC 11990;',
            aiNote: 'Polisa po zmianie własności. Tomasz Olszewski.'
        }
    },
    "samochód_GD721YL_Volvo XC60_poj 1968 cm3, 140KW, D, 5 miejsc_ prod 2017, pierwsza 08.12.2017, Inscription AWD": {
        type: 'BOTH', vehicleReg: 'GD721YL', vehicleBrand: 'Volvo', vehicleModel: 'XC60 Inscription AWD',
        autoDetails: { 
            vehicleType: 'OSOBOWY', productionYear: '2017', engineCapacity: '1968', enginePower: '140', fuelType: 'DIESEL',
            acVariant: 'ASO', ownership: 'PRYWATNA', insuranceItems: 'AWD; Inscription; 5 miejsc;',
            aiNote: 'Wykupiony z leasingu. Polisa HDI.'
        }
    },
    "pojazd_Quad GKAL82R wcześniej GA425N_CAN- AM Bombardier Outlander Max 1000R X-TP, 976 cm3": {
        type: 'BOTH', vehicleReg: 'GKAL82R', vehicleBrand: 'CAN-AM', vehicleModel: 'Outlander Max 1000R',
        autoDetails: { 
            vehicleType: 'QUAD', engineCapacity: '976', ownership: 'LEASING',
            insuranceItems: 'Wcześniej rej GA425N',
            aiNote: 'PKO Leasing. Wartość 56730 netto. Uwaga na GAP.'
        }
    },
    "samochód_GKA88830_ Volkswagen Caravelle 6.1 2.0 TDI Trendline DSG, z dowodu rej. Kombi, bez podwyższenia i wydłużenia, automat,4 drzwiowy, napęd 4x4": {
        type: 'BOTH', vehicleReg: 'GKA88830', vehicleBrand: 'Volkswagen', vehicleModel: 'Caravelle 6.1',
        autoDetails: {
            vehicleType: 'OSOBOWY', engineCapacity: '2000', fuelType: 'DIESEL', acVariant: 'KOSZTORYS',
            insuranceItems: '4x4 (4Motion); DSG; Trendline; Kombi;',
            aiNote: 'Klient wybrał tańszy wariant AC (Kosztorys).'
        }
    },
    "samochód_GD707NN_Ford Focus 2,3 Ecoboost MR'15 RS, 2290 cm3, 257 kW, pierw rej 24-05-2017, benzyna_samo AC z dodatkami": {
        type: 'AC', vehicleReg: 'GD707NN', vehicleBrand: 'Ford', vehicleModel: 'Focus RS',
        autoDetails: {
            vehicleType: 'OSOBOWY', productionYear: '2017', engineCapacity: '2290', enginePower: '257', fuelType: 'BENZYNA',
            acVariant: 'ASO', insuranceItems: 'Wersja RS; Samo AC;',
            aiNote: 'Klient bardzo zadowolony. Model sportowy.'
        }
    },
    "samochód_GWE9310K Skoda Fabia": { type: 'OC', vehicleReg: 'GWE9310K', vehicleBrand: 'Skoda', vehicleModel: 'Fabia', autoDetails: { vehicleType: 'OSOBOWY' } },
    "samochód_GD321YK": { type: 'OC', vehicleReg: 'GD321YK', autoDetails: { vehicleType: 'OSOBOWY' } },
    "samochód_GKA7367E": { type: 'OC', vehicleReg: 'GKA7367E', autoDetails: { vehicleType: 'OSOBOWY' } },
    "samochód_GKA66243": { type: 'OC', vehicleReg: 'GKA66243', autoDetails: { vehicleType: 'OSOBOWY' } },
    "samochód_GDA32773": { type: 'OC', vehicleReg: 'GDA32773', autoDetails: { vehicleType: 'OSOBOWY' } },
    "samochód_GWE98928": { type: 'OC', vehicleReg: 'GWE98928', autoDetails: { vehicleType: 'OSOBOWY' } },
    "samochód_GD896HK Mazda CX5 i dom": { type: 'OC', vehicleReg: 'GD896HK', vehicleBrand: 'Mazda', vehicleModel: 'CX-5', autoDetails: { vehicleType: 'OSOBOWY' } },
    "samochód_GSP59VL_ Opel Karl Enjoy 999 cm3 55kw ": { type: 'OC', vehicleReg: 'GSP59VL', vehicleBrand: 'Opel', vehicleModel: 'Karl', autoDetails: { vehicleType: 'OSOBOWY', engineCapacity: '999', enginePower: '55', fuelType: 'BENZYNA' } }
};
