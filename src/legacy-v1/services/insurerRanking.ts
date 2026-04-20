
import { Policy, PolicyType } from '../types';
import { INSURERS, Insurer } from '../towarzystwa';

/**
 * Algorytm sortowania towarzystw ubezpieczeniowych (Smart Ranking).
 * 
 * Zasada działania:
 * 1. Analizuje całą historię polis agenta (`existingPolicies`).
 * 2. Filtruje polisy pod kątem aktualnie wybranego typu (np. 'OC').
 * 3. Zlicza wystąpienia każdego towarzystwa.
 * 4. Zwraca listę towarzystw posortowaną wg popularności (malejąco), a następnie alfabetycznie.
 */
export const getSortedInsurers = (
    allPolicies: Policy[] = [], 
    currentType: PolicyType = 'OC'
): Insurer[] => {
    
    // 1. Mapa liczników (Frequency Map)
    const usageMap: Record<string, number> = {};

    // 2. Analiza historii
    allPolicies.forEach(policy => {
        if (policy.type === currentType && policy.insurerName) {
            const name = policy.insurerName;
            usageMap[name] = (usageMap[name] || 0) + 1;
        }
    });

    // 3. Klonowanie i sortowanie listy bazowej
    // Używamy slice(), aby nie modyfikować oryginalnej tablicy INSURERS
    const sortedList = [...INSURERS].sort((a, b) => {
        const countA = usageMap[a.name] || 0;
        const countB = usageMap[b.name] || 0;

        // Priorytet 1: Liczba użyć (Malejąco)
        if (countB !== countA) {
            return countB - countA;
        }

        // Priorytet 2: Alfabetycznie (Rosnąco)
        return a.name.localeCompare(b.name);
    });

    return sortedList;
};
