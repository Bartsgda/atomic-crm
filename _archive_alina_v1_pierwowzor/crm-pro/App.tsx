
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
import { SubAgentsView } from './components/SubAgents/SubAgentsView';
import { TowarzystwaView } from './components/Insurers/TowarzystwaView'; 
import { FormArchitect } from './components/Builder/FormArchitect';
import { RawDataView } from './components/RawDataView'; 
import { FinanceView } from './components/Finance/FinanceView'; 
import { DataRepairView } from './components/DataRepair/DataRepairView';
import { Sidebar, MENU_CATEGORIES } from './components/Navigation/Sidebar';
import { storage } from './services/storage';
import { AppState, Client, Policy, PolicyType, ClientNote, UiPreferences } from './types';
import { Loader2, Wallet, TrendingUp } from 'lucide-react';
import { AgentKaratekaWindow } from './components/GlobalAgent/AgentKaratekaWindow';
import { calculateAiDiffs, mergeAiResponseToPolicy } from './modules/utils/diffEngine';

type Page = 'dashboard' | 'clients' | 'new' | 'edit-policy' | 'preview' | 'client-details' | 'calendar' | 'offers' | 'terminations' | 'vision' | 'sub-agents' | 'insurers' | 'form-builder' | 'raw-data' | 'finance' | 'data-repair' | 'test-page';

function App() {
  const [state, setState] = useState<AppState>({ clients: [], policies: [], notes: [], notifications: [], terminations: [], logs: [], subAgents: [], checklistTemplates: {}, insurers: [], insurerConfigs: {}, trash: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  
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
  
  const [isGlobalPolicyModalOpen, setIsGlobalPolicyModalOpen] = useState(false);
  const [isGlobalClientModalOpen, setIsGlobalClientModalOpen] = useState(false);
  
  const [uiPrefs, setUiPrefs] = useState<UiPreferences>({ 
      theme: 'light', 
      density: 'comfortable', 
      primaryColor: '#dc2626', 
      fontScale: 1.0 
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
  }, []);

  const refreshData = useCallback(async () => {
    const freshState = await storage.init();
    const prefs = storage.getUiPrefs();
    
    // NUCLEAR REFRESH: Force new object reference to trigger React updates
    setState({ ...freshState }); 
    setDataVersion(v => v + 1); // Bump version counter
    
    setUiPrefs(prefs);
    applyTheme(prefs);
  }, [applyTheme]);

  useEffect(() => {
    refreshData().then(() => setIsLoading(false));
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
    await storage.addClient(client);
    await refreshData(); // NUCLEAR REFRESH
    
    // Update local modal context if needed
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

  const handleCategorySelect = (id: string, types: PolicyType[] | undefined, sortByDate: boolean) => {
      setActiveCategory(id);
      setDashboardFilter(types);
      setDashboardDateFilter(null);
      setSortByDate(sortByDate);
  };

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
          onToggleTester={() => {} }
          onUpdateUiPrefs={updateUiPrefs}
          onRefreshData={refreshData}
          onAddClient={() => setIsGlobalClientModalOpen(true)}
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
                onNavigate={navigate} 
                onSaveClient={handleSaveClient}
                onImportComplete={refreshData}
                isCompact={uiPrefs.density === 'compact'}
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
    </div>
  );
}

export default App;
