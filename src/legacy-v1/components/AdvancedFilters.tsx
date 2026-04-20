
import React from 'react';
import { Filter, X, Calendar, Layers, Snowflake, CheckCircle2, Clock, Zap, MessageSquare, ArrowLeftRight } from 'lucide-react';
import { SalesStage, PolicyType } from '../types';
import { INSURERS } from '../towarzystwa';
import { format, endOfMonth, endOfYear, addMonths } from 'date-fns';

interface FilterState {
  insurers: string[];
  stages: SalesStage[];
  // paymentStatus removed as requested
  dateRange: { start: string; end: string };
  types: PolicyType[];
}

interface Props {
  isOpen: boolean;
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onClose: () => void;
  onClear: () => void;
}

export const AdvancedFilters: React.FC<Props> = ({ isOpen, filters, onFilterChange, onClose, onClear }) => {
  if (!isOpen) return null;

  const toggleList = <T extends string>(list: T[], item: T): T[] => {
    return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  };

  const applyDatePreset = (type: 'THIS_MONTH' | 'PREV_MONTH' | 'THIS_YEAR') => {
      const now = new Date();
      let start, end;

      if (type === 'THIS_MONTH') {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = endOfMonth(now);
      } else if (type === 'PREV_MONTH') {
          const prev = addMonths(now, -1);
          start = new Date(prev.getFullYear(), prev.getMonth(), 1);
          end = endOfMonth(prev);
      } else {
          start = new Date(now.getFullYear(), 0, 1);
          end = endOfYear(now);
      }

      onFilterChange({
          ...filters,
          dateRange: {
              start: format(start, 'yyyy-MM-dd'),
              end: format(end, 'yyyy-MM-dd')
          }
      });
  };

  // Helper for Status Visuals
  const getStageIcon = (st: string) => {
      switch(st) {
          case 'sprzedaż': return <CheckCircle2 size={14} />;
          case 'of_do zrobienia': return <Zap size={14} />;
          case 'przeł kontakt': return <Clock size={14} />;
          case 'oferta_wysłana': return <MessageSquare size={14} />;
          case 'rez po ofercie_kont za rok': return <Snowflake size={14} />;
          default: return <Layers size={14} />;
      }
  };

  return (
    <div className="mb-6 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
          <Filter size={120} />
      </div>

      <div className="flex justify-between items-center mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-4 relative z-10">
        <div>
            <h3 className="text-base font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
            <Filter size={18} className="text-red-600" /> Centrum Filtrowania
            </h3>
            <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase tracking-wide">Precyzyjne wyszukiwanie w bazie</p>
        </div>
        <div className="flex gap-2">
            <button onClick={onClear} className="text-[10px] font-black uppercase text-zinc-400 hover:text-red-600 transition-colors px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl hover:bg-red-50">
                Wyczyść wszystko
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors">
                <X size={20} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* KOLUMNA 1: ZAKRES DAT (4 col) - KEY FEATURE */}
        <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600"><Calendar size={14}/></div>
                <p className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-300 tracking-wide">Zakres Czasu</p>
            </div>
            
            {/* Quick Presets */}
            <div className="flex gap-2 mb-3">
                <button onClick={() => applyDatePreset('THIS_MONTH')} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-600 dark:text-zinc-400 text-[10px] font-black uppercase rounded-xl transition-all">
                    Ten Miesiąc
                </button>
                <button onClick={() => applyDatePreset('PREV_MONTH')} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-600 dark:text-zinc-400 text-[10px] font-black uppercase rounded-xl transition-all">
                    Poprzedni
                </button>
                <button onClick={() => applyDatePreset('THIS_YEAR')} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-600 dark:text-zinc-400 text-[10px] font-black uppercase rounded-xl transition-all">
                    Ten Rok
                </button>
            </div>

            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <input 
                    type="date" 
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all text-center cursor-pointer"
                    value={filters.dateRange.start}
                    onChange={(e) => onFilterChange({ ...filters, dateRange: { ...filters.dateRange, start: e.target.value } })}
                />
                <ArrowLeftRight size={14} className="text-zinc-400" />
                <input 
                    type="date" 
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all text-center cursor-pointer"
                    value={filters.dateRange.end}
                    onChange={(e) => onFilterChange({ ...filters, dateRange: { ...filters.dateRange, end: e.target.value } })}
                />
            </div>
        </div>

        {/* KOLUMNA 2: ETAPY SPRZEDAŻY (5 col) - DESIGNER LOOK */}
        <div className="lg:col-span-5 space-y-4 border-l border-zinc-100 dark:border-zinc-800 pl-0 lg:pl-8">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600"><Layers size={14}/></div>
                <p className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-300 tracking-wide">Etap Polisy</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
                {['sprzedaż', 'of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'rez po ofercie_kont za rok', 'ucięty kontakt'].map((st) => {
                    const isActive = filters.stages.includes(st as SalesStage);
                    const label = st === 'of_do zrobienia' ? 'Do zrobienia' : 
                                  (st === 'rez po ofercie_kont za rok' ? 'Chłodnia' : 
                                  (st === 'przeł kontakt' ? 'W toku' : st));
                    
                    return (
                        <button
                            key={st}
                            onClick={() => onFilterChange({ ...filters, stages: toggleList(filters.stages, st as SalesStage) })}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border-2 transition-all flex items-center gap-2 shadow-sm ${
                                isActive 
                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white scale-105' 
                                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50'
                            }`}
                        >
                            {getStageIcon(st)}
                            {label}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* KOLUMNA 3: TOWARZYSTWA (3 col) */}
        <div className="lg:col-span-3 space-y-4 border-l border-zinc-100 dark:border-zinc-800 pl-0 lg:pl-8">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600"><Layers size={14}/></div>
                <p className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-300 tracking-wide">Towarzystwo</p>
            </div>
            <div className="max-h-40 overflow-y-auto scrollbar-hide border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl p-2 bg-zinc-50/50 dark:bg-zinc-950/50">
                {INSURERS.map(ins => (
                    <label key={ins.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl cursor-pointer group transition-colors">
                        <input 
                            type="checkbox" 
                            checked={filters.insurers.includes(ins.name)}
                            onChange={() => onFilterChange({ ...filters, insurers: toggleList(filters.insurers, ins.name) })}
                            className="w-4 h-4 rounded border-2 border-zinc-300 text-red-600 focus:ring-red-500"
                        />
                        <span className={`text-[10px] font-bold uppercase truncate ${filters.insurers.includes(ins.name) ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>{ins.name}</span>
                    </label>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};
