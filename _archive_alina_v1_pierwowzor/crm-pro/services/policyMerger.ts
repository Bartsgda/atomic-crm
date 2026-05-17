
import { Policy, SalesStage } from '../types';

// HIERARCHIA STATUSÓW (Im wyżej, tym ważniejszy)
const STAGE_WEIGHT: Record<string, number> = {
    'sprzedaż': 100,
    'sprzedany': 100,
    'oferta_wysłana': 50,
    'of_przedst': 50,
    'przeł kontakt': 40,
    'of_do zrobienia': 30,
    'czekam na dane/dokum': 30,
    'ucięty kontakt': 20,
    'rez po ofercie_kont za rok': 10,
    'inne': 0
};

export class PolicyMerger {

    private static resolveStage(s1: string, s2: string): SalesStage {
        const w1 = STAGE_WEIGHT[s1] || 0;
        const w2 = STAGE_WEIGHT[s2] || 0;
        return w1 >= w2 ? (s1 as SalesStage) : (s2 as SalesStage);
    }

    private static pickBestString(v1: string | undefined, v2: string | undefined, blockList: string[] = ['Inne', 'Agent', 'Brak']): string {
        const val1 = v1?.trim() || '';
        const val2 = v2?.trim() || '';
        
        // Jeśli pierwszy jest pusty lub zablokowany, bierzemy drugi (o ile jest dobry)
        if (!val1 || blockList.includes(val1)) {
            return (val2 && !blockList.includes(val2)) ? val2 : val1; // Zwróć val1 jeśli val2 też słabe
        }
        
        // Jeśli pierwszy jest dobry, zostawiamy go (ochrona danych)
        return val1;
    }

    /**
     * Scala 'source' do 'target'.
     * Target to zazwyczaj rekord istniejący w bazie (ważniejszy).
     * Source to nowy wiersz z importu (uzupełniający).
     */
    static merge(target: Policy, source: Policy): Policy {
        const merged = { ...target };

        // 1. STATUS (Stronger wins)
        merged.stage = this.resolveStage(target.stage, source.stage);

        // 2. DANE KRYTYCZNE (Ochrona przed nadpisaniem pustym)
        merged.policyNumber = this.pickBestString(target.policyNumber, source.policyNumber);
        merged.insurerName = this.pickBestString(target.insurerName, source.insurerName);
        merged.vehicleReg = this.pickBestString(target.vehicleReg, source.vehicleReg);
        merged.vehicleVin = this.pickBestString(target.vehicleVin, source.vehicleVin);
        
        // 3. FINANSE (Addytywne)
        // Jeśli to ten sam rekord (np. rata), sumujemy.
        // Jeśli duplikat, sumujemy.
        merged.premium = (Number(target.premium) || 0) + (Number(source.premium) || 0);
        merged.commission = (Number(target.commission) || 0) + (Number(source.commission) || 0);
        merged.subAgentCommission = (Number(target.subAgentCommission) || 0) + (Number(source.subAgentCommission) || 0);

        // 4. TYP (Upgrade OC -> BOTH)
        if (['OC', 'AC', 'BOTH'].includes(target.type) && ['OC', 'AC', 'BOTH'].includes(source.type)) {
            if (target.type !== source.type) merged.type = 'BOTH';
        }

        // 5. DETALE POJAZDU (Uzupełnianie braków)
        if (!merged.autoDetails) merged.autoDetails = {} as any;
        if (source.autoDetails) {
            // Przepisujemy tylko jeśli w Target brakuje
            if (!merged.autoDetails.productionYear && source.autoDetails.productionYear) merged.autoDetails.productionYear = source.autoDetails.productionYear;
            if (!merged.autoDetails.engineCapacity && source.autoDetails.engineCapacity) merged.autoDetails.engineCapacity = source.autoDetails.engineCapacity;
            if (!merged.autoDetails.vehicleType && source.autoDetails.vehicleType) merged.autoDetails.vehicleType = source.autoDetails.vehicleType;
        }

        // 6. SUB AGENTS
        // Scalamy tablice podziałów
        const splits = [...(target.subAgentSplits || []), ...(source.subAgentSplits || [])];
        merged.subAgentSplits = splits;

        return merged;
    }
}
