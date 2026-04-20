
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { POLICY_CATEGORIES } from '../data/policyOptions';
import { Client, Policy, PolicyType, ClientNote, PolicyCalculation } from '../types';
import { 
  Car, Home, Heart, Plane, Building2, FileText, 
  Save, Search, Shield, 
  Edit, Lock, Fingerprint, RefreshCcw, FileWarning, Key, Banknote,
  X, Database, Bot, ExternalLink, Link as LinkIcon,
  PanelRightOpen, PanelRightClose, Calculator, ListChecks, UserPlus, AlertCircle, History, Sparkles, Loader2, ChevronDown, Copy,
  CheckCircle2, Target, Calendar as CalendarIcon, MessageSquare, Send, Clock,
  ArrowRight, Trash2, Trophy, Plus, Phone, Mail
} from 'lucide-react';
import { InsurerSelect } from './InsurerSelect';
import { CommissionCalculator } from './Commission/CommissionCalculator';
import { ComplianceChecklist } from './ComplianceChecklist';
import { TerminationFormModal } from './TerminationFormModal'; 
import { storage } from '../services/storage';
import { addYears, addDays, format, differenceInDays } from 'date-fns';
import { STATUS_CONFIG } from '../constants';
import { STANDARD_INPUT_CLASS, STANDARD_SELECT_CLASS } from '../modules/utils/window_utils';
import { getSortedInsurers } from '../services/insurerRanking';

// IMPORTY DEDYKOWANYCH FORMULARZY (FILARY 2-5)
import { AutoForm } from './PolicyForms/AutoForm';
import { HomeForm } from './PolicyForms/HomeForm';
import { LifeForm } from './PolicyForms/LifeForm';
import { TravelForm } from './PolicyForms/TravelForm';
import { OtherForm } from './PolicyForms/OtherForm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialClient?: Client;
  clients?: Client[];     
  initialType?: PolicyType;
  initialPolicy?: Policy; 
  onSave: (client: Client, policy: Policy) => Promise<void> | void;
  existingPolicies?: Policy[];
  notes?: ClientNote[]; // Passed from parent (ClientDetails or App)
  // displayMode usunięte - zawsze Modal
  initialMode?: 'VIEW' | 'EDIT';
  onOpenProfile?: (client: Client, policyId?: string) => void;
  aiDiffs?: any; 
  onAddNewClient?: () => void;
  
  // NEW: Renewal Source (for cloning)
  renewalSource?: Policy | null;
}

const generateId = () => {
  return typeof crypto.randomUUID === 'function' 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 11) + '-' + Date.now();
};

const LABEL_CLASS = "text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 pl-1 tracking-wide mb-1 block";

