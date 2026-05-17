
import { GoogleGenAI } from "@google/genai";
import { storage } from '../services/storage';
import { Client, Policy } from '../types';

export class KaratekaService {
    private ai: any;

    constructor() {
        if (process.env.API_KEY) {
            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        }
    }

    private cleanJsonString(text: string): string {
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstCurly = clean.indexOf('{');
        const lastCurly = clean.lastIndexOf('}');
        if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
            return clean.substring(firstCurly, lastCurly + 1);
        }
        return clean;
    }

    // --- EXECUTION PLANNER ---
    async generateExecutionPlan(userMessage: string, contextData: any): Promise<any> {
        if (!this.ai) return { reply: "Brak klucza API.", plan: [] };

        const prompt = `
        Jesteś Systemowym Operatorem (CLI) systemu CRM "Insurance Master".
        Twoim zadaniem jest tłumaczenie języka naturalnego na operacje systemowe JSON.
        
        ### 🕹️ CLI: NAWIGACJA I WYSZUKIWANIE
        1. **NAVIGATE** - Przełączanie widoków ogólnych.
           - targets: 'dashboard', 'calendar', 'offers', 'terminations', 'insurers', 'clients', 'sub-agents'
        2. **SEARCH_AND_NAVIGATE** - Znajdź i przejdź do profilu/polisy.
           - query: "Kowalski", "Toyota", "GD 12345", "Polisa na dom"
        
        ### 🛠️ CLI: EDYCJA I AKCJE (SEARCH & ACT)
        Jeśli użytkownik chce edytować coś, czego ID nie znamy, użyj wyszukiwania:
        3. **SEARCH_AND_OPEN_MODAL** - Znajdź i otwórz okno edycji.
           - query: "Edytuj Kowalskiego", "Zmień dane w Audi", "Popraw polisę na dom"
           - targetType: 'client' | 'policy' (AI musi zdecydować czego szukamy)

        ### 💾 CLI: BAZA DANYCH (Gdy ID jest znane z kontekstu)
        4. **UPDATE_CLIENT** / **UPDATE_POLICY** - Gdy mamy ID w kontekście.
        5. **CREATE_CLIENT** / **CREATE_POLICY** / **CREATE_NOTE**

        ### KONTEKST
        Lokalizacja: ${contextData?.location || 'dashboard'}
        Aktywny Klient ID: ${contextData?.client?.id || 'BRAK'}
        Aktywna Polisa ID: ${contextData?.contextPolicyId || 'BRAK'}

        ### INPUT UŻYTKOWNIKA
        "${userMessage}"

        ### FORMAT WYJŚCIOWY (JSON)
        { "plan": [ ... ] }
        `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.1 }
            });
            
            const rawText = response.text || "{}";
            const cleanedJson = this.cleanJsonString(rawText);
            return JSON.parse(cleanedJson);

        } catch (e) {
            console.error("Plan Error", e);
            return { plan: [{ op: "CHAT", message: "Błąd sieci/API." }] };
        }
    }

    // --- EXECUTOR ENGINE ---
    async executePlan(plan: any[], logCallback: (msg: string) => void): Promise<{ createdClientId?: string, createdPolicyId?: string, requestedAction?: any }> {
        const idMap: Record<string, string> = {}; 
        let createdClientId: string | undefined;
        let createdPolicyId: string | undefined;
        let requestedAction: any = undefined;

        if (!Array.isArray(plan)) return {};

        const state = storage.getState();

        for (const step of plan) {
            try {
                // ID RESOLUTION
                let targetClientId = step.clientId;
                if (targetClientId === 'ref_c1' || step.tempId === 'c1') if (createdClientId) targetClientId = createdClientId;
                if (!targetClientId && idMap['LAST_CLIENT_ID']) targetClientId = idMap['LAST_CLIENT_ID'];

                let targetPolicyId = step.policyId;
                if (targetPolicyId && idMap[targetPolicyId]) targetPolicyId = idMap[targetPolicyId];
                if (!targetPolicyId && idMap['LAST_POLICY_ID']) targetPolicyId = idMap['LAST_POLICY_ID'];

                // --- SEARCH LOGIC (Reusable) ---
                type SearchResult = { type: 'client'; item: Client } | { type: 'policy'; item: Policy } | null;

                const performSearch = (query: string): SearchResult => {
                    const q = (query || '').toLowerCase().trim();
                    // 1. Search Clients
                    const foundClient = state.clients.find(c => 
                        c.lastName.toLowerCase().includes(q) || 
                        c.firstName.toLowerCase().includes(q) ||
                        (c.pesel && c.pesel.includes(q)) ||
                        (c.businesses && c.businesses.some(b => b.name.toLowerCase().includes(q) || (b.nip && b.nip.includes(q))))
                    );
                    if (foundClient) return { type: 'client', item: foundClient };

                    // 2. Search Policies
                    const foundPolicy = state.policies.find(p => 
                        (p.vehicleReg && p.vehicleReg.toLowerCase().replace(/\s/g,'').includes(q.replace(/\s/g,''))) ||
                        (p.vehicleVin && p.vehicleVin.toLowerCase().includes(q)) ||
                        (p.vehicleBrand && p.vehicleBrand.toLowerCase().includes(q)) ||
                        (p.type.toLowerCase() === q && p.clientId === targetClientId) // Context search "Edytuj OC"
                    );
                    if (foundPolicy) return { type: 'policy', item: foundPolicy };

                    return null;
                };

                // --- OPERATIONS ---

                if (step.op === 'SEARCH_AND_NAVIGATE') {
                    logCallback(`🔍 Grep: "${step.query}"...`);
                    const result = performSearch(step.query);

                    if (result && result.type === 'client') {
                        logCallback(`🚀 Przełączam na klienta: ${result.item.lastName}`);
                        window.dispatchEvent(new CustomEvent('AGENT_NAVIGATE', { 
                            detail: { page: 'client-details', clientId: result.item.id } 
                        }));
                    } else if (result && result.type === 'policy') {
                        const client = state.clients.find(c => c.id === result.item.clientId);
                        if (client) {
                            logCallback(`🚀 Przełączam na polisę: ${result.item.vehicleBrand || result.item.type}`);
                            window.dispatchEvent(new CustomEvent('AGENT_NAVIGATE', { 
                                detail: { page: 'client-details', clientId: client.id, highlightPolicyId: result.item.id } 
                            }));
                        }
                    } else {
                        logCallback(`⚠️ Brak wyników dla "${step.query}".`);
                    }
                }

                else if (step.op === 'SEARCH_AND_OPEN_MODAL') {
                    logCallback(`🔍 Grep (Edit): "${step.query}"...`);
                    const result = performSearch(step.query);

                    if (result && result.type === 'client') {
                        logCallback(`🖥️ Otwieram edycję klienta...`);
                        requestedAction = { action: 'OPEN_MODAL', target: 'edit-client', clientId: result.item.id };
                    } else if (result && result.type === 'policy') {
                        logCallback(`🖥️ Otwieram edycję polisy...`);
                        requestedAction = { action: 'OPEN_MODAL', target: 'edit-policy', policyId: result.item.id };
                    } else {
                        logCallback(`⚠️ Nie znaleziono obiektu do edycji.`);
                    }
                }

                else if (step.op === 'NAVIGATE') {
                    logCallback(`📂 cd /${step.target}`);
                    window.dispatchEvent(new CustomEvent('AGENT_NAVIGATE', { detail: { page: step.target } }));
                }

                else if (step.op === 'OPEN_MODAL') {
                    logCallback(`🖥️ exec open_window(${step.target})`);
                    requestedAction = {
                        action: 'OPEN_MODAL',
                        target: step.target,
                        clientId: targetClientId,
                        policyId: targetPolicyId
                    };
                }

                // --- DATA OPS ---
                else if (step.op === 'CREATE_CLIENT') {
                    const d = step.data || {};
                    logCallback(`👤 useradd ${d.lastName}_${d.firstName}`);
                    const newClient = {
                        id: `c_${Date.now()}`,
                        createdAt: new Date().toISOString(),
                        firstName: d.firstName,
                        lastName: d.lastName,
                        pesel: d.pesel || '', 
                        phones: d.phones || [],
                        emails: d.emails || [],
                        street: d.street || '',
                        city: d.city || '',
                        zipCode: d.zipCode || '',
                        businesses: Array.isArray(d.businesses) ? d.businesses : [],
                        notes: d.notes || ''
                    };
                    // @ts-ignore
                    await storage.addClient(newClient);
                    createdClientId = newClient.id;
                    idMap['LAST_CLIENT_ID'] = newClient.id;
                    logCallback(`✅ Klient utworzony.`);
                }

                else if (step.op === 'CREATE_POLICY') {
                    if (!targetClientId) {
                        logCallback(`❌ Błąd: Brak klienta do przypisania polisy.`);
                        continue;
                    }
                    const d = step.data || {};
                    logCallback(`📄 touch policy_${d.type}.json`);
                    const newPolicy = {
                        id: `p_${Date.now()}`,
                        clientId: targetClientId,
                        createdAt: new Date().toISOString(),
                        type: d.type || 'OC',
                        stage: 'of_do zrobienia',
                        vehicleBrand: d.vehicleBrand || '',
                        vehicleReg: d.vehicleReg || '',
                        autoDetails: d.autoDetails || {},
                        policyStartDate: new Date().toISOString(),
                        policyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
                        premium: 0, commission: 0
                    };
                    // @ts-ignore
                    await storage.addPolicy(newPolicy);
                    createdPolicyId = newPolicy.id;
                    idMap['LAST_POLICY_ID'] = newPolicy.id;
                    logCallback(`✅ Polisa utworzona.`);
                }

                else if (step.op === 'UPDATE_CLIENT') {
                    if (targetClientId) {
                        logCallback(`📝 update client:${targetClientId}`);
                        const existingClient = state.clients.find(c => c.id === targetClientId);
                        if (existingClient) {
                            const updatedClient = { ...existingClient, ...step.data };
                            // @ts-ignore
                            await storage.updateClient(updatedClient);
                            logCallback(`✅ Zapisano.`);
                        }
                    }
                }

                await new Promise(r => setTimeout(r, 150)); 

            } catch (err: any) {
                console.error("Step Error", err);
                logCallback(`❌ Runtime Error: ${err.message}`);
            }
        }

        return { createdClientId, createdPolicyId, requestedAction };
    }
}

export const karateka = new KaratekaService();
