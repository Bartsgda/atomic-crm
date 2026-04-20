
import { AppState, Client, Policy, ClientNote, Notification, TerminationRecord, SystemLogEntry, LogAction, LogEntity, UiPreferences, SubAgent, ChecklistTemplates, InsurerConfig, DeletedItem } from '../types';
import { format } from 'date-fns';
import { INSURERS } from '@/legacy-v1/towarzystwa'; 

const STORAGE_KEY = 'InsuranceMaster_Core_V4_Final';
const SESSION_KEY = 'InsuranceMaster_Session_Expiry';
const PREFS_KEY = 'InsuranceMaster_UI_Prefs';
const SESSION_DURATION = 365 * 24 * 60 * 60 * 1000; 

const DEFAULT_PREFS: UiPreferences = {
    theme: 'light',
    density: 'comfortable',
    primaryColor: '#dc2626', 
    fontScale: 1.0,
    skin: 'default'
};

const DEFAULT_CHECKLISTS: ChecklistTemplates = {
    'COMMON': [
        { id: 'rodo', label: 'RODO', isRequired: true },
        { id: 'apk', label: 'APK (IDD)', isRequired: true }
    ],
    'OC': [
        { id: 'dowod_rej', label: 'Dowód Rejestracyjny', isRequired: true },
        { id: 'prawo_jazdy', label: 'Prawo Jazdy', isRequired: false },
        { id: 'historia_ufg', label: 'Historia UFG', isRequired: false }
    ],
    'AC': [
        { id: 'zdjecia', label: 'Zdjęcia (4 strony + VIN)', isRequired: true },
        { id: 'kluczyki', label: '2 kpl. Kluczyków', isRequired: true },
        { id: 'dowod_rej', label: 'Dowód Rejestracyjny', isRequired: true }
    ],
    'DOM': [
        { id: 'akt_notarialny', label: 'Akt Notarialny / KW', isRequired: true },
        { id: 'cesja', label: 'Cesja (Bank)', isRequired: false }
    ],
    'ZYCIE': [
        { id: 'ankieta', label: 'Ankieta Medyczna', isRequired: true },
        { id: 'uposazeni', label: 'Uposażeni', isRequired: true }
    ],
    'PODROZ': [
        { id: 'zakres', label: 'Zakres Terytorialny', isRequired: true }
    ]
};

// EXCLUSIVE AGENT LIST based on user requirements
const DEFAULT_INSURERS = [
    "Compensa",
    "Ergo Hestia",
    "Generali",
    "HDI",
    "Interrisk",
    "Link4",
    "MTU",
    "MTU24",
    "Pevno",
    "PZU",
    "TUZ",
    "Warta",
    "Wiener"
].sort();

class StorageManager {
  private state: AppState = { clients: [], policies: [], notes: [], notifications: [], terminations: [], logs: [], subAgents: [], checklistTemplates: DEFAULT_CHECKLISTS, insurers: [], insurerConfigs: {}, trash: [] };

