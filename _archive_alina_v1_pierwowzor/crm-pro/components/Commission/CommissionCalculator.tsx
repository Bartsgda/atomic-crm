
import React from 'react';
import { Banknote, Percent, Users, MessageSquare, Plus, Trash2, Wallet, ArrowRight } from 'lucide-react';
import { SubAgentSelect } from './SubAgentSelect';
import { SubAgent, PolicyType, PolicySubAgentShare } from '../../types';
import { roundCurrency, calculateRate } from '../../modules/utils/currencyUtils';

interface Props {
    premium: number;
    commission: number; // Agent's Share (Netto in this context)
    commissionRate: number; // Agent's %
    
    // Multi-Agent Array
    subAgentSplits: PolicySubAgentShare[];
    
    currentPolicyType: PolicyType;
    
    // Callbacks
    onUpdate: (data: {
        premium: number;
        commission: number;
        commissionRate: number;
        subAgentSplits: PolicySubAgentShare[];
    }) => void;
}

const INPUT_CLASS = "w-full p-2.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-zinc-400";
const LABEL_CLASS = "text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 pl-1 tracking-wide mb-1 block";

export const CommissionCalculator: React.FC<Props> = (props) => {

    // --- AGENT MATH (BASE) ---
    const handlePremiumChange = (val: number) => {
        const p = roundCurrency(val);
        // Recalculate Agent Amount based on Rate
        const newAgentComm = roundCurrency((p * props.commissionRate) / 100);
        
        // Recalculate ALL SubAgents Amounts based on their Rates
        const newSplits = props.subAgentSplits.map(s => ({
            ...s,
            amount: roundCurrency((p * s.rate) / 100)
        }));

        props.onUpdate({ 
            ...props, 
            premium: p, 
            commission: newAgentComm,
            subAgentSplits: newSplits
        });
    };

    const handleAgentRateChange = (val: number) => {
        // Val is percentage
        const newComm = roundCurrency((props.premium * val) / 100);
        props.onUpdate({ 
            ...props, 
            commissionRate: val, 
            commission: newComm 
        });
    };

    const handleAgentCommChange = (val: number) => {
        const comm = roundCurrency(val);
        const newRate = calculateRate(props.premium, comm);
        props.onUpdate({ 
            ...props, 
            commission: comm, 
            commissionRate: newRate 
        });
    };

    // --- SUB AGENT CRUD ---
    const addSubAgentRow = () => {
        const newSplits = [...props.subAgentSplits, { agentId: '', rate: 0, amount: 0, note: '' }];
        props.onUpdate({ ...props, subAgentSplits: newSplits });
    };

    const removeSubAgentRow = (index: number) => {
        const newSplits = [...props.subAgentSplits];
        newSplits.splice(index, 1);
        props.onUpdate({ ...props, subAgentSplits: newSplits });
    };

    const updateSubAgentRow = (index: number, field: keyof PolicySubAgentShare, value: any, agentObj?: SubAgent) => {
        const newSplits = [...props.subAgentSplits];
        const row = { ...newSplits[index] };

        if (field === 'agentId' && agentObj) {
            row.agentId = agentObj.id;
            // Auto-set default rate
            const rate = agentObj.defaultRates[props.currentPolicyType] || 0;
            row.rate = rate;
            row.amount = roundCurrency((props.premium * rate) / 100);
        } else if (field === 'rate') {
            row.rate = value;
            row.amount = roundCurrency((props.premium * value) / 100);
        } else if (field === 'amount') {
            row.amount = roundCurrency(value);
            row.rate = calculateRate(props.premium, row.amount);
        } else {
            // Note
            (row as any)[field] = value;
        }

        newSplits[index] = row;
        props.onUpdate({ ...props, subAgentSplits: newSplits });
    };

    // --- ADDITIVE LOGIC (Agent + SubAgents = Total Payout from Insurer) ---
    const totalSubAgentCost = roundCurrency(props.subAgentSplits.reduce((acc, s) => acc + (s.amount || 0), 0));
    const totalPayout = roundCurrency(props.commission + totalSubAgentCost);

    return (
        <div className="space-y-6 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            
            {/* 1. AGENT SECTION (PRIMARY) */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-md text-emerald-600 dark:text-emerald-400"><Wallet size={14}/></div>
                    <span className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">Twoje Zarobki (Agent)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={LABEL_CLASS}>Składka (PLN)</label>
                        <input 
                            type="number" step="0.01" inputMode="decimal"
                            value={props.premium || ''}
                            onChange={e => handlePremiumChange(parseFloat(e.target.value) || 0)}
                            className={`${INPUT_CLASS} pl-4`} 
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>Twój %</label>
                        <div className="relative">
                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                            <input 
                                type="number" step="0.1" inputMode="decimal"
                                value={props.commissionRate || ''}
                                onChange={e => handleAgentRateChange(parseFloat(e.target.value) || 0)}
                                className={`${INPUT_CLASS} pl-10`} 
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>Twoja Działka (PLN)</label>
                        <input 
                            type="number" step="0.01" inputMode="decimal"
                            value={props.commission || ''}
                            onChange={e => handleAgentCommChange(parseFloat(e.target.value) || 0)}
                            className={`${INPUT_CLASS} border-emerald-300 focus:border-emerald-500 font-black text-emerald-700 dark:text-emerald-400`} 
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                </div>
            </div>

            {/* 2. SUB-AGENTS SECTION (MULTI-ROW GRID) */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400"><Users size={14}/></div>
                        <span className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">Wypłaty dla Pośredników</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={addSubAgentRow}
                        className="text-[9px] font-black uppercase bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <Plus size={12} /> Dodaj
                    </button>
                </div>

                <div className="space-y-3">
                    {props.subAgentSplits.map((split, index) => (
                        <div key={index} className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-1">
                            <div className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-12 md:col-span-5">
                                    <SubAgentSelect 
                                        selectedId={split.agentId} 
                                        onSelect={(agent) => updateSubAgentRow(index, 'agentId', null, agent || undefined)}
                                        currentPolicyType={props.currentPolicyType}
                                    />
                                </div>
                                <div className="col-span-4 md:col-span-2">
                                    <label className="text-[9px] font-bold text-zinc-400 uppercase mb-1 block">% Pośred.</label>
                                    <input 
                                        type="number" step="0.1" inputMode="decimal"
                                        value={split.rate || ''}
                                        onChange={e => updateSubAgentRow(index, 'rate', parseFloat(e.target.value) || 0)}
                                        className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-center"
                                        onFocus={(e) => e.target.select()}
                                    />
                                </div>
                                <div className="col-span-6 md:col-span-4">
                                    <label className="text-[9px] font-bold text-zinc-400 uppercase mb-1 block">PLN dla Pośred.</label>
                                    <input 
                                        type="number" step="0.01" inputMode="decimal"
                                        value={split.amount || ''}
                                        onChange={e => updateSubAgentRow(index, 'amount', parseFloat(e.target.value) || 0)}
                                        className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-center text-blue-600"
                                        onFocus={(e) => e.target.select()}
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1 md:hidden">
                                     <button onClick={() => removeSubAgentRow(index)} className="w-full p-2.5 text-zinc-400 hover:text-red-500 bg-zinc-50 hover:bg-red-50 rounded-lg transition-colors flex justify-center"><Trash2 size={16} /></button>
                                </div>
                                <div className="col-span-12 md:col-span-11 mt-1">
                                    <div className="relative">
                                        <MessageSquare size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input 
                                            type="text"
                                            value={split.note || ''}
                                            onChange={e => updateSubAgentRow(index, 'note', e.target.value)}
                                            className="w-full pl-8 pr-2 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs placeholder:text-zinc-400 text-zinc-600 dark:text-zinc-300"
                                            placeholder="Notatka rozliczeniowa (np. gotówka)..."
                                        />
                                    </div>
                                </div>
                                <div className="hidden md:block col-span-1 text-center">
                                    <button onClick={() => removeSubAgentRow(index)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. TOTAL FROM INSURER (SUM) */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-2">
                <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wide">
                        Łączny Przypis Prowizji (Ty + Pośrednicy):
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                            {totalPayout.toFixed(2)} PLN
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
