
import React, { useMemo, useState, useRef } from 'react';
import { AppState, Policy, ClientNote } from '../../types';
import { Stethoscope, CheckCircle2, AlertTriangle, Plane, CalendarClock, MailWarning, Trash2, ArrowRight, Database, MessageSquare, StickyNote, Type, Wand2, Heart, PenTool, FileWarning, Smartphone, Mail, Fingerprint, Merge, Split, Car, XCircle, User, X } from 'lucide-react';
import { differenceInDays, isValid, format } from 'date-fns';
import { storage } from '../../services/storage';
import { COMMON_TYPOS, AGENT_ABBREVIATIONS, normalizeAgentInput } from '../../data/normalizationDictionary';
import { PolicyMerger } from '../../services/policyMerger';

interface Props {
    state: AppState;
    onRefresh: () => void;
    onNavigate: (page: string, data?: any) => void;
}

type AnomalyType = 'ZOMBIE_TRAVEL' | 'STALE_CALC' | 'STALE_OFFER' | 'GHOST_LEAD' | 'STALE_LIFE';
type Tab = 'PROCESS' | 'TYPOS' | 'QUALITY' | 'MERGE';

interface Anomaly {
    policy: Policy;
    type: AnomalyType;
    daysInactive: number;
    reason: string;
}

interface TypoItem {
    policy: Policy;
    original: string;
    suggestion: string;
    type: 'TYPO' | 'ABBREVIATION' | 'STRUCTURE';
}

interface QualityItem {
    clientName: string;
    clientId: string;
    issue: string;
    field: 'PESEL' | 'PHONE' | 'EMAIL';
    value: string;
}

interface MergeCandidate {
    key: string; // Reg or Address
    count: number;
    policies: Policy[];
}

