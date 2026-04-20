
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, PolicyType, SalesStage, Client, Policy, VehicleSubType, ClientNote } from '../types';
import { Search, Plus, Wallet, Zap, TrendingUp, SlidersHorizontal, ArrowRight, Car, Home, Heart, Plane, Building2, FileText, Truck, Bike, Tractor, Bus, Container, LayoutGrid, Gamepad2, Calendar, MailCheck, MailWarning, MessageSquare, Briefcase, Clock, CheckCircle2, Snowflake, Phone, Mail, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { format, differenceInDays, isWithinInterval, isValid, addDays, endOfMonth, endOfYear, addMonths } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import { AdvancedFilters } from './AdvancedFilters'; 
import { QuickViewDrawer } from './QuickViewDrawer';
import { STATUS_CONFIG } from '../constants';

interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
  onDeletePolicy: (id: string) => void;
  initialSearchTerm?: string;
  filterTypes?: PolicyType[];
  activeCategory?: string;
  categoryTitle?: string;
  sortByDate?: boolean;
  onImportComplete: () => void;
  isCompact?: boolean;
  onAddClient?: () => void; 
  predefinedDateRange?: string | null; 
}

const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const VEHICLE_TYPE_ICONS: Record<VehicleSubType, any> = {
    'OSOBOWY': Car,
    'CIEZAROWY': Truck,
    'MOTOCYKL': Bike,
    'QUAD': Gamepad2,
    'CIAGNIK': Tractor,
    'PRZYCZEPA': Container,
    'AUTOBUS': Bus,
    'FLOTA': LayoutGrid,
    'INNE': Car
};

