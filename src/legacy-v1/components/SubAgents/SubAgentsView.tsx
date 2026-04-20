
import React, { useState, useMemo } from 'react';
import { AppState, SubAgent, Policy } from '../../types';
import { Handshake, User, Phone, Mail, FileText, Banknote, Wallet, ArrowRight, Car, Home, Calendar, ChevronLeft, ChevronRight, Download, Filter, EyeOff, AlertTriangle, LayoutGrid, List, Users, ChevronDown, ChevronUp, Briefcase, Activity, Search, History, PieChart, CheckCircle2 } from 'lucide-react';
import { format, endOfWeek, endOfMonth, endOfYear, addWeeks, addMonths, addYears, isWithinInterval, getWeek, addDays } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import * as XLSX from 'xlsx';

interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
}

type ViewMode = 'WEEK' | 'MONTH' | 'YEAR';
type LayoutMode = 'LIST' | 'GRID';

interface AgentGroupData {
    agents: SubAgent[];
    groupTotal: number;
    groupPaid: number;
    groupCount: number;
}

const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);

export const SubAgentsView: React.FC<Props> = ({ state, onNavigate }) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('GRID');
  const [cursorDate, setCursorDate] = useState(new Date());
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 'FIRMOWY': true, 'WŁASNY': true, 'PARTNERZY': true });
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true); 
  const [hideZeroPremium, setHideZeroPremium] = useState(true); 
  
  // Detail View Mode (Period vs All Time)
  const [showFullHistory, setShowFullHistory] = useState(false);

  // --- NAVIGATION ---
  const handleNav = (dir: 'prev' | 'next') => {
      if (viewMode === 'WEEK') {
          setCursorDate(d => dir === 'prev' ? addWeeks(d, -1) : addWeeks(d, 1));
      } else if (viewMode === 'MONTH') {
          setCursorDate(d => dir === 'prev' ? addMonths(d, -1) : addMonths(d, 1));
      } else {
          setCursorDate(d => dir === 'prev' ? addYears(d, -1) : addYears(d, 1));
      }
  };

  const currentPeriod = useMemo(() => {
      const today = cursorDate;
      if (viewMode === 'WEEK') {
          return { start: startOfWeek(today), end: endOfWeek(today, { weekStartsOn: 1 }) };
      }
      if (viewMode === 'MONTH') {
          return { start: startOfMonth(today), end: endOfMonth(today) };
      }
      return { start: startOfYear(today), end: endOfYear(today) };
  }, [cursorDate, viewMode]);

  // --- CORE LOGIC: CALCULATE STATS FOR CURRENT PERIOD ---
  const periodStats = useMemo(() => {
      // Structure: { totalCommission, paidCommission (settled), policyCount, policies }
      const stats = new Map<string, { totalCommission: number, paidCommission: number, policyCount: number, policies: Policy[] }>();
      
      state.policies.forEach(p => {
          // 1. Data Filter
          const date = new Date(p.createdAt);
          if (!isWithinInterval(date, currentPeriod)) return;

          // 2. Zero Value Filter Logic
          const safePremium = typeof p.premium === 'string' ? parseFloat(p.premium) : (p.premium || 0);
          const safeCommission = typeof p.commission === 'string' ? parseFloat(p.commission) : (p.commission || 0);
          const isSold = p.stage === 'sprzedaż';

          if (hideZeroPremium) {
              if (!isSold && (safePremium < 0.01 || safeCommission < 0.01)) return;
          }

          const isPaid = p.paymentStatus === 'PAID';

          // 3. Attribution
          if (p.subAgentSplits && p.subAgentSplits.length > 0) {
              p.subAgentSplits.forEach(split => {
                  if (split.agentId) {
                      const current = stats.get(split.agentId) || { totalCommission: 0, paidCommission: 0, policyCount: 0, policies: [] };
                      const amount = split.amount || 0;
                      stats.set(split.agentId, {
                          totalCommission: current.totalCommission + amount,
                          paidCommission: current.paidCommission + (isPaid ? amount : 0),
                          policyCount: current.policyCount + 1,
                          policies: [...current.policies, p]
                      });
                  }
              });
          } 
          else if (p.subAgentId) {
              const current = stats.get(p.subAgentId) || { totalCommission: 0, paidCommission: 0, policyCount: 0, policies: [] };
              const amount = p.subAgentCommission || 0;
              stats.set(p.subAgentId, {
                  totalCommission: current.totalCommission + amount,
                  paidCommission: current.paidCommission + (isPaid ? amount : 0),
                  policyCount: current.policyCount + 1,
                  policies: [...current.policies, p]
              });
          }
      });
      return stats;
  }, [state.policies, currentPeriod, hideZeroPremium]);

  // --- LIFETIME STATS (FOR SELECTED AGENT) ---
  const lifetimeStats = useMemo(() => {
      if (!selectedAgentId) return { totalCommission: 0, policyCount: 0, policies: [] };

      let total = 0;
      let count = 0;
      const policies: Policy[] = [];

      state.policies.forEach(p => {
          let amt = 0;
          let isRelated = false;

          if (p.subAgentSplits && p.subAgentSplits.length > 0) {
              const split = p.subAgentSplits.find(s => s.agentId === selectedAgentId);
              if (split) {
                  amt = split.amount || 0;
                  isRelated = true;
              }
          } else if (p.subAgentId === selectedAgentId) {
              amt = p.subAgentCommission || 0;
              isRelated = true;
          }

          if (isRelated) {
              // Same Zero Value Logic
              const safePremium = typeof p.premium === 'string' ? parseFloat(p.premium) : (p.premium || 0);
              const isSold = p.stage === 'sprzedaż';
              
              if (hideZeroPremium && !isSold && safePremium < 0.01) return;

              total += amt;
              count += 1;
              policies.push(p);
          }
      });

      return { totalCommission: total, policyCount: count, policies };
  }, [state.policies, selectedAgentId, hideZeroPremium]);


  // --- GROUPING LOGIC WITH SEARCH ---
  const groupedAgents = useMemo(() => {
      const groups: Record<string, AgentGroupData> = {};

      state.subAgents.forEach(agent => {
          // SEARCH FILTER
          if (searchTerm) {
              const term = searchTerm.toLowerCase();
              if (!agent.name.toLowerCase().includes(term)) return;
          }

          // Stats check
          const stat = periodStats.get(agent.id);
          if (showOnlyActive && (!stat || stat.policyCount === 0)) return;

          // Name Parsing (e.g. "firmowy/Beata" -> Group: "FIRMOWY")
          const nameLower = agent.name.toLowerCase();
          let groupName = 'PARTNERZY'; // Default

          if (nameLower.includes('/')) {
              groupName = agent.name.split('/')[0].toUpperCase().trim();
          } else if (nameLower.includes('własny') || nameLower.includes('wlasny')) {
              groupName = 'WŁASNY';
          } else if (nameLower.includes('firmowy')) {
              groupName = 'FIRMOWY';
          }

          if (!groups[groupName]) {
              groups[groupName] = { agents: [], groupTotal: 0, groupPaid: 0, groupCount: 0 };
          }

          groups[groupName].agents.push(agent);
          if (stat) {
              groups[groupName].groupTotal += stat.totalCommission;
              groups[groupName].groupPaid += stat.paidCommission;
              groups[groupName].groupCount += stat.policyCount;
          }
      });

      return groups;
  }, [state.subAgents, periodStats, showOnlyActive, searchTerm]);

  // --- FLAT LIST FOR SIDEBAR (Legacy Mode) ---
  const displayAgents = useMemo(() => {
      let agents = [...state.subAgents];
      
      // SEARCH FILTER
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          agents = agents.filter(a => a.name.toLowerCase().includes(term));
      }

      if (showOnlyActive) {
          agents = agents.filter(a => {
              const stat = periodStats.get(a.id);
              return stat && stat.policyCount > 0;
          });
      }
      agents.sort((a, b) => {
          const statA = periodStats.get(a.id)?.totalCommission || 0;
          const statB = periodStats.get(b.id)?.totalCommission || 0;
          return statB - statA;
      });
      return agents;
  }, [state.subAgents, periodStats, showOnlyActive, searchTerm]);

  const selectedAgent = state.subAgents.find(a => a.id === selectedAgentId);
  const currentStats = selectedAgent ? periodStats.get(selectedAgent.id) : null;
  
  // Decide which policies to show (Period vs All Time)
  const activePolicies = showFullHistory 
      ? lifetimeStats.policies 
      : (currentStats?.policies || []);

  const sortedPolicies = useMemo(() => {
      return [...activePolicies].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activePolicies]);

  const handleExportXLSX = () => {
      if (!selectedAgent) return;
      const rows = sortedPolicies.map(p => {
          const client = state.clients.find(c => c.id === p.clientId);
          let amt = 0;
          if (p.subAgentSplits) {
              const s = p.subAgentSplits.find(x => x.agentId === selectedAgentId);
              amt = s?.amount || 0;
          } else {
              amt = p.subAgentCommission || 0;
          }
          return {
              'Data Sprzedaży': format(new Date(p.createdAt), 'yyyy-MM-dd'),
              'Produkt': `${p.vehicleBrand || p.type} ${p.vehicleReg || ''}`.trim(),
              'Klient': client ? `${client.lastName} ${client.firstName}` : 'Nieznany',
              'Składka (PLN)': p.premium,
              'Prowizja (PLN)': amt,
              'Nr Polisy': p.policyNumber,
              'Status': p.stage === 'sprzedaż' && amt === 0 ? 'DO WYJAŚNIENIA' : 'OK'
          };
      });
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rozliczenie");
      const periodLabel = showFullHistory ? 'CALA_HISTORIA' : format(currentPeriod.start, 'yyyy-MM-dd');
      const fileName = `Rozliczenie_${selectedAgent.name.replace(/\s/g, '_')}_${periodLabel}.xlsx`;
      XLSX.writeFile(workbook, fileName);
  };

  const toggleGroup = (groupName: string) => {
      setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // --- RENDER GRID MODE ---
  const renderGridView = () => (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
              {Object.keys(groupedAgents).length === 0 && (
                  <div className="text-center py-20 opacity-50">
                      <Filter size={48} className="mx-auto mb-4 text-zinc-300"/>
                      <p className="text-xl font-black text-zinc-400">Brak wyników</p>
                      <p className="text-sm text-zinc-500">Zmień filtry lub wyszukiwanie</p>
                  </div>
              )}

              {Object.entries(groupedAgents).map(([groupName, rawData]) => {
                  // Explicit cast to fix "Property does not exist on type 'unknown'" error
                  const data = rawData as AgentGroupData;
                  const isExpanded = expandedGroups[groupName];
                  const settledPercentage = data.groupTotal > 0 ? (data.groupPaid / data.groupTotal) * 100 : 0;

                  return (
                      <div key={groupName} className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-[1.5rem] overflow-hidden shadow-sm transition-all hover:shadow-lg">
                          
                          {/* GROUP HEADER */}
                          <div 
                              onClick={() => toggleGroup(groupName)}
                              className="p-6 flex items-center justify-between cursor-pointer bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                          >
                              <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${
                                      groupName === 'WŁASNY' ? 'bg-blue-600' : 
                                      groupName === 'FIRMOWY' ? 'bg-zinc-900 dark:bg-zinc-700' : 'bg-emerald-600'
                                  }`}>
                                      {groupName === 'WŁASNY' ? <User size={24}/> : (groupName === 'FIRMOWY' ? <Briefcase size={24}/> : <Users size={24}/>)}
                                  </div>
                                  <div>
                                      <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">{groupName}</h3>
                                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">
                                          Agentów: {data.agents.length} • Polisy: {data.groupCount}
                                      </p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-6">
                                  <div className="text-right">
                                      <p className="text-[10px] font-black uppercase text-zinc-400 mb-0.5">Suma Prowizji</p>
                                      <p className="text-xl font-black text-zinc-900 dark:text-white">{data.groupTotal.toLocaleString(undefined, {minimumFractionDigits: 0})} PLN</p>
                                      {data.groupPaid > 0 && (
                                          <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-emerald-600">
                                              <CheckCircle2 size={10} /> Rozliczono: {Math.round(settledPercentage)}%
                                          </div>
                                      )}
                                  </div>
                                  <div className="p-2 bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                                      {isExpanded ? <ChevronUp size={20} className="text-zinc-400"/> : <ChevronDown size={20} className="text-zinc-400"/>}
                                  </div>
                              </div>
                          </div>

                          {/* GROUP CONTENT (TILES) */}
                          {isExpanded && (
                              <div className="p-6 bg-zinc-50/30 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                      {data.agents.map(agent => {
                                          const stat = periodStats.get(agent.id) || { totalCommission: 0, paidCommission: 0, policyCount: 0 };
                                          const pending = stat.totalCommission - stat.paidCommission;
                                          
                                          // Clean nested name: "firmowy/Osip/Ewa" -> "Osip/Ewa"
                                          const agentName = agent.name || '';
                                          const displayName = agentName.includes('/') ? agentName.substring(agentName.indexOf('/') + 1) : agentName;

                                          return (
                                              <div 
                                                  key={agent.id}
                                                  onClick={() => {
                                                      setSelectedAgentId(agent.id);
                                                      setLayoutMode('LIST'); // Switch to details view
                                                      setShowFullHistory(false); // Reset to period view initially
                                                  }}
                                                  className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                                              >
                                                  <div>
                                                      <div className="flex justify-between items-start mb-3">
                                                          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-500 font-bold text-xs group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                              {(displayName || '?').substring(0,2).toUpperCase()}
                                                          </div>
                                                          <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded text-zinc-500">
                                                              {stat.policyCount} szt.
                                                          </span>
                                                      </div>
                                                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate mb-1" title={agent.name}>{displayName}</h4>
                                                  </div>
                                                  
                                                  <div className="mt-4 space-y-2">
                                                      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-700">
                                                          <span className="text-[10px] font-black text-zinc-400 uppercase">Razem</span>
                                                          <span className="text-sm font-black text-zinc-900 dark:text-white">{stat.totalCommission.toLocaleString()} zł</span>
                                                      </div>
                                                      
                                                      {/* Settlement Breakdown */}
                                                      <div className="flex gap-2">
                                                          {stat.paidCommission > 0 && (
                                                              <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-1.5 text-center border border-emerald-100 dark:border-emerald-800">
                                                                  <p className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400">Do Wypłaty</p>
                                                                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">{stat.paidCommission.toLocaleString()} zł</p>
                                                              </div>
                                                          )}
                                                          {pending > 0 && (
                                                              <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-1.5 text-center border border-amber-100 dark:border-amber-800">
                                                                  <p className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400">Oczekujące</p>
                                                                  <p className="text-xs font-black text-amber-700 dark:text-amber-300">{pending.toLocaleString()} zł</p>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans overflow-hidden flex-col">
      
      {/* TOP BAR (CONTROLS) */}
      <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex flex-col md:flex-row justify-between items-center gap-4 z-20">
          <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
                  <Handshake className="text-blue-600" /> Centrum Pośredników
              </h1>
              
              {/* Layout Switcher */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                  <button onClick={() => setLayoutMode('GRID')} className={`p-2 rounded-lg transition-all ${layoutMode === 'GRID' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><LayoutGrid size={18}/></button>
                  <button onClick={() => setLayoutMode('LIST')} className={`p-2 rounded-lg transition-all ${layoutMode === 'LIST' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><List size={18}/></button>
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
                {/* Search Agent */}
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Szukaj pośrednika..."
                        className="pl-9 pr-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-700 border-2 focus:border-blue-500 rounded-lg text-xs font-bold outline-none transition-all w-48"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

                {/* Date Navigation */}
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button onClick={() => handleNav('prev')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-500"><ChevronLeft size={16}/></button>
                    <div className="px-4 text-center min-w-[120px]">
                        <p className="text-[10px] font-black text-zinc-900 dark:text-white capitalize leading-tight">
                            {viewMode === 'YEAR' ? format(cursorDate, 'yyyy') : (viewMode === 'MONTH' ? format(cursorDate, 'MMMM yyyy', {locale: pl}) : `Tydz. ${getWeek(cursorDate)}`)}
                        </p>
                    </div>
                    <button onClick={() => handleNav('next')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-500"><ChevronRight size={16}/></button>
                </div>

                {/* View Mode */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button onClick={() => setViewMode('WEEK')} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${viewMode === 'WEEK' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>Tydz.</button>
                    <button onClick={() => setViewMode('MONTH')} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${viewMode === 'MONTH' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>Msc.</button>
                    <button onClick={() => setViewMode('YEAR')} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${viewMode === 'YEAR' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>Rok</button>
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    <button onClick={() => setShowOnlyActive(!showOnlyActive)} className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all flex items-center gap-1 ${showOnlyActive ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-zinc-200 text-zinc-400'}`}>
                        <Activity size={12}/> Aktywni
                    </button>
                    <button onClick={() => setHideZeroPremium(!hideZeroPremium)} className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all flex items-center gap-1 ${hideZeroPremium ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-zinc-200 text-zinc-400'}`}>
                        <EyeOff size={12}/> Ukryj Puste
                    </button>
                </div>
          </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden flex">
          
          {layoutMode === 'GRID' && renderGridView()}

          {layoutMode === 'LIST' && (
              <>
                {/* LEFT: LIST (30%) */}
                <div className="w-80 md:w-96 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-10 shadow-xl overflow-y-auto scrollbar-hide">
                    {displayAgents.map(agent => {
                        const stat = periodStats.get(agent.id) || { totalCommission: 0, paidCommission: 0, policyCount: 0 };
                        const isSelected = agent.id === selectedAgentId;
                        return (
                            <div 
                                key={agent.id}
                                onClick={() => { 
                                    setSelectedAgentId(agent.id); 
                                    setShowFullHistory(false); // Reset to period view on switch
                                }}
                                className={`p-4 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-600' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-bold text-sm truncate pr-2 text-zinc-800 dark:text-zinc-200">{agent.name}</div>
                                    {stat.policyCount > 0 && <span className="text-[10px] font-black bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300">{stat.policyCount}</span>}
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Prowizja</span>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{stat.totalCommission.toLocaleString()} PLN</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* RIGHT: DETAILS (70%) */}
                <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                    {selectedAgent ? (
                        <>
                            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-2">{selectedAgent.name}</h1>
                                        <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                                            {selectedAgent.phone && <span className="flex items-center gap-1"><Phone size={12}/> {selectedAgent.phone}</span>}
                                            {selectedAgent.email && <span className="flex items-center gap-1"><Mail size={12}/> {selectedAgent.email}</span>}
                                        </div>
                                    </div>
                                    
                                    {/* LIFETIME STATS SUMMARY */}
                                    <div className="flex gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Całkowity Przychód</p>
                                            <p className="text-xl font-black text-zinc-700 dark:text-zinc-300">{lifetimeStats.totalCommission.toLocaleString()} <span className="text-sm">PLN</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Wszystkie Polisy</p>
                                            <p className="text-xl font-black text-zinc-700 dark:text-zinc-300">{lifetimeStats.policyCount}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* TOOLBAR: TOGGLE HISTORY / PERIOD */}
                                <div className="flex justify-between items-end border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                        <button 
                                            onClick={() => setShowFullHistory(false)}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!showFullHistory ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                                        >
                                            {viewMode === 'YEAR' ? 'W tym roku' : (viewMode === 'MONTH' ? 'W tym miesiącu' : 'W tym tygodniu')}
                                        </button>
                                        <button 
                                            onClick={() => setShowFullHistory(true)}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showFullHistory ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                                        >
                                            <History size={12} /> Pełna Historia
                                        </button>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-500 mb-1">
                                            {showFullHistory ? 'SUMA CAŁKOWITA' : 'SUMA BIEŻĄCA'}
                                        </p>
                                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                            {(showFullHistory ? lifetimeStats.totalCommission : (currentStats?.totalCommission || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})} PLN
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 relative">
                                <div className="flex justify-end mb-4">
                                    <button onClick={handleExportXLSX} disabled={sortedPolicies.length === 0} className="flex items-center gap-2 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-[10px] font-black uppercase hover:bg-zinc-300 transition-all disabled:opacity-50">
                                        <Download size={14} /> Eksportuj widok (XLSX)
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {sortedPolicies.length === 0 && (
                                        <div className="text-center py-12 text-zinc-400">
                                            <p className="font-bold text-xs uppercase">Brak polis w wybranym widoku.</p>
                                        </div>
                                    )}
                                    {sortedPolicies.map(policy => {
                                        const client = state.clients.find(c => c.id === policy.clientId);
                                        let shareAmount = 0;
                                        let shareRate = 0;
                                        if (policy.subAgentSplits) {
                                            const split = policy.subAgentSplits.find(s => s.agentId === selectedAgentId);
                                            shareAmount = split?.amount || 0;
                                            shareRate = split?.rate || 0;
                                        } else {
                                            shareAmount = policy.subAgentCommission || 0;
                                            shareRate = policy.subAgentRate || 0;
                                        }
                                        const isSold = policy.stage === 'sprzedaż';
                                        const isAnomaly = isSold && shareAmount === 0;
                                        const isPaid = policy.paymentStatus === 'PAID';

                                        return (
                                            <div key={policy.id} onClick={() => client && onNavigate('client-details', { client })} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group ${isAnomaly ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' : 'border-zinc-100 dark:border-zinc-800'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 ${['OC','AC'].includes(policy.type) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                                                        {['OC','AC'].includes(policy.type) ? <Car size={18} /> : <Home size={18} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-zinc-900 dark:text-white uppercase group-hover:text-blue-600 transition-colors">{policy.vehicleBrand || policy.type} {policy.vehicleReg}</p>
                                                        <p className="text-[10px] text-zinc-500 font-bold">{client ? `${client.lastName} ${client.firstName}` : 'Klient nieznany'}</p>
                                                        {isAnomaly && <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 mt-1 w-fit"><AlertTriangle size={10} /> DO WYJAŚNIENIA</div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-8">
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-black uppercase text-zinc-400">Składka</p>
                                                        <p className="text-xs font-bold text-zinc-900 dark:text-white">{policy.premium} PLN</p>
                                                    </div>
                                                    <div className="text-right w-24">
                                                        <p className="text-[9px] font-black uppercase text-zinc-400">Prowizja</p>
                                                        <p className={`text-xs font-black ${isAnomaly ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'}`}>{shareAmount} PLN ({shareRate}%)</p>
                                                        {isPaid && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">OPŁACONA</span>}
                                                    </div>
                                                    <div className="text-right hidden xl:block min-w-[80px]">
                                                        <p className="text-[9px] text-zinc-300 font-mono">{format(new Date(policy.createdAt), 'dd.MM.yyyy')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 opacity-60">
                            <Handshake size={64} strokeWidth={1} className="mb-4" />
                            <p className="text-sm font-black uppercase tracking-widest">Wybierz pośrednika z listy</p>
                        </div>
                    )}
                </div>
              </>
          )}
      </div>
    </div>
  );
};