// --- CONTEXT POPOVER ---
const ContextPopover = ({ policy, notes, position }: { policy: Policy, notes: ClientNote[], position: {x: number, y: number} }) => {
    let top = position.y + 10;
    let left = position.x + 20;
    
    if (window.innerWidth - left < 400) left = position.x - 420;
    if (window.innerHeight - top < 300) top = position.y - 200;

    return (
        <div 
            style={{ top, left, position: 'fixed' }}
            className="z-[9999] w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-zinc-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200 pointer-events-none p-4 flex flex-col gap-4"
        >
            <div className="flex items-center gap-2 text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <Database size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Dane Źródłowe (Import)</span>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-800">
                <p className="text-xs font-mono text-amber-800 dark:text-amber-200 font-bold break-words leading-snug">
                    {policy.originalProductString || "Brak danych źródłowych"}
                </p>
            </div>

            <div>
                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                    <MessageSquare size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Historia Notatek</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {notes.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 italic">Brak notatek.</p>
                    ) : (
                        notes.map(n => (
                            <div key={n.id} className="text-[10px] border-l-2 border-zinc-200 pl-2 py-1">
                                <div className="flex justify-between text-zinc-400 mb-0.5">
                                    <span className="font-mono">{format(new Date(n.createdAt), 'dd.MM HH:mm')}</span>
                                    <span className="font-bold">{n.tag}</span>
                                </div>
                                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">{n.content}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MERGE PREVIEW MODAL ---
const MergePreviewModal = ({ target, others, onClose, onConfirm }: { target: Policy, others: Policy[], onClose: () => void, onConfirm: () => void }) => {
    // Calculate simulated result
    let result = { ...target };
    others.forEach(other => {
        result = PolicyMerger.merge(result, other);
    });

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <Merge size={24} className="text-blue-600"/> Symulacja Scalania
                        </h3>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                            Sprawdź wynik przed zatwierdzeniem
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-full hover:bg-zinc-300 transition-colors"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 scrollbar-hide">
                    
                    {/* LEFT: SOURCES */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-zinc-400 mb-2">
                            <Database size={16}/>
                            <span className="text-xs font-black uppercase tracking-widest">Rekordy Źródłowe ({others.length + 1})</span>
                        </div>
                        
                        {/* Target (Master) */}
                        <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 relative">
                            <div className="absolute -top-3 left-4 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Rekord Bazowy (Master)</div>
                            <p className="font-bold text-sm text-zinc-900 dark:text-white">{target.vehicleBrand || target.type}</p>
                            <p className="font-mono text-xs text-zinc-500">{target.vehicleReg}</p>
                            <div className="mt-2 text-[10px] font-mono bg-white/80 dark:bg-zinc-950/50 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 break-all">
                                {target.originalProductString}
                            </div>
                        </div>

                        {/* Others (Slaves) */}
                        {others.map(o => (
                            <div key={o.id} className="p-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 opacity-70">
                                <div className="flex justify-between">
                                    <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{o.vehicleBrand || o.type}</p>
                                    <p className="font-mono text-xs text-zinc-500">{o.premium} PLN</p>
                                </div>
                                <div className="mt-2 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-950 p-2 rounded text-zinc-500 break-all">
                                    {o.originalProductString}
                                </div>
                                <div className="mt-2 text-[9px] text-blue-500 flex items-center gap-1 font-bold uppercase tracking-wider">
                                    <ArrowRight size={10}/> Zostanie włączony do Mastera
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* RIGHT: RESULT */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] p-6 border-2 border-blue-100 dark:border-blue-900/30 flex flex-col justify-center">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200/50 mx-auto mb-4">
                                <CheckCircle2 size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Wynik Scalenia</h2>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-2 tracking-widest">Tak będzie wyglądał rekord w bazie</p>
                        </div>

                        <div className="space-y-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Pojazd / Przedmiot</span>
                                <span className="text-sm font-black text-zinc-900 dark:text-white">{result.vehicleBrand || result.type}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Nr Rejestracyjny</span>
                                <span className="text-sm font-black text-zinc-900 dark:text-white font-mono">{result.vehicleReg}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Status (Etap)</span>
                                <span className="text-[10px] font-black text-white bg-zinc-900 px-2 py-0.5 rounded uppercase tracking-wider">{result.stage}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Łączna Składka</span>
                                <span className="text-xl font-black text-emerald-600">{result.premium.toFixed(2)} PLN</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Notatki</span>
                                <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><MessageSquare size={12}/> Scalono historię kontaktów</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-black text-zinc-500 hover:bg-zinc-200 transition-colors text-[10px] uppercase tracking-widest">Anuluj</button>
                    <button onClick={onConfirm} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-blue-700 shadow-xl transition-all flex items-center gap-2 tracking-widest">
                        <Merge size={14}/> Potwierdź Scalenie
                    </button>
                </div>
            </div>
        </div>
    );
};

export const DataRepairView: React.FC<Props> = ({ state, onRefresh, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<Tab>('PROCESS');
    const [fixedCount, setFixedCount] = useState(0);
    const [hoveredData, setHoveredData] = useState<{ policy: Policy, notes: ClientNote[], pos: {x:number, y:number} } | null>(null);
    const [mergePreview, setMergePreview] = useState<{ target: Policy, others: Policy[] } | null>(null);
    const hoverTimer = useRef<any>(null);

    // --- 1. ANOMALIES LOGIC (Procesowe) ---
    const anomalies = useMemo(() => {
        const results: Anomaly[] = [];
        const now = new Date();

        state.policies.forEach(p => {
            let lastDate = new Date(p.createdAt);
            const relatedNotes = state.notes
                .filter(n => n.linkedPolicyIds?.includes(p.id) || n.clientId === p.clientId)
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            if (relatedNotes.length > 0) {
                const noteDate = new Date(relatedNotes[0].createdAt);
                if (isValid(noteDate) && noteDate > lastDate) lastDate = noteDate;
            }
            const days = differenceInDays(now, lastDate);

            if (p.type === 'PODROZ' && p.stage === 'rez po ofercie_kont za rok') {
                results.push({ policy: p, type: 'ZOMBIE_TRAVEL', daysInactive: days, reason: "Turystyka w 'Chłodni' (Błąd)" });
            } else if (p.stage === 'przeł kontakt' && days > 120) {
                results.push({ policy: p, type: 'STALE_CALC', daysInactive: days, reason: "Kalkulacja porzucona (4 mc+)" });
            } else if (p.stage === 'oferta_wysłana' && days > 90) {
                results.push({ policy: p, type: 'STALE_OFFER', daysInactive: days, reason: "Oferta wygasła (3 mc+)" });
            } else if (p.stage === 'of_do zrobienia' && days > 30) {
                results.push({ policy: p, type: 'GHOST_LEAD', daysInactive: days, reason: "Lead bez kontaktu (30 dni+)" });
            } else if (p.type === 'ZYCIE' && days > 60 && !['sprzedaż', 'ucięty kontakt'].includes(p.stage)) {
                results.push({ policy: p, type: 'STALE_LIFE', daysInactive: days, reason: "Proces życiowy utknął" });
            }
        });
        return results.sort((a,b) => b.daysInactive - a.daysInactive);
    }, [state.policies, state.notes]);

    // --- 2. TYPOS & STRUCTURE LOGIC (Zapis) ---
    const typos = useMemo(() => {
        const results: TypoItem[] = [];
        
        state.policies.forEach(p => {
            if (!p.originalProductString) return;
            
            const raw = p.originalProductString;
            let currentFix = raw;
            let type: 'TYPO' | 'ABBREVIATION' | 'STRUCTURE' | null = null;

            // A. KOREKTA STRUKTURALNA (Tylko dla POJAZDÓW!)
            const isVehicle = /^(samochód|motocykl|pojazd|przyczepa|ciągnik)/i.test(raw);
            
            if (isVehicle) {
                const structureRegex = /^(samochód(?:\s+ciężarowy)?|motocykl|pojazd|przyczepa|ciągnik)\s+([A-Z0-9])/i;
                if (structureRegex.test(currentFix)) {
                    currentFix = currentFix.replace(structureRegex, '$1_$2');
                    type = 'STRUCTURE';
                }
                const regToBrandRegex = /^(\w+(?:\s+\w+)?)_([A-Z0-9]{4,9})\s+([a-zA-Z])/i;
                if (regToBrandRegex.test(currentFix)) {
                    currentFix = currentFix.replace(regToBrandRegex, '$1_$2_$3');
                    if(!type) type = 'STRUCTURE';
                }
            }

            // B. KOREKTA SŁOWNIKOWA (Wszyscy)
            const normalized = normalizeAgentInput(currentFix);
            if (normalized !== currentFix) {
                const rawWords = currentFix.split(/[\s_]+/);
                for (const w of rawWords) {
                    const lower = w.toLowerCase().replace(/[.,]$/, '');
                    if (COMMON_TYPOS[lower]) {
                        if (!type || type === 'ABBREVIATION') type = 'TYPO';
                    } else if (AGENT_ABBREVIATIONS[lower]) {
                        if (!type) type = 'ABBREVIATION';
                    }
                }
                currentFix = normalized;
            }

            if (type && currentFix !== raw) {
                results.push({ policy: p, original: raw, suggestion: currentFix, type: type });
            }
        });
        return results;
    }, [state.policies]);

    // --- 3. QUALITY LOGIC (Jakość Danych Klienta) ---
    const qualityIssues = useMemo(() => {
        const issues: QualityItem[] = [];
        state.clients.forEach(c => {
            if (c.pesel) {
                const cleanPesel = c.pesel.replace(/\D/g, '');
                if (cleanPesel.length > 0 && cleanPesel.length !== 11) {
                    issues.push({ clientName: `${c.lastName} ${c.firstName}`, clientId: c.id, issue: `PESEL ma ${cleanPesel.length} cyfr (wymagane 11)`, field: 'PESEL', value: c.pesel });
                }
            }
            if (c.phones && c.phones.length > 0) {
                c.phones.forEach(phone => {
                    const cleanPhone = phone.replace(/\D/g, '');
                    if (cleanPhone.length > 0 && cleanPhone.length < 9) {
                        issues.push({ clientName: `${c.lastName} ${c.firstName}`, clientId: c.id, issue: `Telefon za krótki (${cleanPhone.length} cyfr)`, field: 'PHONE', value: phone });
                    }
                });
            }
            if (c.emails && c.emails.length > 0) {
                c.emails.forEach(email => {
                    if (!email.includes('@') || !email.includes('.')) {
                        issues.push({ clientName: `${c.lastName} ${c.firstName}`, clientId: c.id, issue: `Błędny format e-maila`, field: 'EMAIL', value: email });
                    }
                });
            }
        });
        return issues;
    }, [state.clients]);

    // --- 4. MERGE CANDIDATES (KONFLIKTY) ---
    const mergeCandidates = useMemo(() => {
        const groups: Record<string, Policy[]> = {};
        
        state.policies.forEach(p => {
            let key = '';
            // Group by Registration or Address
            if (p.vehicleReg && p.vehicleReg.length > 3) key = p.vehicleReg.replace(/\s/g,'').toUpperCase();
            else if (p.propertyAddress && p.propertyAddress.length > 5) key = p.propertyAddress.replace(/\s/g,'').toUpperCase();
            
            // KEY SAFETY CHECK: Must contain at least one digit to avoid grouping "MOTOCYKL" or "SAMOCHOD"
            if (key && /\d/.test(key)) {
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
            }
        });

        const results: MergeCandidate[] = [];
        Object.entries(groups).forEach(([key, pols]) => {
            // GLOBAL CONFLICT DETECTION:
            if (pols.length > 1) {
                results.push({ key, count: pols.length, policies: pols });
            }
        });
        return results;
    }, [state.policies]);

    // --- ACTIONS ---
    const handleFixAnomaly = async (anomaly: Anomaly) => {
        const updatedPolicy = { ...anomaly.policy, stage: 'ucięty kontakt' as const };
        await storage.updatePolicy(updatedPolicy);
        setFixedCount(prev => prev + 1);
        onRefresh();
    };

    const handleFixTypo = async (item: TypoItem) => {
        const updatedPolicy = { ...item.policy, originalProductString: item.suggestion };
        await storage.updatePolicy(updatedPolicy);
        setFixedCount(prev => prev + 1);
        onRefresh();
    };

    const handleMergeConfirm = async () => {
        if (!mergePreview) return;
        const { target, others } = mergePreview;

        let finalPolicy = { ...target };
        for (const other of others) {
            // MERGE
            finalPolicy = PolicyMerger.merge(finalPolicy, other);
            await storage.deletePolicy(other.id);
            // MOVE NOTES
            const notesToMove = state.notes.filter(n => n.linkedPolicyIds?.includes(other.id));
            for (const note of notesToMove) {
                const newLinks = (note.linkedPolicyIds || []).filter(id => id !== other.id);
                newLinks.push(finalPolicy.id);
                const updatedNote = { ...note, linkedPolicyIds: newLinks };
                await storage.updateNote(updatedNote);
            }
        }
        await storage.updatePolicy(finalPolicy);
        setFixedCount(prev => prev + others.length);
        setMergePreview(null);
        onRefresh();
    };

    const handleSingleDelete = async (id: string) => {
        if(confirm("Czy na pewno usunąć ten rekord? To nieodwracalne.")) {
            await storage.deletePolicy(id);
            setFixedCount(prev => prev + 1);
            onRefresh();
        }
    };

    const handleEditPolicy = (policy: Policy) => {
        const client = state.clients.find(c => c.id === policy.clientId);
        if (client) {
            onNavigate('client-details', { client, highlightPolicyId: policy.id });
        }
    };

    const handleFixAllAnomalies = async () => {
        if (!confirm(`Czy przenieść ${anomalies.length} rekordów do archiwum?`)) return;
        for (const item of anomalies) await handleFixAnomaly(item);
    };

    const handleFixAllTypos = async () => {
        if (!confirm(`Czy automatycznie poprawić zapis w ${typos.length} rekordach?`)) return;
        for (const item of typos) await handleFixTypo(item);
    };

    // --- UI HELPERS ---
    const handleMouseEnter = (e: React.MouseEvent, policy: Policy) => {
        const x = e.clientX;
        const y = e.clientY;
        const notes = state.notes
            .filter(n => n.linkedPolicyIds?.includes(policy.id))
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            setHoveredData({ policy, notes, pos: { x, y } });
        }, 500);
    };

    const handleMouseLeave = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setHoveredData(null);
    };

    const getIcon = (type: AnomalyType) => {
        switch(type) {
            case 'ZOMBIE_TRAVEL': return <Plane size={16} />;
            case 'STALE_CALC': return <CalendarClock size={16} />;
            case 'STALE_OFFER': return <MailWarning size={16} />;
            case 'STALE_LIFE': return <Heart size={16} />;
            default: return <AlertTriangle size={16} />;
        }
    };

    const getColor = (type: AnomalyType) => {
        switch(type) {
            case 'ZOMBIE_TRAVEL': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'STALE_CALC': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'STALE_OFFER': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'STALE_LIFE': return 'bg-pink-100 text-pink-700 border-pink-200';
            default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
        }
    };

    return (
        <div className="p-6 md:p-10 min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans flex flex-col">
            
            {/* HOVER POPOVER */}
            {hoveredData && (
                <ContextPopover 
                    policy={hoveredData.policy} 
                    notes={hoveredData.notes} 
                    position={hoveredData.pos} 
                />
            )}

            {/* MERGE PREVIEW MODAL */}
            {mergePreview && (
                <MergePreviewModal 
                    target={mergePreview.target} 
                    others={mergePreview.others} 
                    onClose={() => setMergePreview(null)} 
                    onConfirm={handleMergeConfirm}
                />
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Stethoscope className="text-emerald-600" size={32} />
                        Centrum Naprawy Danych
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2 ml-1">
                        Higiena Bazy • Diagnostyka • Scalanie
                    </p>
                </div>
                
                {/* TABS */}
                <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('PROCESS')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'PROCESS' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                        <AlertTriangle size={14}/> Procesowe ({anomalies.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('MERGE')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'MERGE' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                        <Split size={14}/> Konflikty ({mergeCandidates.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('TYPOS')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'TYPOS' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                        <Type size={14}/> Korekty ({typos.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('QUALITY')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'QUALITY' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                        <FileWarning size={14}/> Jakość ({qualityIssues.length})
                    </button>
                </div>
            </div>

            {fixedCount > 0 && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-4">
                    <CheckCircle2 size={20} />
                    <span className="font-bold text-sm">Naprawiono pomyślnie {fixedCount} rekordów w tej sesji.</span>
                </div>
            )}

            {/* CONTENT AREA */}
            <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col relative">
                
                {/* 1. PROCESS ANOMALIES TAB */}
                {activeTab === 'PROCESS' && (
                    <>
                        {anomalies.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700">
                                <CheckCircle2 size={64} className="mb-4 text-emerald-200" />
                                <p className="text-xl font-black uppercase tracking-widest">Procesy są czyste</p>
                                <p className="text-sm font-medium mt-1">Nie znaleziono porzuconych ofert ani błędnych statusów.</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-950/50">
                                    <button 
                                        onClick={handleFixAllAnomalies}
                                        className="bg-red-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs hover:bg-red-700 transition-all shadow-lg flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Zamknij Wszystkie ({anomalies.length})
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto scrollbar-hide">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Typ Błędu</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Polisa / Klient</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ostatnia Aktywność</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Akcja</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {anomalies.map((item) => {
                                                const client = state.clients.find(c => c.id === item.policy.clientId);
                                                return (
                                                    <tr 
                                                        key={item.policy.id} 
                                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group cursor-help"
                                                        onMouseEnter={(e) => handleMouseEnter(e, item.policy)}
                                                        onMouseLeave={handleMouseLeave}
                                                    >
                                                        <td className="px-6 py-4 align-top">
                                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase ${getColor(item.type)}`}>
                                                                {getIcon(item.type)}
                                                                {item.reason}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 align-top">
                                                            <div>
                                                                <p className="font-black text-sm text-zinc-900 dark:text-white">
                                                                    {item.policy.vehicleBrand || item.policy.type}
                                                                </p>
                                                                <p className="text-xs font-mono text-zinc-500 uppercase mt-0.5">
                                                                    {item.policy.vehicleReg || item.policy.policyNumber || 'BRAK REJ'}
                                                                </p>
                                                                {client && (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); onNavigate('client-details', { client, highlightPolicyId: item.policy.id }); }}
                                                                        className="text-[10px] font-bold text-blue-500 hover:underline mt-1 flex items-center gap-1 z-10 relative"
                                                                    >
                                                                        {client.lastName} {client.firstName} <ArrowRight size={10}/>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 align-top">
                                                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{item.daysInactive} dni temu</span>
                                                            <p className="text-[10px] text-zinc-400 mt-1">Status obecny: {item.policy.stage}</p>
                                                        </td>
                                                        <td className="px-6 py-4 align-top text-right">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleFixAnomaly(item); }}
                                                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 hover:border-red-300 text-zinc-600 hover:text-red-600 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm z-10 relative"
                                                            >
                                                                <Trash2 size={14} /> Zamknij (Ucięty)
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* 2. MERGE DUPLICATES TAB (REDESIGNED) */}
                {activeTab === 'MERGE' && (
                    <>
                        {mergeCandidates.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700">
                                <Merge size={64} className="mb-4 text-blue-200" />
                                <p className="text-xl font-black uppercase tracking-widest">Brak Duplikatów</p>
                                <p className="text-sm font-medium mt-1">System nie wykrył rozdzielonych rekordów dla tych samych pojazdów.</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto scrollbar-hide bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6">
                                {mergeCandidates.map((group) => (
                                    <div key={group.key} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center rounded-xl font-bold text-lg border border-amber-200 dark:border-amber-800">
                                                {group.count}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                                                    <Car size={20}/> {group.key}
                                                </h3>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Wykryto {group.count} pasujące rekordy (to samo auto lub błąd kopiowania)</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {group.policies.map(p => {
                                                const isSold = p.stage === 'sprzedaż' || p.stage === 'sprzedany';
                                                const client = state.clients.find(c => c.id === p.clientId);
                                                
                                                return (
                                                    <div key={p.id} className="flex flex-col md:flex-row md:items-start justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-300 transition-colors gap-4">
                                                        <div className="flex-1 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}>
                                                                    {p.stage}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-zinc-400">ID: {(p.id || '').substring(0,6)}...</span>
                                                            </div>
                                                            
                                                            {/* Client Context added here */}
                                                            {client && (
                                                                <div className="flex items-center gap-1.5 text-xs font-black text-blue-600 dark:text-blue-400">
                                                                    <User size={12}/> {client.lastName} {client.firstName}
                                                                </div>
                                                            )}

                                                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{p.vehicleBrand || p.type}</p>
                                                            <p className="text-xs text-zinc-500">Składka: <strong>{p.premium} PLN</strong> • TU: {p.insurerName}</p>
                                                            
                                                            {/* RAW EXCEL DATA DISPLAY */}
                                                            {p.originalProductString && (
                                                                <div className="mt-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                                                                    <p className="text-[9px] font-black uppercase text-zinc-400 mb-1 flex items-center gap-1">
                                                                        <Database size={10}/> DANE Z EXCELA:
                                                                    </p>
                                                                    <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 break-all leading-tight">
                                                                        {p.originalProductString}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-2 items-start mt-2 md:mt-0">
                                                            <button 
                                                                onClick={() => setMergePreview({ target: p, others: group.policies.filter(x => x.id !== p.id) })}
                                                                className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-sm"
                                                                title="Zobacz symulację scalenia"
                                                            >
                                                                <Merge size={12} /> Scal do tego
                                                            </button>
                                                            <button 
                                                                onClick={() => handleEditPolicy(p)}
                                                                className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-blue-50 text-zinc-600 hover:text-blue-600 rounded-xl text-[10px] font-black uppercase transition-all"
                                                                title="To inny pojazd (zmień rejestrację)"
                                                            >
                                                                <PenTool size={12} /> To inne auto (Edytuj)
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSingleDelete(p.id)}
                                                                className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-red-50 text-zinc-600 hover:text-red-600 rounded-xl text-[10px] font-black uppercase transition-all"
                                                                title="To śmieć / duplikat"
                                                            >
                                                                <XCircle size={12} /> Usuń
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* 3. SPELLCHECK TAB */}
                {activeTab === 'TYPOS' && (
                    <>
                        {typos.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700">
                                <Type size={64} className="mb-4 text-purple-200" />
                                <p className="text-xl font-black uppercase tracking-widest">Brak błędów pisowni</p>
                                <p className="text-sm font-medium mt-1">Słownik nie wykrył znanych literówek ani braków formatowania.</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-950/50">
                                    <button 
                                        onClick={handleFixAllTypos}
                                        className="bg-purple-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs hover:bg-purple-700 transition-all shadow-lg flex items-center gap-2"
                                    >
                                        <Wand2 size={14} /> Popraw Wszystkie ({typos.length})
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto scrollbar-hide">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Problem</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Tekst Źródłowy (Import)</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Sugerowana Poprawka</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Akcja</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {typos.map((item) => (
                                                <tr key={item.policy.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                                                    onMouseEnter={(e) => handleMouseEnter(e, item.policy)}
                                                    onMouseLeave={handleMouseLeave}
                                                >
                                                    <td className="px-6 py-4 align-top">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black uppercase border ${
                                                            item.type === 'TYPO' ? 'bg-red-50 text-red-600 border-red-200' : 
                                                            (item.type === 'STRUCTURE' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200')
                                                        }`}>
                                                            {item.type === 'TYPO' ? 'LITERÓWKA' : (item.type === 'STRUCTURE' ? 'BRAK _' : 'SKRÓT')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 align-top">
                                                        <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded break-words border border-transparent group-hover:border-zinc-200">{item.original}</p>
                                                    </td>
                                                    <td className="px-6 py-4 align-top">
                                                        <p className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-1 rounded break-words font-bold border border-emerald-100">{item.suggestion}</p>
                                                    </td>
                                                    <td className="px-6 py-4 align-top text-right">
                                                        <button 
                                                            onClick={() => handleFixTypo(item)}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 hover:bg-purple-50 hover:border-purple-300 text-zinc-600 hover:text-purple-600 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm"
                                                        >
                                                            <Wand2 size={14} /> Popraw
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* 4. DATA QUALITY TAB */}
                {activeTab === 'QUALITY' && (
                    <>
                        {qualityIssues.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700">
                                <ShieldCheckIcon size={64} className="mb-4 text-emerald-200" />
                                <p className="text-xl font-black uppercase tracking-widest">Jakość danych wzorowa</p>
                                <p className="text-sm font-medium mt-1">Wszystkie numery telefonów, maile i PESEL są poprawne.</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto scrollbar-hide">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Pole</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Klient</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Wartość Błędna</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Problem</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-right">Akcja</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {qualityIssues.map((q, idx) => {
                                            const client = state.clients.find(c => c.id === q.clientId);
                                            let Icon = AlertTriangle;
                                            if (q.field === 'PESEL') Icon = Fingerprint;
                                            if (q.field === 'PHONE') Icon = Smartphone;
                                            if (q.field === 'EMAIL') Icon = Mail;

                                            return (
                                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-6 py-4 align-top">
                                                        <span className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1 rounded-lg border border-red-200 text-[10px] font-black">
                                                            <Icon size={12} /> {q.field}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 align-top font-bold text-sm text-zinc-900 dark:text-white">
                                                        {q.clientName}
                                                    </td>
                                                    <td className="px-6 py-4 align-top font-mono text-xs text-red-600 break-all">
                                                        {q.value || "(puste)"}
                                                    </td>
                                                    <td className="px-6 py-4 align-top text-xs text-zinc-500">
                                                        {q.issue}
                                                    </td>
                                                    <td className="px-6 py-4 align-top text-right">
                                                        <button 
                                                            onClick={() => client && onNavigate('client-details', { client })}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-md"
                                                        >
                                                            <PenTool size={12} /> Edytuj Klienta
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
};

const ShieldCheckIcon = ({size, className}: {size:number, className?:string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
);
