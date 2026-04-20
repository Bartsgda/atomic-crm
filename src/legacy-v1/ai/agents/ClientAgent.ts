
import { GoogleGenAI, Type } from "@google/genai";

export class ClientAgent {
    private ai: any;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.ai = new GoogleGenAI({ apiKey });
        }
    }

    async parseClientCommand(text: string): Promise<any> {
        if (!this.ai) return null;

        const prompt = `
        Jesteś ekspertem wprowadzania danych CRM.
        Analizujesz luźny tekst od agenta ubezpieczeniowego i wyciągasz dane klienta oraz ewentualnie pojazdu/oferty.
        
        TEKST: "${text}"

        ZASADY:
        1. Rozpoznaj Imię i Nazwisko.
        2. Rozpoznaj telefony (9 cyfr) i e-maile.
        3. Jeśli podano dane pojazdu (marka, model, rej, rok, pojemność), wyodrębnij je do obiektu 'policyData'.
        4. Rozpoznaj typ oferty (OC, AC, DOM, ŻYCIE). Jeśli wymieniono "szyby", "opony" -> zaznacz w 'autoDetails'.
        
        Zwróć JSON zgodny ze schematem.
        `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            intent: { type: Type.STRING, enum: ["CREATE_CLIENT", "UPDATE_CLIENT", "UNKNOWN"] },
                            client: {
                                type: Type.OBJECT,
                                properties: {
                                    firstName: { type: Type.STRING },
                                    lastName: { type: Type.STRING },
                                    phone: { type: Type.STRING },
                                    email: { type: Type.STRING },
                                    pesel: { type: Type.STRING },
                                    companyName: { type: Type.STRING },
                                    nip: { type: Type.STRING }
                                }
                            },
                            policy: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    vehicleBrand: { type: Type.STRING },
                                    vehicleModel: { type: Type.STRING },
                                    vehicleReg: { type: Type.STRING },
                                    productionYear: { type: Type.STRING },
                                    engineCapacity: { type: Type.STRING },
                                    mileage: { type: Type.NUMBER },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } } // np. "szyby", "ac"
                                }
                            },
                            comment: { type: Type.STRING }
                        }
                    }
                }
            });
            return response.text ? JSON.parse(response.text) : null;
        } catch (e) {
            console.error("ClientAgent Error", e);
            return null;
        }
    }
}
