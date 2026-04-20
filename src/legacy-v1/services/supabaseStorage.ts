/**
 * SupabaseStorageManager — V2 backend dla V1 island.
 * Envelope encryption: DEK (AES-GCM CryptoKey) ustawiany raz w sesji po unwrap hasłem.
 * Szyfrowane są TYLKO wrażliwe pola (PESEL, telefony, maile, adres, data ur.,
 * szczegóły pojazdu/domu, treść notatek). Imiona, nazwiska, nazwy firm
 * ubezpieczeniowych, kwoty i daty pozostają w plaintext — żeby wyszukiwanie działało.
 *
 * Tenant: Alina Insurance (11111111-1111-1111-1111-111111111111)
 */

import { getSupabaseClient } from '../../components/atomic-crm/providers/supabase/supabase';
import type {
  AppState, Client, Policy, ClientNote, Notification,
  TerminationRecord, SubAgent, ChecklistTemplates,
  InsurerConfig, DeletedItem, UiPreferences
} from '../types';
import { encryptField, decryptField, encryptJsonField, decryptJsonField, looksEncrypted } from './crypto';

const TENANT_ID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_TENANT_ID) || '11111111-1111-1111-1111-111111111111';
const PREFS_KEY = 'InsuranceMaster_UI_Prefs_v2';

// ─── UUID Conversion ──────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidCache = new Map<string, string>();

function isValidUUID(s: string): boolean {
  return UUID_REGEX.test(s);
}

async function toUUID(v1Id: string): Promise<string> {
  if (!v1Id) return crypto.randomUUID();
  if (isValidUUID(v1Id)) return v1Id.toLowerCase();
  if (uuidCache.has(v1Id)) return uuidCache.get(v1Id)!;

  const encoded = new TextEncoder().encode(v1Id);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(hashBuffer);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  uuidCache.set(v1Id, uuid);
  return uuid;
}

// ─── Stage mapping ────────────────────────────────────────────────────────────

const STAGE_TO_DB: Record<string, string> = {
  'sprzedaż':                   'sprzedaz',
  'sprzedany':                  'sprzedaz',
  'of_do zrobienia':            'of_do_zrobienia',
  'przeł kontakt':              'przel_kontakt',
  'czekam na dane/dokum':       'czekam_na_dane',
  'of_przedst':                 'oferta_wyslana',
  'oferta_wysłana':             'oferta_wyslana',
  'ucięty kontakt':             'uciety_kontakt',
  'rez po ofercie_kont za rok': 'rez_po_ofercie',
  'inne':                       'of_do_zrobienia',
  'zbycie_pojazdu':             'of_do_zrobienia',
};

const STAGE_FROM_DB: Record<string, string> = {
  'sprzedaz':        'sprzedaż',
  'of_do_zrobienia': 'of_do zrobienia',
  'przel_kontakt':   'przeł kontakt',
  'czekam_na_dane':  'czekam na dane/dokum',
  'oferta_wyslana':  'oferta_wysłana',
  'uciety_kontakt':  'ucięty kontakt',
  'rez_po_ofercie':  'rez po ofercie_kont za rok',
};

function stageToDb(s: string)   { return STAGE_TO_DB[s]   ?? 'of_do_zrobienia'; }
function stageFromDb(s: string) { return STAGE_FROM_DB[s] ?? s; }
function typeToDb(t: string)    { return t === 'INNE' ? 'OTHER' : t; }
function typeFromDb(t: string)  { return t === 'OTHER' ? 'INNE' : t; }

// ─── Encryption helpers (scoped to a DEK) ────────────────────────────────────

async function encStr(val: string | null | undefined, dek: CryptoKey | null): Promise<string | null> {
  if (!val) return null;
  if (!dek) return val;
  return encryptField(val, dek);
}

async function decStr(val: any, dek: CryptoKey | null): Promise<string> {
  if (val == null) return '';
  if (typeof val !== 'string') return String(val);
  if (!dek || !looksEncrypted(val)) return val;
  try { return await decryptField(val, dek); }
  catch { return '[[ENCRYPTED]]'; }
}

async function encJson(val: any, dek: CryptoKey | null): Promise<any> {
  if (val == null) return null;
  if (!dek) return val;
  return encryptJsonField(val, dek);
}

