import React, { useState } from 'react';
import {
  Home, Trello, Calendar as CalendarIcon, ShieldAlert, RefreshCcw,
  Car, Home as HomeIcon, Heart, Plane, Users, Lightbulb, Palette,
  Activity, Shield, Bell, PlusCircle, Handshake, PenTool,
  Settings2, ChevronDown, ChevronRight, Save, Building2,
  FileSpreadsheet, Bug, FileDown, Banknote, Plus, Stethoscope,
  Trash2, TableProperties, Camera, Zap
} from 'lucide-react';
import { AppState, PolicyType, UiPreferences } from '../../types';
import { NavButton } from './NavButton';
import { BackupManager } from '../BackupManager';
import { ThemeSettings } from '../ThemeSettings';
import { differenceInDays } from 'date-fns';
import { storage, supabaseStorage } from '../../services/storage';
import { PassphraseModal } from '../PassphraseModal';
import '../../v1-themes.css';

export const MENU_CATEGORIES = [
  { id: 'all', label: 'Pulpit', icon: Zap, types: undefined, sortByDate: false },
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
  { id: 'vehicles', label: 'Pojazdy', icon: Car, types: ['OC', 'AC', 'BOTH'] as PolicyType[], sortByDate: false, addType: 'OC' },
  { id: 'property', label: 'Majątek', icon: HomeIcon, types: ['DOM'] as PolicyType[], sortByDate: false, addType: 'DOM' },
  { id: 'life', label: 'Życiowe', icon: Heart, types: ['ZYCIE'] as PolicyType[], sortByDate: false, addType: 'ZYCIE' },
  { id: 'travel', label: 'Turystyczne', icon: Plane, types: ['PODROZ'] as PolicyType[], sortByDate: false, addType: 'PODROZ' },
];

// skin is now part of UiPreferences

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
  onAddClient: () => void;
  onOpenSnapshots?: () => void;
  onWipeData?: () => void;
  isAdmin?: boolean;
  isSyncing?: boolean;
}

// ─── Skin-aware class helpers ────────────────────────────────────────────────
// note: skin comes from uiPrefs.skin

function sidebarBase(skin: string) {
  // We now use the Premium Indigo-Glass background as the default for the V1 Island to ensure visual hardening
  return 'v1-sidebar bg-zinc-950 text-white border-r border-zinc-800/50 bg-gradient-to-b from-[#020617] via-[#020617] to-[#1e1b4b] shadow-[10px_0_40px_rgba(0,0,0,0.5)] transition-all duration-700';
}

function navBtnBase(skin: string, isActive: boolean) {
  if (skin === 'default') {
    return isActive
      ? 'bg-zinc-800 text-white'
      : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200';
  }
  return `v1-nav-btn${isActive ? ' active' : ''}`;
}

function sepClass(skin: string) {
  return skin === 'default' ? 'border-t border-zinc-800/50 my-3 mx-4' : 'v1-sep border-t my-3 mx-4';
}

function labelClass(skin: string) {
  return skin === 'default'
    ? 'text-[9px] font-black uppercase text-zinc-600 tracking-widest'
    : 'v1-label';
}

function badgeClass(skin: string) {
  return skin === 'default'
    ? 'text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400'
    : 'v1-badge';
}

function iconBtnClass(skin: string) {
  if (skin === 'default') return 'p-2 rounded-xl transition-all';
  return 'v1-icon-btn p-3 rounded-xl transition-all cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105';
}

