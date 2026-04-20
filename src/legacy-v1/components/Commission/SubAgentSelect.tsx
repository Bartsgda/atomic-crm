
import React, { useState, useEffect } from 'react';
import { SubAgent, PolicyType } from '../../types';
import { storage } from '../../services/storage';
import { Users, Plus, Edit2, Trash2, X, Save, Check } from 'lucide-react';

interface Props {
    selectedId?: string;
    onSelect: (subAgent: SubAgent | null) => void;
    currentPolicyType: PolicyType;
}

const DEFAULT_RATES: Record<string, number> = {
    'OC': 2.0,
    'AC': 3.0,
    'DOM': 10.0,
    'ZYCIE': 15.0,
    'FIRMA': 5.0,
    'PODROZ': 10.0
};

export const SubAgentSelect: React.FC<Props> = ({ selectedId, onSelect, currentPolicyType }) => {
    const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
    const [isManaging, setIsManaging] = useState(false);
    const [editAgent, setEditAgent] = useState<SubAgent | null>(null);

    // Refresh Data
    const loadAgents = () => {
        const state = storage.getState();
        setSubAgents(state.subAgents || []);
    };

    useEffect(() => {
        loadAgents();
    }, []);

    const handleSaveAgent = async () => {
        if (!editAgent || !editAgent.name.trim()) return;
        
        if (subAgents.find(a => a.id === editAgent.id)) {
            await storage.updateSubAgent(editAgent);
        } else {
            await storage.addSubAgent(editAgent);
        }
        loadAgents();
        setEditAgent(null);
    };

    const handleDeleteAgent = async (id: string) => {
        if(confirm('Usunąć tego pośrednika?')) {
            await storage.deleteSubAgent(id);
            loadAgents();
            if(selectedId === id) onSelect(null);
        }
    };

    const openNewAgent = () => {
        setEditAgent({
            id: `sa_${Date.now()}`,
            name: '',
            defaultRates: { ...DEFAULT_RATES }
        });
    };

    if (isManaging) {
        return (
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4 shadow-xl z-50 absolute w-full left-0 top-0">
                <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase text-zinc-500">Zarządzaj Pośrednikami</h4>
                    <button onClick={() => { setIsManaging(false); setEditAgent(null); }} className="text-zinc-400 hover:text-zinc-900"><X size={16}/></button>
                </div>

                {editAgent ? (
                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                        <input 
                            placeholder="Nazwa / Imię Nazwisko" 
                            className="w-full p-2 bg-white dark:bg-zinc-800 border rounded text-xs font-bold"
                            value={editAgent.name}
                            onChange={e => setEditAgent({...editAgent, name: e.target.value})}
                            autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input 
                                placeholder="Telefon" 
                                className="w-full p-2 bg-white dark:bg-zinc-800 border rounded text-xs"
                                value={editAgent.phone || ''}
                                onChange={e => setEditAgent({...editAgent, phone: e.target.value})}
                            />
                            <input 
                                placeholder="E-mail" 
                                className="w-full p-2 bg-white dark:bg-zinc-800 border rounded text-xs"
                                value={editAgent.email || ''}
                                onChange={e => setEditAgent({...editAgent, email: e.target.value})}
                            />
                        </div>
                        
                        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2">
                            <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Stawki domyślne (%)</p>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.keys(DEFAULT_RATES).map(type => (
                                    <div key={type} className="flex flex-col">
                                        <label className="text-[8px] font-bold uppercase text-zinc-500">{type}</label>
                                        <input 
                                            type="number" step="0.1"
                                            className="p-1 border rounded text-xs font-mono text-center"
                                            value={editAgent.defaultRates[type] || 0}
                                            onChange={e => setEditAgent({
                                                ...editAgent, 
                                                defaultRates: { ...editAgent.defaultRates, [type]: parseFloat(e.target.value) || 0 }
                                            })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setEditAgent(null)} className="flex-1 py-2 text-xs font-bold bg-white border border-zinc-200 rounded-lg">Anuluj</button>
                            <button onClick={handleSaveAgent} className="flex-1 py-2 text-xs font-bold bg-zinc-900 text-white rounded-lg">Zapisz</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {subAgents.map(agent => (
                            <div key={agent.id} className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <p className="text-xs font-bold">{agent.name}</p>
                                    <p className="text-[9px] text-zinc-400 font-mono">OC: {agent.defaultRates['OC']}%</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => setEditAgent(agent)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={12}/></button>
                                    <button onClick={() => handleDeleteAgent(agent.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                                </div>
                            </div>
                        ))}
                        <button onClick={openNewAgent} className="w-full py-2 text-xs font-bold text-blue-600 border border-dashed border-blue-200 bg-blue-50/50 rounded-lg flex items-center justify-center gap-2">
                            <Plus size={12}/> Dodaj Nowego
                        </button>
                    </div>
                )}
            </div>
        );
    }

    const selectedAgent = subAgents.find(a => a.id === selectedId);

    return (
        <div className="w-full">
            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 pl-1 tracking-wide mb-1 block flex items-center justify-between">
                <span>Pośrednik</span>
                <button type="button" onClick={() => setIsManaging(true)} className="text-blue-500 hover:text-blue-700 text-[9px] font-bold flex items-center gap-1">
                    <Users size={10} /> Baza
                </button>
            </label>
            <div className="relative">
                <select 
                    value={selectedId || ''} 
                    onChange={(e) => {
                        const agent = subAgents.find(a => a.id === e.target.value) || null;
                        onSelect(agent);
                    }}
                    className={`w-full p-2.5 bg-white dark:bg-zinc-800 border rounded-lg text-xs font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none
                        ${selectedId ? 'border-blue-300 text-blue-700' : 'border-zinc-300 text-zinc-900'}
                    `}
                >
                    <option value="">(Własne / Bezpośrednio)</option>
                    {subAgents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                            {agent.name}
                        </option>
                    ))}
                </select>
                {/* REMOVED FLOATING BADGE AS REQUESTED */}
            </div>
        </div>
    );
};
