
import React, { useState } from 'react';
import { X, Calendar, ShieldAlert, FileWarning, ArrowRight, Stamp, Car, Home, User, Info } from 'lucide-react';
import { Policy, Client } from '../types';
import { format } from 'date-fns';

interface Props {
  policy: Policy;
  client: Client;
  onConfirm: (actualDate: string) => void;
  onCancel: () => void;
}

const getIcon = (type: string) => {
    if (['OC', 'AC', 'BOTH'].includes(type)) return Car;
    if (type === 'DOM') return Home;
    return User;
};

export const TerminationFormModal: React.FC<Props> = ({ policy, client, onConfirm, onCancel }) => {
  const [actualDate, setActualDate] = useState(new Date().toISOString().split('T')[0]);
  const Icon = getIcon(policy.type);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md" onClick={onCancel}></div>

      <div className="bg-white dark:bg-zinc-900 rounded-[1.75rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-zinc-100 dark:border-zinc-800 relative z-10 flex flex-col">
        
        {/* Header - Serious Red Tone */}
        <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-zinc-900 p-6 border-b border-red-100 dark:border-red-900/30 flex justify-between items-start">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-none">
                        <ShieldAlert size={20} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
                        Rejestracja<br/>Wypowiedzenia
                    </h3>
                </div>
                <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-widest pl-1">
                    Procedura Zatrzymania Wznowienia
                </p>
            </div>
            <button onClick={onCancel} className="p-2 bg-white dark:bg-zinc-800 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 transition-colors shadow-sm">
                <X size={20}/>
            </button>
        </div>

        <div className="p-6 space-y-6">
            
            {/* Policy Summary Card */}
            <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Icon size={64} className="text-zinc-900 dark:text-white" />
                </div>
                
                <div className="relative z-10">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Przedmiot Wypowiedzenia</p>
                    <h4 className="text-lg font-black text-zinc-900 dark:text-white leading-tight">
                        {policy.vehicleBrand || policy.propertyAddress || policy.type}
                    </h4>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded text-[10px] font-bold text-zinc-600 dark:text-zinc-300 font-mono uppercase">
                            {policy.vehicleReg || policy.policyNumber}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold">
                            {policy.insurerName}
                        </span>
                    </div>
                </div>
            </div>

            {/* Date Input */}
            <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 flex items-center gap-2 pl-1">
                    <Calendar size={14} className="text-red-600" /> Data złożenia / Nadania
                </label>
                <div className="relative group">
                    <input 
                        type="date"
                        value={actualDate}
                        onChange={(e) => setActualDate(e.target.value)}
                        className="w-full p-4 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl text-lg font-black text-zinc-900 dark:text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-900/20 transition-all cursor-pointer"
                        onClick={(e) => e.currentTarget.showPicker()}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 group-hover:text-red-500 transition-colors">
                        <Stamp size={20} />
                    </div>
                </div>
                <div className="flex gap-2 mt-3 px-2">
                    <Info size={14} className="text-blue-500 flex-shrink-0" />
                    <p className="text-[10px] font-medium text-zinc-500 leading-relaxed">
                        Data systemowa operacji zostanie zapisana jako <strong>Dzisiaj</strong>. Data powyżej to data widniejąca na dokumencie (stemplu pocztowym), ważna dla biegu terminów (np. 1 dzień przed końcem).
                    </p>
                </div>
            </div>

            {/* Warning */}
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex gap-3 items-center">
                <FileWarning size={20} className="text-red-600 flex-shrink-0" />
                <p className="text-[10px] font-bold text-red-800 dark:text-red-300 leading-tight">
                    Akcja zablokuje automatyczne wznowienie tej polisy w systemie i ustawi status <strong>"Wypowiedziane"</strong>.
                </p>
            </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex gap-3">
             <button 
                onClick={onCancel}
                className="flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 transition-all"
             >
                Anuluj
             </button>
             <button 
                onClick={() => onConfirm(actualDate)}
                className="flex-[2] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl hover:bg-black dark:hover:bg-zinc-200"
             >
                Zatwierdź w Rejestrze <ArrowRight size={16} />
             </button>
        </div>

      </div>
    </div>
  );
};
