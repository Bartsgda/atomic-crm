
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, Policy, ClientNote, TerminationRecord, PolicyType, SalesStage } from '../types';
import { 
  Car, Home, Heart, Briefcase, Phone, MapPin, ArrowLeft, Trash2, 
  Plane, Link as LinkIcon, PlusCircle, FileText, Building2, Mail, 
  X, ShieldCheck, CheckCircle2, AlertCircle, FilterX, AlertTriangle, 
  Calendar, Zap, Wallet, Crown, History, Printer, BrickWall, Flame, Waves, Umbrella, AlertOctagon,
  ArrowRight, Edit, Settings, Eye, Calculator, MoreHorizontal, Truck, Bike, Tractor, Bus, Container, Search, Lock, RefreshCcw, Users,
  MailCheck, MailWarning, ArrowUpDown, Clock, Copy, StickyNote
} from 'lucide-react';
import { differenceInDays, format, isAfter } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import { Notatki } from './Notatki';
import { storage } from '../services/storage';
import { DeleteSafetyButton } from './DeleteSafetyButton';
import { TerminationFormModal } from './TerminationFormModal';
import { PolicyFormModal } from './PolicyFormModal';
import { ApkGenerator } from './ApkGenerator';
import { ClientFormModal } from './ClientFormModal';
import { STATUS_CONFIG } from '../constants';
import { DraggablePanel } from './Tools/DraggablePanel';

interface Props {
  client: Client;
  policies: Policy[];
  notes: ClientNote[];
  terminations: TerminationRecord[];
  onNavigate: (page: string, data?: any) => void;
  onDeletePolicy: (id: string) => void;
  onUpdatePolicy: (policy: Policy) => void;
  onAddNote: (note: ClientNote) => void;
  onUpdateNote?: (note: ClientNote) => void;
  onDeleteNote: (id: string) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onRefresh: () => void;

  resumeNoteId?: string | null;
  highlightPolicyId?: string | null;
  autoOpenPolicyId?: string | null; 
}

const generateTrId = () => `wypow_${Date.now().toString().slice(-8)}`;

