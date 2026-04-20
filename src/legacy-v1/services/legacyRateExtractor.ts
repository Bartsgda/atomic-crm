
import { Policy, SubAgent, PolicyType } from '../types';
import { calculateRate } from '../modules/utils/currencyUtils';

/**
 * Analizuje historię polis i wykrywa domyślne stawki prowizyjne dla pośredników.
 */
export class LegacyRateExtractor {

    static extractAndApplyRates(policies: Policy[], subAgents: SubAgent[]): SubAgent[] {
        // 1. Struktura do zbierania danych: AgentID -> Typ -> Mapa stawek (Stawka -> Licznik)
        const stats: Record<string, Record<string, Record<number, number>>> = {};

        // Inicjalizacja struktury
        subAgents.forEach(agent => {
            stats[agent.id] = {};
        });

        // 2. Analiza Polis
        policies.forEach(p => {
            const premium = typeof p.premium === 'number' ? p.premium : parseFloat(p.premium) || 0;
            
            // Sprawdzamy oba źródła przypisania agenta (nowe splits i stare pole)
            let agentId: string | undefined;
            let commissionAmt = 0;

            if (p.subAgentSplits && p.subAgentSplits.length > 0) {
                // Bierzemy pierwszego agenta (uproszczenie dla importu)
                agentId = p.subAgentSplits[0].agentId;
                commissionAmt = p.subAgentSplits[0].amount;
            } else if (p.subAgentId) {
                agentId = p.subAgentId;
                commissionAmt = p.subAgentCommission || 0;
            }

            if (agentId && stats[agentId] && premium > 0 && commissionAmt > 0) {
                const rate = calculateRate(premium, commissionAmt);
                
                // Ignorujemy skrajne wartości (błędy danych)
                if (rate > 0 && rate < 100) {
                    const type = p.type || 'INNE';
                    
                    if (!stats[agentId][type]) stats[agentId][type] = {};
                    
                    // Zliczamy wystąpienia tej stawki
                    stats[agentId][type][rate] = (stats[agentId][type][rate] || 0) + 1;
                }
            }
        });

        // 3. Wyciąganie wniosków (Aktualizacja Agentów)
        return subAgents.map(agent => {
            const agentStats = stats[agent.id];
            if (!agentStats) return agent;

            const newRates = { ...agent.defaultRates };
            let hasUpdates = false;

            Object.keys(agentStats).forEach(type => {
                const ratesMap = agentStats[type];
                
                // Znajdź dominantę (najczęstszą stawkę)
                let bestRate = 0;
                let maxCount = 0;

                Object.entries(ratesMap).forEach(([rateStr, count]) => {
                    const rate = parseFloat(rateStr);
                    if (count > maxCount) {
                        maxCount = count;
                        bestRate = rate;
                    }
                });

                // Jeśli mamy silny sygnał (np. min 2 wystąpienia), aktualizujemy
                // Ale nie nadpisujemy, jeśli już jest coś ustawione ręcznie (zakładamy że 0 to brak ustawienia)
                // Daje to pierwszeństwo danym z Excela
                if (maxCount >= 1 && bestRate > 0) {
                    // Logic: Nadpisz tylko jeśli obecna stawka to 0 lub standardowa wartość z seeda (np. całkowita liczba typu 2, 5, 10, 15)
                    if (!newRates[type] || newRates[type] === 0 || [2, 5, 10, 15].includes(newRates[type])) {
                        newRates[type] = bestRate;
                        hasUpdates = true;
                    }
                }
            });

            if (hasUpdates) {
                return { ...agent, defaultRates: newRates };
            }
            return agent;
        });
    }
}
