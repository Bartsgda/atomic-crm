
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, Client, Policy, ClientNote } from '../types';
import { Search, Phone, Mail, Plus, Edit2, ExternalLink, ArrowRight, User, Link as LinkIcon, Car, Home, Heart, Users, ArrowUp, ArrowDown, Calendar, StickyNote, X, Clock, Plane } from 'lucide-react';
import { ClientFormModal } from './ClientFormModal';
import { format, differenceInDays, isValid } from 'date-fns';
import { DeleteSafetyButton } from './DeleteSafetyButton';
import { Archive, RotateCcw, Trash, AlertCircle } from 'lucide-react';

interface Props {
  state: AppState;
  trash: any[];
  onNavigate: (page: string, data?: any) => void;
  onSaveClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onRestoreClient: (id: string) => void;
  onPurgeClient: (id: string) => void;
  onImportComplete: () => void;
  isCompact?: boolean;
  initialAutoCreate?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  client: Client | null;
  isVirtual?: boolean;
  sourcePolicyId?: string;
}

interface VirtualClient extends Client {
    isVirtual: true;
    sourcePolicies: { id: string; label: string; type: 'AUTO' | 'DOM' | 'PODROZ'; mainClientName: string }[];
}

type SortKey = 'name' | 'activity' | 'vehicles' | 'property' | 'life';

