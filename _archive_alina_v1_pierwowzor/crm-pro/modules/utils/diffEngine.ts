
import { Policy } from '../../types';
import { VisualDiffState } from '../../ai/KaratekaTypes';

/**
 * Porównuje stary stan polisy z nowym (z AI) i generuje mapę różnic.
 * Obsługuje płaskie pola oraz zagnieżdżony obiekt autoDetails.
 */
export const calculateAiDiffs = (oldPolicy: Policy | undefined, newPolicy: Policy): Record<string, VisualDiffState> => {
    const diffs: Record<string, VisualDiffState> = {};
    if (!oldPolicy) return diffs;

    // Helper do bezpiecznego porównywania (String vs Number safe)
    const normalize = (val: any) => {
        if (val === null || val === undefined) return '';
        return String(val).trim();
    };

    const checkDiff = (key: string, oldVal: any, newVal: any, path: string) => {
        // Ignoruj puste/null/undefined zmiany w nowym obiekcie (AI nie musi zwracać wszystkiego)
        if (newVal === null || newVal === undefined || newVal === '') return;
        
        // Luźne porównanie (aby "2012" == 2012 nie było różnicą)
        if (normalize(oldVal) === normalize(newVal)) return;

        diffs[path] = {
            originalValue: oldVal,
            aiValue: newVal,
            status: 'PENDING'
        };
    };

    // 1. Pola Główne
    checkDiff('vehicleBrand', oldPolicy.vehicleBrand, newPolicy.vehicleBrand, 'vehicleBrand');
    checkDiff('vehicleModel', oldPolicy.vehicleModel, newPolicy.vehicleModel, 'vehicleModel');
    checkDiff('vehicleReg', oldPolicy.vehicleReg, newPolicy.vehicleReg, 'vehicleReg');
    checkDiff('vehicleVin', oldPolicy.vehicleVin, newPolicy.vehicleVin, 'vehicleVin');
    checkDiff('insurerName', oldPolicy.insurerName, newPolicy.insurerName, 'insurerName');
    checkDiff('premium', oldPolicy.premium, newPolicy.premium, 'premium');

    // 2. Auto Details (Zagnieżdżone)
    const oldAuto = oldPolicy.autoDetails || {};
    const newAuto = newPolicy.autoDetails || {};

    // Lista pól w autoDetails, które chcemy śledzić
    const autoKeys = [
        'productionYear', 'engineCapacity', 'enginePower', 'fuelType', 
        'vehicleType', 'mileage', 'vehicleValue', 'vehicleValueType',
        'tires', 'windows', 'acVariant', 'insuranceItems' // DODANO insuranceItems
    ];

    autoKeys.forEach(key => {
        // @ts-ignore
        checkDiff(key, oldAuto[key], newAuto[key], `autoDetails.${key}`);
    });

    return diffs;
};

/**
 * Inteligentne scalanie (Merge) danych z AI do struktury Polisy.
 * Mapuje płaskie odpowiedzi AI na zagnieżdżone struktury TypeScript.
 */
export const mergeAiResponseToPolicy = (currentPolicy: Policy, aiUpdates: any): Policy => {
    const p = { ...currentPolicy };
    const u = aiUpdates;

    // --- MAPOWANIE PÓŁ PŁASKICH NA ZAGNIEŻDŻONE (Auto Fix) ---
    // Jeśli AI zwróciło "productionYear" w głównym obiekcie, przenieś do autoDetails
    if (!p.autoDetails) p.autoDetails = {} as any;

    if (u.productionYear) p.autoDetails!.productionYear = u.productionYear;
    if (u.engineCapacity) p.autoDetails!.engineCapacity = u.engineCapacity;
    if (u.enginePower) p.autoDetails!.enginePower = u.enginePower;
    if (u.fuelType) p.autoDetails!.fuelType = u.fuelType;
    if (u.mileage) p.autoDetails!.mileage = u.mileage;
    if (u.vehicleType) p.autoDetails!.vehicleType = u.vehicleType;
    
    // Checkboxy
    if (u.windows !== undefined) p.autoDetails!.windows = u.windows;
    if (u.tires !== undefined) p.autoDetails!.tires = u.tires;

    // --- MAPOWANIE PÓŁ GŁÓWNYCH ---
    if (u.vehicleBrand) p.vehicleBrand = u.vehicleBrand;
    if (u.vehicleModel) p.vehicleModel = u.vehicleModel;
    if (u.vehicleReg) p.vehicleReg = u.vehicleReg;
    if (u.vehicleVin) p.vehicleVin = u.vehicleVin;
    if (u.insurerName) p.insurerName = u.insurerName;
    if (u.premium) p.premium = u.premium;

    // Obsługa zagnieżdżonego autoDetails jeśli AI zwróciło obiekt
    // WAŻNE: To nadpisuje ręczne przypisania wyżej, jeśli AI zwróciło już zagnieżdżony obiekt
    if (u.autoDetails) {
        // Głębokie scalanie autoDetails (zachowuje istniejące pola, nadpisuje nowe)
        p.autoDetails = { 
            ...p.autoDetails, 
            ...u.autoDetails 
        };
    }

    return p;
};
