
import React, { useState } from 'react';
import { 
  Home, Trello, Calendar as CalendarIcon, ShieldAlert, RefreshCcw, 
  Car, Home as HomeIcon, Heart, Plane, Users, Lightbulb, Palette, 
  Activity, Shield, Bell, PlusCircle, Handshake, PenTool,
  Settings2, ChevronDown, ChevronRight, Save, Building2,
  FileSpreadsheet, Bug, FileDown, Banknote, Plus, Stethoscope
} from 'lucide-react';
import { AppState, PolicyType, UiPreferences } from '../../types';
import { NavButton } from './NavButton';
import { BackupManager } from '../BackupManager';
import { ThemeSettings } from '../ThemeSettings';
import { differenceInDays } from 'date-fns';
import { storage } from '../../services/storage';

export const MENU_CATEGORIES = [
  { id: 'all', label: 'Pulpit', icon: Home, types: undefined, sortByDate: false },
  { id: 'offers', label: 'Tablica', icon: Trello, types: undefined, sortByDate: false },
  { id: 'calendar', label: 'Terminarz', icon: CalendarIcon, types: undefined, sortByDate: false },
  { id: 'terminations', label: 'Wypowiedzenia', icon: ShieldAlert, types: undefined, sortByDate: false },
  { id: 'insurers', label: 'Towarzystwa', icon: Building2, types: undefined, sortByDate: false }, 
  { 
      id: 'renewals', 
      label: 'Wznowienia', 
      icon: RefreshCcw, 
      types: ['OC', 'AC', 'BOTH', 'DOM', 'ZYCIE', 'FIRMA', 'INNE'] as PolicyType[], 
      sortByDate: true 
  },
  // Products now have explicit config for "Mini Add"
  { id: 'vehicles', label: 'Pojazdy', icon: Car, types: ['OC', 'AC', 'BOTH'] as PolicyType[], sortByDate: false, addType: 'OC' },
  { id: 'property', label: 'Majątek', icon: HomeIcon, types: ['DOM'] as PolicyType[], sortByDate: false, addType: 'DOM' },
  { id: 'life', label: 'Życiowe', icon: Heart, types: ['ZYCIE'] as PolicyType[], sortByDate: false, addType: 'ZYCIE' },
  { id: 'travel', label: 'Turystyczne', icon: Plane, types: ['PODROZ'] as PolicyType[], sortByDate: false, addType: 'PODROZ' },
];

interface SidebarProps {
  state: AppState;
  uiPrefs: UiPreferences;
  currentPage: string;
  activeCategory: string;
  unreadNotifCount: number;
  showThemeSettings: boolean;
  
  onNavigate: (page: string, data?: any) => void;
  onCategorySelect: (id: string, types: PolicyType[] | undefined, sortByDate: boolean) => void;
  onToggleNotifications: () => void;
  onToggleTheme: () => void;
  onToggleImporter: () => void;
  onToggleActivityLog: () => void;
  onToggleTester: () => void;
  onUpdateUiPrefs: (prefs: UiPreferences) => void;
  onRefreshData: () => void;
  onAddClient: () => void; // NOWE
}

