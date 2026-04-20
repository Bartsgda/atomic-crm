
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { PolicyFormModal } from './components/PolicyFormModal';
import { ClientFormModal } from './components/ClientFormModal';
import { TerminationPreview } from './components/TerminationPreview';
import { ClientsList } from './components/ClientsList';
import { ClientDetails } from './components/ClientDetails';
import { CalendarView } from './components/CalendarView';
import { OffersBoard } from './components/OffersBoard';
import { TerminationsView } from './components/Terminations/TerminationsView';
import { DataImporter } from './components/DataImporter';
import { ActivityLogView } from './components/ActivityLogView';
import { VisionBoard } from './components/VisionBoard';
import { AutoTester } from './components/Tester/AutoTester';
import { SubAgentsView } from './components/SubAgents/SubAgentsView';
import { TowarzystwaView } from './components/Insurers/TowarzystwaView'; 
import { FormArchitect } from './components/Builder/FormArchitect';
import { RawDataView } from './components/RawDataView'; 
import { FinanceView } from './components/Finance/FinanceView'; 
import { DataRepairView } from './components/DataRepair/DataRepairView';
import { Sidebar, MENU_CATEGORIES } from './components/Navigation/Sidebar';
import { storage, supabaseStorage } from './services/storage';
import { SnapshotDialog } from './components/SnapshotDialog';
import StatusEye from './components/StatusEye';
import { AppState, Client, Policy, PolicyType, ClientNote, UiPreferences } from './types';
import { Loader2, Wallet, TrendingUp, Cloud } from 'lucide-react';
import { AgentKaratekaWindow } from './components/GlobalAgent/AgentKaratekaWindow';
import { calculateAiDiffs, mergeAiResponseToPolicy } from './modules/utils/diffEngine';
import { useAutoWipe } from './hooks/useAutoWipe';
import { Lock, ShieldAlert } from 'lucide-react';


type Page = 'dashboard' | 'clients' | 'new' | 'edit-policy' | 'preview' | 'client-details' | 'calendar' | 'offers' | 'terminations' | 'vision' | 'sub-agents' | 'insurers' | 'form-builder' | 'raw-data' | 'finance' | 'data-repair' | 'test-page';

