
import React, { useRef, useState } from 'react';
import { Download, Upload, Database, CheckCircle2, AlertTriangle, Trash2, ShieldAlert, Sparkles, PlayCircle } from 'lucide-react';
import { storage } from '../services/storage';
import { generateSeedData } from '../data/seedData';
import { format } from 'date-fns';

interface Props {
    onRefresh?: () => void;
}

export const BackupManager: React.FC<Props> = ({ onRefresh }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [demoConfirm, setDemoConfirm] = useState(false);

  const performRefresh = () => {
      console.log("[BackupManager] Refreshing application state...");
      if (onRefresh) {
          onRefresh();
      } else {
          console.warn("[BackupManager] No onRefresh handler provided. Fallback to reload.");
          window.location.reload();
      }
  };

  const handleExport = () => {
    const state = storage.getState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchorNode = document.createElement('a');
    const fileName = `insurance_master_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    storage.addNotification({
        id: `sys_exp_${Date.now()}`,
        type: 'INFO',
        message: 'Wyeksportowano pełną kopię bazy danych do pliku JSON.',
        timestamp: new Date().toISOString(),
        isRead: false
    });
  };

  const handleImportClick = () => {
    if (confirm("UWAGA! Wczytanie bazy JSON NADPISZE wszystkie obecne dane (klientów, polisy i notatki). Czy na pewno chcesz kontynuować?")) {
        fileInputRef.current?.click();
    }
  };

  const handleGenerateDemo = async () => {
      console.group("[BackupManager] Demo Generation Process");
      try {
          if (demoConfirm) {
              console.log("1. Starting seed generation...");
              const seed = generateSeedData();
              
              console.log("2. Seed data generated. Starting merge into Storage...");
              
              // 1. Clients
              let i = 0;
              for (const c of seed.clients) {
                  await storage.addClient(c);
                  i++;
                  if(i % 10 === 0) console.log(`   - Added ${i} clients`);
              }
              
              // 2. SubAgents (FIX: Added saving logic)
              if (seed.subAgents && seed.subAgents.length > 0) {
                  for (const agent of seed.subAgents) {
                      await storage.addSubAgent(agent);
                  }
                  console.log(`   - Added ${seed.subAgents.length} sub-agents`);
              }

              // 3. Policies
              for (const p of seed.policies) await storage.addPolicy(p);
              console.log(`   - Added ${seed.policies.length} policies`);
              
              // 4. Notes
              for (const n of seed.notes) await storage.addNote(n);
              console.log(`   - Added ${seed.notes.length} notes`);
              
              console.log("3. Adding system notification...");
              await storage.addNotification({
                  id: `sys_demo_${Date.now()}`,
                  type: 'AI_SUCCESS',
                  message: `Wygenerowano dane demonstracyjne (${seed.clients.length} klientów, ${seed.policies.length} polis, ${seed.subAgents?.length || 0} pośredników).`,
                  timestamp: new Date().toISOString(),
                  isRead: false
              });

              console.log("4. SUCCESS. Refreshing UI...");
              performRefresh();
              setDemoConfirm(false);
          } else {
              console.log("0. Waiting for confirmation click.");
              setDemoConfirm(true);
              setTimeout(() => setDemoConfirm(false), 4000);
          }
      } catch (e) {
          console.error("!!! GENERATION CRASHED !!!", e);
          alert("Błąd generowania danych. Sprawdź konsolę (F12) po szczegóły.");
      } finally {
          console.groupEnd();
      }
  };

  const handleWipeData = async () => {
      if (wipeConfirm) {
          console.warn("[BackupManager] WIPING ALL DATA");
          await storage.clearAllData();
          performRefresh();
          setWipeConfirm(false);
      } else {
          setWipeConfirm(true);
          setTimeout(() => setWipeConfirm(false), 3000); // Reset after 3s if not confirmed
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        await storage.importState(json);
        setImportStatus('success');
        setTimeout(() => {
            setImportStatus('idle');
            performRefresh();
        }, 1500);
      } catch (err) {
        console.error(err);
        setImportStatus('error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="px-3 py-4 border-t border-zinc-900 mt-2 bg-zinc-950/20 rounded-b-xl space-y-3">
      <p className="text-[9px] uppercase font-black text-zinc-600 mb-2 tracking-wider flex items-center gap-2 px-1">
        <Database size={10} /> Backup Systemowy (JSON)
      </p>
      
      <div className="flex gap-2">
        <button 
          onClick={handleExport}
          className="flex-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 group shadow-lg"
          title="Pełny eksport stanu systemu"
        >
          <Download size={14} className="group-hover:text-red-600 transition-colors" />
          Eksport
        </button>

        <button 
          onClick={handleImportClick}
          className="flex-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1 group shadow-lg"
          title="Pełne przywrócenie bazy"
        >
          {importStatus === 'success' ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Upload size={14} className="group-hover:text-red-600 transition-colors" />}
          {importStatus === 'success' ? 'OK!' : 'Import'}
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {importStatus === 'error' && (
        <div className="text-[9px] text-red-500 font-bold flex items-center gap-1 bg-red-900/10 p-2 rounded-lg border border-red-900/20">
            <AlertTriangle size={10} /> Nieprawidłowy plik JSON
        </div>
      )}

      {/* Demo Generator */}
      <button 
        onClick={handleGenerateDemo}
        className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${demoConfirm ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl' : 'bg-zinc-900 text-emerald-500 border-zinc-800 hover:bg-zinc-800'}`}
      >
         {demoConfirm ? <PlayCircle size={14} /> : <Sparkles size={14} />}
         {demoConfirm ? 'POTWIERDŹ WGRANIE DEMO' : 'GENERUJ DANE TESTOWE'}
      </button>

      {/* Manual Wipe Button */}
      <button 
        onClick={handleWipeData}
        className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${wipeConfirm ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-zinc-950 text-red-700 border-zinc-900 hover:bg-red-950/30'}`}
      >
         {wipeConfirm ? <ShieldAlert size={14} /> : <Trash2 size={14} />}
         {wipeConfirm ? 'POTWIERDŹ SKASOWANIE!' : 'CZYŚĆ DANE (WIPE)'}
      </button>
    </div>
  );
};