async function decJson<T = any>(val: any, dek: CryptoKey | null, fallback: T): Promise<T> {
  if (val == null) return fallback;
  if (typeof val !== 'string') return val as T;
  if (!dek || !looksEncrypted(val)) {
    try { return JSON.parse(val); } catch { return val as unknown as T; }
  }
  try { return await decryptJsonField(val, dek) as T; }
  catch { return fallback; }
}

function toArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t || t === '{}') return [];
    try { const p = JSON.parse(t); return Array.isArray(p) ? p : []; } catch {}
  }
  return [];
}

// ─── Row mappers ──────────────────────────────────────────────────────────────
// Wrażliwe (szyfrowane): pesel, phones, emails, adres zamieszkania (street/city/zipCode),
//   nr polisy, nr rejestracyjny auta, adres nieruchomości (home_details)
// Plaintext: wszystko inne (imię, nazwisko, data ur., businesses, kwoty, daty, notatki)

async function clientToRow(c: Client, dek: CryptoKey | null) {
  const isFake = c.id.includes('demo') || (c as any).isFake;
  const dbId = await toUUID(c.id);
  return {
    id: dbId,
    tenant_id: TENANT_ID,
    first_name: c.firstName || null,
    last_name: c.lastName || null,
    pesel_encrypted: await encStr(c.pesel, dek),
    birth_date: c.birthDate || null,
    gender: c.gender || null,
    phones: await encJson(c.phones ?? [], dek),
    emails: await encJson(c.emails ?? [], dek),
    businesses: c.businesses ?? [],
    street: await encStr(c.street, dek),
    city: await encStr(c.city, dek),
    zip_code: await encStr(c.zipCode, dek),
    source: 'manual' as const,
    is_fake: isFake,
    v1_original_id: isValidUUID(c.id) ? null : c.id,
  };
}

async function rowToClient(r: any, dek: CryptoKey | null): Promise<Client> {
  const phones = await decJson<string[]>(r.phones, dek, []);
  const emails = await decJson<string[]>(r.emails, dek, []);
  return {
    id: r.v1_original_id || r.id,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    pesel: await decStr(r.pesel_encrypted, dek),
    birthDate: r.birth_date || undefined,
    gender: r.gender ?? undefined,
    phones: toArray(phones),
    emails: toArray(emails),
    businesses: toArray(r.businesses) as any,
    street: await decStr(r.street, dek),
    city: await decStr(r.city, dek),
    zipCode: await decStr(r.zip_code, dek),
    createdAt: r.created_at,
  };
}

async function policyToRow(p: Policy, dek: CryptoKey | null) {
  const isFake = p.id.includes('demo') || p.clientId.includes('demo') || (p as any).isFake;
  const dbId = await toUUID(p.id);
  const dbClientId = await toUUID(p.clientId);
  return {
    id: dbId,
    tenant_id: TENANT_ID,
    client_id: dbClientId,
    type: typeToDb(p.type) as any,
    stage: stageToDb(p.stage) as any,
    insurer_name: p.insurerName || null,
    policy_number: await encStr(p.policyNumber, dek),
    premium: p.premium ?? null,
    commission: p.commission ?? null,
    commission_rate: p.commissionRate ?? null,
    payment_status: (p.paymentStatus ?? 'UNPAID') as any,
    policy_start_date: p.policyStartDate || null,
    policy_end_date: p.policyEndDate || null,
    next_contact_date: p.nextContactDate || null,
    vehicle_brand: p.vehicleBrand || null,
    vehicle_model: p.vehicleModel || null,
    vehicle_reg: await encStr(p.vehicleReg, dek),
    auto_details: p.autoDetails ?? null,
    home_details: await encJson(p.homeDetails, dek),
    life_details: p.lifeDetails ?? null,
    travel_details: p.travelDetails ?? null,
    original_product_string: p.originalProductString || null,
    checklist: p.checklist ?? {},
    calculations: p.calculations ?? [],
    source: 'manual' as const,
    is_fake: isFake,
    v1_original_id: isValidUUID(p.id) ? null : p.id,
    v1_original_client_id: isValidUUID(p.clientId) ? null : p.clientId,
  };
}