function App() {
  const [state, setState] = useState<AppState>({ clients: [], policies: [], notes: [], notifications: [], terminations: [], logs: [], subAgents: [], checklistTemplates: {}, insurers: [], insurerConfigs: {}, trash: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isLocked, setIsLocked] = useState(false);
  
  // Auto wipe is now managed globally by AuthBarrier.
  
  // Data Version Counter for Nuclear Re-renders
  const [dataVersion, setDataVersion] = useState(0);

  const [currentData, setCurrentData] = useState<{ 
      client?: Client, 
      policy?: Policy, 
      resumeNoteId?: string, 
      highlightPolicyId?: string, 
      autoOpenPolicyId?: string, 
      initialType?: PolicyType, 
      autoCreate?: boolean, 
      initialMode?: 'VIEW' | 'EDIT',
      injectedAiDiffs?: any 
  } | undefined>(undefined);
  
  const currentDataRef = useRef(currentData);
  const stateRef = useRef(state);

  useEffect(() => { currentDataRef.current = currentData; }, [currentData]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [isTesterOpen, setIsTesterOpen] = useState(false);
  const [isGlobalPolicyModalOpen, setIsGlobalPolicyModalOpen] = useState(false);
  const [isGlobalClientModalOpen, setIsGlobalClientModalOpen] = useState(false);
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSyncing] = useState(false);
  
  const [uiPrefs, setUiPrefs] = useState<UiPreferences>({ 
      theme: 'dark', 
      density: 'comfortable', 
      primaryColor: '#6366f1', 
      fontScale: 1.0,
      skin: 'premium'
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dashboardFilter, setDashboardFilter] = useState<PolicyType[] | undefined>(undefined);
  const [dashboardDateFilter, setDashboardDateFilter] = useState<string | null>(null);
  const [sortByDate, setSortByDate] = useState<boolean>(false);

  const unreadNotifCount = state.notifications.filter(n => !n.isRead).length;

  const applyTheme = useCallback((prefs: UiPreferences) => {
      const root = window.document.documentElement;
      if (prefs.theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
      root.style.fontSize = `${16 * prefs.fontScale}px`;
      root.style.setProperty('--primary-color', prefs.primaryColor);
      root.setAttribute('data-v1-skin', prefs.skin || 'default');
  }, []);

  const refreshData = useCallback(async () => {
    try {
        const freshState = await storage.init();
        const prefs = storage.getUiPrefs();
        
        // NUCLEAR REFRESH: Force new object reference to trigger React updates
        setState({ ...freshState }); 
        setDataVersion(v => v + 1); // Bump version counter
        
        setUiPrefs(prefs);
        applyTheme(prefs);
    } catch (e) {
        console.error("[App] RefreshData failure:", e);
    } finally {
        setIsLoading(false);
    }
  }, [applyTheme]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const updateUiPrefs = (newPrefs: UiPreferences) => {
      setUiPrefs(newPrefs);
      storage.saveUiPrefs(newPrefs);
      applyTheme(newPrefs);
  };

  const navigate = useCallback((page: Page, data?: any) => {
    if (page === 'edit-policy' && data?.policy) {
        const enhancedData = { 
            ...data, 
            initialType: data.policy.type, 
            initialMode: 'VIEW',
        };
        setCurrentData(enhancedData);
        setIsGlobalPolicyModalOpen(true);
        return;
    }

    if (page === 'new') {
        setCurrentData({ 
            ...data,
            initialMode: 'EDIT',
        });
        setIsGlobalPolicyModalOpen(true);
        return;
    }
    
    setCurrentData(data);
    setCurrentPage(page);
    window.scrollTo(0,0);
  }, []);

  // --- GLOBAL AI ACTION HANDLER ---
  const handleAgentAction = async (action: any): Promise<{ clientId?: string, policyId?: string } | void> => {
      console.log("[App] Agent Action Received:", action);

      // --- MODAL CONTROL ACTIONS ---
      if (action.action === 'OPEN_MODAL') {
          if (action.target === 'edit-client' && action.clientId) {
              const client = stateRef.current.clients.find(c => c.id === action.clientId);
              if (client) {
                  setCurrentData({ client });
                  setIsGlobalClientModalOpen(true);
                  return { clientId: client.id };
              }
          }
          if (action.target === 'edit-policy' && action.policyId) {
              const policy = stateRef.current.policies.find(p => p.id === action.policyId);
              if (policy) {
                  const client = stateRef.current.clients.find(c => c.id === policy.clientId);
                  setCurrentData({ policy, client, initialMode: 'EDIT', initialType: policy.type });
                  setIsGlobalPolicyModalOpen(true);
                  return { policyId: policy.id };
              }
          }
          if (action.target === 'new-policy' && action.clientId) {
              const client = stateRef.current.clients.find(c => c.id === action.clientId);
              if (client) {
                  setCurrentData({ client, initialMode: 'EDIT' });
                  setIsGlobalPolicyModalOpen(true);
                  return { clientId: client.id };
              }
          }
          return;
      }

      // --- EXISTING ACTIONS ---
      if (action.action === 'NAVIGATE_LIST') {
          const cat = MENU_CATEGORIES.find(c => c.id === action.category);
          if (cat) {
              setActiveCategory(cat.id);
              setDashboardFilter(cat.types);
              setSortByDate(cat.sortByDate);
          }
          if (action.timeRange) {
              setDashboardDateFilter(action.timeRange);
          } else {
              setDashboardDateFilter(null);
          }
          navigate('dashboard');
          return;
      }

      return; 
  };

  const handleMarkRead = async () => {
    const newState = await storage.markAllNotificationsRead();
    setState(newState);
  };

  // --- NUCLEAR REFRESH IMPLEMENTATION FOR POLICIES ---
  const handleGlobalPolicySave = async (client: Client, policy: Policy) => {
    // 1. Zapisz klienta (może być nowy lub zaktualizowany)
    await storage.addClient(client);
    
    // 2. Sprawdź czy polisa istnieje w AKTUALNYM stanie (ref)
    const exists = stateRef.current.policies.find(p => p.id === policy.id);
    
    // 3. Wykonaj operację zapisu (AWAIT!)
    if (exists) {
        await storage.updatePolicy(policy);
    } else {
        await storage.addPolicy(policy);
    }

    // 4. NUCLEAR REFRESH: Pobierz wszystko z dysku
    await refreshData();
    
    // 5. Zamknij modal
    setIsGlobalPolicyModalOpen(false);
  };

  const handleUpdatePolicy = async (policy: Policy) => {
    await storage.updatePolicy(policy);
    await refreshData(); // NUCLEAR REFRESH
  };

  const handleSaveClient = async (client: Client) => {
    try {
      await storage.addClient(client);
    } catch (err: any) {
      console.error('[App] handleSaveClient FAILED:', err);
      alert(`❌ Błąd zapisu klienta do Supabase:\n${err?.message || err}`);
      return;
    }
    await refreshData();
    if (isGlobalPolicyModalOpen) {
        setCurrentData(prev => ({ ...prev, client: client }));
    }
    if (currentPage === 'client-details' && currentData?.client?.id === client.id) {
        setCurrentData({ ...currentData, client: client });
    }
    setIsGlobalClientModalOpen(false);
  };

  const handleAddNote = async (note: ClientNote) => {
    await storage.addNote(note);
    await refreshData(); // NUCLEAR REFRESH
  };

  const handleUpdateNote = async (note: ClientNote) => {
    await storage.updateNote(note);
    await refreshData(); // NUCLEAR REFRESH
  };

  const handleDeleteNote = async (id: string) => {
    await storage.deleteNote(id);
    await refreshData(); // NUCLEAR REFRESH
  };

  const handleDeletePolicy = async (id: string) => {
    if(confirm('Czy na pewno usunąć tę polisę?')) {
        await storage.deletePolicy(id);
        await refreshData(); // NUCLEAR REFRESH
    }
  };

  const handleDeleteClient = async (id: string) => {
    // Note: The UI now uses DeleteSafetyButton for the primary confirmation.
    // This handler remains as the functional entry point for archival.
    await storage.deleteClient(id);
    await refreshData();
    
    storage.addNotification({
        id: `archive_${Date.now()}`,
        type: 'INFO',
        message: 'Klient został przeniesiony do archiwum.',
        timestamp: new Date().toISOString(),
        isRead: false
    });

    if (currentPage === 'client-details') {
        navigate('clients');
    }
  };

  const handleRestoreFromTrash = async (id: string) => {
      await storage.restoreFromTrash(id);
      await refreshData();
      storage.addNotification({
          id: `restore_${Date.now()}`,
          type: 'AI_SUCCESS',
          message: 'Element został przywrócony z archiwum.',
          timestamp: new Date().toISOString(),
          isRead: false
      });
  };

  const handlePurgeFromTrash = async (id: string) => {
      if (confirm("Czy na pewno chcesz TRWALE usunąć ten element z archiwum? Tej operacji nie da się cofnąć.")) {
          await storage.purgeFromTrash(id);
          await refreshData();
      }
  };


  const handleWipeSystem = async () => {
    if (confirm("☢️ NUCLEAR RESET: Czy na pewno chcesz usunąć WSZYSTKIE dane lokalne? Te operacja jest nieodwracalna!")) {
        await storage.clearAllData();
        window.location.reload();
    }
  };

  const handleCategorySelect = (id: string, types: PolicyType[] | undefined, sortByDate: boolean) => {
      setActiveCategory(id);
      setDashboardFilter(types);
      setDashboardDateFilter(null);
      setSortByDate(sortByDate);
  };

  useEffect(() => {
    supabaseStorage.isAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, []);

  // Integracja StatusEye → otwiera AutoTester / AgentKarateka
  useEffect(() => {
    const openTester = () => setIsTesterOpen(true);
    window.addEventListener('crm:open-tester', openTester);
    return () => window.removeEventListener('crm:open-tester', openTester);
  }, []);

  // Publikuj kontekst nawigacji dla feedback-bota
  useEffect(() => {
    const PAGE_LABELS: Record<string, string> = {
      dashboard: 'Pulpit',
      clients: 'Baza Klientów',
      'client-details': 'Szczegóły klienta',
      'new': 'Nowa polisa',
      'edit-policy': 'Edycja polisy',
      calendar: 'Terminarz',
      offers: 'Panel Ofert (Kanban)',
      terminations: 'Wypowiedzenia',
      vision: 'Vision Board',
      'sub-agents': 'Pośrednicy',
      insurers: 'Towarzystwa',
      'form-builder': 'Konstruktor formularzy',
      'raw-data': 'XLSX Master View',
      finance: 'Finanse',
      'data-repair': 'Naprawa Danych',
      'test-page': 'Tester',
      preview: 'Podgląd wypowiedzenia',
    };
    const ctx: any = {
      page: currentPage,
      pageLabel: PAGE_LABELS[currentPage] ?? currentPage,
      activeCategory,
      dashboardFilter,
      dashboardDateFilter,
      sortByDate,
    };
    if (currentData?.client) ctx.selectedClient = {
      id: currentData.client.id,
      name: `${currentData.client.firstName} ${currentData.client.lastName}`.trim(),
    };
    if (currentData?.policy) ctx.selectedPolicy = {
      id: currentData.policy.id,
      number: currentData.policy.policyNumber,
      type: currentData.policy.type,
    };
    (window as any).__CRM_CONTEXT__ = ctx;
    document.body.dataset.crmPage = currentPage;
    document.title = `ALINA — ${ctx.pageLabel}`;
  }, [currentPage, activeCategory, dashboardFilter, dashboardDateFilter, sortByDate, currentData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin" />
          <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">CRM PRO LOADING...</p>
        </div>
      </div>
    );
  }

  const handleWipeData = async () => {
    const confirmText = prompt("☢️ NUCLEAR RESET: usunie WSZYSTKIE dane tenantu w Supabase (klienci, polisy, notatki, kosz). Aby potwierdzić — wpisz: USUŃ WSZYSTKO");
    if (confirmText !== "USUŃ WSZYSTKO") return;
    try {
      await supabaseStorage.clearAllData();
      await refreshData();
      alert("✓ Dane tenantu wyczyszczone.");
    } catch (e: any) {
      alert("Błąd: " + (e?.message || e));
    }
  };

  return (
    <div className={`min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col md:flex-row print:block font-sans overflow-hidden transition-colors duration-300 ${uiPrefs.theme}`}>
      <style>{`
        :root {
            --primary-color: ${uiPrefs.primaryColor};
        }
        .text-primary { color: var(--primary-color) !important; }
        .bg-primary { background-color: var(--primary-color) !important; }
        .border-primary { border-color: var(--primary-color) !important; }
      `}</style>
      
      {showNotifications && (
        <div className="fixed inset-0 z-[200] flex items-start justify-end p-6 bg-zinc-950/20 backdrop-blur-sm" onClick={() => setShowNotifications(false)}>
        </div>
      )}

      {showActivityLog && (
          <ActivityLogView state={state} onClose={() => setShowActivityLog(false)} />
      )}

      <AgentKaratekaWindow state={state} onNavigate={navigate} onAgentAction={handleAgentAction} onRefresh={refreshData} />

      <AutoTester externalOpen={isTesterOpen} onClose={() => setIsTesterOpen(false)} />

      <PolicyFormModal 
          key={`policy-modal-${dataVersion}`} // Force remount on refresh if closed
          isOpen={isGlobalPolicyModalOpen}
          onClose={() => setIsGlobalPolicyModalOpen(false)}
          onSave={handleGlobalPolicySave}
          initialType={currentData?.initialType || currentData?.policy?.type} 
          initialPolicy={currentData?.policy}
          initialClient={currentData?.client}
          clients={state.clients} 
          initialMode={currentData?.initialMode || 'VIEW'}
          aiDiffs={currentData?.injectedAiDiffs}
          onAddNewClient={() => setIsGlobalClientModalOpen(true)}
          
          onOpenProfile={(client, policyId) => {
              setIsGlobalPolicyModalOpen(false);
              navigate('client-details', { client, highlightPolicyId: policyId });
          }}
      />

      <ClientFormModal
          isOpen={isGlobalClientModalOpen}
          onClose={() => setIsGlobalClientModalOpen(false)}
          onSave={handleSaveClient}
          initialData={currentData?.client}
      />

      <SnapshotDialog
          isOpen={isSnapshotDialogOpen}
          onClose={() => setIsSnapshotDialogOpen(false)}
          onRestored={refreshData}
      />

      <StatusEye />

      {isSyncing && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-500">
           <div className="flex flex-col items-center gap-6 p-10 bg-zinc-900/50 rounded-[3rem] border border-zinc-800 shadow-2xl animate-in zoom-in-95">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Cloud className="w-8 h-8 text-indigo-400 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-white tracking-tight mb-2">Synchronizacja...</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                  {pendingCloudAction === 'restore' ? 'Pobieranie i deszyfrowanie danych' : 'Szyfrowanie i wysyłka do chmury'}
                </p>
              </div>
           </div>
        </div>
      )}

      <Sidebar 
          state={state}
          uiPrefs={uiPrefs}
          currentPage={currentPage}
          activeCategory={activeCategory}
          unreadNotifCount={unreadNotifCount}
          showThemeSettings={showThemeSettings}
          onNavigate={navigate}
          onCategorySelect={handleCategorySelect}
          onToggleNotifications={() => { setShowNotifications(!showNotifications); if(!showNotifications) handleMarkRead(); }}
          onToggleTheme={() => setShowThemeSettings(!showThemeSettings)}
          onToggleImporter={() => setIsImporterOpen(true)}
          onToggleActivityLog={() => setShowActivityLog(true)}
          onToggleTester={() => setIsTesterOpen(!isTesterOpen)}
          onUpdateUiPrefs={updateUiPrefs}
          onRefreshData={refreshData}
          onAddClient={() => setIsGlobalClientModalOpen(true)}
          onOpenSnapshots={isAdmin ? () => setIsSnapshotDialogOpen(true) : undefined}
          onWipeData={isAdmin ? handleWipeData : undefined}
          isAdmin={isAdmin}
          isSyncing={isSyncing}
      />

      <main className="flex-1 overflow-auto h-screen print:h-auto print:overflow-visible relative bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="print:p-0 min-h-full h-full"> 
          
          {currentPage === 'dashboard' && (
            <Dashboard 
              key={`dashboard-${dataVersion}`} // Nuclear Re-mount
              state={state} 
              onNavigate={navigate} 
              onDeletePolicy={handleDeletePolicy} 
              filterTypes={dashboardFilter}
              predefinedDateRange={dashboardDateFilter} 
              categoryTitle={MENU_CATEGORIES.find(c => c.id === activeCategory)?.label}
              sortByDate={sortByDate}
              onImportComplete={refreshData}
              isCompact={uiPrefs.density === 'compact'}
            />
          )}

          {currentPage === 'vision' && <VisionBoard />}

          {currentPage === 'raw-data' && (
            <RawDataView state={state} />
          )}

          {currentPage === 'data-repair' && (
            <DataRepairView state={state} onRefresh={refreshData} onNavigate={navigate} />
          )}

          {currentPage === 'insurers' && (
            <TowarzystwaView state={state} onRefresh={refreshData} />
          )}

          {currentPage === 'finance' && (
            <FinanceView state={state} />
          )}

          {currentPage === 'form-builder' && <FormArchitect />}

          {currentPage === 'sub-agents' && (
            <SubAgentsView state={state} onNavigate={navigate} />
          )}

          {currentPage === 'offers' && (
            <OffersBoard 
                key={`offers-${dataVersion}`} // Nuclear Re-mount
                state={state} 
                onNavigate={navigate} 
                onRefresh={refreshData} 
            />
          )}

          {currentPage === 'calendar' && (
            <CalendarView state={state} onNavigate={navigate} onDeleteNote={handleDeleteNote} onRefresh={refreshData} />
          )}

          {currentPage === 'terminations' && (
            <TerminationsView state={state} onNavigate={navigate} onRefresh={refreshData} />
          )}

          {currentPage === 'clients' && (
            <ClientsList 
                key={`clients-${dataVersion}`} // Nuclear Re-mount
                state={state} 
                trash={state.trash}
                onNavigate={navigate} 
                onSaveClient={handleSaveClient}
                onDeleteClient={handleDeleteClient}
                onRestoreClient={handleRestoreFromTrash}
                onPurgeClient={handlePurgeFromTrash}
                onImportComplete={refreshData}
                initialAutoCreate={currentData?.autoCreate}
            />
          )}

          {currentPage === 'client-details' && currentData?.client && (
            <ClientDetails 
              key={`client-details-${currentData.client.id}-${dataVersion}`} // Nuclear Re-mount
              client={currentData.client}
              policies={state.policies}
              notes={state.notes}
              terminations={state.terminations}
              resumeNoteId={currentData.resumeNoteId}
              highlightPolicyId={currentData.highlightPolicyId}
              autoOpenPolicyId={currentData.autoOpenPolicyId}
              onNavigate={navigate}
              onDeletePolicy={handleDeletePolicy}
              onUpdatePolicy={handleUpdatePolicy}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onUpdateClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onRefresh={refreshData} // PASSED HERE
            />

          )}

          {currentPage === 'preview' && currentData?.client && currentData?.policy && (
            <div className="p-8 bg-zinc-100 dark:bg-zinc-900 min-h-full flex justify-center print:bg-white print:p-0">
              <TerminationPreview client={currentData.client} policy={currentData.policy} />
            </div>
          )}
        </div>
      </main>
      
      <DataImporter isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)} onImportComplete={refreshData} />

      {isLocked && (
        <div className="fixed inset-0 z-[1000] bg-zinc-950/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="max-w-md w-full text-center space-y-8">
              <div className="bg-red-600/20 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30 shadow-2xl shadow-red-500/20 animate-bounce">
                 <ShieldAlert className="text-white w-10 h-10" />
              </div>
              <div className="space-y-2">
                 <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Sesja Wygasła</h2>
                 <p className="text-zinc-400 text-sm">Z powodu 8 godzin bezczynności dane zostały usunięte z widoku (wymóg RODO). Odśwież stronę, aby kontynuować.</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-indigo-600 text-white py-5 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-indigo-600/20"
              >
                Odśwież i wróć
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;
