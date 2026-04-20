
import { CleanData } from './types';

export const PROPERTY_MAP: Record<string, CleanData> = {
    "dom_Jagiełły 4": { type: 'DOM', propertyAddress: 'Bojano, ul. Jagiełły 4', homeDetails: { objectType: 'DOM' } },
    "dom_Księżycowa 35": { type: 'DOM', propertyAddress: 'Banino, ul. Księżycowa 35', homeDetails: { objectType: 'DOM' } },
    "dom_Rumiankowa 1": { type: 'DOM', propertyAddress: '83-032 Pszczółki, ul. Rumiankowa 1', homeDetails: { objectType: 'DOM', aiNote: 'Współwł. Magdalena Zaborowska.' } },
    "mieszkanie_Ciechanowska 3B/2_budowa 1991, parter, okna antywłamaniowe, alarm, 77,58 m2 mieszkanie i piwnica połącznona z mieszkaniem": {
        type: 'DOM', propertyAddress: 'Gdańsk, ul. Ciechanowska 3B/2',
        homeDetails: { objectType: 'MIESZKANIE', area: 77.58, yearBuilt: '1991', securityType: 'ALARM', aiNote: 'Parter, okna antywłamaniowe.' }
    },
    "dom_Płocka 60, 175 m2 SU 1 500 00zł i dodatki": {
        type: 'DOM', propertyAddress: 'Gdańsk, ul. Płocka 60',
        homeDetails: { objectType: 'DOM', area: 175, sumWalls: 1500000, ocPrivate: true, aiNote: 'Dodano powódź aneksem. Cesja na Bank Spółdzielczy.' }
    },
    "majątek_domek letniskowy_ 77-124 Parchowo Parchowski Młyn 354/3_budowa 2015, 25m2, SU 100 tys, ogrodzenie 5 tys, el ruchome 5 tys, OC 100 tys": {
        type: 'DOM', propertyAddress: 'Parchowo Parchowski Młyn 354/3',
        homeDetails: { objectType: 'LETNISKOWY', yearBuilt: '2015', area: 25, sumWalls: 100000, sumItems: 5000, ocPrivate: true }
    },
    "firma_mienie_mury ul. Kościerska 1A": {
        type: 'FIRMA', businessType: 'MAJATEK', propertyAddress: 'Gdańsk, ul. Kościerska 1A',
        aiNote: 'Polisa PZU. Aneks do polisy na mury.'
    },
    "firma_środki obrotowe_ul. Kościerska 1A": {
        type: 'FIRMA', businessType: 'MAJATEK', propertyAddress: 'Gdańsk, ul. Kościerska 1A',
        aiNote: 'Środki obrotowe. Branża wysokiego ryzyka (Parkiety/Drewno). Składka ok. 10k.'
    },
    "flota 60 pojazdów na 3 różne firmy_WGM3815L": {
        type: 'FIRMA', businessType: 'FLOTA', vehicleReg: 'WGM3815L',
        autoDetails: { 
            vehicleType: 'FLOTA', 
            insuranceItems: '60 pojazdów; 3 firmy;', 
            aiNote: 'Start od Iveco Plandeka (sierpień). Kontakt z Panią Patrycją.'
        }
    },
    "firma_przyczepa ThePhoenixBarber": {
        type: 'FIRMA', businessType: 'MAJATEK', vehicleBrand: 'Przyczepa', 
        autoDetails: { vehicleType: 'PRZYCZEPA', insuranceItems: 'Gastronomiczna / Usługowa' }
    }
};
