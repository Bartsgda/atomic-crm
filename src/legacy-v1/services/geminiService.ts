
import { GoogleGenAI, Type } from "@google/genai";
import { NLPResult } from "../types";

const parseNaturalLanguage = async (input: string): Promise<NLPResult | null> => {
  if (!process.env.API_KEY) {
      console.warn(" SECURITY ALERT: Brak API_KEY. Funkcje AI nie będą działać. Sprawdź konfigurację .env");
      return null;
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Jesteś asystentem w systemie CRM dla agenta ubezpieczeniowego.
      Twoim zadaniem jest przetłumaczenie intencji użytkownika na akcję w systemie.
      Wejście: "${input}"
      Zwróć JSON. Daty w formacie ISO (YYYY-MM-DD).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['CREATE_NOTE', 'SEARCH_CLIENT', 'NAVIGATE'] },
            data: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                dateStr: { type: Type.STRING },
                clientName: { type: Type.STRING },
                noteContent: { type: Type.STRING }
              }
            }
          },
          required: ["action", "data"]
        }
      }
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error("Gemini NLP Error:", error);
    return null;
  }
};

const fetchCompanyData = async (nip?: string, companyName?: string, krs?: string) => {
  if (!process.env.API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `Znajdź oficjalne dane podmiotu gospodarczego w polskich rejestrach (KRS, CEIDG, GOV.pl) na podstawie: 
    NIP: ${nip || 'brak'} 
    Nazwa: ${companyName || 'brak'}
    KRS: ${krs || 'brak'}
    
    ZADANIE DLA AI:
    1. Pobierz PEŁNĄ nazwę prawną podmiotu (np. Jan Kowalski Usługi lub ABC Sp. z o.o.).
    2. Pobierz dokładny adres siedziby: ulica, miasto, kod pocztowy (format 00-000).
    3. Pobierz numery: NIP, REGON, KRS.
    4. Pobierz REPREZENTACJĘ (BARDZO WAŻNE): Wypisz osoby uprawnione do reprezentacji (Zarząd, prokurenci) oraz sposób reprezentacji (np. "jednoosobowo przez prezesa", "łącznie dwóch członków").
    5. Wyodrębnij znane e-maile i telefony służbowe.
    
    ZWRÓĆ DOKŁADNY JSON. NIE ZMYŚLAJ. NIE DODAWAJ KOMENTARZY.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            legalName: { type: Type.STRING },
            street: { type: Type.STRING },
            city: { type: Type.STRING },
            zipCode: { type: Type.STRING },
            nip: { type: Type.STRING },
            regon: { type: Type.STRING },
            krs: { type: Type.STRING },
            representation: { type: Type.STRING, description: "Lista osób i sposób reprezentacji (Zarząd/Prokura)" },
            phones: { type: Type.ARRAY, items: { type: Type.STRING } },
            emails: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    return response.text ? JSON.parse(response.text) : null;
  } catch (e) {
    console.error("AI Business Search Error", e);
    return null;
  }
};

const getTravelAdvice = async (destination: string) => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Jesteś doświadczonym underwriterem ubezpieczeń turystycznych.
            Krótko (maks 3 zdania) opisz najważniejsze ryzyka ubezpieczeniowe dla wyjazdu do kraju: ${destination}.
            
            Format:
            1. Wiza/Szczepienia (Tak/Nie/Jakie).
            2. Koszty leczenia (Niskie/Wysokie/Bardzo Wysokie).
            3. Sugerowana Suma Ubezpieczenia KL (w EUR/USD).
            
            Bądź konkretny.`,
        });
        return response.text;
    } catch (e) {
        return null;
    }
}

export const geminiService = {
  parseNaturalLanguage,
  fetchCompanyData,
  getTravelAdvice
};
