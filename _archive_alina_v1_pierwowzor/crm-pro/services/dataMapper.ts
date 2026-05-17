
import { Client, Policy, ClientNote, PolicyType, TerminationBasis, SalesStage, NoteTag } from '../types';
import { addDays, isValid, addMinutes } from 'date-fns';
import { LEGACY_RECOGNITION_MAP } from '../data/legacy/index';
import { parseOldPolicyInfo, parseCoOwnerColumn, parseTravelParticipants } from '../modules/utils/secondaryParsers';
import { parseHomeString, parseAutoString } from '../modules/utils/legacyParser'; 
import { TRAVEL_PARTICIPANTS_MAP } from '../data/legacy/travel_participants';

export class DataMapper {
  
  static mapClientRow(row: any[]): { client: Client, notes: ClientNote[] } | null {
      if (!row || row.length < 3) return null;
      
      const str = (v: any) => (v ? String(v).trim() : '');
      const id = str(row[0]) || `c_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      // BASIC VALIDATION: Ghost Check
      if (!str(row[1]) && !str(row[2]) && !str(row[3])) return null;

      const firstName = str(row[1]);
      const lastName = str(row[2]);
      const ident = str(row[3]);
      const pesel = ident.length === 11 ? ident : '';
      const nip = ident.length === 10 ? ident : '';
      const phones = str(row[4]).split(',').map(s => s.trim()).filter(Boolean);
      const emails = str(row[5]).split(',').map(s => s.trim()).filter(Boolean);
      const street = str(row[6]);
      const zipCode = str(row[7]);
      const city = str(row[8]);

      // JSON Restore
      if (row[10] && typeof row[10] === 'string' && row[10].startsWith('{')) {
          try {
              const restored = JSON.parse(row[10]);
              let restoredNotes: ClientNote[] = [];
              if (row[11]) {
                  try { restoredNotes = JSON.parse(row[11]); } catch {}
              }
              return { client: restored, notes: restoredNotes };
          } catch {}
      }

      const client: Client = {
          id, firstName, lastName, pesel, phones, emails, street, city, zipCode,
          businesses: nip ? [{ name: lastName, nip, street, city, zipCode }] : [],
          createdAt: new Date().toISOString()
      };

      const rawNotes = str(row[9]);
      const notes = mapNotesLegacy(rawNotes, id, 'UNLINKED', client.createdAt);

      return { client, notes };
  }

  static mapRow(row: any[]): { client: Client, policy: Policy, notes: ClientNote[], sourceName?: string } | null {
    if (!row || row.length < 5) return null;

    const str = (v: any) => (v ? String(v).trim() : '');
    const money = (v: any) => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        const cleaned = String(v).replace(/[^\d.,-]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    };
    const date = (v: any) => {
        if (v instanceof Date) return v.toISOString();
        if (!v) return new Date().toISOString();
        if (typeof v === 'string' && v.match(/^\d{1,2}\.\d{1,2}\.\d{4}/)) {
            const parts = v.split('.');
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).toISOString();
        }
        const d = new Date(v);
        return isValid(d) ? d.toISOString() : new Date().toISOString();
    };

    // --- 1. CLIENT MAPPING ---
    const rawName = str(row[0]); 
    const rawProduct = str(row[8]); 
    
    // CRITICAL: GHOST ROW CHECK
    // Jeśli nie ma nazwy klienta I nie ma opisu produktu, to jest śmieć/pusty wiersz.
    if (rawName.length < 2 && rawProduct.length < 2) return null;

    const nipOrPesel = str(row[7]);
    const sysClientId = str(row[30]); // LINK TO MASTER CLIENT SHEET
    const sysClientJson = row[32];
    
    let client: Client;

    // Use legacy mapper as base or fallback
    const tempClient = mapClientLegacy(rawName, nipOrPesel, row);

    if (sysClientId) {
        // Create a stub client but use parsed names instead of empty strings
        client = { 
            ...tempClient,
            id: sysClientId
        };
    } else if (sysClientJson && typeof sysClientJson === 'string' && sysClientJson.startsWith('{')) {
        try {
            client = JSON.parse(sysClientJson);
        } catch (e) {
            client = tempClient;
        }
    } else {
        client = tempClient;
    }

    // --- 2. POLICY MAPPING ---
    const sysPolicyJson = row[33];
    let policy: Policy;
    let notes: ClientNote[] = [];
    
    const rawNotes = str(row[19]);  

    if (sysPolicyJson && typeof sysPolicyJson === 'string' && sysPolicyJson.startsWith('{')) {
        try {
            policy = JSON.parse(sysPolicyJson);
            if (row[34] && typeof row[34] === 'string') {
                notes = JSON.parse(row[34]);
            } else {
                notes = mapNotesLegacy(rawNotes, client.id, policy.id, policy.createdAt);
            }
        } catch (e) {
            const mapped = mapPolicyLegacy(rawProduct, rawNotes, row, client);
            policy = mapped.policy;
            notes = mapped.notes;
        }
    } else {
        const mapped = mapPolicyLegacy(rawProduct, rawNotes, row, client);
        policy = mapped.policy;
        notes = mapped.notes;
    }

    const sourceName = str(row[13]);

    return { 
        client, 
        policy, 
        notes, 
        sourceName: (sourceName && sourceName !== 'Agent') ? sourceName : undefined 
    };
  }
}

function mapClientLegacy(rawName: string, nipOrPesel: string, row: any[]): Client {
    const str = (v: any) => (v ? String(v).trim() : '');
    const date = (v: any) => {
        const d = new Date(v);
        return isValid(d) ? d.toISOString() : new Date().toISOString();
    };

    const isCompany = rawName.toLowerCase().includes('sp. z o.o.') || 
                      rawName.toLowerCase().includes('s.a.') || 
                      (nipOrPesel.length === 10 && /^\d+$/.test(nipOrPesel));
    
    let firstName = '';
    let lastName = rawName;
    
    if (!isCompany && rawName.includes(' ')) {
        const parts = rawName.split(' ');
        if (parts.length > 1) {
            lastName = parts[0];
            firstName = parts.slice(1).join(' ');
        }
    } else if (isCompany) {
        firstName = '(Firma)';
        lastName = rawName; 
    }

    const clientId = `c_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    return {
        id: clientId,
        firstName,
        lastName,
        pesel: nipOrPesel.length === 11 ? nipOrPesel : '',
        phones: str(row[4]).split(/[,;]/).map(p => p.trim()).filter(Boolean),
        emails: str(row[5]).split(/[,;]/).map(e => e.trim()).filter(Boolean),
        street: str(row[6]),
        city: '', 
        zipCode: '',
        createdAt: date(row[1] || new Date()),
        businesses: isCompany ? [{
            name: rawName,
            nip: nipOrPesel.length === 10 ? nipOrPesel : undefined,
            street: str(row[6]),
            city: '',
            zipCode: ''
        }] : []
    };
}

function mapNotesLegacy(rawNotes: string, clientId: string, policyId: string, baseDate: string): ClientNote[] {
    const notes: ClientNote[] = [];
    if (!rawNotes) return notes;

    const parts = rawNotes.split(/_|\n/);
        
    parts.forEach((part, index) => {
        let content = part.trim();
        if (!content) return;

        let tag: NoteTag = 'ROZMOWA';
        let noteDate = addMinutes(new Date(baseDate), index);

        const dateMatch = content.match(/^\[(\d{4}-\d{2}-\d{2})\]/);
        if (dateMatch) {
            const parsedDate = new Date(dateMatch[1]);
            if (isValid(parsedDate)) {
                noteDate = parsedDate;
                content = content.replace(dateMatch[0], '').trim();
            }
        }

        const tagMatch = content.match(/^\[([A-Z_]+)\]/);
        if (tagMatch) {
            const candidate = tagMatch[1];
            if (['STATUS', 'OFERTA', 'ROZMOWA', 'DECISION_PRICE'].includes(candidate)) {
                tag = candidate as NoteTag;
                content = content.replace(tagMatch[0], '').trim();
            }
        } else {
            const lower = content.toLowerCase();
            if (lower.includes('nie odbiera') || lower.includes('brak tel')) tag = 'STATUS';
            else if (lower.includes('oferta') || lower.includes('kalkulacja')) tag = 'OFERTA';
            else if (lower.includes('rezygn') || lower.includes('odmowa')) tag = 'DECISION_PRICE';
        }

        const effectivePolicyIds = policyId === 'UNLINKED' ? [] : [policyId];

        notes.push({
            id: `n_imp_${policyId}_${index}_${Math.random().toString(36).substr(2, 4)}`,
            clientId: clientId,
            content: content,
            tag: tag,
            createdAt: noteDate.toISOString(),
            linkedPolicyIds: effectivePolicyIds
        });
    });

    return notes;
}

function mapPolicyLegacy(rawProduct: string, rawNotes: string, row: any[], client: Client): { policy: Policy, notes: ClientNote[] } {
    const str = (v: any) => (v ? String(v).trim() : '');
    const money = (v: any) => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        const cleaned = String(v).replace(/[^\d.,-]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    };
    const date = (v: any) => {
        const d = new Date(v);
        return isValid(d) ? d.toISOString() : new Date().toISOString();
    };

    const notes: ClientNote[] = [];

    const pLow = rawProduct.toLowerCase();
    
    let policyType: PolicyType = 'OC';
    let vehicleBrand = '';
    let vehicleModel = ''; 
    let vehicleReg = '';
    let propertyAddr = '';
    let destination = '';
    let brand = ''; 
    let businessType = undefined;
    
    let autoDetails: any = { coOwners: [] }; 
    let homeDetails: any = { coOwners: [] }; 
    let travelDetails: any = {};
    let lifeDetails: any = {};
    let travelStart: string | undefined = undefined;
    let travelEnd: string | undefined = undefined;
    let extraNoteFromLegacy: string | undefined = undefined;

    const contextFromNotes = parseAutoString(rawNotes); 
    if (contextFromNotes.autoDetails) {
        autoDetails = { ...autoDetails, ...contextFromNotes.autoDetails };
    }
    const brandFromNotes = contextFromNotes.vehicleBrand;

    const trimmedKey = rawProduct.trim();
    const legacyMatch = LEGACY_RECOGNITION_MAP?.[rawProduct] || LEGACY_RECOGNITION_MAP?.[trimmedKey];
    const firstWordRaw = rawProduct.split(/[_ ]/)[0].toLowerCase();
    const firstWord = firstWordRaw.replace(/[^a-złęąśżźćóń]/g, '');

    if (legacyMatch) {
        policyType = legacyMatch.type;
        if (legacyMatch.vehicleBrand) vehicleBrand = legacyMatch.vehicleBrand;
        if (legacyMatch.vehicleModel) vehicleModel = legacyMatch.vehicleModel;
        if (legacyMatch.vehicleReg) vehicleReg = legacyMatch.vehicleReg;
        if (legacyMatch.propertyAddress) propertyAddr = legacyMatch.propertyAddress;
        if (legacyMatch.destinationCountry) destination = legacyMatch.destinationCountry;
        if (legacyMatch.businessType) businessType = legacyMatch.businessType as any;
        if (legacyMatch.travelStartDate) travelStart = legacyMatch.travelStartDate;
        if (legacyMatch.travelEndDate) travelEnd = legacyMatch.travelEndDate;
        if (legacyMatch.autoDetails) autoDetails = { ...autoDetails, ...legacyMatch.autoDetails }; 
        if (legacyMatch.homeDetails) homeDetails = { ...homeDetails, ...legacyMatch.homeDetails };
        if (legacyMatch.aiNote) extraNoteFromLegacy = legacyMatch.aiNote;
    
    } else if (['dom', 'mieszkanie', 'lokal', 'budowa', 'domek', 'nieruchomosc', 'nieruchomość', 'garaż', 'garaz', 'majątek', 'majatek'].includes(firstWord)) {
        policyType = 'DOM';
        if (rawProduct.includes('_')) {
            const parts = rawProduct.split('_');
            propertyAddr = parts.slice(1).join('_').trim();
        } else {
            propertyAddr = rawProduct.replace(new RegExp(`^${firstWordRaw}\\s?`, 'i'), '').trim();
        }
        const parsedHome = parseHomeString(rawProduct);
        homeDetails = { ...homeDetails, ...parsedHome };

    } else if (['podróż', 'podroz', 'podróżne', 'podrozne', 'wyjazd', 'turyst'].includes(firstWord)) {
        policyType = 'PODROZ';
        let cleanDest = rawProduct
            .replace(/^podr[óo][żz][a-z]*_?/i, '') 
            .replace(/_/g, ' ') 
            .replace(/(\d{1,2}[.-]\d{1,2})[.-]?\d{0,4}/g, '') 
            .replace(/\d{4}/g, '') 
            .replace('kontynuacja', '')
            .trim();
        if (cleanDest.startsWith(',') || cleanDest.startsWith('.')) cleanDest = cleanDest.substring(1).trim();
        destination = cleanDest || 'Świat (Nieokreślony)';

    } else if (['firma', 'biznes', 'ocpd', 'nzoz', 'flota', 'mienie'].includes(firstWord)) {
        policyType = 'FIRMA';
        brand = rawProduct.replace(new RegExp(`^${firstWordRaw}[_ ]?`, 'i'), '').trim();
    
    } else if (firstWord === 'oc') {
        if (
            pLow.includes('działalno') || 
            pLow.includes('przedsiębiorc') || 
            pLow.includes('zawodow') || 
            pLow.includes('przewoźnik') || 
            pLow.includes('spedytor') || 
            pLow.includes('lekarz') ||
            pLow.includes('nzoz') ||
            pLow.includes('medycz') ||
            pLow.includes('fizjotera')
        ) {
            policyType = 'FIRMA';
            brand = rawProduct.replace(/^oc[_ ]?/i, '').trim();
        } else {
            policyType = 'OC';
            autoDetails.vehicleType = autoDetails.vehicleType || 'OSOBOWY';
            const parsedProduct = parseAutoString(rawProduct);
            if (parsedProduct.vehicleReg) vehicleReg = parsedProduct.vehicleReg;
            vehicleBrand = parsedProduct.vehicleBrand || brandFromNotes || rawProduct;
            vehicleBrand = vehicleBrand.replace(/^oc[_ ]?/i, '').trim();
            autoDetails = { ...autoDetails, ...parsedProduct.autoDetails };
        }

    } else if (['życie', 'zycie', 'life', 'nnw', 'szpital', 'zdrowie', 'śmierć'].includes(firstWord)) {
        policyType = 'ZYCIE';
        brand = rawProduct.replace(/^(życie_|zycie_|life_|nnw_)/i, '').trim() || 'Polisa Życiowa';

    } else {
        if (['przyczepa', 'przyczepka', 'kemping'].includes(firstWord)) autoDetails.vehicleType = 'PRZYCZEPA';
        else if (['motocykl', 'motor', 'skuter'].includes(firstWord)) autoDetails.vehicleType = 'MOTOCYKL';
        else if (['quad', 'atv'].includes(firstWord)) autoDetails.vehicleType = 'QUAD';
        else if (['ciężarowy', 'ciezarowy', 'dostawczy'].includes(firstWord)) autoDetails.vehicleType = 'CIEZAROWY';
        else if (['ciągnik', 'ciagnik', 'siodłowy'].includes(firstWord)) autoDetails.vehicleType = 'CIAGNIK';
        else if (['autobus', 'bus'].includes(firstWord)) autoDetails.vehicleType = 'AUTOBUS';
        else autoDetails.vehicleType = autoDetails.vehicleType || 'OSOBOWY';

        const parsedProduct = parseAutoString(rawProduct);
        if (parsedProduct.vehicleReg) vehicleReg = parsedProduct.vehicleReg;
        vehicleBrand = parsedProduct.vehicleBrand || brandFromNotes || rawProduct;
        vehicleBrand = vehicleBrand.replace(/^(samochód|pojazd|auto)[_ ]?/i, '');
        autoDetails = { ...autoDetails, ...parsedProduct.autoDetails };

        if (pLow.includes('ac') || pLow.includes('autocasco')) policyType = 'AC';
        if ((pLow.includes('oc') && pLow.includes('ac')) || pLow.includes('pakiet')) policyType = 'BOTH';
        if (!policyType) policyType = 'OC';
    }

    let stage: SalesStage = 'inne';
    const rawStage = str(row[2]).toLowerCase();
    
    if (rawStage === 'sprzedaż' || rawStage === 'sprzedany' || rawStage.includes('polisa')) stage = 'sprzedaż';
    else if (rawStage === 'of_do zrobienia') stage = 'of_do zrobienia';
    else if (rawStage === 'przeł kontakt') stage = 'przeł kontakt';
    else if (rawStage === 'czekam na dane/dokum') stage = 'czekam na dane/dokum';
    else if (rawStage === 'of_przedst' || rawStage.includes('przedstawiona')) stage = 'of_przedst';
    else if (rawStage === 'ucięty kontakt') stage = 'ucięty kontakt';
    else if (rawStage.includes('rez po ofercie') || rawStage.includes('za rok')) stage = 'rez po ofercie_kont za rok';
    else if (rawStage.includes('wysłana')) stage = 'oferta_wysłana'; 

    const policyId = `p_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const start = travelStart ? date(travelStart) : date(row[9]); 
    const nextContactDate = row[3] ? date(row[3]) : undefined;
    let endDateRaw = addDays(new Date(start), 365).toISOString();
    if (policyType === 'PODROZ' && travelEnd) endDateRaw = date(travelEnd);

    // --- FINANCIAL CALCULATIONS (FIXED: NO SUBTRACTION) ---
    const prem = money(row[12]);
    const agentCommission = money(row[14]); // TO JEST COL 14 (Prowizja Agenta) - Nie odejmujemy nic!
    const subComm = money(row[15]);         // TO JEST COL 15 (Prowizja Pośrednika) - Niezależna

    const commRate = prem > 0 ? parseFloat(((agentCommission / prem) * 100).toFixed(2)) : 0;
    const subRate = prem > 0 ? parseFloat(((subComm / prem) * 100).toFixed(2)) : 0;

    const oldPolicyRaw = str(row[17]); 
    const coOwnerRaw = str(row[18]);   
    const oldPolicyInfo = parseOldPolicyInfo(oldPolicyRaw);
    
    // --- SPECIAL HANDLING FOR TRAVEL PARTICIPANTS ---
    // If it's a TRAVEL policy, parse participants from column 18 instead of standard co-owners
    if (policyType === 'PODROZ') {
        const rawParticipants = coOwnerRaw.trim();
        if (rawParticipants) {
            // Priority 1: Check Hardcoded Map
            if (TRAVEL_PARTICIPANTS_MAP[rawParticipants]) {
                travelDetails.participants = TRAVEL_PARTICIPANTS_MAP[rawParticipants];
            } else {
                // Priority 2: Auto-parse
                travelDetails.participants = parseTravelParticipants(rawParticipants);
            }
            travelDetails.participantsCount = travelDetails.participants.length || 1;
        }
    } else {
        // Standard logic for AUTO/HOME
        const coOwnerInfo = parseCoOwnerColumn(coOwnerRaw);

        if (coOwnerInfo.ownershipType) autoDetails.ownership = coOwnerInfo.ownershipType;
        if (oldPolicyInfo.vehicleValue) {
            autoDetails.vehicleValue = oldPolicyInfo.vehicleValue;
            autoDetails.vehicleValueType = oldPolicyInfo.valueType;
        }
        
        if (coOwnerInfo.coOwners.length > 0) {
            if (policyType === 'DOM') {
                if (!homeDetails.coOwners) homeDetails.coOwners = [];
                homeDetails.coOwners.push(...coOwnerInfo.coOwners);
            } else {
                if (!autoDetails.coOwners) autoDetails.coOwners = [];
                autoDetails.coOwners.push(...coOwnerInfo.coOwners);
            }
        }
        
        if (coOwnerInfo.assignment) {
            notes.push({
                id: `n_imp_assign_${policyId}`,
                clientId: client.id,
                content: `[IMPORT] Wykryto cesję/bank: ${coOwnerInfo.assignment}`,
                tag: 'ROZMOWA',
                createdAt: addMinutes(new Date(policyId.includes('_') ? start : new Date().toISOString()), 10).toISOString(),
                linkedPolicyIds: [policyId]
            });
            if (policyType === 'DOM' && !homeDetails.assignmentBank) {
                homeDetails.assignmentBank = coOwnerInfo.assignment;
            }
        }
    }

    if (!vehicleBrand && !brand && !propertyAddr && !destination) {
        vehicleBrand = rawProduct;
    }

    const policy: Policy = {
        id: policyId,
        clientId: client.id, 
        type: policyType,
        stage: stage,
        insurerName: str(row[11]) || 'Inne',
        policyNumber: str(row[10]),
        vehicleBrand: brand || vehicleBrand, 
        vehicleModel: vehicleModel, 
        vehicleReg,
        vehicleVin: '',
        propertyAddress: propertyAddr,
        destinationCountry: destination,
        businessType: businessType as any, 
        originalProductString: rawProduct, 
        policyStartDate: start,
        policyEndDate: endDateRaw,
        nextContactDate: nextContactDate,
        premium: prem,
        commission: agentCommission, // DIRECT MAPPING (COL 14)
        commissionRate: commRate, 
        subAgentCommission: subComm, // DIRECT MAPPING (COL 15)
        subAgentRate: subRate, 
        noteForSubAgent: str(row[13]) !== 'Agent' ? str(row[13]) : undefined,
        oldPremium: str(row[16]),
        oldPolicyNumber: oldPolicyRaw, 
        oldInsurerName: oldPolicyInfo.oldInsurer, 
        coOwner: coOwnerRaw, 
        documentsStatus: str(row[20]),
        portalStatus: str(row[21]),
        paymentStatus: str(row[22]).toLowerCase().includes('opłac') ? 'PAID' : 'UNPAID',
        createdAt: date(row[1]), 
        terminationBasis: TerminationBasis.ART_28,
        autoDetails: autoDetails,
        homeDetails: homeDetails,
        travelDetails: travelDetails,
        lifeDetails: lifeDetails
    };

    const notesFromLegacy = mapNotesLegacy(rawNotes, client.id, policy.id, policy.createdAt);
    notes.push(...notesFromLegacy);
    
    if (extraNoteFromLegacy) {
        notes.push({
            id: `n_imp_ai_${policyId}`,
            clientId: client.id,
            content: `[AI CONTEXT]: ${extraNoteFromLegacy}`,
            tag: 'IMPORT',
            createdAt: policy.createdAt,
            linkedPolicyIds: [policyId]
        });
    }

    return { policy, notes };
}
