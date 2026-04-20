
import { Policy, Client, ClientNote } from '../types';
import { format, isValid } from 'date-fns';

export class ReverseMapper {

    private static fmtDate(iso?: string): string {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
        } catch { return ''; }
    }

    private static fmtMoney(val?: number): number | string {
        return typeof val === 'number' ? val : '';
    }

    static generateProductString(p: Policy): string {
        if (p.originalProductString && !p.vehicleBrand && !p.propertyAddress) return p.originalProductString;

        const reg = p.vehicleReg || '';
        const brand = p.vehicleBrand || '';
        const model = p.vehicleModel || '';
        const addr = p.propertyAddress || '';
        const dest = p.destinationCountry || '';

        let techDetails = '';
        if (p.autoDetails) {
            const parts = [];
            if (p.autoDetails.productionYear) parts.push(p.autoDetails.productionYear);
            if (p.autoDetails.engineCapacity) parts.push(`${p.autoDetails.engineCapacity} cm3`);
            if (p.autoDetails.fuelType) parts.push(p.autoDetails.fuelType);
            if (parts.length > 0) techDetails = parts.join(' ');
        }

        switch (p.type) {
            case 'OC':
            case 'AC':
            case 'BOTH':
                const prefix = p.autoDetails?.vehicleType === 'MOTOCYKL' ? 'motocykl' : 
                               (p.autoDetails?.vehicleType === 'CIEZAROWY' ? 'samochód ciężarowy' : 
                               (p.autoDetails?.vehicleType === 'PRZYCZEPA' ? 'przyczepa' : 'samochód'));
                return `${prefix}_${reg}_${brand} ${model} ${techDetails}`.replace(/_+/g, '_').trim();
            case 'DOM': return `dom_${addr}`.trim();
            case 'PODROZ':
                const days = p.travelDetails?.durationDays ? `_${p.travelDetails.durationDays} dni` : '';
                return `podróż_${dest}${days}`.trim();
            case 'ZYCIE':
                const lType = p.lifeDetails?.lifeType === 'SZKOLNA' ? 'NNW Szkolne' : (p.lifeDetails?.lifeType || 'Indywidualna');
                return `życie_${lType}`.trim();
            case 'FIRMA': return `firma_${brand || addr}`.trim();
            default: return p.originalProductString || p.type;
        }
    }

    static generateNotesString(notes: ClientNote[], policy: Policy): string {
        const sortedNotes = [...(notes || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        let notesStr = sortedNotes
            .map(n => {
                const dateStr = isValid(new Date(n.createdAt)) ? `[${format(new Date(n.createdAt), 'yyyy-MM-dd')}]` : '';
                const tagStr = (n.tag && n.tag !== 'ROZMOWA') ? ` [${n.tag}]` : '';
                const safeContent = (n.content || '').replace(/_/g, '-').trim();
                return `${dateStr}${tagStr} ${safeContent}`;
            })
            .join('_'); 

        // Append Calculations if any
        if (policy.calculations && policy.calculations.length > 0) {
            const calcStr = policy.calculations
                .map(c => `[KALKULACJA] ${c.insurerName}: ${c.premium} PLN (${c.notes || ''})`)
                .join('_');
            notesStr = notesStr ? `${notesStr}_${calcStr}` : calcStr;
        }

        return notesStr;
    }

    static mapStageToLegacy(stage: string): string {
        const map: Record<string, string> = {
            'sprzedaż': 'sprzedaż',
            'sprzedany': 'sprzedaż',
            'of_do zrobienia': 'of_do zrobienia',
            'przeł kontakt': 'przeł kontakt',
            'oferta_wysłana': 'of_przedst',
            'of_przedst': 'of_przedst',
            'ucięty kontakt': 'ucięty kontakt',
            'rez po ofercie_kont za rok': 'rez po ofercie_kont za rok',
            'czekam na dane/dokum': 'czekam na dane/dokum'
        };
        return map[stage] || stage;
    }

    static mapPolicyToRow(p: Policy, c?: Client, notes: ClientNote[] = [], subAgentName?: string): any[] {
        const row: any[] = [];
        
        let name = '---';
        if (c) {
            name = c.businesses && c.businesses.length > 0 
                ? c.businesses[0].name 
                : `${c.lastName} ${c.firstName}`; // ALWAYS LAST FIRST FOR EXCEL COMPATIBILITY
        }
        row[0] = name.trim();
        row[1] = this.fmtDate(p.createdAt);
        row[2] = this.mapStageToLegacy(p.stage);
        row[3] = this.fmtDate(p.nextContactDate || p.policyEndDate);
        row[4] = c?.phones?.[0] || '';
        row[5] = c?.emails?.[0] || '';
        row[6] = c ? `${c.zipCode || ''} ${c.city || ''} ${c.street || ''}`.trim() : '';
        row[7] = c?.pesel || c?.businesses?.[0]?.nip || '';

        row[8] = this.generateProductString(p);
        row[9] = this.fmtDate(p.policyStartDate);
        row[10] = p.policyNumber || '';
        row[11] = p.insurerName || '';
        row[12] = this.fmtMoney(p.premium);
        row[13] = subAgentName || (p.subAgentId ? 'Pośrednik (Nieznany)' : 'Agent');
        row[14] = this.fmtMoney(p.commission);
        const subTotal = p.subAgentSplits 
            ? p.subAgentSplits.reduce((acc, s) => acc + (s.amount || 0), 0)
            : (p.subAgentCommission || 0);
        row[15] = this.fmtMoney(subTotal);
        row[16] = p.oldPremium || '';
        
        let col17 = p.oldPolicyNumber || '';
        if (p.oldInsurerName) col17 = `${p.oldInsurerName} ${col17}`;
        if (p.autoDetails?.vehicleValue) col17 += ` SU ${p.autoDetails.vehicleValue} ${p.autoDetails.vehicleValueType || 'BRUTTO'}`;
        row[17] = col17.trim();
        
        let coOwnersParts: string[] = [];
        if (p.autoDetails?.ownership === 'LEASING') coOwnersParts.push("Leasing");
        if (p.autoDetails?.coOwners) p.autoDetails.coOwners.forEach(co => coOwnersParts.push(co.name));
        if (p.homeDetails?.coOwners) p.homeDetails.coOwners.forEach(co => coOwnersParts.push(co.name));
        if (p.homeDetails?.assignmentBank) coOwnersParts.push(`Cesja: ${p.homeDetails.assignmentBank}`);
        row[18] = coOwnersParts.join(' + ') || p.coOwner || '';

        row[19] = this.generateNotesString(notes, p);
        row[20] = p.documentsStatus || '';
        row[21] = p.portalStatus || '';
        row[22] = p.paymentStatus === 'PAID' ? 'Opłacona' : (p.paymentStatus === 'UNPAID' ? 'Nieopłacona' : '');

        for (let i = 23; i < 30; i++) row[i] = '';

        row[30] = c?.id || ''; 
        row[31] = p.id;
        row[32] = JSON.stringify(c || {});
        row[33] = JSON.stringify(p);
        row[34] = JSON.stringify(notes);

        return row;
    }

    static mapClientToRow(c: Client, unlinkedNotes: ClientNote[] = []): any[] {
        const row: any[] = [];
        
        row[0] = c.id;
        row[1] = c.firstName;
        row[2] = c.lastName;
        row[3] = c.pesel || c.businesses?.[0]?.nip || '';
        row[4] = c.phones.join(', ');
        row[5] = c.emails.join(', ');
        row[6] = c.street;
        row[7] = c.zipCode;
        row[8] = c.city;
        row[9] = this.generateNotesString(unlinkedNotes, { calculations: [] } as any); // Dummy policy for notes
        row[10] = JSON.stringify(c);
        row[11] = JSON.stringify(unlinkedNotes);

        return row;
    }
}