// --- KOMPONENT NOTATEK (READ-WRITE WIDGET) ---
const PolicyNotesWidget = ({ policyId, clientId, notes = [] }: { policyId: string, clientId: string, notes?: ClientNote[] }) => {
    const [newNote, setNewNote] = useState('');
    const [localNotes, setLocalNotes] = useState<ClientNote[]>([]);

    useEffect(() => {
        // Filter notes for this policy OR generic client notes (if new policy)
        if (policyId) {
            const relevant = notes.filter(n => n.linkedPolicyIds?.includes(policyId) || (n.clientId === clientId && !n.linkedPolicyIds?.length));
            setLocalNotes(relevant.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
    }, [notes, policyId, clientId]);

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        
        const note: ClientNote = {
            id: `pn_${Date.now()}`,
            clientId: clientId,
            content: newNote,
            tag: 'ROZMOWA',
            createdAt: new Date().toISOString(),
            linkedPolicyIds: [policyId]
        };
        
        await storage.addNote(note);
        setLocalNotes(prev => [note, ...prev]);
        setNewNote('');
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <MessageSquare size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Notatki / Ustalenia</span>
                </div>
                <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-500 text-[9px] font-bold px-2 py-0.5 rounded-full">{localNotes.length}</span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide mb-3 pr-1">
                {localNotes.length === 0 && <p className="text-[10px] text-zinc-400 italic text-center py-2">Brak notatek dla tej sprawy.</p>}
                {localNotes.map(n => (
                    <div key={n.id} className="text-[11px] bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-1 text-zinc-400">
                            <span className="font-mono text-[9px]">{format(new Date(n.createdAt), 'dd.MM HH:mm')}</span>
                            <span className="text-[9px] font-bold uppercase">{n.tag}</span>
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-300 leading-snug">{n.content}</p>
                    </div>
                ))}
            </div>

            <div className="relative">
                <input 
                    className="w-full pl-3 pr-8 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Dopisz szybką notatkę..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                />
                <button 
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
                >
                    <Send size={14} />
                </button>
            </div>
        </div>
    );
};

// --- KOMPONENT PORÓWNYWARKI (OFFER BATTLE) ---
const OfferComparator = ({ calculations, onUpdate, onSelect, activeList, onAddInsurer }: { 
    calculations: PolicyCalculation[], 
    onUpdate: (calcs: PolicyCalculation[]) => void,
    onSelect: (calc: PolicyCalculation) => void,
    activeList: string[],
    onAddInsurer: (name: string) => void
}) => {
    const [newInsurer, setNewInsurer] = useState('');
    const [newPremium, setNewPremium] = useState('');
    const [newNote, setNewNote] = useState('');

    const handleAdd = () => {
        if (!newInsurer || !newPremium) return;
        const newCalc: PolicyCalculation = {
            id: `calc_${Date.now()}`,
            insurerName: newInsurer,
            premium: parseFloat(newPremium) || 0,
            notes: newNote,
            isSelected: false,
            createdAt: new Date().toISOString()
        };
        onUpdate([...calculations, newCalc]);
        
        // SYNC: Add to Target Insurers as well
        onAddInsurer(newInsurer);

        setNewInsurer('');
        setNewPremium('');
        setNewNote('');
    };

    const handleRemove = (id: string) => {
        onUpdate(calculations.filter(c => c.id !== id));
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400">
                <Trophy size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Bitwa Ofert (Kalkulacje)</span>
            </div>

            {/* List */}
            <div className="space-y-2 mb-4">
                {calculations.length === 0 && <p className="text-[10px] text-zinc-400 italic text-center py-2">Brak dodanych kalkulacji.</p>}
                {calculations.map(calc => (
                    <div key={calc.id} className={`flex items-center justify-between p-2 rounded-xl border ${calc.isSelected ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100' : 'bg-zinc-50 border-zinc-100'}`}>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-xs text-zinc-800 dark:text-zinc-200">{calc.insurerName}</span>
                                <span className="font-mono text-xs text-emerald-600 font-bold">{calc.premium} zł</span>
                            </div>
                            {calc.notes && <p className="text-[9px] text-zinc-500 italic leading-tight">{calc.notes}</p>}
                        </div>
                        <div className="flex gap-2">
                            {!calc.isSelected && (
                                <button 
                                    type="button" 
                                    onClick={() => onSelect(calc)}
                                    className="px-2 py-1 bg-zinc-900 text-white text-[9px] font-bold uppercase rounded-lg hover:bg-black transition-colors"
                                >
                                    Wybierz
                                </button>
                            )}
                            {calc.isSelected && <span className="px-2 py-1 text-[9px] font-bold text-emerald-600 bg-emerald-100 rounded-lg flex items-center gap-1"><CheckCircle2 size={10}/> WYBRANA</span>}
                            <button type="button" onClick={() => handleRemove(calc.id)} className="p-1 text-zinc-300 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add New */}
            <div className="grid grid-cols-12 gap-2 items-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="col-span-4">
                    <label className="text-[8px] font-bold uppercase text-zinc-400 pl-1">TU</label>
                    <InsurerSelect value={newInsurer} onChange={setNewInsurer} activeList={activeList} placeholder="Wybierz..." />
                </div>
                <div className="col-span-3">
                    <label className="text-[8px] font-bold uppercase text-zinc-400 pl-1">Kwota</label>
                    <input 
                        type="number" 
                        value={newPremium} 
                        onChange={e => setNewPremium(e.target.value)} 
                        className={STANDARD_INPUT_CLASS} 
                        placeholder="0 zł" 
                    />
                </div>
                <div className="col-span-5">
                    <label className="text-[8px] font-bold uppercase text-zinc-400 pl-1">Notatka (np. Brak szyb)</label>
                    <input 
                        value={newNote} 
                        onChange={e => setNewNote(e.target.value)} 
                        className={STANDARD_INPUT_CLASS} 
                        placeholder="..." 
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                </div>
                <div className="col-span-12 mt-1">
                    <button 
                        type="button" 
                        onClick={handleAdd}
                        disabled={!newInsurer || !newPremium}
                        className="w-full py-2 bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Plus size={12} /> Dodaj Kalkulację
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- KOMPONENT WIDOKU (READ-ONLY DASHBOARD) ---
const ReadOnlyView = ({ policy, onEdit, onAction }: any) => {
    const statusConfig = STATUS_CONFIG[policy.stage] || STATUS_CONFIG['inne'];
    
    let Icon = FileText;
    if(['OC','AC','BOTH'].includes(policy.type)) Icon = Car;
    if(policy.type === 'DOM') Icon = Home;
    if(policy.type === 'ZYCIE') Icon = Heart;
    if(policy.type === 'PODROZ') Icon = Plane;

    return (
        <div className="space-y-8 p-8 animate-in fade-in duration-300 max-w-5xl mx-auto">
             {/* ACTION BAR */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={onEdit} className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform">
                    <Edit size={24} />
                    <span className="text-xs font-black uppercase tracking-widest">Edytuj Dane</span>
                </button>
                
                <button onClick={() => onAction('RENEWAL')} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform">
                    <RefreshCcw size={24} />
                    <span className="text-xs font-black uppercase tracking-widest">Wznowienie</span>
                </button>
                
                {['OC', 'AC', 'BOTH'].includes(policy.type) && (
                    <>
                        <button onClick={() => onAction('SOLD')} className="bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform">
                            <Key size={24} />
                            <span className="text-xs font-black uppercase tracking-widest">Zgłoś Zbycie</span>
                        </button>
                        <button onClick={() => onAction('TERMINATE')} className="bg-white border-2 border-red-100 text-red-600 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-red-50 hover:border-red-200 transition-all">
                            <FileWarning size={24} />
                            <span className="text-xs font-black uppercase tracking-widest">Wypowiedzenie</span>
                        </button>
                    </>
                )}
            </div>

            {/* MAIN CARD */}
            <div className="bg-white dark:bg-zinc-900 rounded-[1.75rem] p-8 border-2 border-zinc-100 dark:border-zinc-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Icon size={200} />
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                            {statusConfig.label}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded">
                            ID: {policy.id}
                        </span>
                    </div>

                    <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white leading-none mb-4 tracking-tighter">
                        {policy.vehicleBrand || policy.propertyAddress || policy.type}
                    </h2>
                    
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl">
                            <span className="block text-[9px] font-black uppercase text-zinc-400">Numer Polisy / Rej</span>
                            <span className="text-lg font-bold text-zinc-700 dark:text-zinc-300 font-mono">{policy.vehicleReg || policy.policyNumber || 'BRAK'}</span>
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl">
                            <span className="block text-[9px] font-black uppercase text-zinc-400">Towarzystwo</span>
                            <span className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{policy.insurerName}</span>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800">
                            <span className="block text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Składka</span>
                            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{policy.premium} PLN</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- ASSET PICKER COMPONENT (Asset Intelligence) ---
const AssetPicker = ({ assets, onSelect }: { assets: Policy[], onSelect: (asset: Policy) => void }) => {
    return (
        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-6 animate-in slide-in-from-top-4">
            <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                <Sparkles size={12} /> Asset Intelligence (Historia Klienta) - Szybki Wybór
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {assets.map(asset => (
                    <button
                        key={asset.id}
                        type="button"
                        onClick={() => onSelect(asset)}
                        className="flex-shrink-0 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl p-3 min-w-[140px] text-left hover:scale-105 hover:shadow-md transition-all group"
                    >
                        <div className="flex justify-between items-start mb-1">
                            {['OC','AC','BOTH'].includes(asset.type) ? <Car size={14} className="text-zinc-400 group-hover:text-blue-500"/> : <Home size={14} className="text-zinc-400 group-hover:text-emerald-500"/>}
                            <span className="text-[9px] font-mono text-zinc-300">{asset.vehicleReg || '---'}</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">{asset.vehicleBrand || asset.propertyAddress || asset.type}</p>
                        <p className="text-[9px] text-zinc-400 mt-1 truncate">{asset.insurerName}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

export const PolicyFormModal: React.FC<Props> = ({ isOpen, onClose, initialClient, clients, initialType, initialPolicy, onSave, existingPolicies = [], notes = [], initialMode, onOpenProfile, aiDiffs: externalAiDiffs, onAddNewClient, renewalSource }) => {
  
  // Logic: If renewalSource is present, we are in 'EDIT' mode of a NEW policy (cloned), so initialMode should be 'EDIT' and initialPolicy is the source for data but not ID.
  const [mode, setMode] = useState<'VIEW' | 'EDIT'>(renewalSource ? 'EDIT' : (initialMode || (initialPolicy ? 'VIEW' : 'EDIT')));
  
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [isRenewalMode, setIsRenewalMode] = useState(!!renewalSource); 
  const [showRightPanel, setShowRightPanel] = useState(true); // Default open on desktop
  const [aiDiffs, setAiDiffs] = useState<any>({}); 
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [showDateWarning, setShowDateWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceVerified, setSourceVerified] = useState(false);
  
  // TIME TRACKING REF (WORK SESSION)
  const openTimeRef = useRef<Date | null>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(initialClient || null);
  const [searchClientTerm, setSearchClientTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false); // NOWE: Stan dropdowna
  const [activeInsurersList, setActiveInsurersList] = useState<string[]>([]);
  
  // --- FORM DEFAULTS ---
  const defaultValues = useMemo(() => {
      // SCENARIO 1: CLONE / RENEWAL MODE
      if (renewalSource) {
          const oldEnd = new Date(renewalSource.policyEndDate);
          const newStart = addDays(oldEnd, 1);
          const newEnd = addDays(addYears(newStart, 1), -1);

          return {
              ...renewalSource,
              id: generateId(), // NEW ID
              stage: 'of_do zrobienia', // RESET STATUS
              policyStartDate: newStart.toISOString().split('T')[0],
              policyEndDate: newEnd.toISOString().split('T')[0],
              premium: '', // RESET FINANCES
              commission: '',
              commissionRate: '',
              insurerName: '', // USER MUST CHOOSE NEW INSURER
              oldInsurerName: renewalSource.insurerName, // SAVE HISTORY
              oldPolicyNumber: renewalSource.policyNumber,
              oldPremium: renewalSource.premium,
              previousPolicyId: renewalSource.id,
              targetInsurers: [], // Reset targets
              calculations: [], // Reset calculations
              
              // Keep Technical Data
              autoDetails: renewalSource.autoDetails || {},
              homeDetails: renewalSource.homeDetails || {},
              travelDetails: renewalSource.travelDetails || {},
              lifeDetails: renewalSource.lifeDetails || {},
              subAgentSplits: [] // Reset Splits
          };
      }

      // SCENARIO 2: EDIT EXISTING POLICY
      if (initialPolicy) {
          let splits = initialPolicy.subAgentSplits || [];
          if (splits.length === 0 && initialPolicy.subAgentId) {
              splits = [{
                  agentId: initialPolicy.subAgentId,
                  rate: initialPolicy.subAgentRate || 0,
                  amount: initialPolicy.subAgentCommission || 0,
                  note: initialPolicy.noteForSubAgent || ''
              }];
          }
          return {
              ...initialPolicy,
              type: initialPolicy.type, 
              policyStartDate: initialPolicy.policyStartDate ? new Date(initialPolicy.policyStartDate).toISOString().split('T')[0] : '',
              policyEndDate: initialPolicy.policyEndDate ? new Date(initialPolicy.policyEndDate).toISOString().split('T')[0] : '',
              nextContactDate: initialPolicy.nextContactDate ? new Date(initialPolicy.nextContactDate).toISOString().split('T')[0] : '',
              autoDetails: initialPolicy.autoDetails || {},
              homeDetails: initialPolicy.homeDetails || {},
              travelDetails: initialPolicy.travelDetails || {},
              lifeDetails: initialPolicy.lifeDetails || {},
              targetInsurers: initialPolicy.targetInsurers || [],
              calculations: initialPolicy.calculations || [],
              subAgentSplits: splits
          };
      } 

      // SCENARIO 3: BRAND NEW POLICY
      return {
          type: initialType || 'OC', 
          stage: 'of_do zrobienia',
          policyStartDate: new Date().toISOString().split('T')[0],
          policyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          premium: '', commission: '', commissionRate: '', checklist: {},
          autoDetails: {}, homeDetails: {}, travelDetails: {}, lifeDetails: {},
          targetInsurers: [],
          calculations: [],
          subAgentSplits: []
      };
  }, [initialPolicy, initialType, renewalSource]);

  const form = useForm<any>({ defaultValues });
  const { register, handleSubmit, watch, setValue, getValues, reset } = form;
  
  const currentType = watch('type'); 
  const currentStage = watch('stage');
  const targetInsurers = watch('targetInsurers') || [];
  const calculations = watch('calculations') || [];

  const isOffer = ['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt', 'czekam na dane/dokum', 'of_przedst'].includes(currentStage);

  const filteredClients = useMemo(() => {
      if (!clients) return [];
      
      // LOGIKA WYSZUKIWANIA
      if (searchClientTerm) {
          const term = searchClientTerm.toLowerCase();
          return clients.filter(c => 
              c.lastName.toLowerCase().includes(term) || 
              c.firstName.toLowerCase().includes(term) ||
              (c.pesel && c.pesel.includes(term))
          ).slice(0, 10);
      } 
      
      // LOGIKA DROPDOWNA (Pokaż ostatnich jeśli brak terminu ale otwarte)
      if (isClientDropdownOpen) {
          // Sortuj po dacie dodania (najnowsze)
          return [...clients]
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10);
      }

      return [];
  }, [clients, searchClientTerm, isClientDropdownOpen]);

  // Unique assets for Asset Intelligence
  const clientAssets = useMemo(() => {
      if (!selectedClient || !existingPolicies) return [];
      // Get unique assets based on Reg/Address to avoid duplicates in picker
      const seen = new Set();
      return existingPolicies.filter(p => {
          if (p.clientId !== selectedClient.id) return false;
          // Ignore current policy if editing
          if (initialPolicy && p.id === initialPolicy.id) return false;
          
          const key = p.vehicleReg || p.propertyAddress || p.type;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
      });
  }, [selectedClient, existingPolicies, initialPolicy]);

  // --- HISTORY DETECTION (ASSET TIMELINE) ---
  const assetHistory = useMemo(() => {
      if (!selectedClient || !existingPolicies) return [];
      
      const currentReg = watch('vehicleReg');
      const currentAddr = watch('propertyAddress');
      const prevId = watch('previousPolicyId');
      
      // If no identifier, show nothing
      if(!currentReg && !currentAddr && !prevId) return [];

      return existingPolicies.filter(p => {
          if (p.clientId !== selectedClient.id) return false;
          if (initialPolicy && p.id === initialPolicy.id) return false; // Don't show self

          // Match by Reg or Address
          const regMatch = currentReg && p.vehicleReg && p.vehicleReg.replace(/\s/g,'') === currentReg.replace(/\s/g,'');
          const addrMatch = currentAddr && p.propertyAddress && p.propertyAddress.toLowerCase().includes(currentAddr.toLowerCase());
          const linkMatch = prevId && p.id === prevId; 

          return regMatch || addrMatch || linkMatch;
      }).sort((a,b) => new Date(b.policyEndDate).getTime() - new Date(a.policyEndDate).getTime());
  }, [selectedClient, existingPolicies, watch('vehicleReg'), watch('propertyAddress'), watch('previousPolicyId')]);

  const availablePreviousPolicies = useMemo(() => {
      if (!selectedClient || !existingPolicies) return [];
      return existingPolicies
          .filter(p => p.clientId === selectedClient.id && (!initialPolicy || p.id !== initialPolicy.id))
          .sort((a, b) => new Date(b.policyEndDate).getTime() - new Date(a.policyEndDate).getTime());
  }, [selectedClient, existingPolicies, initialPolicy]);
  
  // --- SMART RANKING (INSURERS) ---
  const sortedInsurers = useMemo(() => {
      return getSortedInsurers(existingPolicies, currentType).map(i => i.name);
  }, [existingPolicies, currentType]);

  // --- EFFECT 1: INITIALIZATION & CLEANUP (CRITICAL) ---
  useEffect(() => {
      if (isOpen) {
          setShowDateWarning(false);
          setPendingSaveData(null);
          setIsSaving(false);
          setSourceVerified(initialPolicy?.sourceVerified || false);
          openTimeRef.current = new Date(); // Start Work Session
          
          if (renewalSource) {
              setIsRenewalMode(true);
              setMode('EDIT');
          } else {
              setIsRenewalMode(false);
              if (initialMode) setMode(initialMode);
              else if (initialPolicy) setMode('VIEW'); 
              else setMode('EDIT');
          }

          if (initialClient) setSelectedClient(initialClient);
          else if (initialPolicy && clients) {
             const found = clients.find(c => c.id === initialPolicy.clientId);
             if (found) setSelectedClient(found);
          } else if (renewalSource && clients) {
              // Set client from source
             const found = clients.find(c => c.id === renewalSource.clientId);
             if (found) setSelectedClient(found);
          }
      } else {
          // CLEANUP ON CLOSE - Wipe diffs to prevent ghost data
          setAiDiffs({});
          setIsClientDropdownOpen(false); // Reset dropdown
          setSearchClientTerm('');
          openTimeRef.current = null;
      }

      // CLEANUP: Reset agent context when modal closes to avoid data mix-up
      return () => {
          const event = new CustomEvent('RESET_AGENT');
          window.dispatchEvent(event);
      };
  }, [isOpen, initialMode, renewalSource]); 

  // --- EFFECT 2: LIVE DATA SYNC (AI / REFRESH) ---
  useEffect(() => {
      if (isOpen) {
          reset(defaultValues);
          if (externalAiDiffs) {
              console.log("[PolicyForm] Applying AI Diffs", externalAiDiffs);
              setAiDiffs(externalAiDiffs);
          } else {
              setAiDiffs({});
          }
      }
  }, [defaultValues, externalAiDiffs, isOpen, reset]);

  // --- NEW: SYNC INITIAL CLIENT DYNAMICALLY ---
  // Pozwala na "złapanie" nowo dodanego klienta po zamknięciu modalu 'nad'
  useEffect(() => {
      if (initialClient) {
          setSelectedClient(initialClient);
      }
  }, [initialClient]);

  const handleEditClick = () => setMode('EDIT');

  const handleOpenAgent = () => {
      if (initialPolicy && selectedClient) {
          const event = new CustomEvent('OPEN_AGENT', { 
              detail: { 
                  clientId: selectedClient.id, 
                  policyId: initialPolicy.id, 
                  label: `${selectedClient.lastName} (Polisa)`,
                  initialMessage: `Analizuję dane źródłowe: "${initialPolicy.originalProductString || 'brak'}"...`,
                  mode: 'AUTO_REPAIR',
                  sourceString: initialPolicy.originalProductString 
              } 
          });
          window.dispatchEvent(event);
      }
  };

  const handleSmartAction = async (action: string) => {
      if (action === 'RENEWAL') {
          const oldEnd = new Date(initialPolicy!.policyEndDate);
          const newStart = addDays(oldEnd, 1);
          const newEnd = addDays(addYears(newStart, 1), -1);
          setIsRenewalMode(true); 
          setMode('EDIT');
          
          // Switch to "Clone" logic conceptually
          setValue('id', generateId()); // NEW ID
          setValue('stage', 'of_do zrobienia');
          setValue('policyStartDate', newStart.toISOString().split('T')[0]);
          setValue('policyEndDate', newEnd.toISOString().split('T')[0]);
          setValue('premium', '');
          setValue('commission', '');
          setValue('insurerName', ''); // Reset insurer for new offer
          setValue('previousPolicyId', initialPolicy!.id); // Auto-link previous
          setValue('oldInsurerName', initialPolicy!.insurerName);
          setValue('oldPolicyNumber', initialPolicy!.policyNumber);
          setValue('oldPremium', initialPolicy!.premium);
          setValue('targetInsurers', []);
          
          alert("Tryb Wznowienia: Utworzono nową ofertę na podstawie starej polisy.");
      }
      if (action === 'TERMINATE') { setShowTerminationModal(true); }
  };

  const handleAssetPick = (asset: Policy) => {
      // Auto-fill form based on asset type
      if (['OC', 'AC', 'BOTH'].includes(asset.type)) {
          setValue('type', asset.type);
          setValue('vehicleBrand', asset.vehicleBrand);
          setValue('vehicleModel', asset.vehicleModel);
          setValue('vehicleReg', asset.vehicleReg);
          setValue('vehicleVin', asset.vehicleVin);
          if (asset.autoDetails) {
              setValue('autoDetails', { ...asset.autoDetails });
          }
      } else if (asset.type === 'DOM') {
          setValue('type', 'DOM');
          setValue('propertyAddress', asset.propertyAddress);
          if (asset.homeDetails) {
              setValue('homeDetails', { ...asset.homeDetails });
          }
      }
      // Link previous
      setValue('previousPolicyId', asset.id);
      setValue('oldInsurerName', asset.insurerName);
      setValue('oldPolicyNumber', asset.policyNumber);
      setValue('oldPremium', asset.premium);
  };

  const handleTerminationConfirm = async (actualDate: string) => {
      if (!selectedClient || !initialPolicy) return;
      setShowTerminationModal(false);
      onClose();
  };
  
  const toggleTargetInsurer = (name: string) => {
      const current = getValues('targetInsurers') || [];
      if (current.includes(name)) {
          setValue('targetInsurers', current.filter((i: string) => i !== name));
      } else {
          setValue('targetInsurers', [...current, name]);
      }
  };
  
  const handleQuickPlan = (days: number) => {
      const date = addDays(new Date(), days);
      setValue('nextContactDate', date.toISOString().split('T')[0]);
  };
  
  const handleCalcSelect = (calc: PolicyCalculation) => {
      setValue('insurerName', calc.insurerName);
      setValue('premium', calc.premium);
      // Update Selection
      const updated = calculations.map((c: PolicyCalculation) => ({
          ...c,
          isSelected: c.id === calc.id
      }));
      setValue('calculations', updated);

      // AUTO-TRANSITION (Logic Upgrade)
      const currentStage = getValues('stage');
      if (currentStage === 'of_do zrobienia') {
          setValue('stage', 'przeł kontakt');
      }
  };

  useEffect(() => {
      const s = storage.getState();
      if(s.insurers) setActiveInsurersList(s.insurers);
  }, [isOpen]);

  // VALIDATION HELPER (Strict Sale Check)
  const validateSaleRequirements = (data: Policy): string | null => {
      if (!data.policyNumber) return "Wymagany numer polisy przy sprzedaży!";
      if (!data.premium || data.premium <= 0) return "Wymagana składka > 0 przy sprzedaży!";
      
      // Auto
      if (['OC', 'AC', 'BOTH'].includes(data.type)) {
          if (!data.vehicleReg) return "Wymagany numer rejestracyjny!";
      }
      // Dom
      if (data.type === 'DOM') {
          if (!data.propertyAddress) return "Wymagany adres nieruchomości!";
      }

      return null;
  };

  const handlePreSubmit = (data: any) => {
      if (!selectedClient) return alert("Wybierz klienta!");
      
      // STRICT CHECK FOR SALE
      if (data.stage === 'sprzedaż' || data.stage === 'sprzedany') {
          const error = validateSaleRequirements(data);
          if (error) return alert(`BLOKADA SPRZEDAŻY: ${error}`);
      }

      const newPolicy: Policy = {
          id: data.id || generateId(), // Ensure ID exists
          clientId: selectedClient.id,
          createdAt: isRenewalMode || !initialPolicy ? new Date().toISOString() : (initialPolicy.createdAt || new Date().toISOString()), 
          originalProductString: data.originalProductString,
          sourceVerified: sourceVerified,
          ...data,
          premium: parseFloat(data.premium) || 0,
          commission: parseFloat(data.commission) || 0,
          commissionRate: parseFloat(data.commissionRate) || 0,
          policyStartDate: new Date(data.policyStartDate).toISOString(),
          policyEndDate: new Date(data.policyEndDate).toISOString(),
          nextContactDate: data.nextContactDate ? new Date(data.nextContactDate).toISOString() : undefined,
          subAgentSplits: data.subAgentSplits,
          calculations: data.calculations
      };

      if (!isRenewalMode && initialPolicy && (initialPolicy.stage === 'sprzedaż' || initialPolicy.stage === 'sprzedany')) {
          const oldStart = new Date(initialPolicy.policyStartDate).toISOString().split('T')[0];
          const newStart = new Date(newPolicy.policyStartDate).toISOString().split('T')[0];
          
          if (oldStart !== newStart) {
              setPendingSaveData(newPolicy);
              setShowDateWarning(true);
              return; 
          }
      }
      executeSave(newPolicy);
  };

  const executeSave = async (policyToSave: Policy) => {
      if (isSaving) return;
      setIsSaving(true);

      // --- AUDIT LOGIC (Work Session & Status Change) ---
      const now = new Date();
      let durationStr = "";
      
      if (openTimeRef.current) {
          const durationMs = now.getTime() - openTimeRef.current.getTime();
          const mins = Math.floor(durationMs / 60000);
          const secs = Math.floor((durationMs % 60000) / 1000);
          durationStr = `Czas pracy: ${mins}m ${secs}s.`;
      }

      // Check Status Change
      let statusNote = "";
      const oldStage = initialPolicy?.stage;
      const newStage = policyToSave.stage;

      if (oldStage && oldStage !== newStage) {
          const oldLabel = STATUS_CONFIG[oldStage]?.label || oldStage;
          const newLabel = STATUS_CONFIG[newStage]?.label || newStage;
          statusNote = `Zmiana etapu: "${oldLabel}" -> "${newLabel}".`;
      } else {
          statusNote = "Aktualizacja danych.";
      }

      // Add System Note
      const systemNoteContent = `[SYSTEM ${format(now, 'HH:mm')}] ${statusNote} ${durationStr}`;
      
      await storage.addNote({
          id: `sys_audit_${Date.now()}`,
          clientId: selectedClient!.id,
          content: systemNoteContent,
          tag: 'STATUS',
          createdAt: now.toISOString(),
          linkedPolicyIds: [policyToSave.id]
      });

      if (isRenewalMode) {
          // Add extra note about renewal creation if needed (redundant but safe)
          // The main audit note covers "Create" implicitly via "Aktualizacja danych" or just logging
          // But for renewal specifically:
          await storage.addNote({
              id: `sys_renewal_created_${Date.now()}_2`,
              clientId: selectedClient!.id,
              content: `[WZNOWIENIE] Utworzono ofertę wznowieniową na podstawie polisy ${policyToSave.oldPolicyNumber || 'poprzedniej'}.`,
              tag: 'OFERTA',
              createdAt: now.toISOString(),
              linkedPolicyIds: [policyToSave.id]
          });
      }
      
      // CRITICAL FIX: Await the save operation to ensure UI doesn't close prematurely
      await onSave(selectedClient!, policyToSave);
      
      setShowDateWarning(false);
      setPendingSaveData(null);
      setIsSaving(false);
  };

  // State for Add Target Select
  const [newTargetInput, setNewTargetInput] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 md:p-4 bg-zinc-950/80 backdrop-blur-md">
      
      {showTerminationModal && selectedClient && initialPolicy && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/50">
              <TerminationFormModal policy={initialPolicy} client={selectedClient} onConfirm={handleTerminationConfirm} onCancel={() => setShowTerminationModal(false)} />
          </div>
      )}

      {showDateWarning && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-6">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border-4 border-red-500 max-w-sm w-full">
                    <h3 className="text-xl font-black text-red-600 uppercase text-center">Uwaga! Zmiana Daty!</h3>
                    <p className="text-center text-zinc-600 dark:text-zinc-300 text-sm my-4">Zmieniasz datę startu sprzedanej polisy. Czy to aneks/korekta?</p>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setShowDateWarning(false)} className="flex-1 py-3 bg-zinc-100 rounded-xl font-bold">Anuluj</button>
                        <button onClick={() => executeSave(pendingSaveData)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Zatwierdź</button>
                    </div>
                </div>
            </div>
      )}

      {/* MAIN CONTAINER */}
      <div className={`bg-white dark:bg-zinc-900 rounded-none md:rounded-[1.75rem] shadow-2xl w-full h-full md:h-[90vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800 transition-all duration-500 ease-in-out max-w-7xl relative ${isRenewalMode ? 'border-4 border-blue-500/50' : ''}`}>
        
        {/* HEADER */}
        <div className={`px-8 py-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center ${mode === 'VIEW' ? 'bg-zinc-50 dark:bg-zinc-950' : 'bg-white dark:bg-zinc-900'}`}>
            <div className="flex items-center gap-4">
                {isRenewalMode ? (
                    <div className="flex items-center gap-2 text-blue-600">
                        <Copy size={24} />
                        <span className="font-black text-lg uppercase tracking-tight">Kreator Wznowienia</span>
                        {initialPolicy && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-lg font-bold ml-2">
                                Źródło: {initialPolicy.insurerName}
                            </span>
                        )}
                    </div>
                ) : (
                    <>
                        {mode === 'VIEW' ? <Lock size={24} className="text-zinc-400"/> : <Edit size={24} className="text-blue-600"/>}
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
                                    {mode === 'VIEW' ? 'Centrum Operacyjne' : (initialPolicy ? 'Edycja Polisy' : 'Kreator Polisy')}
                                </h3>
                                {initialPolicy && isOffer && (
                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-amber-200">
                                        ID OFERTY: {(initialPolicy.id || '').substring(0,8)}...
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : 'Wybierz klienta...'}
                            </p>
                        </div>
                    </>
                )}
            </div>
            <div className="flex items-center gap-3">
                {mode === 'EDIT' && (
                    <button 
                        onClick={() => setShowRightPanel(!showRightPanel)}
                        className={`p-2 rounded-xl transition-all ${showRightPanel ? 'bg-zinc-100 text-zinc-600' : 'bg-white border hover:bg-zinc-50'}`}
                        title="Przełącz Panel Boczny"
                    >
                        {showRightPanel ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                    </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-xl transition-colors"><X size={24} /></button>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
            
            {/* LEFT COLUMN: FORM / VIEW */}
            <div className={`flex-1 overflow-y-auto scrollbar-hide ${showRightPanel && mode === 'EDIT' ? 'md:border-r border-zinc-200 dark:border-zinc-800' : ''}`}>
                
                {mode === 'VIEW' && initialPolicy && (
                    <ReadOnlyView 
                        policy={initialPolicy} 
                        client={selectedClient} 
                        onEdit={handleEditClick} 
                        onAction={handleSmartAction}
                    />
                )}

                {mode === 'EDIT' && (
                    <div className="p-8 space-y-8">
                        
                        {/* 1. STRATEGIA (PLANOWANIE) - Widoczne dla Leadów/Ofert */}
                        {isOffer && (
                            <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-3xl border border-amber-100 dark:border-amber-800/30 shadow-sm relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                                    <Target size={100} />
                                </div>
                                <h4 className="text-sm font-black uppercase text-amber-700 dark:text-amber-500 mb-4 flex items-center gap-2 relative z-10">
                                    <Target size={18} /> Strategia Ofertowa
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                    <div>
                                        <label className={LABEL_CLASS}>Termin (Przypomnienie)</label>
                                        <div className="flex gap-2 mb-2">
                                            <button type="button" onClick={() => handleQuickPlan(1)} className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 hover:bg-amber-50">+1 Dzień</button>
                                            <button type="button" onClick={() => handleQuickPlan(3)} className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 hover:bg-amber-50">+3 Dni</button>
                                            <button type="button" onClick={() => handleQuickPlan(7)} className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 hover:bg-amber-50">+Tydzień</button>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="date" 
                                                {...register('nextContactDate')}
                                                className={STANDARD_INPUT_CLASS} 
                                                onClick={(e) => e.currentTarget.showPicker()}
                                            />
                                            <CalendarIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"/>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className={LABEL_CLASS}>Gdzie Ofertujemy? (Cele)</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {targetInsurers.map((tu: string) => (
                                                <button 
                                                    key={tu}
                                                    type="button" 
                                                    onClick={() => toggleTargetInsurer(tu)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all bg-amber-500 border-amber-500 text-white`}
                                                >
                                                    {tu}
                                                </button>
                                            ))}
                                        </div>
                                        {/* ADD NEW TARGET */}
                                        <div className="flex gap-2">
                                            <InsurerSelect 
                                                value={newTargetInput}
                                                onChange={(val) => {
                                                    setNewTargetInput('');
                                                    toggleTargetInsurer(val);
                                                }}
                                                activeList={sortedInsurers}
                                                placeholder="+ Dodaj cel..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* WHAT NEXT ACTIONS (ONLY IF CALCS EXIST) */}
                                {calculations.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-amber-200/50 flex items-center justify-between animate-in fade-in">
                                        <span className="text-[10px] font-bold uppercase text-amber-700">Co dalej?</span>
                                        <div className="flex gap-2">
                                            {selectedClient?.phones[0] && (
                                                <a href={`tel:${selectedClient.phones[0]}`} className="flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 rounded-lg text-[10px] font-black uppercase border border-blue-200 hover:bg-blue-50 transition-all">
                                                    <Phone size={12} /> Zadzwoń
                                                </a>
                                            )}
                                            {selectedClient?.emails[0] && (
                                                <a href={`mailto:${selectedClient.emails[0]}`} className="flex items-center gap-1 px-3 py-1.5 bg-white text-purple-600 rounded-lg text-[10px] font-black uppercase border border-purple-200 hover:bg-purple-50 transition-all">
                                                    <Mail size={12} /> Wyślij
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. CLIENT SELECTOR (IF NEW) */}
                        {!selectedClient && (
                            <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border-2 border-red-100 dark:border-red-900/30 animate-pulse">
                                <h4 className="text-sm font-black uppercase text-red-600 mb-3 flex items-center gap-2">
                                    <AlertCircle size={18} /> Krok 1: Wybierz Klienta
                                </h4>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Szukaj: Nazwisko, PESEL..." 
                                            className={`${STANDARD_INPUT_CLASS} pl-12 pr-10 py-4 text-lg`} 
                                            value={searchClientTerm} 
                                            onChange={e => {
                                                setSearchClientTerm(e.target.value);
                                                setIsClientDropdownOpen(true);
                                            }}
                                            onClick={() => setIsClientDropdownOpen(true)}
                                            autoFocus
                                        />
                                        {/* DROPDOWN TOGGLE BUTTON */}
                                        <button 
                                            type="button"
                                            onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-all"
                                        >
                                            <ChevronDown size={20} className={`transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`}/>
                                        </button>

                                        {/* RESULTS DROPDOWN */}
                                        {isClientDropdownOpen && filteredClients.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 border-2 border-zinc-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto scrollbar-hide animate-in fade-in zoom-in-95 duration-100">
                                                {filteredClients.map(c => (
                                                    <button 
                                                        key={c.id} 
                                                        onClick={() => { setSelectedClient(c); setSearchClientTerm(''); setIsClientDropdownOpen(false); }} 
                                                        className="w-full text-left px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center group"
                                                    >
                                                        <span className="font-bold text-base text-zinc-900 dark:text-white">{c.lastName} {c.firstName}</span>
                                                        <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded text-zinc-500">{c.pesel}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {isClientDropdownOpen && filteredClients.length === 0 && searchClientTerm && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 border-2 border-zinc-200 rounded-2xl shadow-2xl z-50 p-4 text-center text-zinc-400 font-bold text-xs uppercase">
                                                Brak wyników
                                            </div>
                                        )}
                                    </div>
                                    {onAddNewClient && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsClientDropdownOpen(false); // Hide dropdown
                                                onAddNewClient();
                                            }}
                                            className="bg-red-600 text-white px-6 rounded-2xl font-black uppercase text-xs flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg whitespace-nowrap"
                                        >
                                            <UserPlus size={18} /> Nowy
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ASSET INTELLIGENCE PICKER (NEW) */}
                        {selectedClient && clientAssets.length > 0 && !initialPolicy && !renewalSource && (
                            <AssetPicker assets={clientAssets} onSelect={handleAssetPick} />
                        )}

                        {/* 3. STATUS & TYPE */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <div>
                                <label className={LABEL_CLASS}>Etap Sprzedaży</label>
                                <select {...register('stage')} className={STANDARD_SELECT_CLASS}>
                                    <option value="of_do zrobienia">1. Do zrobienia (Lead)</option>
                                    <option value="przeł kontakt">2. W toku / Kalkulacja</option>
                                    <option value="czekam na dane/dokum">3. Czekam na Dane</option>
                                    <option value="oferta_wysłana">4. Oferta Wysłana</option>
                                    <option value="sprzedaż">5. Sprzedaż (Polisa)</option>
                                    <option value="ucięty kontakt">6. Odrzucona</option>
                                    <option value="rez po ofercie_kont za rok">7. Chłodnia (Za rok)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className={LABEL_CLASS}>Produkt (Kategoria)</label>
                                <div className="flex flex-wrap gap-2">
                                    {POLICY_CATEGORIES.map(cat => (
                                        <button 
                                            type="button"
                                            key={cat.value} 
                                            onClick={() => setValue('type', cat.value)}
                                            className={`p-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all flex-1 min-w-[60px] ${currentType === cat.value ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-400'}`}
                                        >
                                            {cat.label.replace('AUTO ','').replace(' / MIESZKANIE','').replace(' / ZDROWIE','')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 4. SOURCE DATA AI HELPER */}
                        {initialPolicy?.originalProductString && !sourceVerified && (
                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 relative animate-in fade-in">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-[10px] font-black uppercase text-indigo-500 flex items-center gap-2"><Database size={12} /> Dane Źródłowe</p>
                                    <div className="flex gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => setSourceVerified(true)}
                                            className="bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1 hover:bg-indigo-200 transition-colors"
                                        >
                                            <CheckCircle2 size={12} /> Oznacz jako zweryfikowane
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={handleOpenAgent}
                                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1 hover:bg-indigo-700 transition-colors shadow-sm"
                                        >
                                            <Bot size={12} /> Napraw z AI
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs font-mono text-indigo-900 font-bold leading-relaxed bg-white/50 p-2 rounded">{initialPolicy.originalProductString}</p>
                            </div>
                        )}

                        {/* 5. DEDICATED FORM RENDERER */}
                        <div className="bg-white dark:bg-zinc-900">
                            {['OC', 'AC', 'BOTH'].includes(currentType) && <AutoForm form={form} policyType={currentType} aiDiffs={aiDiffs} />}
                            {currentType === 'DOM' && <HomeForm form={form} />}
                            {currentType === 'ZYCIE' && <LifeForm form={form} />}
                            {currentType === 'PODROZ' && <TravelForm form={form} />} 
                            {['FIRMA', 'INNE'].includes(currentType) && <OtherForm form={form} type={currentType} />}
                        </div>

                        {/* 6. HISTORY & RENEWAL DATA (NEW SECTION) */}
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                            <p className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 mb-4 tracking-widest flex items-center gap-2">
                                <History size={16} /> Historia Ubezpieczenia (Dla Wypowiedzenia)
                            </p>
                            
                            {/* ASSET TIMELINE (NEW VISUALIZATION) */}
                            {assetHistory.length > 0 && (
                                <div className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-2xl shadow-sm">
                                    <p className="text-[9px] font-bold uppercase text-zinc-400 mb-2">Znane polisy dla tego przedmiotu:</p>
                                    <div className="space-y-2">
                                        {assetHistory.map(p => {
                                            const isSold = p.stage === 'sprzedaż' || p.stage === 'sprzedany';
                                            const isCurrent = p.id === initialPolicy?.id;
                                            
                                            // Check if active (not expired)
                                            const now = new Date();
                                            const end = new Date(p.policyEndDate);
                                            const isActive = end > now && isSold;
                                            const daysLeft = differenceInDays(end, now);

                                            return (
                                                <div key={p.id} className={`flex justify-between items-center text-xs p-2 rounded-lg border ${isCurrent ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {isActive && !isCurrent && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Aktywna polisa"></div>}
                                                        <div>
                                                            <span className="font-bold text-zinc-700 dark:text-zinc-300">{p.insurerName}</span>
                                                            <span className="text-zinc-400 mx-2">|</span>
                                                            <span className="font-mono text-zinc-500">{format(new Date(p.policyEndDate), 'dd.MM.yyyy')}</span>
                                                            {isActive && daysLeft < 30 && <span className="ml-2 text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded">Ważna {daysLeft} dni!</span>}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded ${isCurrent ? 'bg-blue-100 text-blue-700' : (isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500')}`}>
                                                        {isCurrent ? 'EDYTOWANA' : (isSold ? 'SPRZEDANA' : 'OFERTA')}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className={LABEL_CLASS}>Poprzedni Ubezpieczyciel</label>
                                    <InsurerSelect 
                                        value={watch('oldInsurerName')} 
                                        onChange={(val) => setValue('oldInsurerName', val)} 
                                        activeList={activeInsurersList} // Fix: Changed prop name
                                        placeholder="Wybierz TU z poprzedniej polisy..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={LABEL_CLASS}>Nr Poprzedniej Polisy</label>
                                        <input 
                                            {...register('oldPolicyNumber')} 
                                            className={STANDARD_INPUT_CLASS} 
                                            placeholder="np. 123456789" 
                                        />
                                    </div>
                                    <div>
                                        <label className={LABEL_CLASS}>Poprzednia Składka</label>
                                        <input 
                                            type="number" 
                                            {...register('oldPremium')} 
                                            className={STANDARD_INPUT_CLASS} 
                                            placeholder="0 PLN" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 7. BASIC FINANCE (Always visible on bottom left) */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800/30">
                            <p className="text-[10px] font-black uppercase text-emerald-600 mb-4 tracking-widest flex items-center gap-2"><Banknote size={16} /> Podsumowanie Oferty</p>
                            
                            {/* OFFER BATTLE - Always show if isOffer OR has history of calculations */}
                            {(isOffer || calculations.length > 0) && (
                                <OfferComparator 
                                    calculations={calculations}
                                    onUpdate={(newCalcs) => setValue('calculations', newCalcs)}
                                    onSelect={handleCalcSelect}
                                    activeList={sortedInsurers}
                                    onAddInsurer={toggleTargetInsurer}
                                />
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className={LABEL_CLASS}>Wybrana Oferta (Finalna)</label>
                                    <InsurerSelect 
                                        value={watch('insurerName')} 
                                        onChange={(val) => setValue('insurerName', val)} 
                                        activeList={sortedInsurers} // USE SMART SORTED LIST
                                    />
                                    
                                    {/* Previous Policy Link */}
                                    {availablePreviousPolicies.length > 0 && (
                                        <div className="mt-2">
                                            <label className="text-[9px] font-black uppercase text-zinc-400 pl-2 flex items-center gap-1"><LinkIcon size={10}/> Wznowienie / Kontynuacja</label>
                                            <select {...register('previousPolicyId')} className={`${STANDARD_SELECT_CLASS} text-xs py-1.5 mt-1 border-dashed`}>
                                                <option value="">-- Brak / Nowa Polisa --</option>
                                                {availablePreviousPolicies.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.vehicleBrand || p.type} ({p.insurerName} - {format(new Date(p.policyEndDate), 'dd.MM.yyyy')})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Policy Number Field - Added Here */}
                                    <div>
                                        <label className={LABEL_CLASS}>
                                            Numer Polisy {currentStage === 'sprzedaż' && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            {...register('policyNumber', { required: currentStage === 'sprzedaż' })}
                                            className={`${STANDARD_INPUT_CLASS} font-mono uppercase`}
                                            placeholder="np. POL/12345"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-zinc-500 mb-1 block pl-2">Składka Roczna (PLN)</label>
                                        <input type="number" step="0.01" {...register('premium')} className={`${STANDARD_INPUT_CLASS} text-emerald-600 font-black text-lg`} placeholder="0.00" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={LABEL_CLASS}>Start Ochrony</label>
                                        <input type="date" {...register('policyStartDate')} className={STANDARD_INPUT_CLASS} onClick={(e) => e.currentTarget.showPicker()} />
                                    </div>
                                    <div>
                                        <label className={LABEL_CLASS}>Koniec Ochrony</label>
                                        <input type="date" {...register('policyEndDate')} className={STANDARD_INPUT_CLASS} onClick={(e) => e.currentTarget.showPicker()} />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* RIGHT COLUMN: NOTES, FINANCE & CHECKLISTS */}
            {mode === 'EDIT' && showRightPanel && (
                <div className="w-full md:w-[450px] lg:w-[500px] bg-zinc-50/80 dark:bg-zinc-950/50 overflow-y-auto scrollbar-hide border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right-4 duration-300">
                    <div className="p-8 space-y-8">
                        
                        {/* 0. NOTES WIDGET (NEW!) */}
                        {initialPolicy && selectedClient && (
                            <PolicyNotesWidget 
                                policyId={initialPolicy.id} 
                                clientId={selectedClient.id} 
                                notes={notes}
                            />
                        )}

                        {/* 1. COMMISSION */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 text-zinc-400">
                                <Calculator size={16} />
                                <span className="text-xs font-black uppercase tracking-widest">Kalkulator Prowizji</span>
                            </div>
                            <CommissionCalculator 
                                premium={parseFloat(watch('premium')) || 0} 
                                commission={parseFloat(watch('commission')) || 0} 
                                commissionRate={parseFloat(watch('commissionRate')) || 0} 
                                subAgentSplits={watch('subAgentSplits') || []} 
                                currentPolicyType={currentType} 
                                onUpdate={(data) => { 
                                    setValue('premium', data.premium); 
                                    setValue('commission', data.commission); 
                                    setValue('commissionRate', data.commissionRate); 
                                    setValue('subAgentSplits', data.subAgentSplits); 
                                }} 
                            />
                        </div>

                        {/* 2. CHECKLISTS */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 text-zinc-400">
                                <ListChecks size={16} />
                                <span className="text-xs font-black uppercase tracking-widest">Wymagane Dokumenty</span>
                            </div>
                            <ComplianceChecklist 
                                type={currentType} 
                                values={watch('checklist') || {}} 
                                onChange={(id, val) => setValue(`checklist.${id}`, val)} 
                            />
                        </div>
                    </div>
                </div>
            )}

        </div>

        {/* FOOTER */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
                {selectedClient && (
                    <button 
                        type="button"
                        onClick={() => {
                            if (onOpenProfile) onOpenProfile(selectedClient, initialPolicy?.id);
                            onClose(); 
                        }}
                        className="group flex items-center gap-3 px-4 py-2 rounded-xl transition-all hover:bg-zinc-50"
                    >
                        <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-black">
                            {selectedClient.lastName[0]}
                        </div>
                        <div className="text-left">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase block">Klient</span>
                            <span className="text-xs font-black text-zinc-900 dark:text-white group-hover:underline decoration-2">
                                {selectedClient.firstName} {selectedClient.lastName} <ExternalLink size={10} className="inline opacity-50"/>
                            </span>
                        </div>
                    </button>
                )}
            </div>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-8 py-4 rounded-xl text-xs font-black uppercase text-zinc-500 hover:bg-zinc-100 transition-all">
                    Anuluj
                </button>
                {mode === 'EDIT' && (
                    <button 
                        onClick={handleSubmit(handlePreSubmit)} 
                        disabled={!selectedClient || isSaving} 
                        className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-10 py-4 rounded-xl text-xs font-black uppercase flex items-center gap-3 shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" /> Przetwarzanie...
                            </>
                        ) : (
                            <>
                                {isRenewalMode ? <Copy size={18} /> : <Save size={18} />} 
                                {isRenewalMode ? 'Utwórz Ofertę Wznowienia' : (isOffer ? 'Zapisz Ofertę' : 'Zatwierdź Polisę')}
                            </>
                        )}
                    </button>
                )}
            </div>

      </div>
      </div>
    </div>
  );
};