// Skin selection moved to ThemeSettings

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

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
  onAddClient,
  onOpenSnapshots,
  onWipeData,
  isAdmin = false,
  isSyncing = false,
}) => {
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const skin = uiPrefs.skin || 'default';

  const getCategoryCount = (categoryId: string, types?: PolicyType[]) => {
    if (!state.policies) return 0;
    if (categoryId === 'all') return state.policies.length;
    if (categoryId === 'calendar') return 0;
    if (categoryId === 'terminations') return state.terminations?.length ?? 0;
    if (categoryId === 'insurers') return state.insurers?.length ?? 0;
    if (categoryId === 'offers') {
      return state.policies.filter(p => ['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt'].includes(p.stage)).length;
    }
    if (categoryId === 'renewals') {
      const today = new Date();
      return state.policies.filter(p => {
        if (p.type === 'PODROZ') return false;
        const diff = differenceInDays(new Date(p.policyEndDate), today);
        return diff >= -30 && diff <= 45;
      }).length;
    }
    if (types) return state.policies.filter(p => types.includes(p.type)).length;
    return 0;
  };

  const Separator = () => <div className={sepClass(skin)} />;

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-3 mb-1.5 mt-1">
      <span className={labelClass(skin)}>{label}</span>
    </div>
  );

  // Generic nav button renderer — uses skin-aware classes
  const renderNavBtn = (id: string, labelOverride?: string, iconOverride?: any, navTarget?: string) => {
    const config = MENU_CATEGORIES.find(c => c.id === id);
    if (!config && !navTarget) return null;

    const label = labelOverride || config?.label || id;
    const Icon  = iconOverride  || config?.icon  || Users;
    const count = getCategoryCount(id, config?.types);
    const target = navTarget || id;
    const isActive = (currentPage === target) || (currentPage === 'dashboard' && activeCategory === id);

    const handleClick = () => {
      if (config) onCategorySelect(config.id, config.types, config.sortByDate);
      if (['calendar','offers','terminations','insurers','clients','sub-agents','finance','raw-data','data-repair'].includes(target))
        onNavigate(target);
      else onNavigate('dashboard');
    };

    if (skin === 'default') {
      // Oryginalny NavButton component
      return (
        <div className="relative group/btn-container" key={`${id}-${label}`}>
          <NavButton icon={Icon} label={label} count={count} isActive={isActive} onClick={handleClick} />
          {(config as any)?.addType && (
            <button
              onClick={e => { e.stopPropagation(); onNavigate('new', { initialType: (config as any).addType }); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-emerald-600 transition-all opacity-0 group-hover/btn-container:opacity-100 z-10"
              title={`Dodaj: ${label}`}
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          )}
        </div>
      );
    }

    // Themed button
    return (
      <div className="relative group/btn-container" key={`${id}-${label}`}>
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium mb-0.5 ${navBtnBase(skin, isActive)}`}
          style={{ borderRadius: 'var(--v1-radius)', borderLeft: isActive ? '3px solid var(--v1-active-border)' : '3px solid transparent' }}
        >
          <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : .65 }} />
          <span className="flex-1 text-left">{label}</span>
          {count > 0 && <span className={badgeClass(skin)}>{count}</span>}
        </button>
        {(config as any)?.addType && (
          <button
            onClick={e => { e.stopPropagation(); onNavigate('new', { initialType: (config as any).addType }); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover/btn-container:opacity-100 z-10 transition-all"
            style={{ background: 'var(--v1-accent)', color: 'var(--v1-accent-fg)', borderRadius: 'var(--v1-radius-sm)' }}
            title={`Dodaj: ${label}`}
          >
            <Plus size={13} strokeWidth={3} />
          </button>
        )}
      </div>
    );
  };

  const themedNavRow = (Icon: any, label: string, isActive: boolean, onClick: () => void, count?: number) => {
    if (skin === 'default') {
      return <NavButton icon={Icon} label={label} count={count} isActive={isActive} onClick={onClick} />;
    }
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium mb-0.5 ${navBtnBase(skin, isActive)}`}
        style={{ borderRadius: 'var(--v1-radius)', borderLeft: isActive ? '3px solid var(--v1-active-border)' : '3px solid transparent' }}
      >
        <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : .65 }} />
        <span className="flex-1 text-left">{label}</span>
        {count !== undefined && count > 0 && <span className={badgeClass(skin)}>{count}</span>}
      </button>
    );
  };

  return (
    <aside
      data-v1-skin={skin !== 'default' ? skin : undefined}
      className={`w-full md:w-64 flex-shrink-0 print:hidden flex flex-col h-auto md:h-screen sticky top-0 z-10 shadow-2xl ${sidebarBase(skin)}`}
    >
      {/* --- PREMIUM HEADER --- */}
      <div className="p-6 mb-2 relative overflow-hidden group">
        {/* Animated Glow Background */}
        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 blur-[100px] rounded-full" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-[1.25rem] border border-white/10 flex items-center justify-center shadow-2xl shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400 blur-md opacity-30 animate-pulse" />
              <Activity className="w-6 h-6 text-indigo-400 relative z-10" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tighter text-white">ALINA</span>
              <span className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[9px] font-black text-indigo-400 uppercase tracking-widest">v1</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Atomic CRM</span>
          </div>
        </div>
      </div>

        {/* --- PREMIUM QUICK ACTION DOCK (HARDENING TOOLS) --- */}
        <div className="px-3 mb-6 relative group">
          <div className={`p-2 flex items-center justify-around gap-2 shadow-2xl ${
            skin === 'default' 
              ? 'bg-zinc-900/50 border border-zinc-800 rounded-xl' 
              : 'v1-quick-dock bg-indigo-950/40 backdrop-blur-2xl border border-indigo-500/20 rounded-[2rem] ring-1 ring-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
          }`}>
            
            {/* SNAPSHOT (admin only) - Emerald Glow */}
            {isAdmin && onOpenSnapshots && (
              <>
                <button
                  onClick={onOpenSnapshots}
                  className="p-3 relative group/snap transition-all hover:scale-110 active:scale-90 text-emerald-500 hover:text-emerald-400"
                  title="Snapshoty bazy (admin)"
                >
                  <div className="absolute inset-0 bg-emerald-500/0 group-hover/snap:bg-emerald-500/20 blur-xl rounded-full transition-all" />
                  <Camera size={20} strokeWidth={1.5} className="relative z-10" />
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1" />
              </>
            )}

            {/* ADD CLIENT - Indigo Glow */}
            <button
              onClick={onAddClient}
              className="p-3 relative group/add transition-all hover:scale-110 active:scale-90 text-indigo-500 hover:text-indigo-400"
              title="Dodaj Klienta"
            >
              <div className="absolute inset-0 bg-indigo-500/0 group-hover/add:bg-indigo-500/20 blur-xl rounded-full transition-all" />
              <Plus size={20} strokeWidth={1.5} className="relative z-10" />
            </button>

            {/* NUCLEAR RESET (admin only) - Rose Glow */}
            {isAdmin && onWipeData && (
              <button
                onClick={onWipeData}
                className="p-3 relative group/wipe transition-all hover:scale-110 active:scale-90 text-rose-500 hover:text-rose-400"
                title="Wyczyść dane tenantu (admin, NUCLEAR RESET)"
              >
                <div className="absolute inset-0 bg-rose-500/0 group-hover/wipe:bg-rose-500/20 blur-xl rounded-full transition-all" />
                <Trash2 size={20} strokeWidth={1.5} className="relative z-10" />
              </button>
            )}
          </div>
        </div>

      {/* Skin Selection integrated into ThemeSettings below */}

      {/* ── Navigation ── */}
      <nav className="px-3 space-y-0.5 flex-1 overflow-y-auto pb-10" style={{ scrollbarWidth: 'none' }}>

        {renderNavBtn('all', 'Pulpit')}

        {/* Baza Klientów + quick add */}
        <div className="relative group/btn-container">
          {themedNavRow(Users, 'Baza Klientów', ['clients','client-details'].includes(currentPage), () => onNavigate('clients'), state.clients?.length ?? 0)}
        </div>

        {renderNavBtn('offers', 'Tablica')}
        {renderNavBtn('calendar', 'Terminarz')}

        <Separator />
        <SectionLabel label="Produkty" />
        {renderNavBtn('vehicles')}
        {renderNavBtn('property')}
        {renderNavBtn('life')}
        {renderNavBtn('travel')}

        <Separator />
        <SectionLabel label="Retencja" />
        {renderNavBtn('offers', 'Panel Ofert', Trello)}
        {renderNavBtn('renewals')}
        {renderNavBtn('terminations')}

        <Separator />
        <SectionLabel label="Biznes" />
        {themedNavRow(Handshake, 'Pośrednicy', currentPage === 'sub-agents', () => onNavigate('sub-agents'), state.subAgents?.length ?? 0)}
        {themedNavRow(Banknote, 'Finanse', currentPage === 'finance', () => onNavigate('finance'))}
        {renderNavBtn('insurers')}

        <Separator />

        {/* Import */}
        <button
          onClick={onToggleImporter}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm mb-0.5 group font-medium transition-all ${skin !== 'default' ? 'v1-nav-btn' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'}`}
          style={skin !== 'default' ? { borderRadius: 'var(--v1-radius)' } : { borderRadius: '10px' }}
        >
          <FileDown size={16} style={{ opacity: .6 }} />
          <span className="flex-1 text-left">Import XLSX</span>
        </button>
        {themedNavRow(FileSpreadsheet, 'XLSX Master View', currentPage === 'raw-data', () => onNavigate('raw-data'))}
        {themedNavRow(Stethoscope, 'Naprawa Danych', currentPage === 'data-repair', () => onNavigate('data-repair'))}

        <Separator />

        {/* System / Tools */}
        <button
          onClick={() => setIsSystemOpen(!isSystemOpen)}
          className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all mb-1 ${
            skin === 'default'
              ? `hover:bg-zinc-900 ${isSystemOpen ? 'text-zinc-200 bg-zinc-900' : 'text-zinc-600'}`
              : 'v1-nav-btn'
          }`}
          style={skin !== 'default' ? { borderRadius: 'var(--v1-radius)' } : { borderRadius: '10px' }}
        >
          <div className="flex items-center gap-2"><Settings2 size={14} /> Dane i Narzędzia</div>
          {isSystemOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {isSystemOpen && (
          <div className="space-y-0.5 pl-2 animate-in slide-in-from-top-2 duration-200">
            {[
              { label: 'Architekt Formularzy', icon: PenTool, page: 'form-builder', action: () => onNavigate('form-builder') },
              { label: 'Vision Labs', icon: Lightbulb, page: 'vision', action: () => onNavigate('vision') },
              { label: 'Wygląd (Motyw)', icon: Palette, page: '_theme', action: onToggleTheme },
              { label: 'Rejestr Czynności', icon: Activity, page: '_log', action: onToggleActivityLog },
              { label: 'BugBot / Tester', icon: Bug, page: '_bug', action: onToggleTester },
              { label: 'Generuj Demo', icon: TableProperties, page: '_demo', action: onToggleTester },
            ].map(({ label, icon: Icon, page, action }) => (
              <button key={page} onClick={action}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all ${
                  skin === 'default'
                    ? `text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 rounded-lg ${currentPage === page ? 'text-white' : ''}`
                    : 'v1-nav-btn'
                }`}
                style={skin !== 'default' ? { borderRadius: 'var(--v1-radius-sm)' } : {}}
              >
                <Icon size={14} /> {label}
              </button>
            ))}

            {showThemeSettings && (
              <div className={`pl-3 ml-3 ${skin === 'default' ? 'border-l border-zinc-800' : ''}`}
                style={skin !== 'default' ? { borderLeft: '1px solid var(--v1-sep)' } : {}}>
                <ThemeSettings prefs={uiPrefs} onUpdate={onUpdateUiPrefs} />
              </div>
            )}
            {isAdmin && (
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--v1-sep, #27272A)' }}>
                <BackupManager onRefresh={onRefreshData} />
              </div>
            )}
          </div>
        )}
      </nav>

    </aside>
  );
};