export const Sidebar: React.FC<SidebarProps> = ({
  state,
  uiPrefs,
  currentPage,
  activeCategory,
  unreadNotifCount,
  showThemeSettings,
  onNavigate,
  onCategorySelect,
  onToggleNotifications,
  onToggleTheme,
  onToggleImporter,
  onToggleActivityLog,
  onToggleTester,
  onUpdateUiPrefs,
  onRefreshData,
  onAddClient
}) => {
  const [isSystemOpen, setIsSystemOpen] = useState(false);

  const getCategoryCount = (categoryId: string, types?: PolicyType[]) => {
    if (!state.policies) return 0;
    
    if (categoryId === 'all') return state.policies.length;
    if (categoryId === 'calendar') return 0; 
    if (categoryId === 'terminations') return state.terminations ? state.terminations.length : 0;
    if (categoryId === 'insurers') return state.insurers ? state.insurers.length : 0;
    if (categoryId === 'offers') {
        return state.policies.filter(p => ['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt'].includes(p.stage)).length;
    }
    if (categoryId === 'renewals') {
        const today = new Date();
        return state.policies.filter(p => {
            // FIX CRITICAL: Polisy turystyczne (PODROZ) nigdy nie są wznawiane.
            if (p.type === 'PODROZ') return false;
            
            const end = new Date(p.policyEndDate);
            const diff = differenceInDays(end, today);
            // Tylko polisy, które kończą się w ciągu najbliższych 45 dni lub są już po terminie
            return diff >= -30 && diff <= 45; 
        }).length;
    }
    if (types) {
        return state.policies.filter(p => types.includes(p.type)).length;
    }
    return 0;
  };

  const handleQuickSave = () => {
      storage.exportToJSON();
      onRefreshData(); 
  };

  // Helper to render standard category buttons
  const renderNavBtn = (id: string, labelOverride?: string, iconOverride?: any, navTarget?: string) => {
      const config = MENU_CATEGORIES.find(c => c.id === id);
      if (!config && !navTarget) return null;

      const label = labelOverride || config?.label || id;
      const Icon = iconOverride || config?.icon || Users;
      const count = getCategoryCount(id, config?.types);
      const target = navTarget || id;
      
      const isActive = (currentPage === target) || (currentPage === 'dashboard' && activeCategory === id);

      return (
        <div className="relative group/btn-container">
            <NavButton 
                key={id}
                icon={Icon}
                label={label}
                count={count}
                isActive={isActive}
                onClick={() => {
                    if (config) onCategorySelect(config.id, config.types, config.sortByDate);
                    if (['calendar', 'offers', 'terminations', 'insurers', 'clients', 'sub-agents', 'finance', 'raw-data', 'data-repair'].includes(target)) onNavigate(target);
                    else onNavigate('dashboard');
                }}
            />
            {/* MINI ADD BUTTON FOR PRODUCTS */}
            {(config as any)?.addType && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('new', { initialType: (config as any).addType });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-emerald-600 transition-all opacity-0 group-hover/btn-container:opacity-100 z-10"
                    title={`Szybkie dodanie: ${label}`}
                >
                    <Plus size={14} strokeWidth={3} />
                </button>
            )}
        </div>
      );
  };

  const Separator = () => <div className="border-t border-zinc-800/50 my-3 mx-4" />;

  return (
    <aside className="w-full md:w-64 bg-zinc-950 border-r border-zinc-900 flex-shrink-0 print:hidden text-zinc-400 flex flex-col h-auto md:h-screen sticky top-0 z-10 shadow-2xl">
        
        {/* Header */}
        <div className="p-6 flex items-center gap-3 mb-2 justify-between">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-900/50">
                <Shield size={18} />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-wide text-zinc-100 leading-none">CRM Pro</h1>
                <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mt-1">v5.0</p>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
              <button onClick={handleQuickSave} className="p-2 rounded-xl transition-all text-emerald-600 hover:text-emerald-400 hover:bg-zinc-900">
                 <Save size={18} />
              </button>
              <button onClick={onToggleNotifications} className={`p-2 rounded-xl transition-all relative ${unreadNotifCount > 0 ? 'text-white bg-zinc-900' : 'text-zinc-600 hover:text-white'}`}>
                 <Bell size={18} />
                 {unreadNotifCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-zinc-950 animate-pulse"></span>}
              </button>
           </div>
        </div>
        
        {/* Main Navigation */}
        <nav className="px-3 space-y-1 flex-1 overflow-y-auto scrollbar-hide pb-10">
          
          {/* GROUP 1: OPERATIONAL */}
          {renderNavBtn('all', 'Pulpit')}
          
          {/* BAZA KLIENTÓW Z PRZYCISKIEM PLUS */}
          <div className="relative group/btn-container">
                <NavButton 
                    icon={Users} 
                    label="Baza Klientów" 
                    count={state.clients ? state.clients.length : 0} 
                    isActive={['clients', 'client-details'].includes(currentPage)} 
                    onClick={() => onNavigate('clients')} 
                />
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddClient();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-blue-600 transition-all opacity-0 group-hover/btn-container:opacity-100 z-10"
                    title="Dodaj Nowego Klienta"
                >
                    <Plus size={14} strokeWidth={3} />
                </button>
          </div>

          {renderNavBtn('offers', 'Tablica')}
          {renderNavBtn('calendar', 'Terminarz')}

          <Separator />

          {/* GROUP 2: PRODUCTS (Quick Add) */}
          <div className="px-3 mb-2">
              <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Produkty</span>
          </div>
          {renderNavBtn('vehicles')}
          {renderNavBtn('property')}
          {renderNavBtn('life')}
          {renderNavBtn('travel')}

          <Separator />

          {/* GROUP 3: RETENTION */}
          <div className="px-3 mb-2">
              <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Retencja</span>
          </div>
          {renderNavBtn('offers', 'Panel Ofert', Trello)}
          {renderNavBtn('renewals')}
          {renderNavBtn('terminations')}

          <Separator />

          {/* GROUP 4: BUSINESS */}
          <div className="px-3 mb-2">
              <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Biznes</span>
          </div>
          <NavButton 
                icon={Handshake} 
                label="Pośrednicy" 
                count={state.subAgents?.length || 0} 
                isActive={currentPage === 'sub-agents'} 
                onClick={() => onNavigate('sub-agents')} 
          />
          <NavButton 
                icon={Banknote} 
                label="Finanse" 
                isActive={currentPage === 'finance'} 
                onClick={() => onNavigate('finance')} 
          />
          {renderNavBtn('insurers')}

          <Separator />

          {/* GROUP 5: DATA */}
          <button onClick={onToggleImporter} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-1 group font-medium hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-200">
             <FileDown className="w-4 h-4 text-zinc-500 group-hover:text-blue-400" />
             <span className="flex-1 text-left">Import XLSX</span>
          </button>
          <NavButton icon={FileSpreadsheet} label="XLSX Master View" isActive={currentPage === 'raw-data'} onClick={() => onNavigate('raw-data')} />
          <NavButton icon={Stethoscope} label="Naprawa Danych" isActive={currentPage === 'data-repair'} onClick={() => onNavigate('data-repair')} variant="warning" />

          <Separator />

          {/* GROUP 6: ADMIN & TOOLS */}
          <div>
            <button onClick={() => setIsSystemOpen(!isSystemOpen)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all mb-1 hover:bg-zinc-900 ${isSystemOpen ? 'text-zinc-200 bg-zinc-900' : 'text-zinc-600'}`}>
                <div className="flex items-center gap-2"><Settings2 size={14} /> Dane i Narzędzia</div>
                {isSystemOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isSystemOpen && (
                <div className="space-y-1 pl-2 animate-in slide-in-from-top-2 duration-200">
                    <button onClick={() => onNavigate('form-builder')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 ${currentPage === 'form-builder' ? 'text-white' : ''}`}><PenTool size={14} /> Architekt Formularzy</button>
                    <button onClick={() => onNavigate('vision')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 ${currentPage === 'vision' ? 'text-white' : ''}`}><Lightbulb size={14} /> Vision Labs</button>
                    <button onClick={onToggleTheme} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 ${showThemeSettings ? 'text-white' : ''}`}><Palette size={14} /> Wygląd (Motyw)</button>
                    {showThemeSettings && <div className="pl-3 border-l border-zinc-800 ml-3"><ThemeSettings prefs={uiPrefs} onUpdate={onUpdateUiPrefs} /></div>}
                    <button onClick={onToggleActivityLog} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-500 hover:text-amber-400 hover:bg-zinc-900/50"><Activity size={14} /> Rejestr Czynności</button>
                    <button onClick={onToggleTester} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-500 hover:text-yellow-400 hover:bg-zinc-900/50"><Bug size={14} /> BugBot / Tester</button>
                    
                    <div className="mt-2 pt-2 border-t border-zinc-900"><BackupManager onRefresh={onRefreshData} /></div>
                </div>
            )}
          </div>

        </nav>
    </aside>
  );
};