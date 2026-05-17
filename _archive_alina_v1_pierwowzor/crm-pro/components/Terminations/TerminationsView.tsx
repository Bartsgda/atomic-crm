
import React, { useState, useRef } from 'react';
import { AppState, TerminationRecord } from '../../types';
import { ShieldAlert, Trash2, FileText, ExternalLink, HardDrive, Link as LinkIcon, Search, Calendar, User, Upload, Fingerprint, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import { storage } from '../../services/storage';
import { DeleteSafetyButton } from '../DeleteSafetyButton';

interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
  onRefresh: () => void;
}

export const TerminationsView: React.FC<Props> = ({ state, onNavigate, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = state.terminations.filter(t => 
    t.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    // Serwis storage usunie rekord i zaktualizuje flagi w powiązanych polisach
    await storage.deleteTerminationRecord(id);
    // Powiadomienie App.tsx o zmianie stanu
    onRefresh();
  };

  const handleUpdateLink = async (record: TerminationRecord, type: 'local' | 'cloud', val: string) => {
    const updated = { ...record, [type === 'local' ? 'localPath' : 'cloudLink']: val };
    await storage.updateTerminationRecord(updated);
    onRefresh();
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            const items = Array.isArray(json) ? json : (json.terminations || []);
            
            let importedCount = 0;
            const currentState = storage.getState();

            for (const item of items) {
                const exists = currentState.terminations.find(ex => ex.id === item.id);
                if (!exists) {
                    await storage.addTerminationRecord(item);
                    importedCount++;
                }
            }
            alert(`Pomyślnie zaimportowano ${importedCount} nowych rekordów wypowiedzeń.`);
            onRefresh();
        } catch (err) {
            alert("Błąd podczas odczytu pliku JSON.");
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-950 tracking-tighter flex items-center gap-4">
             <ShieldAlert size={36} className="text-red-600" /> Rejestr Wypowiedzeń
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-zinc-500 font-medium uppercase text-[10px] tracking-[0.2em]">Ewidencja wysłanych dokumentów</p>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-black text-[9px] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-lg transition-all"
            >
                <Upload size={12} /> Wczytaj JSON
            </button>
            <input type="file" ref={fileInputRef} onChange={handleJsonImport} accept=".json" className="hidden" />
          </div>
        </div>
        <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-red-500 transition-colors" size={20} />
            <input 
                type="text" 
                placeholder="Szukaj ID, Klienta, Pojazdu..."
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-zinc-100 rounded-3xl focus:ring-4 focus:ring-red-50 focus:border-red-500 outline-none transition-all font-bold text-zinc-900 shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-100 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left">
            <thead className="bg-zinc-50/50 border-b-2 border-zinc-100 text-[10px] uppercase font-black text-zinc-400 tracking-widest">
              <tr>
                <th className="px-8 py-6">ID / Sygnatura</th>
                <th className="px-8 py-6">Data Złożenia (Fakt.)</th>
                <th className="px-8 py-6">Operacja (Sys.)</th>
                <th className="px-8 py-6">Kontrahent / Przedmiot</th>
                <th className="px-8 py-6">Linki / Pliki</th>
                <th className="px-8 py-6 text-right">Opcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-24 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-20">
                            <FileText size={64} className="text-zinc-300" />
                            <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Brak zarejestrowanych wypowiedzeń</p>
                        </div>
                    </td>
                  </tr>
              ) : filtered.map(rec => (
                <tr key={rec.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 px-2 py-1 bg-zinc-100 rounded-lg text-zinc-900 font-mono text-[11px] font-black border border-zinc-200 shadow-sm">
                        <Fingerprint size={12} className="text-zinc-400" /> {rec.id}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-red-600" />
                        <div>
                            <p className="text-sm font-black text-zinc-950">
                                {rec.actualDate ? format(new Date(rec.actualDate), 'dd.MM.yyyy') : '---'}
                            </p>
                            <p className="text-[9px] text-zinc-400 font-black uppercase">Data fizyczna</p>
                        </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                        <Clock size={14} className="text-zinc-300" />
                        <div>
                            <p className="text-xs font-bold text-zinc-600">{format(new Date(rec.sentAt), 'dd.MM.yyyy')}</p>
                            <p className="text-[10px] text-zinc-400 font-medium">{format(new Date(rec.sentAt), 'HH:mm')}</p>
                        </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1.5">
                        <button 
                            onClick={() => {
                                const c = state.clients.find(x => x.id === rec.clientId);
                                if (c) onNavigate('client-details', { client: c });
                            }}
                            className="flex items-center gap-2 group/client"
                        >
                            <span className="font-black text-sm text-zinc-900 group-hover/client:text-red-600 transition-colors underline decoration-zinc-100 decoration-2 underline-offset-4 whitespace-nowrap">{rec.clientName}</span>
                        </button>
                        <button 
                             onClick={() => {
                                const c = state.clients.find(x => x.id === rec.clientId);
                                if (c) onNavigate('client-details', { client: c, highlightPolicyId: rec.policyId });
                             }}
                             className="text-left group/policy block"
                        >
                            <p className="text-[10px] font-black text-zinc-500 uppercase group-hover/policy:text-blue-600 transition-colors">{rec.itemDescription}</p>
                        </button>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-2 max-w-xs">
                        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 group/input">
                            <HardDrive size={12} className="text-zinc-300" />
                            <input 
                                type="text"
                                placeholder="C:\Skany\..."
                                className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-zinc-600 w-full p-0"
                                value={rec.localPath || ''}
                                onChange={e => handleUpdateLink(rec, 'local', e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 group/input">
                            <LinkIcon size={12} className="text-blue-400" />
                            <input 
                                type="text"
                                placeholder="https://..."
                                className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-blue-600 w-full p-0"
                                value={rec.cloudLink || ''}
                                onChange={e => handleUpdateLink(rec, 'cloud', e.target.value)}
                            />
                            {rec.cloudLink && (
                                <a href={rec.cloudLink} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-blue-600 transition-colors">
                                    <ExternalLink size={12} />
                                </a>
                            )}
                        </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <DeleteSafetyButton 
                        onConfirm={() => handleDelete(rec.id)}
                        popoverPlacement="left"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