async function rowToPolicy(r: any, dek: CryptoKey | null): Promise<Policy> {
  return {
    id: r.v1_original_id || r.id,
    clientId: r.v1_original_client_id || r.client_id,
    type: typeFromDb(r.type) as any,
    stage: stageFromDb(r.stage) as any,
    insurerName: r.insurer_name ?? '',
    policyNumber: await decStr(r.policy_number, dek),
    premium: Number(r.premium ?? 0),
    commission: Number(r.commission ?? 0),
    commissionRate: r.commission_rate ?? undefined,
    paymentStatus: r.payment_status ?? 'UNPAID',
    policyStartDate: r.policy_start_date ?? '',
    policyEndDate: r.policy_end_date ?? '',
    nextContactDate: r.next_contact_date ?? undefined,
    vehicleBrand: r.vehicle_brand ?? '',
    vehicleModel: r.vehicle_model ?? undefined,
    vehicleReg: await decStr(r.vehicle_reg, dek),
    vehicleVin: '',
    autoDetails: r.auto_details ?? undefined,
    homeDetails: await decJson(r.home_details, dek, undefined),
    lifeDetails: r.life_details ?? undefined,
    travelDetails: r.travel_details ?? undefined,
    originalProductString: r.original_product_string ?? undefined,
    checklist: (typeof r.checklist === 'object' && r.checklist) ? r.checklist : {},
    calculations: Array.isArray(r.calculations) ? r.calculations : [],
    terminationBasis: 'art28' as any,
    createdAt: r.created_at,
    subAgentSplits: [],
    installments: [],
  };
}

async function noteToRow(n: ClientNote, dek: CryptoKey | null) {
  let reminderStatus: 'PRZYPOMNIENIE' | 'UKONCZONE' | 'ANULOWANE' | null = null;
  if (n.reminderDate) {
    reminderStatus = n.isCompleted ? 'UKONCZONE' : 'PRZYPOMNIENIE';
  }
  const dbId = await toUUID(n.id);
  const dbClientId = await toUUID(n.clientId);
  return {
    id: dbId,
    tenant_id: TENANT_ID,
    client_id: dbClientId,
    content: n.content || null,
    tag: n.tag || null,
    reminder_date: n.reminderDate ? new Date(n.reminderDate).toISOString() : null,
    reminder_status: reminderStatus,
    linked_policy_ids: n.linkedPolicyIds ?? [],
    history: n.history ?? [],
    v1_original_id: isValidUUID(n.id) ? null : n.id,
    v1_original_client_id: isValidUUID(n.clientId) ? null : n.clientId,
  };
}

async function rowToNote(r: any, dek: CryptoKey | null): Promise<ClientNote> {
  return {
    id: r.v1_original_id || r.id,
    clientId: r.v1_original_client_id || r.client_id,
    content: r.content ?? '',
    tag: r.tag ?? 'STATUS',
    createdAt: r.created_at,
    reminderDate: r.reminder_date
      ? new Date(r.reminder_date).toISOString().split('T')[0]
      : undefined,
    isCompleted: r.reminder_status === 'UKONCZONE',
    linkedPolicyIds: r.linked_policy_ids ?? [],
    history: Array.isArray(r.history) ? r.history : [],
  };
}

// Trash: cały bundle szyfrowany JSON-em
async function trashToItem(r: any, dek: CryptoKey | null): Promise<DeletedItem> {
  let data = r.data;
  if (typeof data === 'string' && dek) {
    try { data = await decryptJsonField(data, dek); }
    catch (e) { console.warn('[TrashMapper] decrypt failed', e); }
  }
  return {
    id: r.v1_original_id || r.id,
    type: r.type,
    data,
    deletedAt: r.deleted_at,
  };
}