// --- NOTES POPOVER COMPONENT ---
const NotesPopover = ({ notes, policyId, position }: { notes: ClientNote[], policyId: string, position: {x:number, y:number} }) => {
    // FILTER SYSTEM LOGS FROM POPOVER
    const policyNotes = notes
        .filter(n => n.linkedPolicyIds?.includes(policyId) && !n.content.startsWith('[SYSTEM') && n.tag !== 'AUDYT' && !(n.tag === 'STATUS' && n.content.includes('Zmiana etapu')))
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5); // Show more notes in popover since we have more context

    if (policyNotes.length === 0) return null;

    let left = position.x + 20;
    let top = position.y + 10;
    if (window.innerWidth - left < 320) left = position.x - 340;

    return (
        <div 
            style={{ left, top, position: 'fixed' }}
            className="z-[9999] w-96 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border-2 border-zinc-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200 pointer-events-none"
        >
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-t-xl flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                    <MessageSquare size={12} className="text-blue-500"/> Pełna Historia (Użytkownika)
                </span>
            </div>
            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                {policyNotes.map(note => (
                    <div key={note.id} className="text-[11px] p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700">
                        <div className="flex justify-between mb-1 opacity-50">
                            <span className="font-bold">{format(new Date(note.createdAt), 'dd.MM HH:mm')}</span>
                            <span className="uppercase text-[9px] font-black">{note.tag}</span>
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">{note.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Dashboard: React.FC<Props> = ({ state, onNavigate, onDeletePolicy, initialSearchTerm, filterTypes, activeCategory, categoryTitle, sortByDate, onImportComplete, isCompact = false, predefinedDateRange }) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [previewClient, setPreviewClient] = useState<Client | null>(null);
  const clickTimeoutRef = useRef<any>(null);
  const [activeSubType, setActiveSubType] = useState<VehicleSubType | null>(null);

  // --- SORTING STATE ---
  const [sortConfig, setSortConfig] = useState<{ key: 'endDate' | 'client' | 'premium' | 'status'; direction: 'asc' | 'desc' }>({
      key: 'endDate',
      direction: 'asc' // Default: Najbliższe końce
  });

  // --- HOVER STATE ---
  const [hoveredNoteData, setHoveredNoteData] = useState<{ policyId: string, pos: {x:number, y:number} } | null>(null);
  const hoverOpenTimer = useRef<any>(null);
  const hoverCloseTimer = useRef<any>(null);

  // --- FILTERS STATE (FLAT & EXPOSED) ---
  const [activeDatePreset, setActiveDatePreset] = useState<'THIS_MONTH' | 'PREV_MONTH' | 'THIS_YEAR' | 'ALL'>('THIS_MONTH'); // Default to This Month
  const [selectedStages, setSelectedStages] = useState<SalesStage[]>([]);
  const [selectedInsurers, setSelectedInsurers] = useState<string[]>([]);

  // --- DATE LOGIC ---
  const dateRange = useMemo(() => {
      const now = new Date();
      if (activeDatePreset === 'THIS_MONTH') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfMonth(now) };
      if (activeDatePreset === 'PREV_MONTH') {
          const prev = addMonths(now, -1);
          return { start: new Date(prev.getFullYear(), prev.getMonth(), 1), end: endOfMonth(prev) };
      }
      if (activeDatePreset === 'THIS_YEAR') return { start: new Date(now.getFullYear(), 0, 1), end: endOfYear(now) };
      return null; // ALL
  }, [activeDatePreset]);

  // --- HOVER HANDLERS ---
  const handleNoteEnter = (e: React.MouseEvent, policyId: string) => {
      const x = e.clientX;
      const y = e.clientY;
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);

      hoverOpenTimer.current = setTimeout(() => {
          setHoveredNoteData({ policyId, pos: { x, y } });
      }, 700); 
  };

  const handleNoteLeave = () => {
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      hoverCloseTimer.current = setTimeout(() => {
          setHoveredNoteData(null);
      }, 200);
  };

  const toggleStage = (stage: SalesStage) => {
      setSelectedStages(prev => prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]);
  };

  const handleSort = (key: 'endDate' | 'client' | 'premium' | 'status') => {
      if (sortConfig.key === key) {
          setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
      } else {
          setSortConfig({ key, direction: 'asc' });
      }
  };

  const getContextAction = () => {
      const category = activeCategory || 'all';
      switch (category) {
          case 'travel': return { label: 'Dodaj Wyjazd', icon: Plane, type: 'PODROZ' as PolicyType, color: 'bg-sky-600 hover:bg-sky-700 shadow-sky-900/30' };
          case 'property': return { label: 'Dodaj Nieruchomość', icon: Home, type: 'DOM' as PolicyType, color: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/30' };
          case 'life': return { label: 'Dodaj Życie', icon: Heart, type: 'ZYCIE' as PolicyType, color: 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/30' };
          case 'vehicles': return { label: 'Dodaj Pojazd', icon: Car, type: 'OC' as PolicyType, color: 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/30' };
          default: return { label: '+ DODAJ', icon: Plus, type: 'OC' as PolicyType, color: 'bg-zinc-900 dark:bg-zinc-700 hover:bg-black dark:hover:bg-zinc-600 shadow-zinc-900/20' };
      }
  };

  const contextAction = getContextAction();

  const stats = useMemo(() => {
    return state.policies.reduce((acc, p) => {
      const isSold = p.stage === 'sprzedaż' || p.stage === 'sprzedany'; 
      const isLead = ['of_do zrobienia', 'przeł kontakt', 'czekam na dane/dokum', 'of_przedst', 'oferta_wysłana'].includes(p.stage);
      const commission = isSold ? p.commission : 0;
      
      // Update stage counts
      const stageCounts = { ...acc.stageCounts };
      stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;

      return {
        totalPremium: acc.totalPremium + (isSold ? p.premium : 0),
        totalCommission: acc.totalCommission + commission,
        pendingOffers: acc.pendingOffers + (isLead ? 1 : 0),
        soldCount: acc.soldCount + (isSold ? 1 : 0),
        stageCounts
      };
    }, { totalPremium: 0, totalCommission: 0, pendingOffers: 0, soldCount: 0, stageCounts: {} as Record<string, number> });
  }, [state.policies]);

  const filteredAndSortedPolicies = useMemo(() => {
    const rawTerm = searchTerm.trim();
    const term = normalize(rawTerm);
    
    let relevantPolicies = [...state.policies];
    
    if (activeCategory === 'renewals') {
        relevantPolicies = relevantPolicies.filter(p => p.type !== 'PODROZ');
    }
    
    if (filterTypes) relevantPolicies = relevantPolicies.filter(p => filterTypes.includes(p.type));

    if (activeSubType) {
        relevantPolicies = relevantPolicies.filter(p => p.autoDetails?.vehicleType === activeSubType);
    }

    if (selectedInsurers.length > 0) relevantPolicies = relevantPolicies.filter(p => selectedInsurers.includes(p.insurerName));
    if (selectedStages.length > 0) relevantPolicies = relevantPolicies.filter(p => selectedStages.includes(p.stage));
    
    // UPDATED DATE LOGIC: Show if Expiring OR Created in range
    if (dateRange) {
        relevantPolicies = relevantPolicies.filter(p => {
            const endDate = new Date(p.policyEndDate);
            const createdDate = new Date(p.createdAt);

            const isRenewal = isValid(endDate) && isWithinInterval(endDate, dateRange);
            const isProduction = isValid(createdDate) && isWithinInterval(createdDate, dateRange);

            return isRenewal || isProduction;
        });
    }

    if (term) {
      relevantPolicies = relevantPolicies.filter(p => {
        const client = state.clients.find(c => c.id === p.clientId);
        const clientName = client ? normalize(`${client.firstName} ${client.lastName}`) : '';
        const original = p.originalProductString ? normalize(p.originalProductString) : '';
        
        return clientName.includes(term) || 
               normalize(p.vehicleReg).includes(term) || 
               normalize(p.policyNumber).includes(term) ||
               normalize(p.vehicleBrand).includes(term) ||
               original.includes(term) ||
               (client?.pesel || '').includes(term) ||
               normalize(p.propertyAddress || '').includes(term);
      });
    }

    // --- SORTING LOGIC ---
    relevantPolicies.sort((a, b) => {
        let valA: any, valB: any;

        switch (sortConfig.key) {
            case 'endDate':
                valA = new Date(a.policyEndDate).getTime();
                valB = new Date(b.policyEndDate).getTime();
                break;
            case 'premium':
                valA = a.premium;
                valB = b.premium;
                break;
            case 'status':
                valA = a.stage;
                valB = b.stage;
                break;
            case 'client':
                const cA = state.clients.find(c => c.id === a.clientId);
                const cB = state.clients.find(c => c.id === b.clientId);
                valA = cA ? cA.lastName : '';
                valB = cB ? cB.lastName : '';
                break;
            default:
                valA = 0; valB = 0;
        }

        if (sortConfig.direction === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });

    return relevantPolicies;
  }, [searchTerm, state.clients, state.policies, filterTypes, activeSubType, sortConfig, selectedStages, selectedInsurers, dateRange, activeCategory]);

  const getPolicyDisplayData = (p: Policy) => {
      const rawTitle = p.originalProductString || '';
      
      if (['OC', 'AC', 'BOTH'].includes(p.type)) {
          const vType = p.autoDetails?.vehicleType;
          let Icon = Car;
          if (vType && VEHICLE_TYPE_ICONS[vType]) Icon = VEHICLE_TYPE_ICONS[vType];

          return { 
              icon: Icon, 
              iconColor: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', 
              title: rawTitle || p.vehicleBrand, 
              subtitle: rawTitle ? p.vehicleReg : (p.vehicleReg || 'Brak rej.') 
          };
      }
      if (p.type === 'DOM') {
          return { 
              icon: Home, 
              iconColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', 
              title: rawTitle || p.propertyAddress || 'Nieruchomość', 
              subtitle: 'Ubezpieczenie Mienia' 
          };
      }
      if (p.type === 'ZYCIE') {
          return { 
              icon: Heart, 
              iconColor: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20', 
              title: rawTitle || p.vehicleBrand || 'Polisa na Życie', 
              subtitle: 'Ochrona Zdrowia/Życia' 
          };
      }
      if (p.type === 'PODROZ') {
          return { 
              icon: Plane, 
              iconColor: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20', 
              title: rawTitle || p.destinationCountry || 'Wyjazd Zagraniczny', 
              subtitle: 'Ubezpieczenie Turystyczne' 
          };
      }
      if (p.type === 'FIRMA') {
          return { 
              icon: Building2, 
              iconColor: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800', 
              title: rawTitle || p.vehicleBrand || 'Firma', 
              subtitle: 'OC Działalności / Mienie' 
          };
      }
      return { 
          icon: FileText, 
          iconColor: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800', 
          title: rawTitle || p.vehicleBrand || 'Inne', 
          subtitle: p.type 
      };
  };

  const handleRowClick = (client: Client) => {
      if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
      }
      clickTimeoutRef.current = setTimeout(() => {
          setPreviewClient(client);
          clickTimeoutRef.current = null;
      }, 250);
  };

  const handleRowDoubleClick = (client: Client, policy: Policy) => {
      if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
      }
      onNavigate('client-details', { 
          client, 
          highlightPolicyId: policy.id 
      });
  };

  const renderSortIcon = (columnKey: string) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown size={10} className="ml-1 opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={10} className="ml-1" /> : <ArrowDown size={10} className="ml-1" />;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1800px] mx-auto space-y-6 bg-zinc-50 dark:bg-zinc-900 min-h-screen relative">
      
      {/* GLOBAL HOVER POPOVER */}
      {hoveredNoteData && (
          <NotesPopover 
              notes={state.notes} 
              policyId={hoveredNoteData.policyId} 
              position={hoveredNoteData.pos} 
          />
      )}

      <QuickViewDrawer 
        client={previewClient} 
        state={state} 
        onClose={() => setPreviewClient(null)} 
        onNavigate={onNavigate} 
      />

      {/* STAT CARDS - Surgically Hardened */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 flex-shrink-0">
        
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border-2 border-zinc-100 dark:border-zinc-800 flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-amber-500">
            <Zap size={64} />
          </div>
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Leady (Otwarte)</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-black text-zinc-900 dark:text-white">{stats.pendingOffers}</p>
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">W toku</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border-2 border-zinc-100 dark:border-zinc-800 flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-blue-500">
            <Zap size={64} />
          </div>
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Wysłane Oferty</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-black text-zinc-900 dark:text-white">{stats.stageCounts['oferta_wysłana'] || 0}</p>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">Aktywne</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border-2 border-zinc-100 dark:border-zinc-800 flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-rose-500">
            <Zap size={64} />
          </div>
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Wystawione (m-c)</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-black text-zinc-900 dark:text-white">{stats.stageCounts['wystawiona'] || 0}</p>
            <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold">Polisy</span>
          </div>
        </div>

        <div className="bg-emerald-600 rounded-2xl p-5 flex flex-col justify-between shadow-xl shadow-emerald-900/20 relative overflow-hidden group text-white">
          <div className="absolute right-0 top-0 p-4 opacity-20 group-hover:scale-110 transition-transform text-emerald-100">
            <Zap size={64} />
          </div>
          <p className="text-[10px] font-black uppercase text-emerald-100 tracking-widest opacity-80">Składka przypisana</p>
          <div className="flex items-end justify-between gap-2 mt-1">
              <p className="text-2xl font-black">{stats.totalPremium.toLocaleString()} PLN</p>
              <TrendingUp size={20} className="mb-0.5" />
          </div>
        </div>
      </div>
      
      {/* FILTER BAR */}
      <div className="sticky top-2 z-30">
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl transition-all p-3 space-y-2">
            
            {/* ROW 1: SEARCH + DATES */}
            <div className="flex flex-col xl:flex-row gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Szukaj (Nazwisko, Rej, Polisa)..." 
                        className="w-full pl-11 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-300 dark:focus:border-zinc-700 rounded-2xl outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl shrink-0 overflow-x-auto">
                    {[
                        { id: 'THIS_MONTH', label: 'Ten Miesiąc' },
                        { id: 'PREV_MONTH', label: 'Poprzedni' },
                        { id: 'THIS_YEAR', label: 'Ten Rok' },
                        { id: 'ALL', label: 'Wszystkie' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setActiveDatePreset(opt.id as any)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                                activeDatePreset === opt.id 
                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ROW 2: STATUSES + ACTION */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 w-full md:w-auto">
                    {[
                        'of_do zrobienia',
                        'przeł kontakt',
                        'oferta_wysłana',
                        'rez po ofercie_kont za rok',
                        'sprzedaż'
                    ].map(stKey => {
                        const st = STATUS_CONFIG[stKey as SalesStage];
                        const isActive = selectedStages.includes(stKey as SalesStage);
                        
                        return (
                            <button
                                key={stKey}
                                onClick={() => toggleStage(stKey as SalesStage)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all flex items-center gap-2 whitespace-nowrap ${
                                    isActive 
                                    ? `bg-zinc-900 text-white border-zinc-900` 
                                    : `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400`
                                }`}
                            >
                                <st.icon size={12} className={isActive ? 'text-white' : st.color.split(' ')[0].replace('bg-','text-')} />
                                {st.label}
                            </button>
                        )
                    })}
                    <button 
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-1 whitespace-nowrap ${
                            showAdvancedFilters || selectedInsurers.length > 0 
                            ? 'bg-zinc-100 text-zinc-900 border-zinc-300' 
                            : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                        }`}
                        title="Więcej filtrów (Towarzystwa)"
                    >
                        <SlidersHorizontal size={14} /> <span className="text-[10px] font-bold uppercase">Więcej</span>
                    </button>
                </div>

                <div className="w-full md:w-auto flex justify-end">
                    <button 
                        onClick={() => onNavigate('new', { initialType: contextAction.type })} 
                        className={`${contextAction.color} text-white px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 whitespace-nowrap`}
                    >
                        <contextAction.icon size={16} /> <span className="inline">{contextAction.label}</span>
                    </button>
                </div>
            </div>

            {/* EXPANDABLE: ADVANCED FILTERS */}
            <div className="px-1">
                <AdvancedFilters 
                    isOpen={showAdvancedFilters} 
                    filters={{
                        insurers: selectedInsurers,
                        stages: selectedStages,
                        dateRange: { start: '', end: '' }, 
                        types: []
                    }}
                    onFilterChange={(newFilters) => {
                        setSelectedInsurers(newFilters.insurers);
                        setSelectedStages(newFilters.stages);
                    }}
                    onClose={() => setShowAdvancedFilters(false)}
                    onClear={() => {
                        setSelectedInsurers([]);
                        setSelectedStages([]);
                        setActiveDatePreset('ALL');
                    }}
                />
            </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
              <tr className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">
                <th 
                    className={`px-6 ${isCompact ? 'py-3' : 'py-4'} w-[20%] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}
                    onClick={() => handleSort('client')}
                >
                    <div className="flex items-center">Klient (Kontakt) {renderSortIcon('client')}</div>
                </th>
                <th 
                    className={`px-4 ${isCompact ? 'py-3' : 'py-4'} w-[25%] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}
                    onClick={() => handleSort('premium')}
                >
                    <div className="flex items-center">Przedmiot / Składka {renderSortIcon('premium')}</div>
                </th>
                <th 
                    className={`px-4 ${isCompact ? 'py-3' : 'py-4'} text-center w-[10%] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}
                    onClick={() => handleSort('status')}
                >
                    <div className="flex items-center justify-center">Status {renderSortIcon('status')}</div>
                </th>
                <th 
                    className={`px-4 ${isCompact ? 'py-3' : 'py-4'} text-center w-[10%] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}
                    onClick={() => handleSort('endDate')}
                >
                    <div className="flex items-center justify-center">Koniec {renderSortIcon('endDate')}</div>
                </th>
                <th className={`px-4 ${isCompact ? 'py-3' : 'py-4'} text-center w-[5%]`}>Dok.</th>
                <th className={`px-4 ${isCompact ? 'py-3' : 'py-4'} text-left w-[30%]`}>Notatka</th>
                <th className={`px-2 ${isCompact ? 'py-3' : 'py-4'}`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredAndSortedPolicies.map(policy => {
                const client = state.clients.find(c => c.id === policy.clientId);
                if (!client) return null;

                const today = new Date();
                const end = new Date(policy.policyEndDate);
                const isValidDate = isValid(end);
                const days = isValidDate ? differenceInDays(end, today) : 0;
                
                const statusConfig = STATUS_CONFIG[policy.stage as SalesStage] || STATUS_CONFIG['inne'];
                
                const displayData = getPolicyDisplayData(policy);
                const TypeIcon = displayData.icon;

                const paddingClass = isCompact ? 'py-2' : 'py-4';
                const avatarSize = isCompact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
                
                const isSold = policy.stage === 'sprzedaż' || policy.stage === 'sprzedany';
                const docsSent = policy.documentsStatus === 'WYSŁANO';
                
                // Get Latest Note (Filter system logs)
                const policyNotes = state.notes
                    .filter(n => n.linkedPolicyIds?.includes(policy.id) && !n.content.startsWith('[SYSTEM'))
                    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const latestNote = policyNotes[0];

                return (
                  <tr 
                    key={policy.id} 
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer"
                    onClick={() => handleRowClick(client)}
                    onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRowDoubleClick(client, policy);
                    }}
                  >
                    {/* KLIENT COLUMN */}
                    <td className={`px-6 ${paddingClass}`}>
                      <div className="flex items-center gap-3">
                        <div className={`${avatarSize} rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-black group-hover:bg-zinc-900 dark:group-hover:bg-zinc-700 group-hover:text-white transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm`}>
                            {client.lastName[0]}
                        </div>
                        <div>
                          <p className={`font-black ${isCompact ? 'text-[11px]' : 'text-xs'} text-zinc-900 dark:text-zinc-100 leading-none group-hover:text-red-600 transition-colors`}>
                              {client.lastName} {client.firstName}
                          </p>
                          <div className="mt-1 space-y-0.5">
                              {client.phones?.[0] && (
                                  <div className="flex items-center gap-1.5 text-zinc-400">
                                      <Phone size={10} /> <span className="text-[9px] font-mono font-medium">{client.phones[0]}</span>
                                  </div>
                              )}
                              {client.emails?.[0] && (
                                  <div className="flex items-center gap-1.5 text-zinc-400">
                                      <Mail size={10} /> <span className="text-[9px] font-medium truncate max-w-[140px]">{client.emails[0]}</span>
                                  </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* PRZEDMIOT + SKŁADKA + TU */}
                    <td className={`px-4 ${paddingClass}`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-lg mt-1 ${displayData.iconColor}`}>
                                <TypeIcon size={14} />
                            </div>
                            <div className="flex flex-col items-start w-full">
                                <span 
                                    className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-bold text-zinc-700 dark:text-zinc-300 uppercase truncate max-w-[220px]`}
                                    title={displayData.title} 
                                >
                                    {displayData.title}
                                </span>
                                
                                {/* PREMIUM & INSURER ROW */}
                                <div className="flex items-center gap-2 mt-1.5 w-full">
                                    <span className="text-[9px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wide border border-zinc-200 dark:border-zinc-700 truncate max-w-[80px]">
                                        {(policy.insurerName || '').substring(0, 7)}{(policy.insurerName || '').length > 7 ? '.' : ''}
                                    </span>
                                    <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-100">
                                        {policy.premium > 0 ? `${policy.premium} zł` : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </td>

                    <td className={`px-4 ${paddingClass} text-center`}>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border shadow-sm ${statusConfig.color} ${statusConfig.bg} ${statusConfig.border}`}>
                        <statusConfig.icon size={12} />
                        {statusConfig.label}
                      </div>
                    </td>

                    <td className={`px-4 ${paddingClass} text-center`}>
                      <div className="flex flex-col items-center">
                        <span className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-black ${days <= 30 && days >= 0 ? 'text-red-600' : days < 0 ? 'text-zinc-400 line-through' : 'text-zinc-900 dark:text-zinc-100'}`}>
                          {days < 0 ? 'Wygasła' : `${days} dni`}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-medium font-mono">
                            {isValidDate ? format(end, 'dd.MM') : '---'}
                        </span>
                      </div>
                    </td>
                    
                    {/* DOKUMENTS STATUS COLUMN */}
                    <td className={`px-4 ${paddingClass} text-center`}>
                        {isSold ? (
                            docsSent ? (
                                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-100 text-emerald-600" title="Wysłano">
                                    <MailCheck size={16} />
                                </span>
                            ) : (
                                <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-zinc-100 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Brak/Niewysłane">
                                    <MailWarning size={16} />
                                </span>
                            )
                        ) : (
                            <span className="text-zinc-200 dark:text-zinc-800 text-[10px]">-</span>
                        )}
                    </td>

                    {/* NOTES COLUMN (EXPANDED) */}
                    <td className={`px-4 ${paddingClass}`}>
                        <div 
                            className="relative cursor-help group/note min-w-[300px]"
                            onMouseEnter={(e) => handleNoteEnter(e, policy.id)}
                            onMouseLeave={handleNoteLeave}
                        >
                            {latestNote ? (
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-normal break-words leading-tight line-clamp-3">
                                    <span className="font-bold text-zinc-400 dark:text-zinc-500 mr-1 text-[10px]">{format(new Date(latestNote.createdAt), 'dd.MM')}:</span>
                                    {latestNote.content}
                                </div>
                            ) : (
                                <span className="text-zinc-300 dark:text-zinc-700 text-[10px] italic">Brak notatek</span>
                            )}
                        </div>
                    </td>

                    {/* ACTION */}
                    <td className={`px-2 ${paddingClass} text-right`}>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onNavigate('client-details', { client, highlightPolicyId: policy.id }); 
                            }}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl text-zinc-300 hover:text-zinc-900 transition-all opacity-0 group-hover:opacity-100"
                            title="Pełny profil (2-klik)"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
