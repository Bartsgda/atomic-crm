
import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, ArrowRight, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DataMapper } from '../services/dataMapper';
import { storage } from '../services/storage';
import { LegacyRateExtractor } from '../services/legacyRateExtractor';
import { SubAgent, Client, Policy } from '../types';

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
    terminations: number;
    totalCommission: number;
    subAgentsDetected: number;
    insurersUpdated: number;
    ratesLearned: number;
}

export const DataImporter: React.FC<Props> = ({ isOpen, onClose, onImportComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const norm = (str?: string) => str ? str.trim().toLowerCase().replace(/\s+/g, ' ') : '';

  const processSpreadsheetData = async (workbook: XLSX.WorkBook) => {
    setIsLoading(true);
    setError(null);
    
    let counts: ImportStats = { 
        totalRowsProcessed: 0,
        clientsCreated: 0,
        clientsUpdated: 0,
        policiesCreated: 0,
        policiesMerged: 0,
        notes: 0, 
        terminations: 0, 
        totalCommission: 0, 
        subAgentsDetected: 0,
        insurersUpdated: 0,
        ratesLearned: 0
    };

    try {
        const currentState = storage.getState();
        const workingClients: Client[] = [...currentState.clients];
        const clientMap = new Map<string, Client>(); 
        workingClients.forEach(c => clientMap.set(c.id, c));

        // --- STEP 0: DICTIONARIES ---
        if (workbook.SheetNames.includes("POSREDNICY")) {
            const sheet = workbook.Sheets["POSREDNICY"];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[1] || String(row[1]).trim().length < 2) continue;
                const existingId = String(row[0]).trim();
                const subAgent: SubAgent = {
                    id: existingId || `sa_xls_${Date.now()}_${i}`, 
                    name: String(row[1]).trim(),
                    phone: String(row[2]).trim(),
                    email: String(row[3]).trim(),
                    defaultRates: (() => { try { return JSON.parse(row[4] || '{}') } catch { return {} } })()
                };
                const exists = currentState.subAgents.find(sa => sa.id === subAgent.id);
                if (exists) await storage.updateSubAgent(subAgent);
                else await storage.addSubAgent(subAgent);
                counts.subAgentsDetected++;
            }
        }

        if (workbook.SheetNames.includes("TOWARZYSTWA")) {
            const sheet = workbook.Sheets["TOWARZYSTWA"];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue;
                const name = String(row[0]).trim(); 
                await storage.addActiveInsurer(name);
                await storage.updateInsurerConfig({
                    id: name, name: name, isActive: true,
                    managerName: String(row[5]).trim(), managerPhone: String(row[6]).trim(),
                    managerEmail: String(row[7]).trim(), helpdeskPhone: String(row[8]).trim(),
                });
                counts.insurersUpdated++;
            }
        }

        // --- STEP 1: CLIENTS ---
        if (workbook.SheetNames.includes("KLIENCI")) {
            const clientSheet = workbook.Sheets["KLIENCI"];
            const clientRows = XLSX.utils.sheet_to_json(clientSheet, { header: 1, defval: '' }) as any[][];
            for (let i = 1; i < clientRows.length; i++) {
                const mapped = DataMapper.mapClientRow(clientRows[i]);
                if (mapped) {
                    const { client, notes } = mapped;
                    const existing = clientMap.get(client.id);
                    if (existing) {
                        Object.assign(existing, client);
                        counts.clientsUpdated++;
                    } else {
                        workingClients.push(client);
                        clientMap.set(client.id, client);
                        counts.clientsCreated++;
                    }
                    for (const n of notes) {
                        await storage.addNote(n);
                        counts.notes++;
                    }
                }
            }
            for (const c of workingClients) await storage.addClient(c); 
        }

        // --- STEP 2: POLICIES ---
        let policySheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('POLISY')) || workbook.SheetNames[0];
        if (workbook.SheetNames.includes("KLIENCI") && workbook.SheetNames.length > 1) {
             policySheetName = workbook.SheetNames.find(n => n !== "KLIENCI") || workbook.SheetNames[0];
        }

        const policySheet = workbook.Sheets[policySheetName];
        const policyRows = XLSX.utils.sheet_to_json(policySheet, { header: 1, defval: '' }) as any[][];

        let startIndex = 0;
        for (let i = 0; i < Math.min(20, policyRows.length); i++) {
            const rowStr = JSON.stringify(policyRows[i]).toLowerCase();
            if (rowStr.includes('imię') || rowStr.includes('kontakt')) {
                startIndex = i + 1;
                break;
            }
        }

        const collectedInsurers = new Set<string>(currentState.insurers || []);
        const updatedSubAgents = storage.getState().subAgents;
        const subAgentCache = new Map<string, string>();
        updatedSubAgents.forEach(sa => subAgentCache.set(sa.name.toLowerCase(), sa.id));

        const importedPolicies = []; 

        for (let i = startIndex; i < policyRows.length; i++) {
            const row = policyRows[i];
            const hasContent = row && row.some(cell => cell && String(cell).trim().length > 1);
            if (!hasContent) continue;

            counts.totalRowsProcessed++;

            const result = DataMapper.mapRow(row); 
            if (result) {
                const sysClientId = row[30]; 
                let finalClientId = "";

                if (sysClientId && clientMap.has(sysClientId)) {
                    finalClientId = sysClientId;
                } else {
                    const parsedClient = result.client;
                    if (!parsedClient.lastName) continue;

                    const existing = workingClients.find(ex => {
                        if (ex.id === parsedClient.id) return true;
                        if (ex.pesel && parsedClient.pesel && ex.pesel === parsedClient.pesel && parsedClient.pesel.length === 11) return true;
                        const impNip = parsedClient.businesses?.[0]?.nip?.replace(/-/g, '');
                        if (impNip && ex.businesses?.some(b => b.nip?.replace(/-/g, '') === impNip)) return true;
                        const exLast = norm(ex.lastName); const exFirst = norm(ex.firstName);
                        const impLast = norm(parsedClient.lastName); const impFirst = norm(parsedClient.firstName);
                        if (exLast && impLast) {
                            if (exLast === impLast && exFirst === impFirst) return true;
                            if (exLast === impFirst && exFirst === impLast) return true;
                        }
                        return false;
                    });

                    if (existing) {
                        finalClientId = existing.id;
                    } else {
                        await storage.addClient(parsedClient);
                        workingClients.push(parsedClient);
                        clientMap.set(parsedClient.id, parsedClient); 
                        finalClientId = parsedClient.id;
                        counts.clientsCreated++;
                    }
                }

                result.policy.clientId = finalClientId;

                if (result.sourceName) {
                    const normalizedName = result.sourceName.trim();
                    const lowerName = normalizedName.toLowerCase();
                    let agentId = subAgentCache.get(lowerName);
                    
                    if (!agentId) {
                        agentId = `sa_imp_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
                        const newAgent: SubAgent = { id: agentId, name: normalizedName, defaultRates: { 'OC': 0, 'AC': 0 } };
                        await storage.addSubAgent(newAgent);
                        updatedSubAgents.push(newAgent);
                        subAgentCache.set(lowerName, agentId);
                        counts.subAgentsDetected++;
                    }
                    result.policy.subAgentId = agentId;
                    if (!result.policy.subAgentSplits || result.policy.subAgentSplits.length === 0) {
                        result.policy.subAgentSplits = [{ agentId: agentId, rate: result.policy.subAgentRate || 0, amount: result.policy.subAgentCommission || 0, note: 'Import XLSX' }];
                    }
                }

                if (result.policy.insurerName?.trim()) collectedInsurers.add(result.policy.insurerName.trim());

                // --- RAW IMPORT MODE (NO MERGE) ---
                // Zasada: Importujemy wszystko jak leci. Duplikaty wyłapie Agent w widoku Naprawy Danych.
                await storage.addPolicy(result.policy);
                counts.policiesCreated++;
                importedPolicies.push(result.policy);

                if (result.policy.commission > 0) counts.totalCommission += result.policy.commission;

                for (const note of result.notes) {
                    note.clientId = finalClientId;
                    note.linkedPolicyIds = [result.policy.id];
                    await storage.addNote(note);
                    counts.notes++;
                }
            }
        }

        for (const ins of Array.from(collectedInsurers)) await storage.addActiveInsurer(ins);

        const learnedAgents = LegacyRateExtractor.extractAndApplyRates(importedPolicies, updatedSubAgents);
        for (const agent of learnedAgents) await storage.updateSubAgent(agent);
        counts.ratesLearned = learnedAgents.length;

        setStats(counts);
        onImportComplete();

    } catch (e) {
        console.error(e);
        setError("Błąd przetwarzania pliku. Sprawdź format danych.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(e.target?.result as ArrayBuffer, { type: 'array', cellDates: true });
        processSpreadsheetData(workbook);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Obsługiwane formaty: .xlsx, .xls");
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-3">
            <Upload size={24} className="text-red-600" /> Kreator Importu
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-zinc-400 hover:text-zinc-900 transition-all"><X size={24} /></button>
        </div>

        <div className="p-10">
          {stats ? (
            <div className="text-center space-y-6">
              <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 mb-2">
                    <CheckCircle size={48} />
                  </div>
                  <h4 className="text-3xl font-black text-zinc-900 tracking-tight">Sukces!</h4>
                  <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest mt-1">Raw Import Active - 100% danych przeniesionych.</p>
              </div>

              <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6">
                  <div className="mb-6 pb-6 border-b border-zinc-200">
                      <div className="flex items-center justify-center gap-3 text-zinc-400 mb-1">
                          <FileSpreadsheet size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Wiersze z Excela</span>
                      </div>
                      <div className="text-5xl font-black text-zinc-900">{stats.totalRowsProcessed}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-2xl border border-zinc-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span className="text-xs font-bold text-zinc-600">Utworzone Polisy</span>
                          </div>
                          <span className="text-xl font-black text-zinc-900">{stats.policiesCreated}</span>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-zinc-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span className="text-xs font-bold text-zinc-600">Notatki</span>
                          </div>
                          <span className="text-xl font-black text-zinc-900">{stats.notes}</span>
                      </div>
                  </div>
              </div>

              <button onClick={() => { setStats(null); onClose(); }} className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3">
                Wróć do pracy <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <>
              <div 
                className={`border-4 border-dashed rounded-[2.5rem] p-12 text-center transition-all cursor-pointer ${isDragging ? 'border-red-500 bg-red-50' : 'border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-6" />
                    <p className="text-lg font-black text-zinc-900">Analiza Danych...</p>
                  </div>
                ) : (
                  <>
                    <FileText className="w-16 h-16 text-zinc-200 mx-auto mb-6" />
                    <p className="text-lg font-black text-zinc-900">Kliknij lub upuść plik XLSX</p>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-3">Tryb Raw-Import (Zero Scalania)</p>
                  </>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
              {error && (
                <div className="mt-6 p-4 bg-rose-50 text-rose-700 text-xs font-black rounded-2xl flex items-center gap-3 border border-rose-100">
                  <AlertCircle size={20} /> {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