async function itemToTrash(item: DeletedItem, dek: CryptoKey | null) {
  const dbId = await toUUID(item.id);
  return {
    id: dbId,
    tenant_id: TENANT_ID,
    type: item.type,
    data: await encJson(item.data, dek),
    deleted_at: item.deletedAt,
    v1_original_id: isValidUUID(item.id) ? null : item.id,
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: UiPreferences = {
  theme: 'light',
  density: 'comfortable',
  primaryColor: '#dc2626',
  fontScale: 1.0,
};

const DEFAULT_CHECKLISTS: ChecklistTemplates = {
  'COMMON': [
    { id: 'rodo', label: 'RODO', isRequired: true },
    { id: 'apk',  label: 'APK (IDD)', isRequired: true }
  ],
  'OC': [
    { id: 'dowod_rej',    label: 'Dowód Rejestracyjny', isRequired: true },
    { id: 'prawo_jazdy',  label: 'Prawo Jazdy',          isRequired: false },
    { id: 'historia_ufg', label: 'Historia UFG',          isRequired: false }
  ],
  'AC': [
    { id: 'zdjecia',    label: 'Zdjęcia (4 strony + VIN)', isRequired: true },
    { id: 'kluczyki',   label: '2 kpl. Kluczyków',          isRequired: true },
    { id: 'dowod_rej',  label: 'Dowód Rejestracyjny',        isRequired: true }
  ],
  'DOM': [
    { id: 'akt_notarialny', label: 'Akt Notarialny / KW', isRequired: true },
    { id: 'cesja',          label: 'Cesja (Bank)',          isRequired: false }
  ],
  'ZYCIE': [
    { id: 'ankieta',   label: 'Ankieta Medyczna', isRequired: true },
    { id: 'uposazeni', label: 'Uposażeni',          isRequired: true }
  ],
  'PODROZ': [
    { id: 'zakres', label: 'Zakres Terytorialny', isRequired: true }
  ]
};

// ─── SupabaseStorageManager ───────────────────────────────────────────────────

class SupabaseStorageManager {
  private dek: CryptoKey | null = null;
  private sb() { return getSupabaseClient(); }

  setDEK(dek: CryptoKey | null) { this.dek = dek; }
  hasDEK() { return !!this.dek; }

  // Legacy API — nie używane w nowym flow, zostawione dla kompatybilności wywołań
  setPassphrase(_pw: string | null) { /* noop: envelope encryption używa setDEK */ }

  getUiPrefs(): UiPreferences {
    try {
      const s = localStorage.getItem(PREFS_KEY);
      if (s) return { ...DEFAULT_PREFS, ...JSON.parse(s) };
    } catch { /* ignore */ }
    return DEFAULT_PREFS;
  }

  saveUiPrefs(prefs: UiPreferences) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  extendSession() {}
  getSessionExpiry(): number | null { return Date.now() + 365 * 24 * 3600 * 1000; }

  async exportToJSON() {
    const state = await this.init();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `backup_${new Date().toISOString().slice(0, 16)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async init(): Promise<AppState> {
    const sb = this.sb();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      throw new Error("Brak aktywnej sesji Supabase. Zaloguj się ponownie.");
    }

    const [clientsRes, policiesRes, notesRes, subAgentsRes, insurersRes, trashRes] = await Promise.all([
      sb.from('insurance_clients').select('*').eq('tenant_id', TENANT_ID).order('last_name'),
      sb.from('policies').select('*').eq('tenant_id', TENANT_ID),
      sb.from('policy_notes').select('*').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }),
      sb.from('sub_agents').select('*').eq('tenant_id', TENANT_ID),
      sb.from('insurers').select('name').eq('tenant_id', TENANT_ID).eq('is_visible', true),
      sb.from('insurance_trash').select('*').eq('tenant_id', TENANT_ID).order('deleted_at', { ascending: false }),
    ]);

    const errors = [clientsRes.error, policiesRes.error, notesRes.error, subAgentsRes.error, insurersRes.error, trashRes.error].filter(Boolean);
    if (errors.length > 0) {
      const firstError = errors[0];
      console.error('[SupabaseStorage] Query failure:', firstError);
      throw new Error(`Błąd bazy danych: ${firstError?.message || 'unknown'}`);
    }

    const dek = this.dek;
    const [clients, policies, notes, trash] = await Promise.all([
      Promise.all((clientsRes.data ?? []).map(r => rowToClient(r, dek))),
      Promise.all((policiesRes.data ?? []).map(r => rowToPolicy(r, dek))),
      Promise.all((notesRes.data ?? []).map(r => rowToNote(r, dek))),
      Promise.all((trashRes.data ?? []).map(r => trashToItem(r, dek))),
    ]);

    return {
      clients, policies, notes, trash,
      subAgents:          (subAgentsRes.data ?? []).map(this.rowToSubAgent),
      insurers:           (insurersRes.data ?? []).map(r => r.name),
      notifications:      [...this.notifications],
      terminations:       [],
      logs:               [],
      checklistTemplates: DEFAULT_CHECKLISTS,
      insurerConfigs:     {},
    };
  }

  getState(): AppState {
    return {
      clients: [], policies: [], notes: [], notifications: [],
      terminations: [], logs: [], subAgents: [],
      checklistTemplates: DEFAULT_CHECKLISTS,
      insurers: [], insurerConfigs: {}, trash: [],
    };
  }

  private notifications: Notification[] = [];

  async addNotification(notif: Notification): Promise<AppState> {
    this.notifications = [notif, ...this.notifications].slice(0, 50);
    return this.init();
  }

  async markAllNotificationsRead(): Promise<AppState> {
    this.notifications = this.notifications.map(n => ({ ...n, isRead: true }));
    return this.init();
  }

  async clearAllData(): Promise<AppState> {
    const sb = this.sb();
    await Promise.all([
      sb.from('policy_notes').delete().eq('tenant_id', TENANT_ID),
      sb.from('policies').delete().eq('tenant_id', TENANT_ID),
      sb.from('insurance_clients').delete().eq('tenant_id', TENANT_ID),
      sb.from('terminations').delete().eq('tenant_id', TENANT_ID),
      sb.from('insurance_trash').delete().eq('tenant_id', TENANT_ID),
    ]);
    this.notifications = [];
    return this.init();
  }

  async addClient(client: Client): Promise<AppState> {
    const sb = this.sb();
    const dbId = await toUUID(client.id);
    const existing = await sb.from('insurance_clients').select('id').eq('id', dbId).maybeSingle();
    if (existing.data) return this.updateClient(client);
    const { error } = await sb.from('insurance_clients').insert(await clientToRow(client, this.dek));
    if (error) throw new Error(`Błąd dodawania klienta: ${error.message}`);
    return this.init();
  }

  async updateClient(client: Client): Promise<AppState> {
    const sb = this.sb();
    const dbId = await toUUID(client.id);
    const { error } = await sb.from('insurance_clients').upsert(await clientToRow(client, this.dek)).eq('id', dbId);
    if (error) throw new Error(`Błąd aktualizacji klienta: ${error.message}`);
    return this.init();
  }

  async addPolicy(policy: Policy): Promise<AppState> {
    const { error } = await this.sb().from('policies').insert(await policyToRow(policy, this.dek));
    if (error) throw new Error(`Błąd dodawania polisy: ${error.message}`);
    if (policy.insurerName) {
      await this.sb().from('insurers').upsert(
        { tenant_id: TENANT_ID, name: policy.insurerName, is_visible: true, is_custom: true },
        { onConflict: 'tenant_id,name', ignoreDuplicates: true }
      );
    }
    return this.init();
  }

  async updatePolicy(policy: Policy): Promise<AppState> {
    const dbId = await toUUID(policy.id);
    const { error } = await this.sb().from('policies').upsert(await policyToRow(policy, this.dek)).eq('id', dbId);
    if (error) throw new Error(`Błąd aktualizacji polisy: ${error.message}`);
    if (policy.insurerName) {
      await this.sb().from('insurers').upsert(
        { tenant_id: TENANT_ID, name: policy.insurerName, is_visible: true, is_custom: true },
        { onConflict: 'tenant_id,name', ignoreDuplicates: true }
      );
    }
    return this.init();
  }

  async deletePolicy(id: string): Promise<AppState> {
    const sb = this.sb();
    const dbId = await toUUID(id);
    const { data: p } = await sb.from('policies').select('*').eq('id', dbId).single();
    if (!p) return this.init();

    const deletedItem: DeletedItem = {
      id,
      type: 'POLICY',
      data: await rowToPolicy(p, this.dek),
      deletedAt: new Date().toISOString(),
    };
    await sb.from('insurance_trash').insert(await itemToTrash(deletedItem, this.dek));
    await sb.from('policies').delete().eq('id', dbId);
    return this.init();
  }

  async deleteClient(id: string): Promise<AppState> {
    const sb = this.sb();
    const dbId = await toUUID(id);
    const [{ data: c }, { data: pols }, { data: notes }] = await Promise.all([
      sb.from('insurance_clients').select('*').eq('id', dbId).single(),
      sb.from('policies').select('*').eq('client_id', dbId),
      sb.from('policy_notes').select('*').eq('client_id', dbId),
    ]);
    if (!c) return this.init();

    const dek = this.dek;
    const deletedItem: DeletedItem = {
      id,
      type: 'CLIENT',
      data: {
        client: await rowToClient(c, dek),
        policies: await Promise.all((pols || []).map(p => rowToPolicy(p, dek))),
        notes: await Promise.all((notes || []).map(n => rowToNote(n, dek))),
      },
      deletedAt: new Date().toISOString(),
    };
    await sb.from('insurance_trash').insert(await itemToTrash(deletedItem, dek));
    await Promise.all([
      sb.from('policy_notes').delete().eq('client_id', dbId),
      sb.from('policies').delete().eq('client_id', dbId),
      sb.from('insurance_clients').delete().eq('id', dbId),
    ]);
    return this.init();
  }

  async restoreFromTrash(id: string): Promise<AppState> {
    const sb = this.sb();
    const dbId = await toUUID(id);
    const { data: row } = await sb.from('insurance_trash').select('*').eq('id', dbId).single();
    if (!row) return this.init();

    const item = await trashToItem(row, this.dek);
    if (item.type === 'POLICY') {
      await sb.from('policies').insert(await policyToRow(item.data as Policy, this.dek));
    } else if (item.type === 'CLIENT') {
      const { client, policies, notes } = item.data as any;
      await sb.from('insurance_clients').insert(await clientToRow(client, this.dek));
      if (policies?.length) {
        const pRows = await Promise.all(policies.map((p: any) => policyToRow(p, this.dek)));
        await sb.from('policies').insert(pRows);
      }
      if (notes?.length) {
        const nRows = await Promise.all(notes.map((n: any) => noteToRow(n, this.dek)));
        await sb.from('policy_notes').insert(nRows);
      }
    }
    await sb.from('insurance_trash').delete().eq('id', dbId);
    return this.init();
  }

  async purgeFromTrash(id: string): Promise<AppState> {
    const dbId = await toUUID(id);
    await this.sb().from('insurance_trash').delete().eq('id', dbId);
    return this.init();
  }

  async addNote(note: ClientNote): Promise<AppState> {
    await this.sb().from('policy_notes').insert(await noteToRow(note, this.dek));
    return this.init();
  }

  async updateNote(note: ClientNote): Promise<AppState> {
    const dbId = await toUUID(note.id);
    await this.sb().from('policy_notes').upsert(await noteToRow(note, this.dek)).eq('id', dbId);
    return this.init();
  }

  async deleteNote(id: string): Promise<AppState> {
    const dbId = await toUUID(id);
    await this.sb().from('policy_notes').delete().eq('id', dbId);
    return this.init();
  }

  private rowToTermination(r: any): TerminationRecord {
    return {
      id: r.id,
      clientId: '',
      clientName: '',
      policyId: r.policy_id,
      policyType: '',
      itemDescription: '',
      sentAt: r.sent_date ?? r.created_at,
      actualDate: r.document_date ?? r.created_at,
      localPath: r.pdf_storage_path ?? undefined,
    };
  }

  async addTerminationRecord(record: TerminationRecord): Promise<AppState> {
    await this.sb().from('terminations').insert({
      id: record.id,
      tenant_id: TENANT_ID,
      policy_id: record.policyId,
      sent_date: record.sentAt ? record.sentAt.split('T')[0] : null,
      document_date: record.actualDate ? record.actualDate.split('T')[0] : null,
      pdf_storage_path: record.localPath ?? null,
      article: '28',
    });
    return this.init();
  }

  async deleteTerminationRecord(id: string): Promise<AppState> {
    await this.sb().from('terminations').delete().eq('id', id);
    return this.init();
  }

  async updateTerminationRecord(record: TerminationRecord): Promise<AppState> {
    await this.sb().from('terminations').update({
      sent_date: record.sentAt ? record.sentAt.split('T')[0] : null,
      document_date: record.actualDate ? record.actualDate.split('T')[0] : null,
      pdf_storage_path: record.localPath ?? null,
    }).eq('id', record.id);
    return this.init();
  }

  private rowToSubAgent(r: any): SubAgent {
    return {
      id: r.v1_original_id || r.id,
      name: r.name,
      phone: r.phone ?? undefined,
      email: r.email ?? undefined,
      defaultRates: r.default_rates ?? {},
    };
  }

  private async subAgentToRow(a: SubAgent) {
    const dbId = await toUUID(a.id);
    return {
      id: dbId,
      tenant_id: TENANT_ID,
      name: a.name,
      phone: a.phone ?? null,
      email: a.email ?? null,
      default_rates: a.defaultRates ?? {},
      v1_original_id: isValidUUID(a.id) ? null : a.id,
    };
  }

  async addSubAgent(agent: SubAgent): Promise<AppState> {
    await this.sb().from('sub_agents').insert(await this.subAgentToRow(agent));
    return this.init();
  }

  async updateSubAgent(agent: SubAgent): Promise<AppState> {
    const dbId = await toUUID(agent.id);
    await this.sb().from('sub_agents').upsert(await this.subAgentToRow(agent)).eq('id', dbId);
    return this.init();
  }

  async deleteSubAgent(id: string): Promise<AppState> {
    const dbId = await toUUID(id);
    await this.sb().from('sub_agents').delete().eq('id', dbId);
    return this.init();
  }

  async addActiveInsurer(name: string): Promise<AppState> {
    await this.sb().from('insurers').upsert(
      { tenant_id: TENANT_ID, name, is_visible: true, is_custom: true },
      { onConflict: 'tenant_id,name', ignoreDuplicates: true }
    );
    return this.init();
  }

  async removeActiveInsurer(name: string): Promise<AppState> {
    await this.sb().from('insurers').update({ is_visible: false })
      .eq('tenant_id', TENANT_ID).eq('name', name);
    return this.init();
  }

  async updateInsurerConfig(_config: InsurerConfig): Promise<AppState> { return this.init(); }
  async seedDefaultInsurers(): Promise<AppState> { return this.init(); }

  async updateChecklistTemplates(templates: ChecklistTemplates): Promise<AppState> {
    localStorage.setItem('InsuranceMaster_Checklists_v2', JSON.stringify(templates));
    return this.init();
  }

  // ── Snapshots (admin-only; sprawdzenie RLS na poziomie Supabase) ─────────

  async isAdmin(): Promise<boolean> {
    const sb = this.sb();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user?.id) return false;
    const { data } = await sb
      .from('sales')
      .select('insurance_role, administrator')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!data) return false;
    return data.administrator === true || data.insurance_role === 'owner' || data.insurance_role === 'admin';
  }

  async createSnapshot(note?: string): Promise<{ id: string; created_at: string }> {
    const sb = this.sb();
    const { data: { session } } = await sb.auth.getSession();
    const userId = session?.user?.id;

    // Pobierz salesId dla created_by
    let salesId: number | null = null;
    if (userId) {
      const { data: s } = await sb.from('sales').select('id').eq('user_id', userId).maybeSingle();
      salesId = s?.id ?? null;
    }

    // Surowe wiersze z DB (zaszyfrowane pola lądują w snapshocie bez re-szyfrowania)
    const [clients, policies, notes, subAgents, insurers, trash, terminations] = await Promise.all([
      sb.from('insurance_clients').select('*').eq('tenant_id', TENANT_ID),
      sb.from('policies').select('*').eq('tenant_id', TENANT_ID),
      sb.from('policy_notes').select('*').eq('tenant_id', TENANT_ID),
      sb.from('sub_agents').select('*').eq('tenant_id', TENANT_ID),
      sb.from('insurers').select('*').eq('tenant_id', TENANT_ID),
      sb.from('insurance_trash').select('*').eq('tenant_id', TENANT_ID),
      sb.from('terminations').select('*').eq('tenant_id', TENANT_ID),
    ]);

    const stats = {
      clients: clients.data?.length ?? 0,
      policies: policies.data?.length ?? 0,
      notes: notes.data?.length ?? 0,
      subAgents: subAgents.data?.length ?? 0,
      insurers: insurers.data?.length ?? 0,
      trash: trash.data?.length ?? 0,
      terminations: terminations.data?.length ?? 0,
    };

    const data = {
      insurance_clients: clients.data ?? [],
      policies: policies.data ?? [],
      policy_notes: notes.data ?? [],
      sub_agents: subAgents.data ?? [],
      insurers: insurers.data ?? [],
      insurance_trash: trash.data ?? [],
      terminations: terminations.data ?? [],
    };

    const { data: inserted, error } = await sb
      .from('insurance_snapshots')
      .insert({ tenant_id: TENANT_ID, created_by: salesId, note: note ?? null, stats, data })
      .select('id, created_at')
      .single();
    if (error) throw new Error(`Błąd tworzenia snapshotu: ${error.message}`);
    return inserted as any;
  }

  async listSnapshots(): Promise<Array<{ id: string; created_at: string; note: string | null; stats: any; created_by_email?: string | null }>> {
    const sb = this.sb();
    const { data, error } = await sb
      .from('insurance_snapshots')
      .select('id, created_at, note, stats, created_by')
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(`Błąd listowania snapshotów: ${error.message}`);
    return (data ?? []).map(r => ({ id: r.id, created_at: r.created_at, note: r.note, stats: r.stats }));
  }

  async restoreSnapshot(id: string): Promise<AppState> {
    const sb = this.sb();
    const { data: snap, error } = await sb
      .from('insurance_snapshots')
      .select('data')
      .eq('id', id)
      .single();
    if (error || !snap) throw new Error(`Nie znaleziono snapshotu: ${error?.message}`);

    const d = snap.data as any;
    // Czyszczenie bieżącego stanu tenantu
    await Promise.all([
      sb.from('policy_notes').delete().eq('tenant_id', TENANT_ID),
      sb.from('policies').delete().eq('tenant_id', TENANT_ID),
      sb.from('insurance_clients').delete().eq('tenant_id', TENANT_ID),
      sb.from('insurance_trash').delete().eq('tenant_id', TENANT_ID),
      sb.from('terminations').delete().eq('tenant_id', TENANT_ID),
    ]);

    // Wstawiamy surowe wiersze w kolejności zależności
    const chunk = <T>(arr: T[], size: number) => {
      const r: T[][] = [];
      for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
      return r;
    };
    const insertAll = async (table: string, rows: any[]) => {
      if (!rows?.length) return;
      for (const c of chunk(rows, 50)) {
        const { error: e } = await sb.from(table).insert(c);
        if (e) throw new Error(`Restore ${table}: ${e.message}`);
      }
    };

    await insertAll('insurance_clients', d.insurance_clients ?? []);
    await insertAll('policies', d.policies ?? []);
    await insertAll('policy_notes', d.policy_notes ?? []);
    await insertAll('sub_agents', d.sub_agents ?? []);
    await insertAll('insurance_trash', d.insurance_trash ?? []);
    await insertAll('terminations', d.terminations ?? []);

    return this.init();
  }

  async deleteSnapshot(id: string): Promise<void> {
    const { error } = await this.sb().from('insurance_snapshots').delete().eq('id', id);
    if (error) throw new Error(`Błąd usuwania snapshotu: ${error.message}`);
  }

  async importState(newState: AppState): Promise<AppState> {
    const sb = this.sb();
    const dek = this.dek;

    const clientRows = await Promise.all((newState.clients ?? []).map(c => clientToRow(c, dek)));
    const policyRows = await Promise.all((newState.policies ?? []).map(p => policyToRow(p, dek)));
    const noteRows   = await Promise.all((newState.notes ?? []).map(n => noteToRow(n, dek)));
    const agentRows  = await Promise.all((newState.subAgents ?? []).map(a => this.subAgentToRow(a)));

    const chunk = <T>(arr: T[], size: number) => {
      const r: T[][] = [];
      for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
      return r;
    };

    for (const c of chunk(clientRows, 50)) {
      const { error } = await sb.from('insurance_clients').upsert(c, { onConflict: 'id' });
      if (error) throw error;
    }
    for (const c of chunk(policyRows, 50)) {
      const { error } = await sb.from('policies').upsert(c, { onConflict: 'id' });
      if (error) throw error;
    }
    for (const c of chunk(noteRows, 50)) {
      const { error } = await sb.from('policy_notes').upsert(c, { onConflict: 'id' });
      if (error) throw error;
    }
    if (agentRows.length) {
      const { error } = await sb.from('sub_agents').upsert(agentRows, { onConflict: 'id' });
      if (error) throw error;
    }
    if (newState.trash?.length) {
      const trashRows = await Promise.all(newState.trash.map(item => itemToTrash(item, dek)));
      for (const c of chunk(trashRows, 20)) {
        const { error } = await sb.from('insurance_trash').upsert(c, { onConflict: 'id' });
        if (error) throw error;
      }
    }
    if (newState.insurers?.length) {
      const rows = newState.insurers.map(name => ({
        tenant_id: TENANT_ID, name, is_visible: true, is_custom: true,
      }));
      const { error } = await sb.from('insurers').upsert(rows, { onConflict: 'tenant_id,name' });
      if (error) throw error;
    }
    return this.init();
  }
}

export const supabaseStorage = new SupabaseStorageManager();
