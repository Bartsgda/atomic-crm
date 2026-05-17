
import { PolicyType, VehicleSubType } from '../../types';

export interface CleanData {
    type: PolicyType;
    // Auto
    vehicleBrand?: string;
    vehicleModel?: string; 
    vehicleReg?: string;
    // Dom / Firma
    propertyAddress?: string;
    // Podróż
    destinationCountry?: string;
    travelStartDate?: string;
    travelEndDate?: string;
    // Firma
    businessType?: 'MAJATEK' | 'OC_DZIALALNOSCI' | 'OC_ZAWODOWE' | 'OCPD' | 'FLOTA' | 'INNE';
    
    aiNote?: string;

    // Detale techniczne
    autoDetails?: {
        vehicleType?: VehicleSubType;
        productionYear?: string;
        engineCapacity?: string;
        enginePower?: string;
        fuelType?: 'BENZYNA' | 'DIESEL' | 'LPG' | 'HYBRYDA' | 'ELEKTRYK';
        mileage?: number;
        acVariant?: 'KOSZTORYS' | 'ASO' | 'PARTNER';
        vehicleValue?: number;
        vehicleValueType?: 'BRUTTO' | 'NETTO';
        windows?: boolean;
        tires?: boolean;
        ownership?: 'PRYWATNA' | 'LEASING' | 'KREDYT';
        assistanceVariant?: 'PODSTAWOWY' | 'ROZSZERZONY' | 'VIP';
        towingLimitPL?: 'BRAK' | '100KM' | '200KM' | '500KM' | 'NO_LIMIT';
        insuranceItems?: string;
        aiNote?: string; 
    };
    homeDetails?: {
        area?: number;
        yearBuilt?: string;
        objectType?: 'DOM' | 'MIESZKANIE' | 'BUDOWA' | 'LETNISKOWY';
        sumWalls?: number;
        sumItems?: number;
        sumFixedElements?: number;
        constructionType?: 'MUROWANA' | 'DREWNIANA' | 'INNA';
        ownershipType?: 'WLASNOSC' | 'SPOLDZIELCZE' | 'NAJEMCA' | 'WYNAJMUJACY';
        securityType?: 'STANDARD' | 'DRZWI_ATEST' | 'ALARM' | 'MONITORING';
        ocPrivate?: boolean;
        assignmentBank?: string;
        aiNote?: string;
    };
    travelDetails?: {
        zone?: 'EUROPA' | 'SWIAT';
        participantsCount?: number;
        durationDays?: number;
        sumMedical?: number;
    };
    lifeDetails?: {
        lifeType: 'INDYWIDUALNA' | 'GRUPOWA' | 'SZKOLNA';
        sumDeath: number;
        hospital: boolean;
        seriousIllness: boolean;
    };
}
