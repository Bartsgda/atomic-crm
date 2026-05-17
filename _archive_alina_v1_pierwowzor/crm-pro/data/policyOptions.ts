
import { PolicyType } from '../types';

export interface PolicyCategoryConfig {
  value: PolicyType;
  label: string;
  isVehicle: boolean; // Czy to ubezpieczenie komunikacyjne?
  fields: {
    brandLabel: string; // Etykieta dla pola vehicleBrand
    regLabel: string;   // Etykieta dla pola vehicleReg
    showVin: boolean;   // Czy pokazywać VIN
    showReg: boolean;   // Czy pokazywać Nr Rejestracyjny
  }
}

export const POLICY_CATEGORIES: PolicyCategoryConfig[] = [
  { 
    value: 'OC', 
    label: 'AUTO (OC)', 
    isVehicle: true,
    fields: { brandLabel: 'Marka pojazdu', regLabel: 'Nr Rejestracyjny', showVin: true, showReg: true }
  },
  { 
    value: 'AC', 
    label: 'AUTO (PAKIET)', 
    isVehicle: true,
    fields: { brandLabel: 'Marka pojazdu', regLabel: 'Nr Rejestracyjny', showVin: true, showReg: true }
  },
  { 
    value: 'DOM', 
    label: 'DOM / MIESZKANIE', 
    isVehicle: false,
    fields: { brandLabel: 'Adres nieruchomości / Opis', regLabel: '', showVin: false, showReg: false }
  },
  { 
    value: 'ZYCIE', 
    label: 'ŻYCIE / ZDROWIE', 
    isVehicle: false,
    fields: { brandLabel: 'Rodzaj polisy (np. Grupowa)', regLabel: '', showVin: false, showReg: false }
  },
  { 
    value: 'PODROZ', 
    label: 'TURYSTYCZNA', 
    isVehicle: false,
    fields: { brandLabel: 'Kierunek / Cel', regLabel: '', showVin: false, showReg: false }
  },
  { 
    value: 'FIRMA', 
    label: 'FIRMA', 
    isVehicle: false,
    fields: { brandLabel: 'Rodzaj działalności', regLabel: 'NIP', showVin: false, showReg: true }
  },
  { 
    value: 'INNE', 
    label: 'INNE', 
    isVehicle: false,
    fields: { brandLabel: 'Przedmiot ubezpieczenia', regLabel: 'Szczegóły', showVin: false, showReg: true }
  }
];

export const DEFAULT_OWU_TEXT = {
  AC: 'Niniejszym wypowiadam umowę ubezpieczenia Autocasco (AC) zgodnie z obowiązującymi Ogólnymi Warunkami Ubezpieczenia (OWU).',
  NON_VEHICLE: 'Niniejszym wypowiadam umowę ubezpieczenia z zachowaniem okresu wypowiedzenia określonego w Ogólnych Warunkach Ubezpieczenia (OWU).'
};
