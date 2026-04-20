
import React, { useMemo, useState, useEffect } from 'react';
import { Building2, MapPin, Mail, Globe, ShieldCheck, AlertTriangle, Phone, Save, X, Edit3, User, Database, Plus, Check, Settings2, Search } from 'lucide-react';
import { AppState, InsurerConfig } from '../../types';
import { INSURERS } from '../../towarzystwa'; 
import { storage } from '../../services/storage';

interface Props {
    state?: AppState;
    onRefresh?: () => void;
}

export const TowarzystwaView: React.FC<Props> = ({ state, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<InsurerConfig>>({});
    
    // MANAGER STATE
    const [showManager, setShowManager] = useState(false);
    const [managerSearch, setManagerSearch] = useState('');
    const [newCustomName, setNewCustomName] = useState('');

    // Active insurers list from state (or default empty array)
    const activeInsurersNames = state?.insurers || [];

    // --- MAIN TABLE DATA LOGIC ---
    // Show only ACTIVE insurers in the main table
    const tableData = useMemo(() => {
        const userConfigs = state?.insurerConfigs || {};
        
        // Filter static list by active state
        const activeStatic = INSURERS.filter(i => activeInsurersNames.includes(i.name));
        
        // Find custom added insurers (in state.insurers but NOT in INSURERS const)
        const customNames = activeInsurersNames.filter(name => !INSURERS.some(i => i.name === name));
        
        const customInsurers = customNames.map(name => ({
            id: name, // Custom ID is name
            name: name,
            currentLegalEntity: 'Wpis niestandardowy',
            address: '',
            zipCode: '',
            city: '',
            email: '',
            isBrandOnly: false
        }));

        const mergedList = [...activeStatic, ...customInsurers].sort((a, b) => a.name.localeCompare(b.name));

        return mergedList.map(baseData => {
            const userConfig = userConfigs[baseData.name];
            return {
                ...baseData,
                managerName: userConfig?.managerName || '',
                managerPhone: userConfig?.managerPhone || '',
                managerEmail: userConfig?.managerEmail || '',
                helpdeskPhone: userConfig?.helpdeskPhone || baseData.email 
            };
        });
    }, [state?.insurerConfigs, state?.insurers]);

    const filteredData = tableData.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.currentLegalEntity.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- ACTIONS ---

    const startEditing = (item: typeof tableData[0]) => {
        setEditingId(item.name);
        setEditForm({
            id: item.name,
            name: item.name,
            managerName: item.managerName,
            managerPhone: item.managerPhone,
            managerEmail: item.managerEmail,
            helpdeskPhone: item.helpdeskPhone
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEditing = async () => {
        if (editingId && editForm.id) {
            const configToSave: InsurerConfig = {
                isActive: true, 
                id: editForm.id || editingId,
                name: editForm.name || editingId,
                managerName: editForm.managerName,
                managerPhone: editForm.managerPhone,
                managerEmail: editForm.managerEmail,
                helpdeskPhone: editForm.helpdeskPhone
            };
            
            await storage.updateInsurerConfig(configToSave);
            setEditingId(null);
            setEditForm({});
            if (onRefresh) onRefresh();
        }
    };

    const toggleInsurer = async (name: string, isActive: boolean) => {
        if (isActive) {
            await storage.removeActiveInsurer(name);
        } else {
            await storage.addActiveInsurer(name);
        }
        if (onRefresh) onRefresh();
    };

    const addCustomInsurer = async () => {
        if (!newCustomName.trim()) return;
        await storage.addActiveInsurer(newCustomName.trim());
        setNewCustomName('');
        if (onRefresh) onRefresh();
    };

    return (
        <div className="p-6 md:p-10 min-h-full bg-zinc-50 dark:bg-zinc-950 font-sans animate-in fade-in duration-300">
            
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tight">
                        <Building2 className="text-red-600" size={32} />
                        Katalog Towarzystw
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2 ml-1">
                        Baza teleadresowa ({filteredData.length} aktywnych)
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowManager(true)}
                        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                    >
                        <Settings2 size={16} /> Zarządzaj Listą
                    </button>

                    <div className="relative group w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Database size={14} className="text-zinc-400" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Szukaj..." 
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold outline-none focus:border-red-500 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-100 dark:bg-zinc-950 border-b-2 border-zinc-200 dark:border-zinc-800">
                                <th className="p-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest w-[30%]">Nazwa / Podmiot</th>
                                <th className="p-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest w-[25%]">Adres Siedziby</th>
                                <th className="p-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest w-[25%]">Twój Opiekun</th>
                                <th className="p-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-center w-[10%]">Status</th>
                                <th className="p-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right w-[10%]">Akcja</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-zinc-400 font-bold uppercase text-xs">
                                        Brak aktywnych towarzystw. Kliknij "Zarządzaj Listą", aby dodać.
                                    </td>
                                </tr>
                            ) : filteredData.map((item, idx) => {
                                const isEditing = editingId === item.name;
                                return (
                                    <tr key={idx} className={`transition-colors group ${isEditing ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30'}`}>
                                        
                                        {/* Kolumna 1: Nazwa */}
                                        <td className="p-5 align-top">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 font-black text-xs shrink-0 border border-zinc-200 dark:border-zinc-700">
                                                    {(item.name || '?').substring(0,2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm text-zinc-900 dark:text-white leading-tight">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 font-medium mt-1 uppercase tracking-wide leading-tight">
                                                        {item.currentLegalEntity}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Kolumna 2: Adres */}
                                        <td className="p-5 align-top">
                                            <div className="flex items-start gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                                <MapPin size={14} className="text-zinc-400 mt-0.5 shrink-0" />
                                                <div>
                                                    <p>{item.address || '---'}</p>
                                                    <p>{item.zipCode} {item.city}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Kolumna 3: Kontakt / Opiekun (Edycja) */}
                                        <td className="p-5 align-top">
                                            {isEditing ? (
                                                <div className="space-y-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm animate-in zoom-in-95">
                                                    <input 
                                                        className="w-full p-2 text-xs font-bold border border-zinc-200 rounded bg-zinc-50 outline-none" 
                                                        placeholder="Imię Nazwisko Opiekuna"
                                                        value={editForm.managerName || ''}
                                                        onChange={e => setEditForm({...editForm, managerName: e.target.value})}
                                                    />
                                                    <input 
                                                        className="w-full p-2 text-xs font-bold border border-zinc-200 rounded bg-zinc-50 outline-none" 
                                                        placeholder="Tel. Opiekuna"
                                                        value={editForm.managerPhone || ''}
                                                        onChange={e => setEditForm({...editForm, managerPhone: e.target.value})}
                                                    />
                                                    <input 
                                                        className="w-full p-2 text-xs font-bold border border-zinc-200 rounded bg-zinc-50 outline-none" 
                                                        placeholder="Email"
                                                        value={editForm.managerEmail || ''}
                                                        onChange={e => setEditForm({...editForm, managerEmail: e.target.value})}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {item.email && (
                                                        <a href={`mailto:${item.email}`} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline decoration-2">
                                                            <Mail size={14} /> {item.email}
                                                        </a>
                                                    )}
                                                    {item.managerName ? (
                                                        <div className="text-[10px] mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                                            <p className="font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                                                <User size={12}/> {item.managerName}
                                                            </p>
                                                            {item.managerPhone && <p className="text-zinc-500 pl-5">{item.managerPhone}</p>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] text-zinc-300 italic block mt-1">Brak opiekuna</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Kolumna 4: Typ */}
                                        <td className="p-5 align-top text-center">
                                            {item.isBrandOnly ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-[9px] font-black uppercase border border-amber-200">
                                                    <AlertTriangle size={10} /> Marka
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase border border-emerald-200">
                                                    <ShieldCheck size={10} /> TU (S.A.)
                                                </span>
                                            )}
                                        </td>

                                        {/* Kolumna 5: Akcja */}
                                        <td className="p-5 align-top text-right">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={saveEditing} className="bg-blue-600 text-white px-2 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 flex items-center justify-center gap-1">
                                                        <Save size={12}/> Zapisz
                                                    </button>
                                                    <button onClick={cancelEditing} className="bg-white border border-zinc-200 text-zinc-500 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-zinc-50 flex items-center justify-center gap-1">
                                                        <X size={12}/> Anuluj
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => startEditing(item)} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edytuj dane opiekuna">
                                                    <Edit3 size={16} />
                                                </button>
                                            )}
                                        </td>

                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MANAGER MODAL */}
            {showManager && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                        
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Settings2 size={24} className="text-blue-600"/> Zarządzaj Listą
                                </h3>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Wybierz towarzystwa widoczne w systemie</p>
                            </div>
                            <button onClick={() => setShowManager(false)} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-full hover:bg-zinc-300 transition-colors"><X size={20}/></button>
                        </div>

                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                                <input 
                                    autoFocus
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                                    placeholder="Szukaj na liście..."
                                    value={managerSearch}
                                    onChange={e => setManagerSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                            {INSURERS.filter(i => i.name.toLowerCase().includes(managerSearch.toLowerCase())).map(insurer => {
                                const isActive = activeInsurersNames.includes(insurer.name);
                                return (
                                    <div 
                                        key={insurer.id} 
                                        onClick={() => toggleInsurer(insurer.name, isActive)}
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${isActive ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isActive ? 'bg-blue-600 border-blue-600' : 'border-zinc-300'}`}>
                                                {isActive && <Check size={12} className="text-white"/>}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-zinc-900 dark:text-white">{insurer.name}</p>
                                                <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[200px]">{insurer.currentLegalEntity}</p>
                                            </div>
                                        </div>
                                        {insurer.isBrandOnly && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">MARKA</span>}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
                            <p className="text-[10px] font-black uppercase text-zinc-400 mb-2 pl-1">Nie ma na liście? Dodaj własne:</p>
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 p-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none focus:border-emerald-500"
                                    placeholder="Nazwa Towarzystwa..."
                                    value={newCustomName}
                                    onChange={e => setNewCustomName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addCustomInsurer()}
                                />
                                <button 
                                    onClick={addCustomInsurer}
                                    disabled={!newCustomName.trim()}
                                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                                >
                                    Dodaj
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};
