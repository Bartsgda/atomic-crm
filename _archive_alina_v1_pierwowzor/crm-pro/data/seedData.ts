
import { AppState, Client, Policy, ClientNote, PolicyType, TerminationBasis, SubAgent } from '../types';

const FIRST_NAMES = ['Adam', 'Barbara', 'Cezary', 'Dorota', 'Edward', 'Ewa', 'Filip', 'Grażyna', 'Henryk', 'Iwona', 'Jan', 'Karolina', 'Łukasz', 'Monika', 'Norbert', 'Olga', 'Piotr', 'Renata', 'Stanisław', 'Teresa'];
const LAST_NAMES = ['Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Wojciechowski'];
const CITIES = ['Gdańsk', 'Gdynia', 'Sopot', 'Warszawa', 'Kraków', 'Poznań', 'Wrocław', 'Łódź', 'Szczecin', 'Bydgoszcz'];
const CARS = ['Toyota Yaris', 'Skoda Octavia', 'Volkswagen Golf', 'Ford Focus', 'Opel Astra', 'BMW X5', 'Audi A4', 'Mercedes C200', 'Volvo XC60', 'Kia Sportage'];
const INSURERS = ['Warta', 'PZU', 'Hestia', 'Allianz', 'Generali', 'Uniqa', 'Link4', 'Compensa', 'Wiener', 'Interrisk'];

const getRandomElement = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateFakePesel = (year: number) => {
    const y = year.toString().substring(2);
    const m = getRandomInt(1, 12).toString().padStart(2, '0');
    const d = getRandomInt(1, 28).toString().padStart(2, '0');
    const r = getRandomInt(10000, 99999);
    return `${y}${m}${d}${r}`;
};

