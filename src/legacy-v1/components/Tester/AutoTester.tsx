
import React, { useState, useEffect } from 'react';
import { Bug, Play, X, Zap, Activity, Terminal, Trash2, Plane, Briefcase, Users, CalendarClock, Database, Stethoscope, AlertTriangle, CheckCircle2, Home, UserPlus, Phone, RefreshCcw, ThumbsDown, HelpCircle, Ghost } from 'lucide-react';
import { simulateType, simulateClick, simulateCheckbox, sleep } from './automationUtils';
import { storage } from '../../services/storage';
import { addDays } from 'date-fns';
import { Client, Policy, ClientNote } from '../../types';

interface Props {
    externalOpen?: boolean;
    onClose?: () => void;
    onRefresh?: () => void;
}

export const AutoTester: React.FC<Props> = ({ externalOpen, onClose, onRefresh }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Sync with external control
  useEffect(() => {
      if (externalOpen !== undefined) {
          setIsOpen(externalOpen);
      }
  }, [externalOpen]);

  const handleClose = () => {
      setIsOpen(false);
      if (onClose) onClose();
  };

  const log = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev].slice(0, 50));

  // --- HELPERY DANYCH ---
  const FAKE_NAMES = ['Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański'];
  const FAKE_FIRST = ['Jan', 'Anna', 'Piotr', 'Katarzyna', 'Michał', 'Agnieszka', 'Tomasz', 'Barbara'];
  const FAKE_CARS = ['Toyota Yaris', 'Skoda Octavia', 'BMW X5', 'Audi A4', 'Ford Focus', 'Kia Sportage', 'Volvo XC60'];

  const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  // --- SYMULACJA AGENTA (THE NARRATIVE ENGINE) ---
  const runAgentScenario = async (outcome: 'SUCCESS' | 'RECALC' | 'GHOST') => {
      if (isRunning) return;
      setIsRunning(true);
      setLogs([]);
      
      const scenarioName = outcome === 'SUCCESS' ? 'Szybka Akceptacja' : (outcome === 'RECALC' ? 'Maruda (Rekalkulacja)' : 'Nie Odbiera (Ghost)');
      log(`🎬 START SCENARIUSZA: ${scenarioName}`);
      
      try {
          // KROK 1: KLIENT
          log("👤 [1/6] Tworzę klienta w bazie...");
          
          const fname = getRandom(FAKE_FIRST);
          const lname = getRandom(FAKE_NAMES);
          const clientId = `sim_c_${Date.now()}`;
          
          const newClient: Client = {
              id: clientId,
              firstName: fname,
              lastName: lname,
              pesel: `9${getRandomInt(0,9)}0101${getRandomInt(10000,99999)}`,
              phones: ['500600700'],
              emails: [`${fname.toLowerCase()}@test.pl`],
              street: 'Testowa 1',
              city: 'Gdańsk',
              zipCode: '80-000',
              businesses: [],
              createdAt: new Date().toISOString()
          };
          await storage.addClient(newClient);
          
          // CRITICAL FIX: Czekamy na cykl odświeżania App.tsx (5s) zamiast reloadu
          log("⏳ Czekam na synchronizację UI (5s)...");
          await sleep(5500); 
          log(`✅ Klient widoczny w systemie.`);

          // KROK 2: OFERTA (Do zrobienia)
          log("📄 [2/6] Generuję ofertę 'Do zrobienia'...");
          
          const car = getRandom(FAKE_CARS);
          const policyId = `sim_p_${Date.now()}`;
          const policy: Policy = {
              id: policyId,
              clientId: clientId,
              type: 'OC',
              stage: 'of_do zrobienia',
              insurerName: '---',
              policyNumber: '',
              vehicleBrand: car,
              vehicleReg: `GD ${getRandomInt(10000,99999)}`,
              vehicleVin: '',
              terminationBasis: 'art28' as any,
              policyStartDate: new Date().toISOString(),
              policyEndDate: addDays(new Date(), 365).toISOString(),
              premium: 0, commission: 0,
              createdAt: new Date().toISOString()
          };
          await storage.addPolicy(policy);
          
          // Wymuś nawigację do Dashboardu, żeby zobaczyć zmianę
          const dashBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Pulpit'));
          if(dashBtn) dashBtn.click();
          
          await sleep(1000); // UI Refresh
          log(`✅ Dodano temat na Dashboard: ${car}`);

          // KROK 3: KALKULACJA (W toku)
          await sleep(1500);
          log("🧮 [3/6] Agentka dzwoni i robi kalkulację...");
          
          await storage.addNote({
              id: `n_${Date.now()}_1`, clientId, linkedPolicyIds: [policyId],
              content: "Telefon do klienta: Potwierdził bezszkodowość. Żona jako współwłaściciel.",
              tag: 'ROZMOWA', createdAt: new Date().toISOString()
          });
          
          policy.stage = 'przeł kontakt';
          await storage.updatePolicy(policy);
          log("🔄 Status: W TRAKCIE (Kalkulacja)");

          // KROK 4: WYNIKI I WYSYŁKA
          await sleep(2000);
          const priceWarta = getRandomInt(500, 900);
          const pricePZU = priceWarta + 150;
          
          log(`📧 [4/6] Warta: ${priceWarta}zł. Wysyłam ofertę.`);
          
          await storage.addNote({
              id: `n_${Date.now()}_2`, clientId, linkedPolicyIds: [policyId],
              content: `[MAIL: WYSŁANY] Oferta przesłana. Warta: ${priceWarta} zł, PZU: ${pricePZU} zł.`,
              tag: 'OFERTA', createdAt: new Date().toISOString()
          });

          policy.stage = 'oferta_wysłana';
          policy.insurerName = 'Warta';
          policy.premium = priceWarta;
          await storage.updatePolicy(policy);
          log("📨 Status: OFERTA WYSŁANA");

          // KROK 5: DECYZJA (Rozgałęzienie)
          await sleep(2000);
          
          if (outcome === 'SUCCESS') {
              log("👍 [5/6] Klient dzwoni: BIERZE!");
              await storage.addNote({
                  id: `n_${Date.now()}_3`, clientId, linkedPolicyIds: [policyId],
                  content: "Klient zaakceptował Wartę. Polisa wystawiona.",
                  tag: 'STATUS', createdAt: new Date().toISOString()
              });
              policy.stage = 'sprzedaż';
              policy.policyNumber = `POL/${getRandomInt(100000, 999999)}`;
              policy.commission = Math.round(priceWarta * 0.15); // 15% prowizji
              await storage.updatePolicy(policy);
              if (onRefresh) onRefresh();
              log("💰 [6/6] SUKCES! Polisa sprzedana.");

          } else if (outcome === 'RECALC') {
              log("👎 [5/6] Klient: 'Za drogo!'");
              await storage.addNote({
                  id: `n_${Date.now()}_3`, clientId, linkedPolicyIds: [policyId],
                  content: "Za drogo. Klient ma ofertę w Link4 za 400zł. Sprawdzić MTU.",
                  tag: 'DECISION_PRICE', createdAt: new Date().toISOString()
              });
              
              // Cofamy do kalkulacji
              policy.stage = 'przeł kontakt'; 
              await storage.updatePolicy(policy);
              log("🔄 Cofam do: W TRAKCIE (Szukam taniej...)");
              
              await sleep(1500);
              log("💡 Znalazłam! MTU wychodzi 390zł.");
              await storage.addNote({
                  id: `n_${Date.now()}_4`, clientId, linkedPolicyIds: [policyId],
                  content: "Nowa oferta MTU: 390 zł. Klient akceptuje.",
                  tag: 'ROZMOWA', createdAt: new Date().toISOString()
              });
              
              policy.insurerName = 'MTU';
              policy.premium = 390;
              policy.commission = 30;
              policy.stage = 'sprzedaż';
              policy.policyNumber = `MTU/${getRandomInt(100000, 999999)}`;
              await storage.updatePolicy(policy);
              if (onRefresh) onRefresh();
              log("💰 [6/6] Uratowane! Polisa sprzedana w MTU.");

          } else if (outcome === 'GHOST') {
              log("👻 [5/6] Dzwonię... Poczta głosowa.");
              await storage.addNote({
                  id: `n_${Date.now()}_3`, clientId, linkedPolicyIds: [policyId],
                  content: "[ST: BRAK TEL] Próba kontaktu nieudana. Prosił o kontakt po 16:00.",
                  tag: 'STATUS', 
                  createdAt: new Date().toISOString(),
                  reminderDate: addDays(new Date(), 1).toISOString()
              });
              log("⏰ [6/6] Ustawiłam przypomnienie na jutro.");
          }

          // Finalny wait na odświeżenie widoku
          await sleep(2000);
          log("🏁 Scenariusz zakończony. Dane zapisane.");

      } catch (e: any) {
          log(`❌ BŁĄD SKRYPTU: ${e.message}`);
          console.error(e);
      } finally {
          setIsRunning(false);
      }
  };

  // --- NAWIGACJA ---
  const navigateTo = async (btnText: string) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.toLowerCase().includes(btnText.toLowerCase()));
      if (btn) {
          btn.click();
          await sleep(600);
          return true;
      }
      return false;
  };

  const runSanityCheck = async () => {
      setIsRunning(true);
      setLogs([]);
      log("🔍 DIAGNOSTYKA BAZY...");
      await sleep(500);
      try {
          const state = storage.getState();
          let issues = 0;
          const badIds = state.clients.filter(c => !c.id || c.id === 'undefined');
          if (badIds.length > 0) { log(`❌ KRYTYCZNE: ${badIds.length} uszkodzonych ID!`); issues++; }
          else log("✨ Struktura bazy OK.");
      } catch (e: any) {
          log(`❌ Error: ${e.message}`);
      } finally {
          setIsRunning(false);
      }
  };

  const runScenarioNuke = async () => {
      if(confirm("☢️ CZYŚCIMY BAZĘ?")) {
          await storage.clearAllData();
          window.location.reload();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-zinc-950/80 backdrop-blur-2xl border border-indigo-500/30 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden font-mono text-xs animate-in slide-in-from-bottom-10 flex flex-col max-h-[80vh]">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-3 flex justify-between items-center flex-shrink-0">
            <span className="font-black text-white flex items-center gap-2">
                <Terminal size={14} className="text-indigo-200" /> SYMBBIOSIS AGENT v5.0
            </span>
            <div className="flex gap-2">
                <button onClick={() => setLogs([])} className="hover:bg-black/20 p-1 rounded"><Trash2 size={14} className="text-black"/></button>
                <button onClick={handleClose} className="hover:bg-black/20 p-1 rounded"><X size={14} className="text-black"/></button>
            </div>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            
            {/* SEKCJA AGENTKA 007 */}
            <div className="space-y-2">
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1"><Briefcase size={10}/> SCENARIUSZE SPRZEDAŻOWE</p>
                
                <button onClick={() => runAgentScenario('SUCCESS')} disabled={isRunning} className="tester-btn text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/20">
                    <CheckCircle2 size={14} /> 
                    <div><div className="font-bold">Ścieżka: SUKCES</div><div className="text-[8px] opacity-70">Klient &gt; Oferta &gt; Akceptacja &gt; Polisa</div></div>
                </button>

                <button onClick={() => runAgentScenario('RECALC')} disabled={isRunning} className="tester-btn text-amber-400 border-amber-900/50 hover:bg-amber-900/20">
                    <RefreshCcw size={14} /> 
                    <div><div className="font-bold">Ścieżka: MARUDA</div><div className="text-[8px] opacity-70">"Za drogo" &gt; Rekalkulacja &gt; Sukces</div></div>
                </button>

                <button onClick={() => runAgentScenario('GHOST')} disabled={isRunning} className="tester-btn text-purple-400 border-purple-900/50 hover:bg-purple-900/20">
                    <Ghost size={14} /> 
                    <div><div className="font-bold">Ścieżka: DUCH</div><div className="text-[8px] opacity-70">Brak kontaktu &gt; Przypomnienie</div></div>
                </button>
            </div>

            {/* SEKCJA NARZĘDZIA */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1"><Database size={10}/> ADMIN TOOLS</p>

                <button onClick={runSanityCheck} disabled={isRunning} className="tester-btn text-blue-400">
                    <Stethoscope size={14} /> Diagnoza Bazy
                </button>

                <button onClick={runScenarioNuke} disabled={isRunning} className="tester-btn text-red-500 border-red-900 hover:bg-red-900/20">
                    <Trash2 size={14} /> RESET (WIPE)
                </button>
            </div>
        </div>

        {/* LOGI */}
        <div className="bg-black p-2 h-32 overflow-y-auto border-t-2 border-yellow-600 text-[10px] text-zinc-400 font-mono flex-shrink-0">
            {logs.length === 0 && <span className="opacity-50 italic">&gt; Gotowy. Wybierz scenariusz...</span>}
            {logs.map((l, i) => (
                <div key={i} className="mb-1 border-b border-zinc-900 pb-0.5 last:border-0">{l}</div>
            ))}
        </div>

        <style>{`
            .tester-btn {
                @apply w-full flex items-center gap-3 p-2.5 bg-zinc-900/50 hover:bg-indigo-600/20 rounded-2xl border border-white/5 disabled:opacity-50 text-left transition-all hover:border-indigo-500/30;
            }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 2px; }
        `}</style>
    </div>
  );
};
