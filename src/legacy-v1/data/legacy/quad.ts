
import { CleanData } from './types';

export const QUAD_MAP: Record<string, CleanData> = {
    // --- QUADY (ATV) ---
    "pojazd_Quad GKAL82R wcześniej GA425N_CAN- AM Bombardier Outlander Max 1000R X-TP, 976 cm3": {
        type: 'BOTH',
        vehicleReg: 'GKAL82R',
        vehicleBrand: 'CAN-AM',
        vehicleModel: 'Outlander Max 1000R',
        autoDetails: { 
            vehicleType: 'QUAD',
            engineCapacity: '976',
            ownership: 'LEASING',
            insuranceItems: 'Wcześniej rej GA425N',
            aiNote: 'PKO Leasing. Wartość 56730 netto.'
        }
    },
    "polisa zastępcza po rekalkulacji w PZU Quad_samochód_GD86S1_CFMOTO CForce 1000 Overland_2025_poj silnika 962 ccm": {
        type: 'AC', // Polisa na samo AC (zastępcza)
        vehicleReg: 'GD86S1',
        vehicleBrand: 'CFMOTO',
        vehicleModel: 'CForce 1000 Overland',
        autoDetails: { 
            vehicleType: 'QUAD',
            engineCapacity: '962',
            productionYear: '2025',
            ownership: 'LEASING',
            aiNote: 'Polisa zastępcza (Samo AC). Santander Leasing.'
        }
    },
    "pojazd_Quad GD72N6_CAN- AM Bombardier Outlander 1000R, 976 cm3, 2024": {
        type: 'OC',
        vehicleReg: 'GD72N6',
        vehicleBrand: 'CAN-AM',
        vehicleModel: 'Outlander 1000R',
        autoDetails: { 
            vehicleType: 'QUAD',
            engineCapacity: '976',
            productionYear: '2024',
            ownership: 'LEASING',
            aiNote: 'Santander Leasing.'
        }
    }
};
