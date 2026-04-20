
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AppState, Policy, SalesStage, ClientNote, Client, PolicyCalculation } from '../types';
import { differenceInDays, isValid, format } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import { 
  Briefcase, 
  ArrowRight, 
  ArrowLeft,
  Clock, 
  Phone, 
  FileText,
  Ban,
  TrendingUp,
  DollarSign,
  Eye,
  PenTool,
  X,
  AlertTriangle,
  Zap,
  Rocket,
  PartyPopper,
  CheckCircle2,
  Car, Truck, Bike, Tractor, Bus, Container, Home, Heart, Plane, Building2,
  MessageSquare, User, History, Undo2, XCircle, Archive, AlertOctagon, CalendarPlus,
  LayoutList, Trello, Plus, Send, Mail, Trash2
} from 'lucide-react';
import { storage } from '../services/storage';
import { STATUS_CONFIG } from '../constants';
import { QuickViewDrawer } from './QuickViewDrawer';
import { InsurerSelect } from './InsurerSelect';
import { getSortedInsurers } from '../services/insurerRanking';

interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
  onRefresh: () => void;
}

interface ColumnData {
  items: Policy[];
  totalValue: number;
}

// --- ROW COMPONENT FOR TABLE VIEW ---
const OfferRow = ({ 
    policy, 
    client, 
    notes, 
    onStatusChange, 
    onNavigate, 
    insurersList, 
    onUpdatePolicy, 
    onAddNote
}: { 
    policy: Policy, 
    client: Client, 
    notes: ClientNote[], 
    onStatusChange: (id: string, stage: SalesStage) => void,
    onNavigate: (page: string, data?: any) => void,
    insurersList: string[],
    onUpdatePolicy: (p: Policy) => void,
    onAddNote: (n: ClientNote) => void
}) => {
    const [newPrice, setNewPrice] = useState('');
    const [newInsurer, setNewInsurer] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const calculations = policy.calculations || [];
    const PolicyIcon = getIcon(policy);
    const daysSinceUpdate = differenceInDays(new Date(), new Date(policy.createdAt));

    // Determine sent mails based on notes
    const sentMails = useMemo(() => {
        const sentSet = new Set<string>();
        notes.forEach(n => {
            if (n.content.includes('[MAIL: WYSŁANY]')) {
                // Try to extract insurer name
                insurersList.forEach(ins => {
                    if (n.content.includes(ins)) sentSet.add(ins);
                });
            }
        });
        return sentSet;
    }, [notes, insurersList]);

    const handleAddCalc = () => {
        if (!newPrice || !newInsurer) return;
        const newCalc: PolicyCalculation = {
            id: `calc_${Date.now()}`,
            insurerName: newInsurer,
            premium: parseFloat(newPrice),
            isSelected: false,
            createdAt: new Date().toISOString()
        };
        const updated = { ...policy, calculations: [...calculations, newCalc] };
        onUpdatePolicy(updated);
        setNewPrice('');
        setNewInsurer('');
    };

    const handleToggleMail = (insurer: string) => {
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
        const noteContent = `[${timestamp}]_PRZYPOMNIENIE_[MAIL: WYSŁANY] Wysłano ofertę ${insurer} do klienta.`;
        
        onAddNote({
            id: `note_${Date.now()}`,
            clientId: policy.clientId,
            content: noteContent,
            tag: 'OFERTA',
            createdAt: new Date().toISOString(),
            linkedPolicyIds: [policy.id]
        });
    };

    const handleRemoveCalc = (id: string) => {
        const updated = { ...policy, calculations: calculations.filter(c => c.id !== id) };
        onUpdatePolicy(updated);
    };

    return (
        <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-2 transition-all hover:shadow-md ${isExpanded ? 'ring-2 ring-blue-100 dark:ring-blue-900' : ''}`}>
            {/* MAIN ROW */}
            <div className="flex flex-col md:flex-row items-center p-3 gap-4">
                
                {/* 1. INFO */}
                <div className="flex-1 min-w-[200px] flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('client-details', { client, highlightPolicyId: policy.id })}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500`}>
                        <PolicyIcon size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-zinc-900 dark:text-white truncate">{client.lastName} {client.firstName}</span>
                            {daysSinceUpdate > 3 && <span className="bg-red-100 text-red-600 text-[9px] px-1.5 rounded font-bold">{daysSinceUpdate}d</span>}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase truncate max-w-[180px]">
                            {policy.vehicleBrand || policy.type} {policy.vehicleReg}
                        </p>
                    </div>
                </div>

                {/* 2. CALCULATIONS (THE BATTLEFIELD) */}
                <div className="flex-[2] flex flex-wrap gap-2 items-center">
                    {/* Existing Calcs */}
                    {calculations.map(calc => {
                        const isSent = sentMails.has(calc.insurerName);
                        return (
                            <div key={calc.id} className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-2 pr-1 py-1 group/calc">
                                <div className="flex flex-col leading-none">
                                    <span className="text-[9px] font-black uppercase text-zinc-400">{calc.insurerName}</span>
                                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{calc.premium} zł</span>
                                </div>
                                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                                <button 
                                    onClick={() => handleToggleMail(calc.insurerName)}
                                    className={`p-1.5 rounded-md transition-colors ${isSent ? 'text-purple-600 bg-purple-100' : 'text-zinc-300 hover:text-purple-500 hover:bg-zinc-100'}`}
                                    title={isSent ? "Oferta wysłana (kliknij aby ponowić)" : "Oznacz jako wysłane"}
                                >
                                    <Mail size={12} />
                                </button>
                                <button 
                                    onClick={() => handleRemoveCalc(calc.id)}
                                    className="p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-zinc-100 opacity-0 group-hover/calc:opacity-100 transition-opacity"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}

                    {/* Quick Add */}
                    <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg p-1 transition-all focus-within:ring-2 focus-within:ring-blue-200">
                        <div className="w-24">
                            <InsurerSelect 
                                value={newInsurer} 
                                onChange={setNewInsurer} 
                                activeList={insurersList} 
                                placeholder="TU..."
                                tabIndex={-1} 
                            />
                        </div>
                        <input 
                            type="number" 
                            placeholder="PLN" 
                            className="w-16 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-bold outline-none"
                            value={newPrice}
                            onChange={e => setNewPrice(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCalc()}
                        />
                        <button 
                            onClick={handleAddCalc}
                            disabled={!newPrice || !newInsurer}
                            className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Plus size={12} />
                        </button>
                    </div>
                </div>

                {/* 3. ACTIONS */}
                <div className="flex items-center gap-2 min-w-[120px] justify-end">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className={`p-2 rounded-lg border transition-all ${isExpanded ? 'bg-zinc-100 border-zinc-300 text-zinc-900' : 'bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600'}`}
                    >
                        <MessageSquare size={16} />
                    </button>
                    <select 
                        value={policy.stage}
                        onChange={(e) => onStatusChange(policy.id, e.target.value as SalesStage)}
                        className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[10px] font-black uppercase outline-none cursor-pointer hover:border-zinc-300"
                    >
                        {Object.keys(STATUS_CONFIG).filter(k => !['sprzedaż', 'ucięty kontakt'].includes(k)).map(key => (
                            <option key={key} value={key}>{STATUS_CONFIG[key].label}</option>
                        ))}
                        <option value="sprzedaż">✅ SPRZEDAJ</option>
                        <option value="ucięty kontakt">❌ ODRZUĆ</option>
                    </select>
                </div>
            </div>

            {/* EXPANDED NOTES AREA */}
            {isExpanded && (
                <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col gap-2">
                    <div className="max-h-32 overflow-y-auto scrollbar-hide space-y-1">
                        {notes.slice(0, 5).map(n => (
                            <div key={n.id} className="text-[10px] text-zinc-500 pl-2 border-l-2 border-zinc-300">
                                <span className="font-bold mr-2">{format(new Date(n.createdAt), 'dd.MM')}</span>
                                {n.content}
                            </div>
                        ))}
                        {notes.length === 0 && <p className="text-[10px] text-zinc-300 italic">Brak notatek.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

const getIcon = (policy: Policy) => {
    if (['OC', 'AC', 'BOTH'].includes(policy.type)) {
        const vType = policy.autoDetails?.vehicleType;
        if (vType === 'CIEZAROWY') return Truck;
        if (vType === 'MOTOCYKL') return Bike;
        if (vType === 'CIAGNIK') return Tractor;
        if (vType === 'AUTOBUS') return Bus;
        if (vType === 'PRZYCZEPA') return Container;
        return Car;
    }
    if (policy.type === 'DOM') return Home;
    if (policy.type === 'ZYCIE') return Heart;
    if (policy.type === 'PODROZ') return Plane;
    if (policy.type === 'FIRMA') return Building2;
    return FileText;
};

// --- MISSING DATA MODAL ---
const MissingDataModal = ({ policy, fields, onClose, onNavigate }: { policy: Policy, fields: string[], onClose: () => void, onNavigate: any }) => {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border-4 border-amber-400 overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
                <div className="bg-amber-400 p-6 flex justify-between items-start">
                    <div className="flex items-center gap-3 text-zinc-900">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <AlertOctagon size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight leading-none">Sprzedaż<br/>Niekompletna</h3>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors text-zinc-900">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="text-center">
                        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                            Status zmieniono na <span className="text-emerald-600 font-black">SPRZEDAŻ</span>, ale wykryto braki w danych:
                        </p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg p-4">
                        <ul className="space-y-2">
                            {fields.map(field => (
                                <li key={field} className="flex items-center gap-2 text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wide">
                                    <XCircle size={14} /> {field}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                        <CalendarPlus size={24} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 mb-1">Akcja Automatyczna</p>
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-tight">
                                System dodał zadanie <strong>"Uzupełnij braki w polisie"</strong> do Twojego terminarza.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-black uppercase text-zinc-500 hover:text-zinc-900 transition-colors">
                            Uzupełnię Później
                        </button>
                        <button 
                            onClick={() => {
                                onClose();
                                onNavigate('client-details', { 
                                    client: { id: policy.clientId }, 
                                    highlightPolicyId: policy.id,
                                    autoOpenPolicyId: policy.id 
                                });
                            }} 
                            className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-black uppercase shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
                        >
                            <PenTool size={14} /> Edytuj Teraz
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Celebration Overlay Component
const CelebrationOverlay = ({ type, onClose }: { type: 'start' | 'sold', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2500);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-xl flex gap-1 items-center">
                {type === 'start' ? (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                            <div className="w-32 h-32 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center animate-bounce shadow-xl shadow-blue-200 relative z-10">
                                <Rocket size={64} fill="currentColor" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Brawo!</h2>
                            <p className="text-lg font-bold text-blue-600 uppercase tracking-widest mt-2">Temat Ruszony! 🚀</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                            <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce shadow-xl shadow-emerald-200 relative z-10">
                                <PartyPopper size={64} fill="currentColor" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">KASING!</h2>
                            <p className="text-lg font-bold text-emerald-600 uppercase tracking-widest mt-2">Polisa Sprzedana! 💰</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// CANONICAL STAGE ORDER
const STAGE_ORDER: SalesStage[] = [
    'of_do zrobienia', 
    'przeł kontakt', 
    'czekam na dane/dokum', 
    'oferta_wysłana', 
    'ucięty kontakt', 
    'sprzedaż'
];

const extractPriceValue = (notes: string[]): number => {
    const regex = /(\d{3,5})\s?(?:zł|pln)/i;
    for (const note of notes) {
        const match = note.match(regex);
        if (match) return parseInt(match[1], 10);
    }
    return 0;
};

// --- HOVER POPOVER COMPONENT ---
interface OfferPopoverProps {
    policy: Policy;
    client: Client;
    notes: ClientNote[];
    onClose: () => void;
    position: { x: number, y: number };
}

const OfferPopover: React.FC<OfferPopoverProps> = ({ policy, client, notes, onClose, position }) => {
    const visibleNotes = notes
        .filter(n => n.tag !== 'STATUS' && !n.content.startsWith('[SYSTEM]'))
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3);
        
    const PolicyIcon = getIcon(policy);

    let left = position.x + 20;
    let top = position.y + 10;

    if (window.innerWidth - position.x < 350) {
        left = position.x - 340; 
    }
    if (window.innerHeight - position.y < 400) {
        top = position.y - 300; 
    }

    return (
        <div 
            style={{ top, left, position: 'fixed' }}
            className="z-[9999] w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-zinc-100 dark:border-zinc-700 animate-in zoom-in-95 duration-200 pointer-events-none"
        >
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-t-2xl flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm text-zinc-500">
                        <User size={18} />
                    </div>
                    <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-white leading-tight">{client.lastName} {client.firstName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            {client.phones[0] && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><Phone size={8}/> {client.phones[0]}</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                    <div className="flex items-center gap-2 text-zinc-400 mb-2">
                        <PolicyIcon size={12} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Dane Przedmiotu</span>
                    </div>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{policy.vehicleBrand || policy.propertyAddress}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">
                            <span className="text-[8px] text-zinc-400 block">NR REJ / ID</span>
                            <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400">{policy.vehicleReg || '---'}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-2 text-zinc-400 mb-2">
                        <MessageSquare size={12} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Ostatnie Notatki (Agenta)</span>
                    </div>
                    {visibleNotes.length > 0 ? (
                        <div className="space-y-2">
                            {visibleNotes.map(n => (
                                <div key={n.id} className="text-[10px] border-l-2 border-zinc-200 pl-2 py-0.5">
                                    <span className="text-zinc-400 font-mono mr-2">{format(new Date(n.createdAt), 'dd.MM')}</span>
                                    <span className="text-zinc-600 dark:text-zinc-300 line-clamp-2">{n.content}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-zinc-400 italic">Brak notatek ręcznych.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export const OffersBoard: React.FC<Props> = ({ state, onNavigate, onRefresh }) => {
  const [draggedPolicyId, setDraggedPolicyId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ show: boolean, type: 'start' | 'sold' }>({ show: false, type: 'start' });
  const [missingDataAlert, setMissingDataAlert] = useState<{ policy: Policy, fields: string[] } | null>(null);
  
  const [hoveredOffer, setHoveredOffer] = useState<{ policy: Policy, client: Client, notes: ClientNote[], pos: {x:number, y:number} } | null>(null);
  const hoverTimeoutRef = useRef<any>(null);
  const closeTimeoutRef = useRef<any>(null);

  const [previewClient, setPreviewClient] = useState<any | null>(null);
  const [quickNotePolicy, setQuickNotePolicy] = useState<Policy | null>(null);
  const [noteContent, setNoteContent] = useState('');

  const [viewMode, setViewMode] = useState<'KANBAN' | 'TABLE'>(() => {
      const saved = localStorage.getItem('CRM_OFFERS_VIEW_MODE');
      return (saved === 'KANBAN' || saved === 'TABLE') ? saved : 'TABLE';
  });

  const handleSetViewMode = (mode: 'KANBAN' | 'TABLE') => {
      setViewMode(mode);
      localStorage.setItem('CRM_OFFERS_VIEW_MODE', mode);
  };
  
  const [filterInsurer, setFilterInsurer] = useState('');
  const [filterTerm, setFilterTerm] = useState('');

  const handleCardEnter = (e: React.MouseEvent, policy: Policy, client: Client, notes: ClientNote[]) => {
      if (viewMode === 'TABLE') return;
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      const x = e.clientX;
      const y = e.clientY;
      hoverTimeoutRef.current = setTimeout(() => {
          setHoveredOffer({ policy, client, notes, pos: { x, y } });
      }, 700); 
  };

  const handleCardLeave = () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      closeTimeoutRef.current = setTimeout(() => {
          setHoveredOffer(null);
      }, 200);
  };

  const handleStatusChange = async (policyId: string, newStage: SalesStage) => {
    const policy = state.policies.find(p => p.id === policyId);
    if (!policy) return;

    if (policy.stage === newStage) return;

    if (newStage === 'sprzedaż') {
        const missing = [];
        if (!policy.policyNumber) missing.push("Numer Polisy");
        if (!policy.premium || policy.premium <= 0) missing.push("Składka");
        if (['OC', 'AC', 'BOTH'].includes(policy.type) && !policy.vehicleReg) missing.push("Numer Rejestracyjny");
        
        if (missing.length > 0) {
            const taskContent = `[ZADANIE] Uzupełnij braki w sprzedanej polisie: ${missing.join(', ')}.`;
            const timeStr = format(new Date(), 'yyyy-MM-dd HH:mm');
            const taskNoteContent = `[${timeStr}]_PRZYPOMNIENIE_${taskContent}`;
            
            await storage.addNote({
                id: `task_${Date.now()}`,
                clientId: policy.clientId,
                content: taskNoteContent,
                tag: 'STATUS',
                createdAt: new Date().toISOString(),
                linkedPolicyIds: [policyId],
                reminderDate: new Date().toISOString()
            });

            setMissingDataAlert({ policy, fields: missing });
        }
    }

    const oldStageLabel = STATUS_CONFIG[policy.stage]?.label || policy.stage;
    const newStageLabel = STATUS_CONFIG[newStage]?.label || newStage;

    const lastSystemNote = state.notes
        .filter(n => n.linkedPolicyIds?.includes(policyId) && n.tag === 'STATUS')
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    let shouldAddNote = true;
    if (lastSystemNote) {
        const diff = Date.now() - new Date(lastSystemNote.createdAt).getTime();
        if (diff < 60000) {
            shouldAddNote = false;
        }
    }

    if (shouldAddNote) {
        const timeStr = format(new Date(), 'HH:mm');
        const noteContent = `[SYSTEM ${timeStr}] Zmiana etapu: "${oldStageLabel}" -> "${newStageLabel}"`;
        
        await storage.addNote({
            id: `sys_note_${Date.now()}`,
            clientId: policy.clientId,
            content: noteContent,
            tag: 'STATUS',
            createdAt: new Date().toISOString(),
            linkedPolicyIds: [policyId]
        });
    }

    if (policy.stage === 'of_do zrobienia' && (newStage === 'przeł kontakt' || newStage === 'oferta_wysłana')) {
        setCelebration({ show: true, type: 'start' });
    } else if (newStage === 'sprzedaż') {
        setCelebration({ show: true, type: 'sold' });
    }

    const updatedPolicy = { ...policy, stage: newStage };
    await storage.updatePolicy(updatedPolicy);
    onRefresh(); 
  };

  const saveQuickNote = async () => {
      if(!quickNotePolicy || !noteContent.trim()) return;
      const newNote: ClientNote = {
          id: `note_${Date.now()}`,
          clientId: quickNotePolicy.clientId,
          content: noteContent,
          tag: 'ROZMOWA',
          createdAt: new Date().toISOString(),
          linkedPolicyIds: [quickNotePolicy.id]
      };
      await storage.addNote(newNote);
      setQuickNotePolicy(null);
      setNoteContent('');
      onRefresh();
  };

  const onDragStart = (e: React.DragEvent, policyId: string) => {
      setDraggedPolicyId(policyId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', policyId);
      setHoveredOffer(null); 
  };

  const onDragOver = (e: React.DragEvent, stageKey: string) => {
      e.preventDefault(); 
      if (dragOverColumn !== stageKey) {
          setDragOverColumn(stageKey);
      }
  };

  const onDrop = (e: React.DragEvent, stageKey: string) => {
      e.preventDefault();
      const policyId = e.dataTransfer.getData('text/plain');
      setDragOverColumn(null);
      setDraggedPolicyId(null);
      
      if (policyId && stageKey) {
          handleStatusChange(policyId, stageKey as SalesStage);
      }
  };

  const moveStage = (policy: Policy, direction: 'next' | 'prev', currentStage: SalesStage, e: React.MouseEvent) => {
      e.stopPropagation();
      const idx = STAGE_ORDER.indexOf(currentStage);
      if (idx === -1) return;
      
      const newIdx = direction === 'next' ? idx + 1 : idx - 1;
      if (newIdx >= 0 && newIdx < STAGE_ORDER.length) {
          handleStatusChange(policy.id, STAGE_ORDER[newIdx]);
      }
  };

  const { activeColumns, doneList, grandTotal, tableList } = useMemo(() => {
    const cols: Record<string, ColumnData> = {
      'of_do zrobienia': { items: [], totalValue: 0 },
      'przeł kontakt': { items: [], totalValue: 0 },
      'czekam na dane/dokum': { items: [], totalValue: 0 },
      'oferta_wysłana': { items: [], totalValue: 0 },
    };

    const done: Policy[] = [];
    const tableItems: Policy[] = [];

    state.policies.forEach(p => {
      let key = p.stage;
      if (key === 'of_przedst') key = 'oferta_wysłana';

      const client = state.clients.find(c => c.id === p.clientId);
      const matchFilter = filterTerm === '' || 
          (client && `${client.lastName} ${client.firstName}`.toLowerCase().includes(filterTerm.toLowerCase())) ||
          p.vehicleReg.toLowerCase().includes(filterTerm.toLowerCase());

      if (key in cols) {
        if (matchFilter) {
            cols[key].items.push(p);
            const clientNotes = state.notes
                .filter(n => n.linkedPolicyIds?.includes(p.id) || n.clientId === p.clientId)
                .map(n => n.content);
            const val = extractPriceValue(clientNotes);
            cols[key].totalValue += val;
            tableItems.push(p);
        }
      } 
      else if (['sprzedaż', 'sprzedany', 'ucięty kontakt', 'rez po ofercie_kont za rok'].includes(key)) {
          const lastNote = state.notes
            .filter(n => n.linkedPolicyIds?.includes(p.id))
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          
          if (lastNote) {
              const days = differenceInDays(new Date(), new Date(lastNote.createdAt));
              if (days <= 7) done.push(p);
          } else {
              const days = differenceInDays(new Date(), new Date(p.createdAt));
              if(days <= 7) done.push(p);
          }
      }
    });

    const total = Object.values(cols).reduce((acc: number, col) => acc + (col as ColumnData).totalValue, 0);
    
    done.sort((a,b) => {
         const getNoteDate = (pid: string) => {
             const note = state.notes.filter(n => n.linkedPolicyIds?.includes(pid)).sort((x,y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
             return note ? new Date(note.createdAt).getTime() : 0;
         }
         return getNoteDate(b.id) - getNoteDate(a.id);
    });

    tableItems.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { activeColumns: cols, doneList: done, grandTotal: total, tableList: tableItems };
  }, [state.policies, state.notes, filterTerm]);

  const activeInsurersList = useMemo(() => {
      return getSortedInsurers(state.policies, 'OC').map(i => i.name);
  }, [state.policies]);

  const handleUpdatePolicy = async (p: Policy) => {
      await storage.updatePolicy(p);
      onRefresh();
  };

  const handleAddNote = async (n: ClientNote) => {
      await storage.addNote(n);
      onRefresh();
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans relative">
      
      {missingDataAlert && (
          <MissingDataModal 
            policy={missingDataAlert.policy} 
            fields={missingDataAlert.fields} 
            onClose={() => setMissingDataAlert(null)}
            onNavigate={(page: string, data: any) => {
                const realClient = state.clients.find(c => c.id === data.client.id);
                if (realClient) {
                    onNavigate(page, { ...data, client: realClient });
                }
            }}
          />
      )}

      {hoveredOffer && (
          <OfferPopover 
              policy={hoveredOffer.policy}
              client={hoveredOffer.client}
              notes={hoveredOffer.notes}
              onClose={() => setHoveredOffer(null)}
              position={hoveredOffer.pos}
          />
      )}

      {celebration.show && (
          <CelebrationOverlay type={celebration.type} onClose={() => setCelebration({ ...celebration, show: false })} />
      )}

      <QuickViewDrawer 
        client={previewClient} 
        state={state} 
        onClose={() => setPreviewClient(null)} 
        onNavigate={onNavigate} 
      />

      {quickNotePolicy && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/30 backdrop-blur-sm" onClick={() => setQuickNotePolicy(null)}>
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl p-8 border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                          <PenTool size={16} className="text-blue-500" /> Szybka Notatka
                      </h4>
                      <button onClick={() => setQuickNotePolicy(null)}><X size={18} className="text-zinc-400"/></button>
                  </div>
                  <p className="text-xs font-bold text-zinc-500 mb-2">
                      {quickNotePolicy.vehicleBrand || quickNotePolicy.type} ({quickNotePolicy.vehicleReg})
                  </p>
                  <textarea 
                      autoFocus
                      className="w-full h-32 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Wpisz treść notatki..."
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && saveQuickNote()}
                  />
                  <div className="flex justify-end mt-4">
                      <button onClick={saveQuickNote} className="bg-zinc-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">
                          Zapisz
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="flex-shrink-0 p-6 pb-2">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tight">
                    <Briefcase className="text-red-600" /> Pipeline Sprzedażowy
                </h1>
                <div className="flex items-center gap-4 mt-2">
                    <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">
                        W toku: {tableList.length}
                    </p>
                    <div className="h-4 w-px bg-zinc-300"></div>
                    <p className="text-sm font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={16} /> Potencjał: {grandTotal.toLocaleString()} PLN
                    </p>
                </div>
            </div>
            
            <div className="flex gap-4">
                {/* SEARCH */}
                <input 
                    type="text" 
                    placeholder="Szukaj..."
                    value={filterTerm}
                    onChange={e => setFilterTerm(e.target.value)}
                    className="pl-4 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-700 border-2 focus:border-blue-500 rounded-xl text-xs font-bold outline-none transition-all w-48"
                />

                {/* VIEW SWITCHER */}
                <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => handleSetViewMode('KANBAN')} className={`p-3 rounded-lg transition-all ${viewMode === 'KANBAN' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><Trello size={18}/></button>
                    <button onClick={() => handleSetViewMode('TABLE')} className={`p-3 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><LayoutList size={18}/></button>
                </div>

                <button 
                    onClick={() => onNavigate('new')}
                    className="bg-zinc-900 dark:bg-zinc-700 text-white px-8 py-3 rounded-2xl text-xs font-black hover:bg-black dark:hover:bg-zinc-600 transition-all shadow-xl shadow-zinc-300 dark:shadow-none flex items-center gap-2 uppercase tracking-widest"
                >
                    <Briefcase size={16} /> Nowa
                </button>
            </div>
        </div>
      </div>

      {/* CONTENT: SPLIT VIEW OR TABLE */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6 gap-6">
        
        {viewMode === 'TABLE' && (
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                {tableList.map(policy => {
                    const client = state.clients.find(c => c.id === policy.clientId);
                    if(!client) return null;
                    const notes = state.notes
                        .filter(n => n.linkedPolicyIds?.includes(policy.id))
                        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                    return (
                        <OfferRow 
                            key={policy.id}
                            policy={policy}
                            client={client}
                            notes={notes}
                            onStatusChange={handleStatusChange}
                            onNavigate={onNavigate}
                            insurersList={activeInsurersList}
                            onUpdatePolicy={handleUpdatePolicy}
                            onAddNote={handleAddNote}
                        />
                    )
                })}
            </div>
        )}

        {viewMode === 'KANBAN' && (
            <>
                {/* UPPER DECK: ACTIVE PIPELINE (Flexible Height) */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2 min-h-0">
                    <div className="flex gap-4 h-full min-w-[1200px]">
                    {Object.entries(activeColumns).map(([stageKey, data]) => {
                        const colData = data as ColumnData;
                        const config = STATUS_CONFIG[stageKey as SalesStage] || STATUS_CONFIG['inne'];
                        const isOver = dragOverColumn === stageKey;
                        
                        return (
                        <div 
                            key={stageKey} 
                            className={`flex-1 flex flex-col min-w-[280px] h-full transition-all duration-300 rounded-[2rem] border-2 
                                ${isOver ? 'bg-zinc-100 dark:bg-zinc-800 border-red-400 scale-[1.01] shadow-2xl' : `bg-white dark:bg-zinc-900 ${config.border} dark:border-zinc-800 shadow-sm`}`}
                            onDragOver={(e) => onDragOver(e, stageKey)}
                            onDrop={(e) => onDrop(e, stageKey)}
                        >
                            <div className={`p-4 rounded-t-[2rem] border-b flex flex-col gap-2 ${config.bg} dark:bg-zinc-800/50 border-opacity-50 ${config.border} dark:border-zinc-700`}>
                                <div className="flex justify-between items-center">
                                    <div className={`flex items-center gap-2 font-black uppercase tracking-widest text-[10px] ${config.color} dark:text-zinc-200`}>
                                        <config.icon size={16} />
                                        {config.label}
                                    </div>
                                    <span className="bg-white dark:bg-zinc-700 px-2 py-1 rounded-lg text-[10px] font-black shadow-sm text-zinc-900 dark:text-zinc-100 min-w-[24px] text-center">
                                        {colData.items.length}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-zinc-50/50 dark:bg-zinc-950/50 rounded-b-[2rem] p-3 flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                            {colData.items.map(policy => {
                                const client = state.clients.find(c => c.id === policy.clientId);
                                if (!client) return null;
                                const end = new Date(policy.policyEndDate);
                                const daysToExpiry = isValid(end) ? differenceInDays(end, new Date()) : 0;
                                const isExpired = daysToExpiry < 0;
                                const PolicyIcon = getIcon(policy);
                                
                                const relatedNotes = state.notes
                                    .filter(n => n.linkedPolicyIds?.includes(policy.id) && n.tag !== 'STATUS' && !n.content.includes('[SYSTEM]'))
                                    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                                const latestNote = relatedNotes[0];

                                return (
                                <div 
                                    key={policy.id} 
                                    draggable
                                    onDragStart={(e) => onDragStart(e, policy.id)}
                                    onMouseEnter={(e) => handleCardEnter(e, policy, client, state.notes.filter(n => n.linkedPolicyIds?.includes(policy.id)))}
                                    onMouseLeave={handleCardLeave}
                                    onDoubleClick={() => onNavigate('client-details', { client, highlightPolicyId: policy.id })}
                                    className={`bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative overflow-hidden ${
                                        isExpired ? 'border-red-300 dark:border-red-900/50' : ''
                                    }`}
                                >
                                    <div className="pl-2">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2 text-zinc-400">
                                                <PolicyIcon size={14} />
                                                <span className="text-[9px] font-black uppercase tracking-wider truncate max-w-[80px]">{policy.insurerName}</span>
                                            </div>
                                            {isExpired && <AlertTriangle size={12} className="text-red-500 animate-pulse"/>}
                                        </div>

                                        <h4 className="text-xs font-black text-zinc-900 dark:text-white leading-tight mb-1 truncate">
                                            {client.lastName} {client.firstName}
                                        </h4>
                                        <p className="text-[10px] text-zinc-500 font-bold mb-2 truncate">
                                            {policy.vehicleBrand || policy.type}
                                        </p>

                                        {latestNote && (
                                            <div className="mb-2 p-1.5 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-700">
                                                <p className="text-[8px] text-zinc-500 italic line-clamp-2 leading-tight">
                                                    {latestNote.content}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                            <button onClick={() => setQuickNotePolicy(policy)} className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-blue-500"><PenTool size={12} /></button>
                                            {stageKey !== 'of_do zrobienia' && <button onClick={(e) => moveStage(policy, 'prev', stageKey as SalesStage, e)} className="p-1 hover:bg-zinc-100 rounded text-zinc-300 hover:text-zinc-600"><ArrowLeft size={12} /></button>}
                                            <button onClick={(e) => moveStage(policy, 'next', stageKey as SalesStage, e)} className="p-1 hover:bg-zinc-100 rounded text-zinc-300 hover:text-zinc-600"><ArrowRight size={12} /></button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>

                {/* --- DROP ZONES FOR DECISION (Visible only when dragging) --- */}
                {draggedPolicyId && (
                    <div className="flex gap-6 h-24 animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div 
                            className={`flex-1 rounded-[2rem] border-2 border-dashed flex items-center justify-center gap-4 transition-all ${dragOverColumn === 'ucięty kontakt' ? 'bg-red-500 border-red-600 text-white scale-105 shadow-xl' : 'bg-red-50 border-red-200 text-red-400 opacity-80'}`}
                            onDragOver={(e) => onDragOver(e, 'ucięty kontakt')}
                            onDrop={(e) => onDrop(e, 'ucięty kontakt')}
                        >
                            <XCircle size={32} />
                            <span className="text-lg font-black uppercase tracking-widest">Odrzuć (Kosz)</span>
                        </div>
                        <div 
                            className={`flex-1 rounded-[2rem] border-2 border-dashed flex items-center justify-center gap-4 transition-all ${dragOverColumn === 'sprzedaż' ? 'bg-emerald-500 border-emerald-600 text-white scale-105 shadow-xl' : 'bg-emerald-50 border-emerald-200 text-emerald-400 opacity-80'}`}
                            onDragOver={(e) => onDragOver(e, 'sprzedaż')}
                            onDrop={(e) => onDrop(e, 'sprzedaż')}
                        >
                            <CheckCircle2 size={32} />
                            <span className="text-lg font-black uppercase tracking-widest">Sprzedaj (Sukces)</span>
                        </div>
                    </div>
                )}

                {/* BOTTOM DECK: RECENT HISTORY (1/3 Height - hidden when dragging to reduce clutter) */}
                {!draggedPolicyId && (
                    <div className="h-1/3 min-h-[200px] bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] border-2 border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-200/50 dark:bg-zinc-800 flex justify-between items-center">
                            <h4 className="text-xs font-black uppercase text-zinc-500 flex items-center gap-2">
                                <History size={14} /> Ostatnio Zakończone (7 dni)
                            </h4>
                            <span className="text-[9px] font-bold text-zinc-400">Archiwum Operacyjne</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {doneList.length === 0 && (
                                    <div className="col-span-full text-center py-8 text-zinc-400 text-xs italic">Brak zakończonych tematów w ostatnim tygodniu.</div>
                                )}
                                {doneList.map(p => {
                                    const client = state.clients.find(c => c.id === p.clientId);
                                    const isSold = p.stage === 'sprzedaż' || p.stage === 'sprzedany';
                                    const isRejected = p.stage === 'ucięty kontakt';
                                    
                                    return (
                                        <div key={p.id} draggable onDragStart={(e) => onDragStart(e, p.id)} className="bg-white dark:bg-zinc-950 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:shadow-md">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSold ? 'bg-emerald-100 text-emerald-600' : (isRejected ? 'bg-red-100 text-red-600' : 'bg-zinc-200 text-zinc-500')}`}>
                                                {isSold ? <CheckCircle2 size={16} /> : (isRejected ? <Ban size={16} /> : <Archive size={16} />)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between">
                                                    <p className="text-[10px] font-black text-zinc-800 dark:text-zinc-200 truncate">{client ? `${client.lastName} ${client.firstName}` : '---'}</p>
                                                    <button 
                                                        onClick={() => handleStatusChange(p.id, 'przeł kontakt')} 
                                                        className="text-zinc-300 hover:text-blue-500" 
                                                        title="Przywróć do obiegu"
                                                    >
                                                        <Undo2 size={12} />
                                                    </button>
                                                </div>
                                                <p className="text-[9px] text-zinc-500 truncate">{p.vehicleBrand || p.type}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </>
        )}

      </div>
    </div>
  );
};
