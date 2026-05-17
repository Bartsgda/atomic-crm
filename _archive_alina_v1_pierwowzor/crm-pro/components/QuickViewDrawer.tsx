
import React, { useMemo } from 'react';
import { Client, Policy, AppState, SalesStage } from '../types';
import { X, Phone, Mail, MapPin, ExternalLink, FileText, CheckCircle2, AlertCircle, Clock, Shield, Zap } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { STATUS_CONFIG } from '../constants';

interface Props {
  client: Client | null;
  state: AppState;
  onClose: () => void;
  onNavigate: (page: string, data?: any) => void;
}

export const QuickViewDrawer: React.FC<Props> = ({ client, state, onClose, onNavigate }) => {
  if (!client) return null;

  const clientPolicies = state.policies.filter(p => p.clientId === client.id);
  
  // Separation Logic
  const pipeline = useMemo(() => clientPolicies.filter(p => ['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt'].includes(p.stage)), [clientPolicies]);
  const wallet = useMemo(() => clientPolicies.filter(p => !['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt', 'rez po ofercie_kont za rok'].includes(p.stage)), [clientPolicies]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-900/20 backdrop-blur-[1px] pointer-events-auto transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Drawer */}
      <div className="w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl pointer-events-auto transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-start">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center text-xl font-black shadow-lg">
                    {client.lastName[0]}
                </div>
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-none">{client.firstName} {client.lastName}</h2>
                    <p className="text-xs text-zinc-500 font-mono mt-1 font-bold">{client.pesel || 'BRAK PESEL'}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            
            {/* Quick Contact */}
            <div className="grid grid-cols-2 gap-3">
                {client.phones[0] && (
                    <a href={`tel:${client.phones[0]}`} className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-black text-xs uppercase hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100 dark:border-blue-900">
                        <Phone size={14} /> Zadzwoń
                    </a>
                )}
                <button 
                    onClick={() => onNavigate('client-details', { client })}
                    className="flex items-center justify-center gap-2 p-3 bg-zinc-900 dark:bg-zinc-700 text-white rounded-xl font-black text-xs uppercase hover:bg-black dark:hover:bg-zinc-600 transition-colors shadow-lg"
                >
                    <ExternalLink size={14} /> Pełny Profil
                </button>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <MapPin size={16} className="text-zinc-400 mt-0.5" />
                <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-200">{client.street}</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">{client.zipCode} {client.city}</p>
                </div>
            </div>

            {/* PIPELINE (OFFERS) */}
            {pipeline.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap size={12} /> Procesowane Oferty ({pipeline.length})
                    </h4>
                    <div className="space-y-2">
                        {pipeline.map(p => {
                            const config = STATUS_CONFIG[p.stage as SalesStage] || STATUS_CONFIG['inne'];
                            return (
                                <div key={p.id} className="p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-black text-zinc-900 dark:text-white uppercase">{p.type}</p>
                                        <p className={`text-[10px] font-bold ${config.color}`}>{config.label}</p>
                                    </div>
                                    <FileText size={16} className="text-blue-300" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* WALLET (POLICIES) */}
            <div>
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Shield size={12} /> Aktywne Polisy ({wallet.length})
                </h4>
                <div className="space-y-2">
                    {wallet.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">Brak aktywnych polis.</p>
                    ) : wallet.map(p => {
                        const days = differenceInDays(new Date(p.policyEndDate), new Date());
                        const isWarning = days < 30;
                        return (
                            <div key={p.id} className={`p-3 rounded-xl border flex justify-between items-center bg-white dark:bg-zinc-900 ${isWarning ? 'border-red-200' : 'border-zinc-200 dark:border-zinc-800'}`}>
                                <div>
                                    <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase">{p.insurerName}</p>
                                    <p className="text-[10px] text-zinc-500 font-medium truncate w-40">{p.vehicleBrand || p.type} {p.vehicleReg}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs font-black ${isWarning ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100'}`}>{days} dni</p>
                                    <p className="text-[9px] text-zinc-400 font-mono">{format(new Date(p.policyEndDate), 'dd.MM')}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

        </div>
        
        {/* Footer Info */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <p className="text-[9px] text-zinc-400 font-mono">ID: {client.id}</p>
        </div>
      </div>
    </div>
  );
};
