
import React, { useState, useRef, useEffect } from 'react';
import { 
    Upload, X, FileText, CheckCircle, AlertCircle, 
    Loader2, ArrowRight, FileSpreadsheet, Database, 
    Shield, Terminal, Trash2, Users 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DataMapper } from '../services/dataMapper';
import { storage } from '../services/storage';
import { LegacyRateExtractor } from '../services/legacyRateExtractor';
import { SubAgent, Client, Policy, ClientNote } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportStats {
    totalRowsProcessed: number;
    clientsCreated: number;
    clientsUpdated: number;
    policiesCreated: number;
    policiesMerged: number;
    notes: number; 
    totalCommission: number;
    subAgentsDetected: number;
    insurersUpdated: number;
    ratesLearned: number;
}

export const DataImporter: React.FC<Props> = ({ isOpen, onClose, onImportComplete }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [processedRows, setProcessedRows] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const log = (msg: string) => {
    setLogs(prev => [...prev, msg]);
    console.log(`[Importer] ${msg}`);
  };

  const norm = (str?: string) => str ? str.trim().toLowerCase().replace(/\s+/g, ' ') : '';

  const processSpreadsheetData = async (workbook: XLSX.WorkBook) => {
    setIsProcessing(true);
    setProcessedRows(0);
    setError(null);
    setLogs([]);
    
    let counts: ImportStats = { 
        totalRowsProcessed: 0,
        clientsCreated: 0,
        clientsUpdated: 0,
        policiesCreated: 0,
        policiesMerged: 0,
        notes: 0, 
        totalCommission: 0, 
        subAgentsDetected: 0,
        insurersUpdated: 0,
        ratesLearned: 0
    };

    try {
        log("🚀 Inicjalizacja procesu importu...");
        const currentState = await storage.init(); 
        const workingClients: Client[] = [...currentState.clients];
        const clientMap = new Map<string, Client>(); 
        workingClients.forEach(c => clientMap.set(c.id, c));

        const allNotes: ClientNote[] = [...currentState.notes];
        const allPolicies: Policy[] = [...currentState.policies];
        const allSubAgents: SubAgent[] = [...currentState.subAgents];
        const allInsurers = new Set<string>(currentState.insurers || []);
        const allInsurerConfigs = { ...currentState.insurerConfigs };

        // --- STEP 1: POLICIES ---
        let policySheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('POLISY')) || workbook.SheetNames[0];
        log(`📂 Wykryto arkusz: ${policySheetName}`);
        
        const policySheet = workbook.Sheets[policySheetName];
        const policyRows = XLSX.utils.sheet_to_json(policySheet, { header: 1, defval: '' }) as any[][];

        let startIndex = 0;
        for (let i = 0; i < Math.min(20, policyRows.length); i++) {
            const rowStr = JSON.stringify(policyRows[i]).toLowerCase();
            if (rowStr.includes('imię') || rowStr.includes('kontakt') || rowStr.includes('nazwisko')) {
                startIndex = i + 1;
                log(`📍 Znaleziono nagłówek w wierszu ${i+1}.`);
                break;
            }
        }

        const usableRows = policyRows.slice(startIndex).filter(row => row && row.some(cell => cell && String(cell).trim().length > 1));
        setTotalRows(usableRows.length);
        log(`📊 Do przetworzenia: ${usableRows.length} wierszy.`);

        const subAgentCache = new Map<string, string>();
        allSubAgents.forEach(sa => subAgentCache.set(sa.name.toLowerCase(), sa.id));

        const importedPolicies: Policy[] = []; 

        for (let i = 0; i < usableRows.length; i++) {
            const row = usableRows[i];
            setProcessedRows(i + 1);
            counts.totalRowsProcessed++;

            try {
                const result = DataMapper.mapRow(row); 
                if (result) {
                    const parsedClient = result.client;
                    if (!parsedClient.lastName) {
                        log(`⚠️ [Wiersz ${i+startIndex+1}] POMINIĘTO: Brak nazwiska.`);
                        continue;
                    }

                    // Client matching logic
                    let existing = workingClients.find(ex => {
                        if (ex.pesel && parsedClient.pesel && ex.pesel === parsedClient.pesel && parsedClient.pesel.length === 11) return true;
                        const exLast = norm(ex.lastName); const exFirst = norm(ex.firstName);
                        const impLast = norm(parsedClient.lastName); const impFirst = norm(parsedClient.firstName);
                        if (exLast && impLast && exLast === impLast && exFirst === impFirst) return true;
                        return false;
                    });

                    let finalClientId = "";
                    if (existing) {
                        finalClientId = existing.id;
                        counts.clientsUpdated++;
                    } else {
                        workingClients.push(parsedClient);
                        clientMap.set(parsedClient.id, parsedClient); 
                        finalClientId = parsedClient.id;
                        counts.clientsCreated++;
                    }

                    result.policy.clientId = finalClientId;

                    // Agency detection
                    if (result.sourceName) {
                        const normalizedName = result.sourceName.trim();
                        const lowerName = normalizedName.toLowerCase();
                        let agentId = subAgentCache.get(lowerName);
                        
                        if (!agentId) {
                            agentId = `sa_imp_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
                            const newAgent: SubAgent = { id: agentId, name: normalizedName, defaultRates: { 'OC': 0, 'AC': 0 } };
                            allSubAgents.push(newAgent);
                            subAgentCache.set(lowerName, agentId);
                            counts.subAgentsDetected++;
                        }
                        result.policy.subAgentId = agentId;
                    }

                    if (result.policy.insurerName?.trim()) allInsurers.add(result.policy.insurerName.trim());

                    allPolicies.push(result.policy);
                    importedPolicies.push(result.policy);
                    counts.policiesCreated++;

                    if (result.policy.commission > 0) counts.totalCommission += result.policy.commission;

                    for (const note of result.notes) {
                        note.clientId = finalClientId;
                        note.linkedPolicyIds = [result.policy.id];
                        allNotes.push(note);
                        counts.notes++;
                    }
                    
                    if ((i + 1) % 50 === 0) {
                        log(`⏳ Postęp: ${(i + 1)}/${usableRows.length} wierszy...`);
                    }
                }
            } catch (rowError) {
                log(`❌ [Wiersz ${i+startIndex+1}] BŁĄD: ${String(rowError)}`);
            }
        }

        log("🧠 Uruchomienie LegacyRateExtractor (analiza stawek)...");
        const learnedAgents = LegacyRateExtractor.extractAndApplyRates(importedPolicies, allSubAgents);
        
        log("💾 Zapisywanie stanu do LocalStorage...");
        await storage.importState({
            ...currentState,
            clients: workingClients,
            policies: allPolicies,
            notes: allNotes,
            subAgents: learnedAgents,
            insurers: Array.from(allInsurers),
            insurerConfigs: allInsurerConfigs
        });

        counts.ratesLearned = learnedAgents.length;
        log("✅ Import zakończony sukcesem.");

        setStats(counts);
        onImportComplete();

    } catch (e: any) {
        log(`❌ BŁĄD KRYTYCZNY: ${e.message}`);
        setError(e.message || "Błąd przetwarzania pliku.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target?.result as ArrayBuffer, { type: 'array', cellDates: true });
          await processSpreadsheetData(workbook);
        } catch (err: any) {
          setError("Błąd struktury pliku Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Obsługiwane formaty: .xlsx, .xls");
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <div 
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md transition-opacity animate-in fade-in" 
            onClick={!isProcessing ? onClose : undefined} 
        />
        
        <div className="relative w-full max-w-4xl bg-zinc-900 border border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)] rounded-[1.75rem] overflow-hidden flex flex-col h-[90vh] animate-in zoom-in-95 duration-300">
            {/* Sandbox Header */}
            <div className="bg-indigo-600 px-6 py-2 flex items-center justify-center gap-2 text-white text-[10px] font-black uppercase tracking-widest flex-shrink-0">
                <Shield size={12} /> Local Sandbox — No Cloud Sync
            </div>

            <div className="p-8 flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                            <Database className="text-indigo-400" /> Wgrywanie XLSX <span className="text-indigo-500/50 text-sm font-normal">v5.0</span>
                        </h2>
                        <p className="text-zinc-500 mt-1">Lokalna destylacja danych ubezpieczeniowych.</p>
                    </div>
                    {!isProcessing && (
                        <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-colors text-zinc-500 hover:text-white">
                            <X size={24} />
                        </button>
                    )}
                </div>

                {stats ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6 rotate-3">
                            <CheckCircle size={56} className="text-white" />
                        </div>
                        <h3 className="text-4xl font-black text-white tracking-tighter mb-2">Gotowe!</h3>
                        <p className="text-zinc-400 mb-8 max-w-sm">Dzięki! Dane są już w Twojej lokalnej piaskownicy.</p>
                        
                        <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
                            <div className="bg-zinc-800/50 p-6 rounded-3xl border border-white/5">
                                <div className="text-3xl font-black text-indigo-400">{stats.policiesCreated}</div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Polisy</div>
                            </div>
                            <div className="bg-zinc-800/50 p-6 rounded-3xl border border-white/5">
                                <div className="text-3xl font-black text-indigo-400">{stats.clientsCreated + stats.clientsUpdated}</div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Klienci</div>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setStats(null); onClose(); }} 
                            className="w-full max-w-xs bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-xl"
                        >
                            Zamknij
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 overflow-hidden">
                        {/* Drag Area */}
                        <div className="flex flex-col gap-6">
                            {!isProcessing ? (
                                <div 
                                    className={`
                                        flex-1 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col items-center justify-center p-8 gap-4
                                        ${isDragOver 
                                            ? 'border-indigo-400 bg-indigo-500/10 scale-[0.98]' 
                                            : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/50'}
                                    `}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                    onDragLeave={() => setIsDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileInput} />
                                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 border border-indigo-500/20 shadow-inner">
                                        <FileSpreadsheet className="text-indigo-400" size={32} />
                                    </div>
                                    <p className="text-white font-bold text-lg">Wybierz plik Excel</p>
                                    <p className="text-zinc-500 text-sm mt-1">Kliknij tutaj lub przeciągnij plik</p>
                                </div>
                            ) : (
                                <div className="flex-1 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col items-center justify-center p-8 text-center animate-pulse">
                                     <div className="relative z-10 text-center">
                                        <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6 mx-auto shadow-2xl shadow-indigo-500/40" />
                                        <p className="text-white text-xl font-black tracking-tight uppercase">Analiza...</p>
                                        <p className="text-indigo-400 mt-2 font-mono text-xs">{processedRows} / {totalRows}</p>
                                     </div>
                                </div>
                            )}

                            <div className="bg-zinc-800/30 rounded-3xl p-6 border border-white/5 space-y-3">
                                <h4 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle size={14} className="text-amber-500" /> Przewodnik
                                </h4>
                                <ul className="text-[11px] text-zinc-500 space-y-2">
                                    <li className="flex gap-2">
                                        <span className="text-indigo-500">•</span> Automatyczne łączenie danych po numerze PESEL.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-indigo-500">•</span> Detekcja prowizji i stawek agentów legacy.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-indigo-500">•</span> Pełna izolacja — dane nie opuszczają przeglądarki.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Logs Area */}
                        <div className="flex flex-col h-full min-h-0 bg-black/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-inner">
                            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                    <Terminal size={12} /> Konsola Logowania
                                </h4>
                                <button onClick={() => setLogs([])} className="text-[10px] text-zinc-600 hover:text-indigo-400 transition-colors uppercase font-bold">Wyczyść</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar font-mono text-[10px] leading-relaxed">
                                {logs.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-zinc-700 italic">
                                        Oczekiwanie na plik...
                                    </div>
                                ) : (
                                    logs.map((logStr, i) => (
                                        <div key={i} className={`py-1 ${
                                            logStr.includes('❌') ? 'text-red-400' : 
                                            logStr.includes('⚠️') ? 'text-amber-400' : 
                                            logStr.includes('✅') ? 'text-emerald-400' : 'text-zinc-500'
                                        }`}>
                                            {logStr}
                                        </div>
                                    ))
                                )}
                                <div ref={logEndRef} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e550; border-radius: 2px; }
            `}</style>
        </div>
    </div>
  );
};