// Helper Components
const StatBadge = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${color} bg-white dark:bg-zinc-900 shadow-sm`}>
        <div className={`p-2 rounded-xl ${color.replace('border', 'bg').replace('-200', '-50')} dark:bg-opacity-20`}>
            <Icon size={16} className={color.replace('border-', 'text-').replace('-200', '-600')} />
        </div>
        <div>
            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">{label}</p>
            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 leading-none">{value}</p>
        </div>
    </div>
);

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <Icon size={14} className="text-zinc-400" />
        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{title}</h4>
    </div>
);

// --- NEW REDESIGNED POLICY CARD (PRODUCT CENTER STYLE) ---
const PolicyCardItem = ({ policy, client, statusConfig, isFiltered, isHovered, daysToExpiry, onClick, onEdit, onAction, onToggleDocs, onDoubleClick }: any) => {
    let TypeIcon = FileText;
    
    let rawTitle = policy.originalProductString || '';
    let mainTitle = rawTitle || policy.vehicleBrand || policy.type;
    let subTitle = policy.vehicleReg || policy.policyNumber;
    let badgeText = policy.vehicleReg;

    if (['OC', 'AC', 'BOTH'].includes(policy.type)) {
        TypeIcon = Car;
        if (policy.autoDetails?.vehicleType === 'CIEZAROWY') TypeIcon = Truck;
        if (policy.autoDetails?.vehicleType === 'MOTOCYKL') TypeIcon = Bike;
        if (policy.autoDetails?.vehicleType === 'CIAGNIK') TypeIcon = Tractor;
        if (policy.autoDetails?.vehicleType === 'AUTOBUS') TypeIcon = Bus;
        if (policy.autoDetails?.vehicleType === 'PRZYCZEPA') TypeIcon = Container;

        badgeText = policy.vehicleReg || 'BRAK REJ';
    } else if (policy.type === 'DOM') {
        TypeIcon = Home;
        subTitle = policy.propertyAddress;
        badgeText = policy.propertyAddress ? policy.propertyAddress.split(',')[0] : 'ADRES';
    } else if (policy.type === 'ZYCIE') {
        TypeIcon = Heart;
        badgeText = 'POLISA ŻYCIE';
    } else if (policy.type === 'PODROZ') {
        TypeIcon = Plane;
        badgeText = policy.destinationCountry || 'ŚWIAT';
    }

    const isSold = policy.stage === 'sprzedaż' || policy.stage === 'sprzedany';
    const areDocsSent = policy.documentsStatus === 'WYSŁANO';

    // UNIFIED LIST: Co-Owners (Auto/Home) + Participants (Travel)
    const coOwners = [
        ...(policy.autoDetails?.coOwners || []),
        ...(policy.homeDetails?.coOwners || []),
        // Map travel participants to match structure { name: ... }
        ...(policy.travelDetails?.participants?.map((p: any) => ({ name: p.fullName })) || [])
    ];

    // Renewal Badge Logic
    let renewalBadge = null;
    if (isSold && daysToExpiry !== undefined) {
        if (daysToExpiry < 0) {
            renewalBadge = <span className="text-[9px] font-black text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">PO TERMINIE ({Math.abs(daysToExpiry)} dni)</span>;
        } else if (daysToExpiry <= 30) {
            renewalBadge = <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 animate-pulse">ZA {daysToExpiry} DNI</span>;
        } else if (daysToExpiry <= 60) {
            renewalBadge = <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">ZA {daysToExpiry} DNI</span>;
        }
    }

    return (
        <div 
            onClick={onClick}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick();
            }}
            className={`group relative bg-white dark:bg-zinc-900 border rounded-[1.5rem] transition-all duration-300 overflow-hidden cursor-pointer select-none
                ${isFiltered ? 'border-red-500 ring-4 ring-red-50 dark:ring-red-900/20 shadow-xl' : (isHovered ? 'border-red-300 shadow-xl scale-[1.01]' : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300')}
            `}
            title="Kliknij 1x aby filtrować notatki, 2x aby edytować"
        >
            <div className="p-5 pb-3 flex justify-between items-start">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${isFiltered ? 'bg-red-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <TypeIcon size={20} />
                </div>
                
                {isSold ? (
                    <div className="text-right">
                        <span className="block text-[14px] font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                            {policy.premium ? `${policy.premium.toLocaleString()} PLN` : '0 PLN'}
                        </span>
                        <span className="text-[8px] font-bold text-zinc-400 uppercase">Składka roczna</span>
                    </div>
                ) : (
                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${statusConfig.color} ${statusConfig.bg} border ${statusConfig.border}`}>
                        {statusConfig.label}
                    </div>
                )}
            </div>

            <div className="px-5 pb-4">
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white leading-tight truncate mb-1 pr-2" title={mainTitle}>
                        {mainTitle}
                    </h3>
                    {renewalBadge}
                </div>
                
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded truncate max-w-[150px]">
                        {badgeText}
                    </span>
                    {policy.isTerminationSent && (
                        <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 size={10} /> WYPOWIEDZIANE
                        </span>
                    )}
                </div>

                {coOwners.length > 0 && (
                    <div className="mb-3 space-y-1">
                        {coOwners.map((owner: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-lg w-fit border border-purple-100 dark:border-purple-800">
                                <Users size={10} /> 
                                <span className="truncate max-w-[180px]">{owner.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-zinc-50 dark:border-zinc-800">
                    <div>
                        <p className="text-[9px] font-black uppercase text-zinc-400">Towarzystwo</p>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{policy.insurerName}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-zinc-400">Koniec</p>
                        <p className={`text-xs font-bold ${daysToExpiry < 14 ? 'text-red-600' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {format(new Date(policy.policyEndDate), 'dd.MM.yyyy')}
                        </p>
                    </div>
                </div>
            </div>

            {isSold && (
                <div className="px-3 pb-3">
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-1 grid grid-cols-2 gap-1 border border-zinc-100 dark:border-zinc-800">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleDocs(policy); }}
                            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                areDocsSent 
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                                : 'bg-white dark:bg-zinc-800 text-zinc-400 hover:text-red-500 border border-zinc-100 dark:border-zinc-700'
                            }`}
                            title={areDocsSent ? "Dokumenty wysłane do klienta" : "Oznacz jako wysłane"}
                        >
                            {areDocsSent ? <MailCheck size={14}/> : <MailWarning size={14}/>}
                            {areDocsSent ? 'WYSŁANO' : 'WYŚLIJ DOKI'}
                        </button>

                        <div className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase ${
                            policy.paymentStatus === 'PAID'
                            ? 'text-zinc-400'
                            : 'text-red-600'
                        }`}>
                            {policy.paymentStatus === 'PAID' ? 'Opłacona' : 'Nieopłacona'}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 p-2 grid grid-cols-3 gap-2 rounded-b-[1.5rem]">
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 transition-colors group/btn"
                    title="Edytuj i zobacz szczegóły"
                >
                    <Eye size={16} className="group-hover/btn:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-tight">Pełne Info</span>
                </button>
                
                {isSold ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAction('clone_renewal', policy); }}
                        className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-blue-50/50 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors group/btn border border-blue-100 dark:border-blue-900/30"
                        title="Przygotuj ofertę wznowienia na kolejny rok"
                    >
                        <RefreshCcw size={16} className="group-hover/btn:rotate-180 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-tight">Wznowienie</span>
                    </button>
                ) : (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-zinc-500 hover:text-amber-600 transition-colors group/btn"
                        title="Kalkulacje i Oferty"
                    >
                        <Calculator size={16} className="group-hover/btn:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-tight">Kalkulacja</span>
                    </button>
                )}

                <button 
                    onClick={(e) => { e.stopPropagation(); onAction('apk', policy); }}
                    className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-zinc-500 hover:text-emerald-600 transition-colors group/btn"
                    title="Dokumenty (APK, Wypowiedzenia)"
                >
                    <Printer size={16} className="group-hover/btn:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-tight">Dokumenty</span>
                </button>
            </div>
        </div>
    );
};

export const ClientDetails: React.FC<Props> = ({ client, policies, notes, terminations, onNavigate, onDeletePolicy, onUpdatePolicy, onAddNote, onUpdateNote, onDeleteNote, onUpdateClient, onDeleteClient, onRefresh, resumeNoteId, highlightPolicyId, autoOpenPolicyId }) => {

  const [hoveredPolicyId, setHoveredPolicyId] = useState<string | null>(null);
  const [hoveredNoteIds, setHoveredNoteIds] = useState<string[]>([]);
  const [pendingPolicyLinks, setPendingPolicyLinks] = useState<string[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [renewalSourcePolicy, setRenewalSourcePolicy] = useState<Policy | null>(null); // NEW: For cloning
  const [filterPolicyId, setFilterPolicyId] = useState<string | null>(null);
  const [terminationModalPolicy, setTerminationModalPolicy] = useState<Policy | null>(null);
  const [isAddPolicyModalOpen, setIsAddPolicyModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false); 
  const [showApkGenerator, setShowApkGenerator] = useState<Policy | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  
  // NEW: Sort Toggle State (Default: True = Nearest Renewal First)
  const [sortByRenewal, setSortByRenewal] = useState(true);
  
  const policyRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const clientPolicies = useMemo(() => policies.filter(p => p.clientId === client.id), [policies, client.id]);
  
  // Separate into Pipeline (Offers) and Wallet (Sold/Old)
  const pipeline = useMemo(() => clientPolicies.filter(p => [
      'of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt', 
      'czekam na dane/dokum', 'of_przedst'
  ].includes(p.stage)), [clientPolicies]);
  
  const wallet = useMemo(() => clientPolicies.filter(p => !['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt', 'czekam na dane/dokum', 'of_przedst'].includes(p.stage)), [clientPolicies]);

  const showSearch = (pipeline.length + wallet.length) > 5;

  // Sorting Helper
  const sortPolicies = (pols: Policy[]) => {
      if (sortByRenewal) {
          // Najbliższy koniec polisy na górze
          return [...pols].sort((a,b) => new Date(a.policyEndDate).getTime() - new Date(b.policyEndDate).getTime());
      } else {
          // Standardowo: Najnowsze dodane na górze
          return [...pols].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
  };

  const filteredWallet = useMemo(() => {
      let res = wallet;
      if (productSearchTerm) {
          const term = productSearchTerm.toLowerCase();
          res = res.filter(p => 
              (p.vehicleBrand || '').toLowerCase().includes(term) ||
              (p.vehicleReg || '').toLowerCase().includes(term) ||
              (p.type || '').toLowerCase().includes(term) ||
              (p.insurerName || '').toLowerCase().includes(term) ||
              (p.originalProductString || '').toLowerCase().includes(term)
          );
      }
      return sortPolicies(res);
  }, [wallet, productSearchTerm, sortByRenewal]);

  const filteredPipeline = useMemo(() => {
      let res = pipeline;
      if (productSearchTerm) {
          const term = productSearchTerm.toLowerCase();
          res = res.filter(p => 
              (p.vehicleBrand || '').toLowerCase().includes(term) ||
              (p.vehicleReg || '').toLowerCase().includes(term) ||
              (p.type || '').toLowerCase().includes(term) ||
              (p.originalProductString || '').toLowerCase().includes(term)
          );
      }
      // Pipeline is usually sorted by creation (newest opportunities), but user might want to see expiring leads
      return [...res].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pipeline, productSearchTerm]);

  const totalPremium = wallet.filter(p => p.stage === 'sprzedaż' || p.stage === 'sprzedany').reduce((acc, p) => acc + p.premium, 0);
  const activeCount = wallet.filter(p => !['rez po ofercie_kont za rok'].includes(p.stage)).length;
  const isVip = totalPremium > 3000;

  useEffect(() => {
    if (autoOpenPolicyId && policies.length > 0) {
        const target = policies.find(p => p.id === autoOpenPolicyId);
        if (target) {
            setSelectedPolicy(target);
            setHoveredPolicyId(autoOpenPolicyId);
            setTimeout(() => {
                const el = policyRefs.current[autoOpenPolicyId];
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    } 
    else if (highlightPolicyId) {
        setFilterPolicyId(highlightPolicyId);
        setTimeout(() => {
            const el = policyRefs.current[highlightPolicyId];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHoveredPolicyId(highlightPolicyId);
                setTimeout(() => setHoveredPolicyId(null), 3000);
            }
        }, 400);
    }
  }, [highlightPolicyId, autoOpenPolicyId, policies]);

  const filteredNotes = useMemo(() => {
    const baseNotes = (notes || []).filter(n => n.clientId === client.id);
    if (!filterPolicyId) return baseNotes;
    return baseNotes.filter(n => n.linkedPolicyIds?.includes(filterPolicyId));
  }, [notes, client.id, filterPolicyId]);

  const handleRegisterTermination = async (policy: Policy, actualDate: string) => {
    const trId = generateTrId();
    const record: TerminationRecord = {
        id: trId,
        clientId: client.id,
        clientName: `${client.lastName} ${client.firstName}`,
        policyId: policy.id,
        policyType: policy.type,
        itemDescription: `${policy.vehicleBrand || policy.type} ${policy.vehicleReg || ''}`.trim(),
        sentAt: new Date().toISOString(),
        actualDate: actualDate
    };
    await storage.addTerminationRecord(record);
    
    const noteId = `sys_term_${Date.now()}`;
    const newNote = {
        id: noteId,
        clientId: client.id,
        content: `[STATUS] Wypowiedzenie zarejestrowane. Data pisma: ${actualDate}. ID: ${trId}`,
        tag: 'STATUS' as any,
        createdAt: new Date().toISOString(),
        linkedPolicyIds: [policy.id]
    };
    await storage.addNote(newNote);
    onAddNote(newNote); 

    onUpdatePolicy({ ...policy, isTerminationSent: true, terminationId: trId });
    setTerminationModalPolicy(null);
  };

  const handlePolicyAction = (action: string, policy: Policy) => {
      if (action === 'apk') setShowApkGenerator(policy);
      if (action === 'link') setPendingPolicyLinks(prev => [...prev, policy.id]);
      if (action === 'termination') setTerminationModalPolicy(policy);
      if (action === 'clone_renewal') setRenewalSourcePolicy(policy); // NEW: TRIGGER CLONE
  };

  const handleToggleDocs = async (policy: Policy) => {
      const newStatus = policy.documentsStatus === 'WYSŁANO' ? '' : 'WYSŁANO';
      const updated = { ...policy, documentsStatus: newStatus };
      await storage.updatePolicy(updated);
      onUpdatePolicy(updated);
  };

  const handleEditPolicy = (policy: Policy) => {
      setSelectedPolicy(policy);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-900 font-sans overflow-hidden">
      
      {/* --- HEADER --- */}
      <header className="flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-20 sticky top-0 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto w-full">
            <div className="flex items-center gap-6">
                <button onClick={() => onNavigate('clients')} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                    <ArrowLeft size={20} />
                </button>
                
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg relative ${isVip ? 'bg-zinc-900 text-amber-400 ring-2 ring-amber-400 ring-offset-2' : 'bg-zinc-100 text-zinc-500'}`}>
                        {(client.lastName || 'U')[0]}
                        {isVip && <div className="absolute -top-2 -right-2 bg-amber-400 text-zinc-900 p-1 rounded-full shadow-sm"><Crown size={12} fill="currentColor" /></div>}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-none flex items-center gap-2">
                                {client.lastName} {client.firstName}
                            </h1>
                            <button 
                                onClick={() => setIsEditClientModalOpen(true)}
                                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-colors"
                            >
                                <Settings size={12} /> Edytuj Dane
                            </button>
                            <DeleteSafetyButton 
                                onConfirm={() => onDeleteClient(client.id)}
                                label="Zarchiwizuj klienta"
                                iconSize={14}
                                className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-colors border border-red-100 dark:border-red-800/30"
                            />
                        </div>

                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold">{client.pesel || 'BRAK PESEL'}</span>
                            {isVip && <span className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded uppercase tracking-wider">Kluczowy Klient</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
                {client.phones?.[0] && (
                    <a href={`tel:${client.phones[0]}`} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-black text-xs uppercase hover:bg-blue-100 transition-all border border-blue-100 dark:border-blue-800">
                        <Phone size={14} /> {client.phones[0]}
                    </a>
                )}
                {client.emails?.[0] && (
                    <a href={`mailto:${client.emails[0]}`} className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-black text-xs uppercase hover:bg-zinc-100 transition-all border border-zinc-200 dark:border-zinc-700">
                        <Mail size={14} /> Wyślij E-mail
                    </a>
                )}
            </div>

            <div className="flex items-center gap-3">
                <StatBadge icon={Wallet} label="Suma Składek" value={`${totalPremium.toLocaleString()} PLN`} color={isVip ? 'border-amber-200 text-amber-700' : 'border-zinc-200 text-zinc-700'} />
                <StatBadge icon={ShieldCheck} label="Aktywne Polisy" value={activeCount.toString()} color="border-emerald-200 text-emerald-700" />
            </div>
        </div>
      </header>

      {/* --- MAIN GRID LAYOUT 1.5-7-3.5 --- */}
      <div 
        className="flex-1 overflow-hidden grid gap-0 min-h-0"
        style={{ gridTemplateColumns: '1.5fr 7fr 3.5fr' }}
      >
        
        {/* COLUMN 1: AKTA (CLIENT DNA) - 1.5/12 = 12.5% */}
        <aside className="hidden xl:flex flex-col bg-zinc-50/50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <div className="space-y-6">
                    <div>
                        <SectionHeader icon={Phone} title="Kontakty" />
                        <div className="space-y-2">
                            {client.phones?.map((p,i) => (
                                <div key={i} className="text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 flex justify-between">
                                    {p} <Phone size={10} className="text-zinc-300" />
                                </div>
                            ))}
                            {client.emails?.map((e,i) => (
                                <div key={i} className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 break-all flex justify-between">
                                    {e} <Mail size={10} className="text-zinc-300" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <SectionHeader icon={MapPin} title="Adres" />
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight">{client.street || 'Brak ulicy'}</p>
                            <p className="text-[10px] text-zinc-500 font-medium mt-1">{client.zipCode} {client.city}</p>
                        </div>
                    </div>

                    {/* BIO / NOTATKA O KLIENCIE (STICKY NOTE) */}
                    <div>
                        <SectionHeader icon={StickyNote} title="Notatka o Kliencie (Bio)" />
                        <div 
                            onClick={() => setIsEditClientModalOpen(true)}
                            className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800/30 shadow-sm relative group cursor-pointer hover:bg-yellow-100 transition-colors"
                        >
                            <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100 italic leading-relaxed whitespace-pre-wrap">
                                {client.notes || "Brak notatki o kliencie. Kliknij edycję aby dodać (np. 'Preferuje kontakt SMS', 'Lubi kawę')."}
                            </p>
                            <div className="absolute top-2 right-2 text-yellow-600 dark:text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit size={12} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <SectionHeader icon={Building2} title="Firma" />
                        {client.businesses && client.businesses.length > 0 ? client.businesses.map((b, i) => (
                            <div key={i} className="bg-zinc-900 text-white p-3 rounded-xl shadow-lg relative overflow-hidden group mb-2">
                                <div className="relative z-10">
                                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">NIP: {b.nip || '---'}</p>
                                    <p className="text-[10px] font-bold leading-tight">{b.name}</p>
                                </div>
                                <Building2 className="absolute -bottom-2 -right-2 text-zinc-800 w-12 h-12 group-hover:scale-110 transition-transform" />
                            </div>
                        )) : (
                            <div className="text-center py-2 border-2 border-dashed border-zinc-200 rounded-lg">
                                <p className="text-[9px] text-zinc-400 font-black uppercase">Prywatnie</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </aside>

        {/* COLUMN 2: OŚ CZASU (THE BRAIN) - 7/12 = 58.3% */}
        <main className="bg-white dark:bg-zinc-900 flex flex-col border-r border-zinc-200 dark:border-zinc-800 relative shadow-xl z-10 overflow-hidden">
            <div className="px-8 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur sticky top-0 z-20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <History size={16} className="text-red-600" />
                    <h2 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">
                        {filterPolicyId ? 'Historia Obiektu (Filtrowana)' : 'Oś Czasu (Wszystko)'}
                    </h2>
                </div>
                {filterPolicyId && (
                    <button onClick={() => setFilterPolicyId(null)} className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-3 py-1 rounded-lg hover:bg-red-100 transition-all flex items-center gap-2 animate-in fade-in">
                        <FilterX size={12} /> Pokaż Wszystko
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                <Notatki 
                    clientId={client.id}
                    notes={filteredNotes}
                    allPolicies={policies}
                    initialResumeId={resumeNoteId}
                    pendingPolicyLinks={pendingPolicyLinks}
                    activePolicyId={filterPolicyId} // NEW: PASS FILTERED POLICY AS DEFAULT TARGET
                    onClearPendingLinks={() => setPendingPolicyLinks([])}
                    onAddPendingLink={(id) => setPendingPolicyLinks(prev => prev.includes(id) ? prev : [...prev, id])}
                    onAddNote={onAddNote}
                    onUpdateNote={async (n) => { 
                        if (onUpdateNote) {
                            onUpdateNote(n);
                        } else {
                            await storage.updateNote(n); 
                        }
                    }}
                    onDeleteNote={onDeleteNote}
                    onHoverNote={(policyIds) => setHoveredPolicyId(policyIds?.[0] || null)}
                    highlightedIds={hoveredNoteIds}
                    onUpdatePolicy={onUpdatePolicy}
                />
            </div>
        </main>

        {/* COLUMN 3: PORTFEL (ASSETS) - 3.5/12 = 29.1% */}
        <aside className="bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-100/50 dark:bg-zinc-900">
                <div className="flex flex-col gap-2 w-full mr-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Briefcase size={14} /> Centrum Produktów
                        </h3>
                    </div>
                    {showSearch && (
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Szukaj w portfelu..." 
                                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:border-red-500 transition-all"
                                value={productSearchTerm}
                                onChange={(e) => setProductSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <button onClick={() => setIsAddPolicyModalOpen(true)} className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all flex-shrink-0">
                    <PlusCircle size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                
                {filteredPipeline.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest flex items-center gap-2">
                                <Zap size={12} /> Procesowane Oferty
                            </h4>
                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[9px] font-black px-2 py-0.5 rounded-md">{filteredPipeline.length}</span>
                        </div>
                        <div className="space-y-3">
                            {filteredPipeline.map(policy => (
                                <div key={policy.id} ref={el => { policyRefs.current[policy.id] = el; }}>
                                    <PolicyCardItem 
                                        policy={policy} 
                                        client={client}
                                        statusConfig={STATUS_CONFIG[policy.stage as SalesStage] || STATUS_CONFIG['inne']}
                                        isFiltered={filterPolicyId === policy.id}
                                        isHovered={hoveredPolicyId === policy.id}
                                        daysToExpiry={differenceInDays(new Date(policy.policyEndDate), new Date())}
                                        onMouseOver={() => {
                                            const relatedNotes = filteredNotes.filter(n => n.linkedPolicyIds?.includes(policy.id)).map(n => n.id);
                                            setHoveredNoteIds(relatedNotes);
                                        }}
                                        onMouseOut={() => setHoveredNoteIds([])}
                                        onClick={() => setFilterPolicyId(policy.id === filterPolicyId ? null : policy.id)}
                                        onDoubleClick={() => handleEditPolicy(policy)}
                                        onEdit={() => handleEditPolicy(policy)}
                                        onAction={handlePolicyAction}
                                        onToggleDocs={handleToggleDocs}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                                <ShieldCheck size={12} /> Historia i Polisy
                            </h4>
                            
                            {/* SORT TOGGLE */}
                            <button 
                                onClick={() => setSortByRenewal(!sortByRenewal)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-colors ${sortByRenewal ? 'bg-amber-100 text-amber-700' : 'bg-zinc-200 text-zinc-500'}`}
                                title={sortByRenewal ? "Sortowanie: Najbliższe wznowienie" : "Sortowanie: Data dodania"}
                            >
                                {sortByRenewal ? <Clock size={10} /> : <ArrowUpDown size={10} />}
                                {sortByRenewal ? "Wznowienia" : "Data dod."}
                            </button>
                        </div>
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-black px-2 py-0.5 rounded-md">{filteredWallet.length}</span>
                    </div>
                    <div className="space-y-3">
                        {filteredWallet.length > 0 ? filteredWallet.map(policy => (
                            <div key={policy.id} ref={el => { policyRefs.current[policy.id] = el; }}>
                                <PolicyCardItem 
                                    policy={policy} 
                                    client={client}
                                    statusConfig={STATUS_CONFIG[policy.stage as SalesStage] || STATUS_CONFIG['inne']}
                                    isFiltered={filterPolicyId === policy.id}
                                    isHovered={hoveredPolicyId === policy.id}
                                    daysToExpiry={differenceInDays(new Date(policy.policyEndDate), new Date())}
                                    onMouseOver={() => {
                                        const relatedNotes = filteredNotes.filter(n => n.linkedPolicyIds?.includes(policy.id)).map(n => n.id);
                                        setHoveredNoteIds(relatedNotes);
                                    }}
                                    onMouseOut={() => setHoveredNoteIds([])}
                                    onClick={() => setFilterPolicyId(policy.id === filterPolicyId ? null : policy.id)}
                                    onDoubleClick={() => handleEditPolicy(policy)}
                                    onEdit={() => handleEditPolicy(policy)}
                                    onAction={handlePolicyAction}
                                    onToggleDocs={handleToggleDocs}
                                />
                            </div>
                        )) : (
                            <div className="text-center py-12 opacity-40 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl">
                                <FileText size={48} className="mx-auto text-zinc-300 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Brak aktywnych polis</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </aside>
      </div>

      {terminationModalPolicy && (
          <TerminationFormModal 
            policy={terminationModalPolicy}
            client={client}
            onConfirm={(actualDate) => handleRegisterTermination(terminationModalPolicy, actualDate)}
            onCancel={() => setTerminationModalPolicy(null)}
          />
      )}

      {showApkGenerator && (
          <ApkGenerator 
            client={client} 
            policy={showApkGenerator} 
            onClose={() => setShowApkGenerator(null)} 
          />
      )}

      <PolicyFormModal 
        isOpen={isAddPolicyModalOpen}
        onClose={() => setIsAddPolicyModalOpen(false)}
        initialClient={client}
        existingPolicies={clientPolicies} 
        onSave={async (c, p) => {
            await storage.addPolicy(p);
            setIsAddPolicyModalOpen(false);
            onRefresh();
        }}
      />

      <ClientFormModal
        isOpen={isEditClientModalOpen}
        onClose={() => setIsEditClientModalOpen(false)}
        onSave={onUpdateClient}
        initialData={client}
      />

      {/* HANDLE CLONING / RENEWAL */}
      {renewalSourcePolicy && (
          <PolicyFormModal 
            isOpen={true}
            onClose={() => setRenewalSourcePolicy(null)}
            initialClient={client}
            initialPolicy={renewalSourcePolicy} // This acts as template
            initialType={renewalSourcePolicy.type}
            existingPolicies={clientPolicies}
            notes={notes}
            initialMode="EDIT"
            // NEW PROP: Tell modal this is a renewal clone
            renewalSource={renewalSourcePolicy}
            onSave={async (c, p) => {
                await storage.addPolicy(p); // Add as NEW, don't update old
                setRenewalSourcePolicy(null);
                onRefresh();
            }}
          />
      )}

      {selectedPolicy && !renewalSourcePolicy && (
        <PolicyFormModal
            isOpen={true}
            onClose={() => setSelectedPolicy(null)}
            initialClient={client}
            initialPolicy={selectedPolicy}
            initialType={selectedPolicy.type}
            existingPolicies={clientPolicies}
            notes={notes}
            initialMode="EDIT"
            onOpenProfile={() => { setFilterPolicyId(null); }}
            onSave={async (c, p) => {
                await storage.updatePolicy(p);
                setSelectedPolicy(null);
                onRefresh();
            }}
        />
      )}
    </div>
  );
};
