
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `
Jesteś zaawansowanym systemem OCR i Data Mining dla branży ubezpieczeniowej (InsurTech).
Twoim zadaniem jest przeanalizowanie załączonego obrazu (skan polisy, dowód rejestracyjny, dowód osobisty, notatka) i wyekstrahowanie danych do formatu JSON.

ZASADY KRYTYCZNE:
1. Zwróć TYLKO czysty JSON. Żadnych markdownów, żadnego gadania.
2. Daty sformatuj ściśle jako YYYY-MM-DD.
3. Kwoty (waluty) zamień na number (np. "1 200,00 zł" -> 1200.00).
4. Jeśli pola nie ma na obrazie, wstaw null.
5. Wykryj typ dokumentu i na jego podstawie wydedukuj 'policyType' (OC, AC, DOM, PODROZ, ZYCIE).

SCHEMAT DOCELOWY:
{
  "client": {
    "firstName": string,
    "lastName": string,
    "pesel": string, 
    "street": string,
    "city": string,
    "zipCode": string,
    "phones": string[],
    "emails": string[],
    "companyName": string, 
    "nip": string 
  },
  "policy": {
    "insurerName": string,
    "policyNumber": string,
    "policyStartDate": string,
    "policyEndDate": string,
    "premium": number,
    "type": "OC" | "AC" | "DOM" | "ZYCIE" | "PODROZ" | "FIRMA",
    "vehicleBrand": string, 
    "vehicleReg": string, 
    "vehicleVin": string,
    "propertyAddress": string
  }
}
`;

export const processDocument = async (base64Image: string, mimeType: string = 'image/jpeg') => {
    if (!process.env.API_KEY) {
        console.warn("Brak API_KEY. OCR niedostępny.");
        return null;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Image } },
                    { text: SYSTEM_PROMPT }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) return null;

        return JSON.parse(text);

    } catch (e) {
        console.error("OCR Service Error:", e);
        return null;
    }
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data:image/jpeg;base64, prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};