  // --- UI PREFS ---
  getUiPrefs(): UiPreferences {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
          try { 
              const parsed = JSON.parse(stored);
              return { ...DEFAULT_PREFS, ...parsed }; 
          } catch(e) {}
      }
      return DEFAULT_PREFS;
  }

  saveUiPrefs(prefs: UiPreferences) {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  // --- SESSION MANAGEMENT ---
  extendSession() {
      if (localStorage.getItem(STORAGE_KEY)) {
          const newExpiry = Date.now() + SESSION_DURATION;
          localStorage.setItem(SESSION_KEY, newExpiry.toString());
      }
  }

  getSessionExpiry(): number | null {
      const str = localStorage.getItem(SESSION_KEY);
      return str ? parseInt(str, 10) : null;
  }

  // --- LOGGING ENGINE ---
  private log(action: LogAction, entity: LogEntity, details: string, entityId?: string, meta?: any) {
      const entry: SystemLogEntry = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
          timestamp: new Date().toISOString(),
          action,
          entity,
          entityId,
          details,
          meta
      };
      this.state.logs = [entry, ...(this.state.logs || [])].slice(0, 1000);
  }

  // --- EXPORT UTILS ---
  exportToJSON() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
      const downloadAnchorNode = document.createElement('a');
      const fileName = `insurance_master_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      this.addNotification({
          id: `sys_exp_${Date.now()}`,
          type: 'INFO',
          message: 'Wyeksportowano pełną kopię bazy danych do pliku JSON.',
          timestamp: new Date().toISOString(),
          isRead: false
      });
  }

  // --- HELPER: INSURER SYNC ---
  private syncInsurers(policies: Policy[], existingInsurers: string[]) {
      // 1. Collect from Policies (Source of Truth)
      const fromPolicies = policies
          .map(p => p.insurerName)
          .filter(x => x && typeof x === 'string' && x.trim().length > 1 && !x.includes('[object'));

      // 2. Collect from Existing List (User preferences)
      const validExisting = (existingInsurers || [])
          .filter(x => x && typeof x === 'string' && x.trim().length > 1 && !x.includes('[object'));
      
      // 3. Merge & Deduplicate
      const merged = new Set([...validExisting, ...fromPolicies]);
      
      // 4. Force Seed / Update from Defaults
      // Always merge defaults to ensure new static insurers appear in the app
      DEFAULT_INSURERS.forEach(i => merged.add(i));

      return Array.from(merged).sort();
  }

  // --- CORE ---
  async init(): Promise<AppState> {
    const storedData = localStorage.getItem(STORAGE_KEY);
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed && Array.isArray(parsed.clients)) {
            const loadedPolicies = parsed.policies || [];
            let loadedInsurers = parsed.insurers || [];
            
            // Critical Fix: If insurers array is broken or empty, force defaults IMMEDIATELY
            let wasFixed = false;
            if (!Array.isArray(loadedInsurers) || loadedInsurers.length === 0) {
                loadedInsurers = DEFAULT_INSURERS;
                wasFixed = true;
            }
            
            // Sync with policies to ensure everything is visible
            const syncedInsurers = this.syncInsurers(loadedPolicies, loadedInsurers);

            // Check if we need to save the synced version (e.g. new defaults added)
            if (syncedInsurers.length !== loadedInsurers.length) {
                wasFixed = true;
            }

            this.state = {
                clients: Array.isArray(parsed.clients) ? parsed.clients : [],
                policies: Array.isArray(parsed.policies) ? parsed.policies : [],
                notes: Array.isArray(parsed.notes) ? parsed.notes : [],
                notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
                terminations: Array.isArray(parsed.terminations) ? parsed.terminations : [],
                logs: Array.isArray(parsed.logs) ? parsed.logs : [],
                subAgents: Array.isArray(parsed.subAgents) ? parsed.subAgents : [],
                checklistTemplates: (parsed.checklistTemplates && typeof parsed.checklistTemplates === 'object') ? parsed.checklistTemplates : DEFAULT_CHECKLISTS,
                insurers: Array.isArray(syncedInsurers) ? syncedInsurers : DEFAULT_INSURERS,
                insurerConfigs: (parsed.insurerConfigs && typeof parsed.insurerConfigs === 'object') ? parsed.insurerConfigs : {},
                trash: Array.isArray(parsed.trash) ? parsed.trash : []
            };
            
            if (wasFixed) {
                this.save();
            }

            this.extendSession();
            return this.getState();
        }
      } catch (e) {
        console.error("[Storage] Read error", e);
      }
    }
    
    // Fresh start - Seed defaults
    this.state = { 
        clients: [], policies: [], notes: [], notifications: [], terminations: [], logs: [], subAgents: [],
        checklistTemplates: DEFAULT_CHECKLISTS, 
        insurers: DEFAULT_INSURERS,
        insurerConfigs: {},
        trash: []
    };
    this.save(); 
    return this.getState();
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.extendSession();
    } catch (e) {
      console.error("[Storage] Save error", e);
    }
  }


  getState(): AppState {
    return {
      clients: [...this.state.clients],
      policies: [...this.state.policies],
      notes: [...this.state.notes],
      notifications: [...this.state.notifications],
      terminations: [...this.state.terminations],
      logs: [...(this.state.logs || [])],
      subAgents: [...(this.state.subAgents || [])],
      checklistTemplates: { ...this.state.checklistTemplates },
      insurers: [...(this.state.insurers || [])],
      insurerConfigs: { ...this.state.insurerConfigs },
      trash: [...(this.state.trash || [])]
    };
  }

  // ... (Insurers & Clients methods same as before) ...
  async updateChecklistTemplates(templates: ChecklistTemplates): Promise<AppState> {
      this.state.checklistTemplates = templates;
      this.save();
      return this.getState();
  }

  async addActiveInsurer(name: string): Promise<AppState> {
      if (!this.state.insurers.includes(name)) {
          this.state.insurers = [...this.state.insurers, name].sort();
          this.save();
      }
      return this.getState();
  }

  async removeActiveInsurer(name: string): Promise<AppState> {
      this.state.insurers = this.state.insurers.filter(i => i !== name);
      this.save();
      return this.getState();
  }

  async updateInsurerConfig(config: InsurerConfig): Promise<AppState> {
      const current = this.state.insurerConfigs || {};
      this.state.insurerConfigs = { ...current, [config.id]: config };
      this.save();
      return this.getState();
  }

  async seedDefaultInsurers(): Promise<AppState> {
      const current = new Set(this.state.insurers);
      DEFAULT_INSURERS.forEach(i => current.add(i));
      this.state.insurers = Array.from(current).sort();
      this.save();
      return this.getState();
  }

  async addClient(client: Client): Promise<AppState> {
    const exists = this.state.clients.find(c => (c.pesel && client.pesel && c.pesel === client.pesel) || (c.id === client.id));
    if (exists) return this.updateClient(client);
    const newClient = { ...client, createdAt: client.createdAt || new Date().toISOString() };
    this.state.clients = [...this.state.clients, newClient];
    this.log('CREATE', 'CLIENT', `Utworzono klienta: ${client.lastName} ${client.firstName}`, client.id);
    this.save();
    return this.getState();
  }

  async updateClient(updatedClient: Client): Promise<AppState> {
    this.state.clients = this.state.clients.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c);
    this.log('UPDATE', 'CLIENT', `Aktualizacja danych: ${updatedClient.lastName}`, updatedClient.id);
    this.save();
    return this.getState();
  }

  async addPolicy(policy: Policy): Promise<AppState> {
    const newPolicy = { ...policy, createdAt: policy.createdAt || new Date().toISOString() };
    this.state.policies = [...this.state.policies, newPolicy];
    
    if (policy.insurerName && !this.state.insurers.includes(policy.insurerName)) {
        this.state.insurers = [...this.state.insurers, policy.insurerName].sort();
    }

    this.log('CREATE', 'POLICY', `Dodano polisę ${policy.type}: ${policy.vehicleBrand || ''}`, policy.id);
    this.save();
    return this.getState();
  }

  async updatePolicy(updatedPolicy: Policy): Promise<AppState> {
    const oldPolicy = this.state.policies.find(p => p.id === updatedPolicy.id);
    this.state.policies = this.state.policies.map(p => p.id === updatedPolicy.id ? updatedPolicy : p);
    
    if (updatedPolicy.insurerName && !this.state.insurers.includes(updatedPolicy.insurerName)) {
        this.state.insurers = [...this.state.insurers, updatedPolicy.insurerName].sort();
    }

    if (oldPolicy && oldPolicy.stage !== updatedPolicy.stage) {
        this.log('UPDATE', 'POLICY', `Zmiana etapu: ${oldPolicy.stage} -> ${updatedPolicy.stage}`, updatedPolicy.id);
    } else {
        this.log('UPDATE', 'POLICY', `Edycja polisy ${updatedPolicy.policyNumber}`, updatedPolicy.id);
    }
    this.save();
    return this.getState();
  }

  // --- SOFT DELETE IMPLEMENTATION ---
  async deletePolicy(id: string): Promise<AppState> {
    const p = this.state.policies.find(x => x.id === id);
    if (!p) return this.getState();

    // Move to Trash
    const trashItem: DeletedItem = {
        id: p.id,
        type: 'POLICY',
        data: p,
        deletedAt: new Date().toISOString()
    };
    
    this.state.trash = [...(this.state.trash || []), trashItem];
    this.state.policies = this.state.policies.filter(p => p.id !== id);
    
    this.log('DELETE', 'POLICY', `Przeniesiono do kosza (Archiwum) polisę ${p.insurerName} ${p.vehicleBrand}`, id, p);
    this.save();
    return this.getState();
  }

  async deleteClient(id: string): Promise<AppState> {
    const client = this.state.clients.find(c => c.id === id);
    if (!client) return this.getState();

    // Bundle all associated data
    const associatedPolicies = this.state.policies.filter(p => p.clientId === id);
    const associatedNotes = this.state.notes.filter(n => n.clientId === id);
    const associatedTerminations = this.state.terminations.filter(t => t.clientId === id);

    // Create Archive Bundle
    const trashItem: DeletedItem = {
        id: client.id,
        type: 'CLIENT',
        data: {
            client,
            policies: associatedPolicies,
            notes: associatedNotes,
            terminations: associatedTerminations
        },
        deletedAt: new Date().toISOString()
    };

    this.state.trash = [...(this.state.trash || []), trashItem];
    
    // Cleanup: Remove client and all their bundled data from active state
    this.state.clients = this.state.clients.filter(c => c.id !== id);
    this.state.policies = this.state.policies.filter(p => p.clientId !== id);
    this.state.notes = this.state.notes.filter(n => n.clientId !== id);
    this.state.terminations = this.state.terminations.filter(t => t.clientId !== id);

    this.log('DELETE', 'CLIENT', `Zarchiwizowano klienta oraz ${associatedPolicies.length} polisy i ${associatedNotes.length} notatki: ${client.lastName} ${client.firstName}`, id);
    this.save();
    return this.getState();
  }

  async restoreFromTrash(id: string): Promise<AppState> {
      const item = this.state.trash?.find(x => x.id === id);
      if (!item) return this.getState();

      if (item.type === 'POLICY') {
          // Restore single policy
          this.state.policies = [...this.state.policies, item.data];
          this.log('RESTORE', 'POLICY', `Przywrócono z kosza polisę: ${item.data.policyNumber}`, id);
      } else if (item.type === 'CLIENT') {
          // Restore Client Bundle
          const { client, policies, notes, terminations } = item.data;
          
          this.state.clients = [...this.state.clients, client];
          if (policies) this.state.policies = [...this.state.policies, ...policies];
          if (notes) this.state.notes = [...this.state.notes, ...notes];
          if (terminations) this.state.terminations = [...this.state.terminations, ...terminations];

          this.log('RESTORE', 'CLIENT', `Przywrócono z archiwum klienta: ${client.lastName} ${client.firstName}`, id);
      } else if (item.type === 'NOTE') {
          this.state.notes = [...this.state.notes, item.data];
          this.log('RESTORE', 'NOTE', `Przywrócono notatkę`, id);
      }

      this.state.trash = this.state.trash?.filter(x => x.id !== id);
      this.save();
      return this.getState();
  }

  async purgeFromTrash(id: string): Promise<AppState> {
      const item = this.state.trash?.find(x => x.id === id);
      if (!item) return this.getState();

      this.state.trash = this.state.trash?.filter(x => x.id !== id);
      this.log('DELETE', 'SYSTEM', `Trwale usunięto z kosza: ${item.type} (ID: ${id})`, id);
      this.save();
      return this.getState();
  }

  // ... (Note, Termination, SubAgent, etc. - Keep existing, but map deleteNote to soft delete if needed) ...
  async addNote(note: ClientNote): Promise<AppState> {
    const newNote = { ...note, createdAt: note.createdAt || new Date().toISOString() };
    this.state.notes = [newNote, ...this.state.notes];
    this.log('CREATE', 'NOTE', `Notatka [${note.tag}]: ${note.content.substring(0, 20)}...`, note.id);
    this.save();
    return this.getState();
  }

  async deleteNote(id: string): Promise<AppState> {
    // Currently hard delete for notes to keep it simple, but could be soft delete too
    const n = this.state.notes.find(x => x.id === id);
    this.state.notes = this.state.notes.filter(n => n.id !== id);
    this.log('DELETE', 'NOTE', `Usunięto notatkę`, id, n);
    this.save();
    return this.getState();
  }

  async updateNote(updatedNote: ClientNote): Promise<AppState> {
    this.state.notes = this.state.notes.map(n => n.id === updatedNote.id ? updatedNote : n);
    this.log('UPDATE', 'NOTE', `Edycja notatki`, updatedNote.id);
    this.save();
    return this.getState();
  }

  async addTerminationRecord(record: TerminationRecord): Promise<AppState> {
    this.state.terminations = [record, ...this.state.terminations];
    this.log('CREATE', 'TERMINATION', `Zarejestrowano wypowiedzenie dla ${record.clientName}`, record.id);
    this.save();
    return this.getState();
  }

  async deleteTerminationRecord(id: string): Promise<AppState> {
    this.state.terminations = this.state.terminations.filter(t => t.id !== id);
    this.state.policies = this.state.policies.map(p => {
      if (p.terminationId === id) return { ...p, isTerminationSent: false, terminationId: undefined };
      return p;
    });
    this.log('DELETE', 'TERMINATION', `Usunięto wpis z rejestru wypowiedzeń`, id);
    this.save();
    return this.getState();
  }

  async updateTerminationRecord(updated: TerminationRecord): Promise<AppState> {
    this.state.terminations = this.state.terminations.map(t => t.id === updated.id ? updated : t);
    this.log('UPDATE', 'TERMINATION', `Aktualizacja linków w wypowiedzeniu`, updated.id);
    this.save();
    return this.getState();
  }

  async addSubAgent(agent: SubAgent): Promise<AppState> {
      this.state.subAgents = [...(this.state.subAgents || []), agent];
      this.log('CREATE', 'SUB_AGENT', `Dodano pośrednika: ${agent.name}`, agent.id);
      this.save();
      return this.getState();
  }

  async updateSubAgent(updated: SubAgent): Promise<AppState> {
      this.state.subAgents = (this.state.subAgents || []).map(a => a.id === updated.id ? updated : a);
      this.log('UPDATE', 'SUB_AGENT', `Zaktualizowano pośrednika: ${updated.name}`, updated.id);
      this.save();
      return this.getState();
  }

  async deleteSubAgent(id: string): Promise<AppState> {
      this.state.subAgents = (this.state.subAgents || []).filter(a => a.id !== id);
      this.log('DELETE', 'SUB_AGENT', `Usunięto pośrednika`, id);
      this.save();
      return this.getState();
  }

  // ── Notifications (in-memory only) ──

  async addNotification(notif: Notification): Promise<AppState> {
    this.state.notifications = [notif, ...this.state.notifications].slice(0, 50);
    this.save();
    return this.getState();
  }

  async markAllNotificationsRead(): Promise<AppState> {
    this.state.notifications = this.state.notifications.map(n => ({ ...n, isRead: true }));
    this.save();
    return this.getState();
  }

  // ── Terminations (stored in `terminations` table) ──

  async importState(newState: AppState): Promise<AppState> {
    const newPolicies = newState.policies || [];
    let newInsurers = newState.insurers || [];
    
    if (!Array.isArray(newInsurers) || newInsurers.length === 0) {
        newInsurers = DEFAULT_INSURERS;
    }

    const syncedInsurers = this.syncInsurers(newPolicies, newInsurers);

    this.state = {
      clients: newState.clients || [],
      policies: newPolicies,
      notes: newState.notes || [],
      notifications: newState.notifications || [],
      terminations: newState.terminations || [],
      logs: newState.logs || [],
      subAgents: newState.subAgents || [],
      checklistTemplates: newState.checklistTemplates || DEFAULT_CHECKLISTS,
      insurers: syncedInsurers,
      insurerConfigs: newState.insurerConfigs || {},
      trash: newState.trash || []
    };
    this.log('IMPORT', 'SYSTEM', `Zaimportowano bazę danych z pliku.`);
    this.save();
    return this.getState();
  }

  /**
   * NUCLEAR RESET: Clears all local data and resets to defaults.
   */
  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    this.state = { 
        clients: [], 
        policies: [], 
        notes: [], 
        notifications: [], 
        terminations: [], 
        logs: [], 
        subAgents: [], 
        checklistTemplates: DEFAULT_CHECKLISTS, 
        insurers: DEFAULT_INSURERS, 
        insurerConfigs: {}, 
        trash: [] 
    };
    this.log('DELETE', 'SYSTEM', 'Nuclear Reset: Wszystkie dane lokalne zostały usunięte.');
    this.save();
  }
}

export const localStorageManager = new StorageManager();
import { supabaseStorage } from './supabaseStorage';

// ─── Selection Strategy ───────────────────────────────────────────────────────
// PRIMARY: Supabase Cloud (Live Sync with Database)
// LOCAL:   Available via localStorageManager if needed
export const storage = supabaseStorage;
export { supabaseStorage };