export const ClientsList: React.FC<Props> = ({ 
  state, trash = [], onNavigate, onSaveClient, onDeleteClient, onRestoreClient, onPurgeClient, 
  onImportComplete, isCompact = false, initialAutoCreate = false 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCoOwners, setShowCoOwners] = useState(false);
  const [viewMode, setViewMode] = useState<'CLIENTS' | 'ARCHIVE'>('CLIENTS');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  // Sorting State - Domyślnie po aktywności (Najnowsze na górze)
  const [sortKey, setSortKey] = useState<SortKey>('activity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
      if (initialAutoCreate) {
          setEditingClient(null);
          setIsClientModalOpen(true);
      }
  }, [initialAutoCreate]);

  // --- LOGIKA IDENTYFIKACJI WSPÓŁWŁAŚCICIELI ---
  const coOwnerIdentities = useMemo(() => {
      const identities = new Set<string>();
      state.policies.forEach(p => {
          p.autoDetails?.coOwners?.forEach(c => {
              if (c.pesel) identities.add(c.pesel);
              else if (c.name) identities.add(c.name.trim().toLowerCase());
          });
          p.homeDetails?.coOwners?.forEach(c => {
              if (c.pesel) identities.add(c.pesel);
              else if (c.name) identities.add(c.name.trim().toLowerCase());
          });
      });
      return identities;
  }, [state.policies]);

  const isClientAlsoCoOwner = (client: Client) => {
      if (client.pesel && coOwnerIdentities.has(client.pesel)) return true;
      const fullName = `${client.firstName} ${client.lastName}`.trim().toLowerCase();
      const reverseName = `${client.lastName} ${client.firstName}`.trim().toLowerCase();
      return coOwnerIdentities.has(fullName) || coOwnerIdentities.has(reverseName);
  };

  // --- LOGIKA WIRTUALNYCH KLIENTÓW ---
  const coOwnerList = useMemo(() => {
      if (!showCoOwners) return [];
      const map = new Map<string, VirtualClient>();

      state.policies.forEach(policy => {
          const mainClient = state.clients.find(c => c.id === policy.clientId);
          const mainClientLabel = mainClient ? `${mainClient.lastName} ${mainClient.firstName}` : 'Nieznany';
          // Extended source type to include PODROZ
          const sources: { name: string, pesel?: string, type: 'AUTO' | 'DOM' | 'PODROZ' }[] = [];

          if (policy.autoDetails?.coOwners) policy.autoDetails.coOwners.forEach(co => sources.push({ name: co.name, pesel: co.pesel, type: 'AUTO' }));
          if (policy.homeDetails?.coOwners) policy.homeDetails.coOwners.forEach(co => sources.push({ name: co.name, pesel: co.pesel, type: 'DOM' }));
          
          // NEW: Add Travel Participants
          if (policy.travelDetails?.participants) {
              policy.travelDetails.participants.forEach(p => {
                  sources.push({ name: p.fullName, pesel: undefined, type: 'PODROZ' });
              });
          }

          sources.forEach(src => {
              if (src.name.toLowerCase().includes('leasing') || src.name.toLowerCase().includes('bank') || src.name.toLowerCase().includes('grupa szkolna')) return;
              const key = src.pesel || src.name.trim().toLowerCase();
              
              if (!map.has(key)) {
                  const parts = src.name.trim().split(' ');
                  const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
                  const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : '';

                  map.set(key, {
                      id: `virt_${key}`,
                      firstName: firstName,
                      lastName: lastName,
                      pesel: src.pesel || '',
                      phones: [], emails: [], street: 'Adres z polisy', city: '', zipCode: '', businesses: [],
                      createdAt: new Date().toISOString(),
                      isVirtual: true,
                      sourcePolicies: []
                  });
              }
              const entry = map.get(key)!;
              
              let label = policy.vehicleBrand || policy.propertyAddress || policy.policyNumber;
              if (src.type === 'PODROZ') label = policy.destinationCountry || 'Wyjazd';

              if (!entry.sourcePolicies.some(p => p.id === policy.id)) {
                  entry.sourcePolicies.push({ 
                      id: policy.id, label: label, type: src.type, mainClientName: mainClientLabel
                  });
              }
          });
      });
      return Array.from(map.values());
  }, [state.policies, state.clients, showCoOwners]);

  // --- PRZYGOTOWANIE DANYCH DO SORTOWANIA ---
  const processedList = useMemo(() => {
      let sourceList: any[] = [];
      
      if (viewMode === 'ARCHIVE') {
          sourceList = trash
            .filter(item => item.type === 'CLIENT')
            .map(item => ({
                ...item.data.client,
                _archiveId: item.id,
                _deletedAt: item.deletedAt,
                _archivedPolicies: item.data.policies || [],
                _archivedNotes: item.data.notes || []
            }));
      } else {
          sourceList = showCoOwners ? coOwnerList : state.clients;
      }
      
      // 1. Mapowanie z metadanymi (policz oferty, daty, ostatnia aktywność)
      const withMeta = sourceList.map(client => {
          if ('isVirtual' in client) {
              const vc = client as VirtualClient;
              return { 
                  ...vc, 
                  _offers: [] as Policy[], 
                  _lastActivity: 0, 
                  _v: 0, 
                  _p: 0, 
                  _l: 0, 
                  _notePreview: '' 
              }; 
          }

          const pols = state.policies.filter(p => p.clientId === client.id);
          const clientNotes = state.notes.filter(n => n.clientId === client.id);
          
          // Oferty
          const offers = pols.filter(p => ['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt'].includes(p.stage));
          
          // Ostatnia aktywność (Data utworzenia klienta vs Ostatnia polisa vs Ostatnia notatka)
          let lastActivity = new Date(client.createdAt).getTime();
          
          if (pols.length > 0) {
              const lastPolDate = Math.max(...pols.map(p => new Date(p.createdAt).getTime()));
              if (lastPolDate > lastActivity) lastActivity = lastPolDate;
          }
          if (clientNotes.length > 0) {
              const lastNoteDate = Math.max(...clientNotes.map(n => new Date(n.createdAt).getTime()));
              if (lastNoteDate > lastActivity) lastActivity = lastNoteDate;
          }

          // Liczniki
          const v = pols.filter(p => ['OC', 'AC', 'BOTH'].includes(p.type)).length;
          const p = pols.filter(p => ['DOM', 'FIRMA'].includes(p.type)).length;
          const l = pols.filter(p => ['ZYCIE', 'PODROZ'].includes(p.type)).length;
          
          // Latest User Note (Exclude System)
          const userNotes = clientNotes
            .filter(n => !n.content.startsWith('[SYSTEM') && n.tag !== 'AUDYT')
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          const latestNoteContent = userNotes.length > 0 ? userNotes[0].content : (client.notes || '');

          return { 
              ...client, 
              _offers: offers, 
              _lastActivity: lastActivity,
              _v: v, _p: p, _l: l,
              _notePreview: latestNoteContent 
          };
      });

      // 2. Filtrowanie (Imię, Nazwisko, NIP, Telefon, Email)
      const filtered = withMeta.filter(client => {
        const term = searchTerm.toLowerCase();
        
        // Basic fields
        const matchesName = (client.lastName || '').toLowerCase().includes(term) || (client.firstName || '').toLowerCase().includes(term);
        
        // Phones & Emails
        const matchesPhone = client.phones?.some(p => p.replace(/\s/g, '').includes(term));
        const matchesEmail = client.emails?.some(e => e.toLowerCase().includes(term));

        let matchesBusiness = false;
        if (!('isVirtual' in client)) {
            matchesBusiness = client.businesses?.some(b => (b.name || '').toLowerCase().includes(term) || b.nip?.includes(term));
        }
        
        let matchesSource = false;
        if ('isVirtual' in client) {
            matchesSource = (client as unknown as VirtualClient).sourcePolicies.some(p => p.label.toLowerCase().includes(term) || p.mainClientName.toLowerCase().includes(term));
        }

        return matchesName || matchesPhone || matchesEmail || matchesBusiness || matchesSource;
      });

      // 3. Sortowanie
      return filtered.sort((a, b) => {
          let valA: any = 0, valB: any = 0;

          switch(sortKey) {
              case 'name': valA = a.lastName; valB = b.lastName; break;
              case 'activity': valA = a._lastActivity; valB = b._lastActivity; break;
              case 'vehicles': valA = a._v; valB = b._v; break;
              case 'property': valA = a._p; valB = b._p; break;
              case 'life': valA = a._l; valB = b._l; break;
          }

          if (valA < valB) return sortDir === 'asc' ? -1 : 1;
          if (valA > valB) return sortDir === 'asc' ? 1 : -1;
          return 0;
      });

  }, [state.policies, state.clients, state.notes, trash, coOwnerList, showCoOwners, viewMode, searchTerm, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
      if (sortKey === key) {
          setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      } else {
          setSortKey(key);
          setSortDir('desc'); // Domyślnie malejąco (najwięcej/najnowsze)
      }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
      if (sortKey !== k) return <ArrowDown size={12} className="opacity-20 ml-1" />;
      return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1 text-zinc-900 dark:text-white" /> : <ArrowDown size={12} className="ml-1 text-zinc-900 dark:text-white" />;
  };

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    const handleGlobal = () => handleCloseContextMenu();
    window.addEventListener('click', handleGlobal);
    window.addEventListener('scroll', handleCloseContextMenu);
    return () => {
      window.removeEventListener('click', handleGlobal);
      window.removeEventListener('scroll', handleCloseContextMenu);
    };
  }, [handleCloseContextMenu]);

  const handleContextMenu = (e: React.MouseEvent, client: Client) => {
    e.preventDefault();
    const isVirtual = 'isVirtual' in client;
    setContextMenu({ 
        x: e.clientX, 
        y: e.clientY, 
        client, 
        isVirtual,
        sourcePolicyId: isVirtual ? (client as VirtualClient).sourcePolicies[0]?.id : undefined
    });
  };

  const openEditClient = (client: Client) => {
    setEditingClient(client);
    setIsClientModalOpen(true);
  };

  const openNewClient = () => {
      setEditingClient(null);
      setIsClientModalOpen(true);
  }

  const handleConvertToReal = (virtual: VirtualClient) => {
      setEditingClient({
          ...virtual,
          id: `c_${Date.now()}`,
          isVirtual: undefined,
          createdAt: new Date().toISOString()
      } as Client);
      setIsClientModalOpen(true);
  };

  return (
    <div className="p-6 md:p-10 max-w-[1920px] mx-auto select-none h-full flex flex-col">
      
      {/* HEADER BAR */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
              {showCoOwners ? <Users className="text-purple-600"/> : null} 
              {showCoOwners ? 'Rejestr Współwłaścicieli' : 'Baza Kontrahentów'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 font-medium">
              {showCoOwners 
                ? `Znaleziono ${processedList.length} potencjalnych leadów w polisach.`
                : `Zarządzaj portfelem ${state.clients.length} osób i ich firm.`
              }
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto items-center">
            {/* SWITCH */}
            <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg flex-shrink-0">
                <button 
                    onClick={() => { setShowCoOwners(false); setViewMode('CLIENTS'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${!showCoOwners && viewMode === 'CLIENTS' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Klienci
                </button>
                <button 
                    onClick={() => { setShowCoOwners(true); setViewMode('CLIENTS'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${showCoOwners ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    <LinkIcon size={12} /> Współwł.
                </button>
                <button 
                    onClick={() => { setShowCoOwners(false); setViewMode('ARCHIVE'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'ARCHIVE' ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    <Archive size={12} /> Archiwum
                </button>
            </div>

            {/* OMNI SEARCH */}
            <div className="relative flex-1 md:w-[400px] group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                className="block w-full pl-12 pr-10 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none font-bold shadow-sm bg-white dark:bg-zinc-900 transition-all text-sm" 
                placeholder={showCoOwners ? "Szukaj w polisach..." : "Szukaj: Nazwisko, Telefon, E-mail, Firma..."}
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
              {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                      <X size={14} />
                  </button>
              )}
            </div>

            {/* ACTION */}
            {!showCoOwners && (
                <button onClick={openNewClient} className="flex items-center gap-2 px-6 py-3 bg-zinc-950 dark:bg-zinc-700 text-white rounded-xl text-sm font-black uppercase shadow-xl hover:bg-black dark:hover:bg-zinc-600 transition-all tracking-widest whitespace-nowrap justify-center">
                    <Plus size={18} /> <span>Nowy Klient</span>
                </button>
            )}
        </div>
      </div>

      {/* TABLE */}
      <div className={`flex-1 bg-white dark:bg-zinc-900 border-2 ${showCoOwners ? 'border-amber-400' : 'border-zinc-100 dark:border-zinc-800'} rounded-2xl shadow-xl overflow-hidden flex flex-col`}>
        <div className="overflow-x-auto overflow-y-auto scrollbar-hide flex-1">
          <table className="w-full text-left border-collapse">
            <thead className={`sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 ${showCoOwners ? 'border-purple-100' : 'border-zinc-100 dark:border-zinc-800'} text-[10px] uppercase font-black text-zinc-400 tracking-widest`}>
              <tr>
                <th onClick={() => handleSort('name')} className={`px-8 ${isCompact ? 'py-3' : 'py-5'} cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-[30%]`}>
                    <div className="flex items-center">Osoba / Notatka <SortIcon k="name"/></div>
                </th>
                <th onClick={() => handleSort('activity')} className={`px-8 ${isCompact ? 'py-3' : 'py-5'} cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors`}>
                    <div className="flex items-center gap-1"><Clock size={12}/> Ostatnia Aktywność <SortIcon k="activity"/></div>
                </th>
                <th className={`px-8 ${isCompact ? 'py-3' : 'py-5'}`}>Kontakt & Firma</th>
                
                {showCoOwners ? (
                    <th className={`px-4 ${isCompact ? 'py-3' : 'py-5'} text-center`}>Status Leada</th>
                ) : (
                    <>
                        <th onClick={() => handleSort('vehicles')} className={`px-4 ${isCompact ? 'py-3' : 'py-5'} text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
                            <div className="flex items-center justify-center"><Car size={14} className="mr-1"/> <SortIcon k="vehicles"/></div>
                        </th>
                        <th onClick={() => handleSort('property')} className={`px-4 ${isCompact ? 'py-3' : 'py-5'} text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
                            <div className="flex items-center justify-center"><Home size={14} className="mr-1"/> <SortIcon k="property"/></div>
                        </th>
                        <th onClick={() => handleSort('life')} className={`px-4 ${isCompact ? 'py-3' : 'py-5'} text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
                            <div className="flex items-center justify-center"><Heart size={14} className="mr-1"/> <SortIcon k="life"/></div>
                        </th>
                        {/* OFFERS NOW LAST */}
                        <th className={`px-4 ${isCompact ? 'py-3' : 'py-5'} text-center bg-blue-50/30 dark:bg-blue-900/10`}>
                            <div className="flex items-center justify-center">Oferty (Daty)</div>
                        </th>
                    </>
                )}
                
                <th className={`px-8 ${isCompact ? 'py-3' : 'py-5'} text-right`}>
                    {viewMode === 'ARCHIVE' ? 'Opcje Archiwum' : 'Akcje'}
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${showCoOwners ? 'divide-purple-50' : 'divide-zinc-50 dark:divide-zinc-800'}`}>
              {processedList.map((client: any) => {
                const isVirtual = !!client.isVirtual;
                const paddingClass = isCompact ? 'py-3' : 'py-5';
                const avatarSize = isCompact ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-xl';
                const isAlsoCoOwner = !isVirtual && isClientAlsoCoOwner(client);

                return (
                  <tr 
                    key={client.id} 
                    onDoubleClick={() => {
                        if (isVirtual) {
                            const sourceId = (client as VirtualClient).sourcePolicies[0]?.id;
                            if (sourceId) {
                                const realClient = state.clients.find(c => state.policies.find(p => p.id === sourceId)?.clientId === c.id);
                                if (realClient) onNavigate('client-details', { client: realClient, highlightPolicyId: sourceId });
                            }
                        } else {
                            onNavigate('client-details', { client });
                        }
                    }} 
                    onContextMenu={(e) => handleContextMenu(e, client)} 
                    className={`transition-all group cursor-pointer ${showCoOwners ? 'hover:bg-purple-50/50' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800'}`}
                  >
                    {/* KOLUMNA 1: OSOBA + NOTATKA */}
                    <td className={`px-8 ${paddingClass} align-top`}>
                      <div className="flex items-start gap-4">
                        <div className={`${avatarSize} rounded-xl ${isVirtual ? 'bg-purple-100 text-purple-600' : 'bg-zinc-900 dark:bg-zinc-800 text-white'} flex items-center justify-center font-black shadow-lg group-hover:scale-105 transition-transform mt-1`}>
                          {(client.lastName || 'U')[0]}
                        </div>
                        <div>
                          <div className={`font-black text-zinc-950 dark:text-zinc-100 ${isCompact ? 'text-sm' : 'text-base'} tracking-tight leading-none group-hover:text-blue-600 transition-colors flex items-center gap-2 mb-1`}>
                            {client.lastName} {client.firstName}
                            {isAlsoCoOwner && !isVirtual && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[8px] font-black uppercase border border-purple-200" title="Ta osoba jest też współwłaścicielem w innej polisie">
                                    <LinkIcon size={8} className="mr-1"/> Współwł.
                                </span>
                            )}
                          </div>
                          
                          {/* CLIENT NOTE PREVIEW */}
                          {client._notePreview && (
                              <div className="flex items-start gap-1 mt-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30 p-1.5 rounded-lg max-w-[250px]">
                                  <StickyNote size={10} className="text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                                  <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 italic leading-tight line-clamp-2">
                                      {client._notePreview}
                                  </p>
                              </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* KOLUMNA 2: OSTATNIA AKTYWNOŚĆ */}
                    <td className={`px-8 ${paddingClass} align-top`}>
                        {client._lastActivity > 0 ? (
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                    {format(new Date(client._lastActivity), 'dd.MM.yyyy')}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-medium">
                                    {differenceInDays(new Date(), new Date(client._lastActivity))} dni temu
                                </span>
                            </div>
                        ) : (
                            <span className="text-zinc-300 text-[10px]">-</span>
                        )}
                    </td>

                    {/* KOLUMNA 3: KONTAKT I FIRMA */}
                    <td className={`px-8 ${paddingClass} align-top`}>
                      {isVirtual ? (
                          <div className="flex flex-col gap-2">
                              {(client as VirtualClient).sourcePolicies.slice(0, 2).map((src, i) => (
                                  <div key={i} className="flex items-center gap-2 text-[10px] bg-white dark:bg-zinc-900 border border-purple-100 dark:border-purple-900 rounded-lg p-1.5 shadow-sm">
                                      <div className={`p-1 rounded ${
                                          src.type === 'AUTO' ? 'bg-blue-50 text-blue-600' : 
                                          (src.type === 'PODROZ' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600')
                                      }`}>
                                          {src.type === 'AUTO' ? <Car size={12}/> : (src.type === 'PODROZ' ? <Plane size={12}/> : <Home size={12}/>)}
                                      </div>
                                      <div>
                                          <div className="font-bold text-zinc-700 dark:text-zinc-200">{src.label}</div>
                                          <div className="text-zinc-400 font-medium flex items-center gap-1">
                                              <User size={10} /> Główny: <span className="text-zinc-600 dark:text-zinc-300 font-bold">{src.mainClientName}</span>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="space-y-2">
                              {/* CONTACTS */}
                              <div className="flex flex-col gap-1">
                                {client.phones?.[0] ? (
                                    <div className="flex items-center gap-2 font-black text-zinc-700 dark:text-zinc-300 text-xs">
                                        <Phone size={12} className="text-zinc-400" /> {client.phones[0]}
                                    </div>
                                ) : null}
                                {client.emails?.[0] ? (
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-500 truncate max-w-[150px]">
                                        <Mail size={12} className="text-zinc-300" /> {client.emails[0]}
                                    </div>
                                ) : null}
                              </div>
                              
                              {/* BUSINESS */}
                              {client.businesses?.[0] && (
                                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                  <div className="text-[10px] font-black text-zinc-800 dark:text-zinc-300 uppercase truncate max-w-[200px] leading-tight">{client.businesses[0].name}</div>
                                  <div className="text-[9px] text-zinc-400 font-mono tracking-widest">NIP: {client.businesses[0].nip}</div>
                                </div>
                              )}
                          </div>
                      )}
                    </td>
                    
                    {/* STATYSTYKI & OFERTY (ALWAYS LAST) */}
                    {isVirtual ? (
                        <td className={`px-4 ${paddingClass} text-center align-middle`}>
                            <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-600 text-[9px] font-black uppercase border border-purple-200 shadow-sm">
                                LEAD
                            </span>
                        </td>
                    ) : (
                        <>
                            {/* PRODUCTS */}
                            <td className={`px-4 ${paddingClass} text-center align-middle`}>
                                <span className={`text-[10px] font-black ${client._v > 0 ? 'text-blue-600' : 'text-zinc-200'}`}>{client._v > 0 ? client._v : '-'}</span>
                            </td>
                            <td className={`px-4 ${paddingClass} text-center align-middle`}>
                                <span className={`text-[10px] font-black ${client._p > 0 ? 'text-emerald-600' : 'text-zinc-200'}`}>{client._p > 0 ? client._p : '-'}</span>
                            </td>
                            <td className={`px-4 ${paddingClass} text-center align-middle`}>
                                <span className={`text-[10px] font-black ${client._l > 0 ? 'text-rose-600' : 'text-zinc-200'}`}>{client._l > 0 ? client._l : '-'}</span>
                            </td>

                            {/* OFERTY (DATES) - MOVED TO END */}
                            <td className={`px-4 ${paddingClass} text-center align-top bg-blue-50/20 dark:bg-blue-900/5`}>
                                {client._offers && client._offers.length > 0 ? (
                                    <div className="flex flex-col items-center gap-1 mt-1">
                                        {client._offers.slice(0, 3).map((off: Policy) => {
                                            const d = new Date(off.createdAt);
                                            const isFresh = differenceInDays(new Date(), d) < 7;
                                            return (
                                                <div key={off.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black border w-full justify-center ${isFresh ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white text-zinc-500 border-zinc-200'}`}>
                                                    <Calendar size={8} />
                                                    {format(d, 'dd.MM')}
                                                </div>
                                            );
                                        })}
                                        {client._offers.length > 3 && <span className="text-[8px] text-zinc-400">+{client._offers.length - 3}</span>}
                                    </div>
                                ) : (
                                    <span className="text-zinc-200 dark:text-zinc-800 text-xs">-</span>
                                )}
                            </td>
                        </>
                    )}

                    <td className={`px-8 ${paddingClass} text-right align-middle`}>
                      <div className="flex items-center justify-end gap-2">
                        {viewMode === 'ARCHIVE' ? (
                          <>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRestoreClient(client._archiveId); }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-all border border-emerald-100 dark:border-emerald-800"
                                title="Przywróć klienta i wszystkie jego dane"
                            >
                                <RotateCcw size={14} /> Przywróć
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onPurgeClient(client._archiveId); }}
                                className="p-1.5 text-zinc-300 hover:text-red-600 transition-all"
                                title="Usuń trwale z archiwum"
                            >
                                <Trash size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            {!isVirtual && onDeleteClient && (
                              <DeleteSafetyButton 
                                onConfirm={() => onDeleteClient(client.id)} 
                                label="Zarchiwizuj klienta"
                                iconSize={18}
                                popoverPlacement="left"
                              />
                            )}
                            <button 
                              onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if(isVirtual) {
                                      const sourceId = (client as VirtualClient).sourcePolicies[0]?.id;
                                      if (sourceId) {
                                          const realClient = state.clients.find(c => state.policies.find(p => p.id === sourceId)?.clientId === c.id);
                                          if (realClient) onNavigate('client-details', { client: realClient, highlightPolicyId: sourceId });
                                      }
                                  } else {
                                      onNavigate('client-details', { client }); 
                                  }
                              }} 
                              className="p-2.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title={isVirtual ? "Pokaż źródło" : "Otwórz profil (2-klik)"}
                            >
                              <ArrowRight size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {processedList.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                       <User size={48} className="text-zinc-400" />
                       <p className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                           {showCoOwners ? 'Brak współwłaścicieli w polisach' : 'Brak wyników wyszukiwania'}
                       </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div 
          className="fixed z-[100] w-64 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl py-3 animate-in fade-in zoom-in-95 duration-150 overflow-hidden" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-5 py-2 border-b border-zinc-50 dark:border-zinc-800 mb-2">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {contextMenu.isVirtual ? 'LEAD (Współwłaściciel)' : 'KONTRAHENT'}
            </p>
            <p className="text-sm font-black text-zinc-950 dark:text-zinc-100 truncate leading-tight mt-0.5">{contextMenu.client?.lastName} {contextMenu.client?.firstName}</p>
          </div>
          
          {contextMenu.isVirtual ? (
              <>
                <button 
                    onClick={() => { handleConvertToReal(contextMenu.client as VirtualClient); setContextMenu(null); }} 
                    className="w-full flex items-center gap-3 px-5 py-3 text-purple-600 hover:bg-purple-50 transition-colors font-black text-[11px] uppercase tracking-tight"
                >
                    <User size={16} /> Załóż Kartotekę Klienta
                </button>
                <button 
                    onClick={() => { 
                        if (contextMenu.sourcePolicyId) {
                            const realClient = state.clients.find(c => state.policies.find(p => p.id === contextMenu.sourcePolicyId)?.clientId === c.id);
                            if (realClient) onNavigate('client-details', { client: realClient, highlightPolicyId: contextMenu.sourcePolicyId });
                        }
                        setContextMenu(null); 
                    }} 
                    className="w-full flex items-center gap-3 px-5 py-3 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-black text-[11px] uppercase tracking-tight"
                >
                    <LinkIcon size={16} /> Przejdź do Polisy
                </button>
              </>
          ) : (
              <>
                <button 
                    onClick={() => { openEditClient(contextMenu.client!); setContextMenu(null); }} 
                    className="w-full flex items-center gap-3 px-5 py-3 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-black text-[11px] uppercase tracking-tight"
                >
                    <Edit2 size={16} /> Modyfikuj Dane
                </button>
                <div className="border-t border-zinc-50 dark:border-zinc-800 my-2"></div>
                <button 
                    onClick={() => { onNavigate('client-details', { client: contextMenu.client }); setContextMenu(null); }} 
                    className="w-full flex items-center gap-3 px-5 py-3 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-black text-[11px] uppercase tracking-tight"
                >
                    <ExternalLink size={16} /> Panel Klienta (2-klik)
                </button>
              </>
          )}
        </div>
      )}

      <ClientFormModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onSave={onSaveClient} initialData={editingClient} />
    </div>
  );
};