export const generateSeedData = (): AppState => {
  console.log("%c[SEED] Rozpoczynam generowanie danych...", "color: cyan; font-weight: bold;");
  
  const clients: Client[] = [];
  const policies: Policy[] = [];
  const notes: ClientNote[] = [];
  
  // --- SUB AGENTS SEED ---
  const subAgents: SubAgent[] = [
      {
          id: 'sa_marek',
          name: 'Marek Auto-Handel',
          phone: '500 123 456',
          email: 'marek@komis.pl',
          defaultRates: { 'OC': 5.0, 'AC': 5.0, 'BOTH': 5.0, 'INNE': 2.0 }
      },
      {
          id: 'sa_biuro',
          name: 'Biuro Nieruchomości Kąt',
          phone: '600 987 654',
          email: 'biuro@kat.pl',
          defaultRates: { 'DOM': 10.0, 'ZYCIE': 15.0, 'INNE': 5.0 }
      }
  ];

  try {
      // Generujemy 30 bogatych rekordów
      for (let i = 0; i < 30; i++) {
        const firstName = getRandomElement(FIRST_NAMES);
        const lastName = getRandomElement(LAST_NAMES);
        const city = getRandomElement(CITIES);
        const clientId = `c_demo_${i}_${Date.now()}`;
        const creationDate = new Date();
        creationDate.setDate(creationDate.getDate() - getRandomInt(10, 300)); // Klient istnieje od jakiegoś czasu

        // Klient
        clients.push({
            id: clientId,
            firstName,
            lastName,
            pesel: generateFakePesel(getRandomInt(1950, 2000)),
            phones: [`500${getRandomInt(100, 999)}${getRandomInt(100, 999)}`],
            emails: [`${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`],
            street: `ul. Przykładowa ${getRandomInt(1, 150)}`,
            city,
            zipCode: `${getRandomInt(10, 99)}-${getRandomInt(100, 999)}`,
            createdAt: creationDate.toISOString(),
            businesses: i % 4 === 0 ? [{ // Co 4-ty klient ma firmę
                name: `${lastName.toUpperCase()} INVEST SP. Z O.O.`,
                nip: `583${getRandomInt(1000000, 9999999)}`,
                city,
                street: `ul. Biznesowa ${getRandomInt(1, 10)}`,
                zipCode: '80-000',
                representation: 'Zarząd wieloosobowy'
            }] : []
        });

        // Polisy
        const policiesCount = getRandomInt(1, 3);
        for(let j=0; j<policiesCount; j++) {
            const policyId = `p_${clientId}_${j}`;
            const typeRoll = getRandomInt(1, 100);
            let type: PolicyType = 'OC';
            let item = '';
            
            if (typeRoll < 50) { type = 'OC'; item = getRandomElement(CARS); }
            else if (typeRoll < 70) { type = 'AC'; item = getRandomElement(CARS); }
            else if (typeRoll < 85) { type = 'DOM'; item = `Mieszkanie ${city}, ul. Długa`; }
            else if (typeRoll < 95) { type = 'PODROZ'; item = 'Wyjazd narty Włochy'; }
            else { type = 'ZYCIE'; item = 'Polisa Grupowa'; }

            // Logika Dat:
            const dateRoll = getRandomInt(1, 100);
            const endDate = new Date();
            
            if (dateRoll < 30) endDate.setDate(endDate.getDate() + getRandomInt(1, 30));
            else if (dateRoll < 50) endDate.setDate(endDate.getDate() - getRandomInt(1, 14));
            else endDate.setDate(endDate.getDate() + getRandomInt(31, 360));

            const startDate = new Date(endDate);
            startDate.setFullYear(startDate.getFullYear() - 1);

            const isExpired = endDate < new Date();
            const stage = isExpired ? 'of_do zrobienia' : 'sprzedaż';
            const premium = getRandomInt(400, 4500);
            
            // --- SUB AGENT LOGIC (20% Chance) ---
            let subAgentId = undefined;
            let subAgentRate = undefined;
            let subAgentCommission = undefined;
            let noteForSubAgent = undefined;

            if (Math.random() > 0.8) {
                if (['OC', 'AC', 'BOTH'].includes(type)) {
                    const agent = subAgents[0]; // Marek
                    subAgentId = agent.id;
                    subAgentRate = agent.defaultRates[type] || 5;
                    subAgentCommission = parseFloat(((premium * subAgentRate) / 100).toFixed(2));
                    noteForSubAgent = "Rozliczenie gotówkowe";
                } else if (['DOM', 'ZYCIE'].includes(type)) {
                    const agent = subAgents[1]; // Biuro
                    subAgentId = agent.id;
                    subAgentRate = agent.defaultRates[type] || 10;
                    subAgentCommission = parseFloat(((premium * subAgentRate) / 100).toFixed(2));
                    noteForSubAgent = "Przelew koniec miesiąca";
                }
            }

            policies.push({
                id: policyId,
                clientId: clientId,
                type,
                stage,
                insurerName: getRandomElement(INSURERS),
                policyNumber: `POL/${getRandomInt(1000, 9999)}/${new Date().getFullYear()}`,
                vehicleBrand: (type === 'OC' || type === 'AC') ? item : (type === 'DOM' ? item : (type === 'PODROZ' ? item : '')),
                vehicleReg: (type === 'OC' || type === 'AC') ? `GD${getRandomInt(10000, 99999)}` : '',
                vehicleVin: (type === 'OC' || type === 'AC') ? `VIN${getRandomInt(1000000000, 9999999999)}` : '',
                destinationCountry: type === 'PODROZ' ? 'Włochy' : '',
                policyStartDate: startDate.toISOString(),
                policyEndDate: endDate.toISOString(),
                premium,
                commission: getRandomInt(50, 800),
                terminationBasis: TerminationBasis.ART_28,
                paymentStatus: Math.random() > 0.7 ? 'UNPAID' : 'PAID',
                createdAt: creationDate.toISOString(),
                
                // Add Split Data
                subAgentId,
                subAgentRate,
                subAgentCommission,
                noteForSubAgent
            });

            // Notatki
            if (Math.random() > 0.4) {
                notes.push({
                    id: `n_${policyId}`,
                    clientId,
                    tag: 'ROZMOWA',
                    content: `[ST: ${isExpired ? 'OCZEKIWANIE' : 'OK'}] Klient pytał o zniżkę na ${item}. Pamiętać o Assistance.`,
                    createdAt: creationDate.toISOString(),
                    linkedPolicyIds: [policyId]
                });
            }
        }
      }
      
      console.log(`%c[SEED] SUKCES. Wygenerowano: ${clients.length} klientów, ${policies.length} polis, ${notes.length} notatek.`, "color: lime; font-weight: bold;");
      
      // Extract active insurers from policies
      const insurers = Array.from(new Set(policies.map(p => p.insurerName))).sort();

      return { 
          clients, 
          policies, 
          notes, 
          notifications: [], 
          terminations: [], 
          logs: [], 
          subAgents, 
          checklistTemplates: {}, 
          insurers 
      };

  } catch (error) {
      console.error("%c[SEED] CRITICAL ERROR", "color: red; font-size: 20px;", error);
      throw error;
  }
};
