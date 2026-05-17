
import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, Settings, Plus, X, Trash2, ShieldCheck, ListChecks } from 'lucide-react';
import { PolicyType, ChecklistTemplates, ChecklistItemDef } from '../types';
import { storage } from '../services/storage';

interface Props {
    type: PolicyType;
    values: Record<string, boolean>;
    onChange: (id: string, val: boolean) => void;
}

export const ComplianceChecklist: React.FC<Props> = ({ type, values = {}, onChange }) => {
    const [templates, setTemplates] = useState<ChecklistTemplates>({});
    const [isConfigMode, setIsConfigMode] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemRequired, setNewItemRequired] = useState(true);

    // Refresh function
    const loadTemplates = () => {
        const state = storage.getState();
        setTemplates(state.checklistTemplates || {});
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    // Merge templates logic
    const getActiveItems = () => {
        let items: ChecklistItemDef[] = [...(templates['COMMON'] || [])];
        
        if (type === 'BOTH') {
            const uniqueIds = new Set(items.map(i => i.id));
            const merged = [...(templates['OC'] || []), ...(templates['AC'] || [])];
            merged.forEach(item => {
                if (!uniqueIds.has(item.id)) {
                    items.push(item);
                    uniqueIds.add(item.id);
                }
            });
        } else {
            const specific = templates[type] || [];
            // Merge to avoid duplicates if common has same ID
            const uniqueIds = new Set(items.map(i => i.id));
            specific.forEach(item => {
                if(!uniqueIds.has(item.id)) {
                    items.push(item);
                    uniqueIds.add(item.id);
                }
            });
        }
        return items;
    };

    const activeItems = getActiveItems();
    const requiredItems = activeItems.filter(i => i.isRequired);
    const optionalItems = activeItems.filter(i => !i.isRequired);

    // --- CONFIG HANDLERS ---
    const handleDeleteItem = async (cat: string, itemId: string) => {
        const newTemplates = { ...templates };
        newTemplates[cat] = newTemplates[cat].filter(i => i.id !== itemId);
        await storage.updateChecklistTemplates(newTemplates);
        loadTemplates();
    };

    const handleAddItem = async (cat: string) => {
        if(!newItemName.trim()) return;
        const newId = newItemName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
        const newItem: ChecklistItemDef = { id: newId, label: newItemName, isRequired: newItemRequired };
        
        const newTemplates = { ...templates };
        if(!newTemplates[cat]) newTemplates[cat] = [];
        newTemplates[cat].push(newItem);
        
        await storage.updateChecklistTemplates(newTemplates);
        loadTemplates();
        setNewItemName('');
    };

    if (isConfigMode) {
        // --- EDITOR MODE ---
        const editableCategories = type === 'BOTH' ? ['COMMON', 'OC', 'AC'] : ['COMMON', type];
        
        return (
            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-3xl border-2 border-zinc-200 dark:border-zinc-700 mb-6 relative">
                <button onClick={() => setIsConfigMode(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900"><X size={20}/></button>
                <div className="mb-4">
                    <h4 className="text-sm font-black uppercase text-zinc-600 flex items-center gap-2"><Settings size={16}/> Konfigurator Checklist</h4>
                    <p className="text-[10px] text-zinc-400">Dodaj lub usuń pozycje dla tego typu polisy.</p>
                </div>

                <div className="space-y-6">
                    {editableCategories.map(cat => (
                        <div key={cat} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                            <p className="text-[10px] font-black uppercase text-blue-500 mb-2">Kategoria: {cat}</p>
                            <div className="space-y-1 mb-3">
                                {templates[cat]?.map(item => (
                                    <div key={item.id} className="flex justify-between items-center text-xs font-bold p-1 hover:bg-zinc-50 rounded">
                                        <span className={item.isRequired ? 'text-red-600' : 'text-zinc-600'}>{item.label} {item.isRequired && '*'}</span>
                                        <button onClick={() => handleDeleteItem(cat, item.id)} className="text-zinc-300 hover:text-red-500"><Trash2 size={12}/></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 items-center border-t pt-2 border-zinc-100">
                                <input 
                                    className="flex-1 bg-zinc-50 border rounded px-2 py-1 text-xs" 
                                    placeholder="Nowa pozycja..." 
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                />
                                <label className="flex items-center gap-1 text-[9px] font-bold uppercase cursor-pointer select-none">
                                    <input type="checkbox" checked={newItemRequired} onChange={e => setNewItemRequired(e.target.checked)} />
                                    Wymagane
                                </label>
                                <button onClick={() => handleAddItem(cat)} className="bg-zinc-900 text-white p-1.5 rounded hover:bg-black"><Plus size={12}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- COMPACT VIEW (AGENT MODE) ---
    return (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border-2 border-zinc-100 dark:border-zinc-800 mb-6 relative group/container">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400"><ListChecks size={14} /></div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Checklista</span>
                </div>
                <button 
                    onClick={() => setIsConfigMode(true)} 
                    className="text-zinc-300 hover:text-blue-500 transition-colors opacity-0 group-hover/container:opacity-100" 
                    title="Edytuj wzorzec checklisty"
                >
                    <Settings size={14} />
                </button>
            </div>

            <div className="flex flex-col gap-3">
                {/* REQUIRED ROW */}
                {requiredItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="text-[9px] font-bold text-red-500 uppercase w-16 flex-shrink-0 flex items-center gap-1">
                            <AlertTriangle size={10} /> Wymagane
                        </div>
                        {requiredItems.map(item => {
                            const isChecked = !!values[item.id];
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onChange(item.id, !isChecked)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border
                                        ${isChecked 
                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                                            : 'bg-white dark:bg-zinc-800 border-red-200 dark:border-red-900 text-zinc-500 hover:border-red-400'
                                        }
                                    `}
                                >
                                    {isChecked && <Check size={10} strokeWidth={4} />}
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* OPTIONAL ROW */}
                {optionalItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="text-[9px] font-bold text-zinc-400 uppercase w-16 flex-shrink-0 flex items-center gap-1">
                            <ShieldCheck size={10} /> Opcje
                        </div>
                        {optionalItems.map(item => {
                            const isChecked = !!values[item.id];
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onChange(item.id, !isChecked)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border
                                        ${isChecked 
                                            ? 'bg-zinc-700 border-zinc-700 text-white' 
                                            : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300'
                                        }
                                    `}
                                >
                                    {isChecked && <Check size={10} />}
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
