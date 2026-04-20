
import React, { useState } from 'react';
import { AppState, SystemLogEntry } from '../types';
import { Activity, Search, Filter, Clock, Database, User, FileText, ShieldAlert, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale/pl';

interface Props {
  state: AppState;
  onClose: () => void;
}

export const ActivityLogView: React.FC<Props> = ({ state, onClose }) => {
  const [filter, setFilter] = useState('');
  
  const logs = state.logs || [];
  const filteredLogs = logs.filter(l => 
      l.details.toLowerCase().includes(filter.toLowerCase()) ||
      l.action.toLowerCase().includes(filter.toLowerCase()) ||
      l.entity.toLowerCase().includes(filter.toLowerCase())
  );

  const getIcon = (entity: string) => {
      switch(entity) {
          case 'CLIENT': return <User size={14} className="text-blue-500" />;
          case 'POLICY': return <FileText size={14} className="text-emerald-500" />;
          case 'TERMINATION': return <ShieldAlert size={14} className="text-red-500" />;
          case 'SYSTEM': return <Database size={14} className="text-amber-500" />;
          default: return <Activity size={14} className="text-zinc-400" />;
      }
  };

  const getActionColor = (action: string) => {
      switch(action) {
          case 'DELETE': return 'bg-red-50 text-red-600 border-red-200';
          case 'CREATE': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
          case 'UPDATE': return 'bg-blue-50 text-blue-600 border-blue-200';
          case 'IMPORT': return 'bg-amber-50 text-amber-600 border-amber-200';
          default: return 'bg-zinc-50 text-zinc-600 border-zinc-200';
      }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-zinc-950/80 backdrop-blur-md animate-in fade-in">
        <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex flex-col items-center overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="w-full p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                        <Activity className="text-amber-500" /> Rejestr Czynności (Audit Log)
                    </h2>
                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest mt-1">
                        Czarna Skrzynka Systemu • {logs.length} Zdarzeń
                    </p>
                </div>
                <button onClick={onClose} className="px-6 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-xl text-xs font-black uppercase hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                    Zamknij
                </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Szukaj zdarzenia (np. usunięto, klient, polisa)..." 
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:border-amber-500 transition-all"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800/30">
                    <AlertTriangle size={16} />
                    <span className="text-[10px] font-black uppercase">Dane są nieedytowalne</span>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-0">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-3 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Czas</th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Akcja</th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Obiekt</th>
                            <th className="px-6 py-3 text-[10px] font-black uppercase text-zinc-400 tracking-widest w-1/2">Szczegóły</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
                                        <Clock size={12} />
                                        {format(new Date(log.timestamp), 'dd.MM HH:mm:ss')}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${getActionColor(log.action)}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">
                                        {getIcon(log.entity)} {log.entity}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{log.details}</p>
                                    <p className="text-[9px] font-mono text-zinc-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">ID: {log.id}</p>
                                </td>
                            </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-20 text-center text-zinc-400 font-bold uppercase text-xs">
                                    Brak wpisów w rejestrze
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
