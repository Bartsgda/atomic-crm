/**
 * SupabaseStorageManager — V2 backend dla V1 island.
 * Envelope encryption: DEK (AES-GCM CryptoKey) ustawiany raz w sesji po unwrap hasłem.
 * Szyfrowane są TYLKO wrażliwe pola (PESEL, telefony, maile, adres, data ur.,
 * szczegóły pojazdu/domu, treść notatek). Imiona, nazwiska, nazwy firm
 * ubezpieczeniowych, kwoty i daty pozostają w plaintext — żeby wyszukiwanie działało.
 *
 * Tenant: Alina Insurance (11111111-1111-1111-1111-111111111111)
 */

import { getSupabaseClient, getActiveSchema } from '../../components/atomic-crm/providers/supabase/supabase';
import type {
  AppState, Client, Policy, ClientNote, Notification,
  TerminationRecord, SubAgent, ChecklistTemplates,
  InsurerConfig, DeletedItem, UiPreferences,
  Vehicle, InsuredPerson, ClientBusiness, BusinessEntity,
} from '../types';
import type { FlagResolution } from './policyFlags';
import { resolutionKey } from './policyFlags';
import { encryptField, decryptField, encryptJsonField, decryptJsonField, looksEncrypted, looksLikePlaintextPesel } from './crypto';

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

/**
 * Szyfruj string wrażliwy (PESEL, telefon, email, numer polisy, rejestracja, adres).
 *
 * RODO security (fix 2026-05-15, task PESEL DEK):
 * - val pusty (null/undefined/'') → null (nic do zachowania)
 * - DEK obecny → zaszyfruj envelope AES-GCM
 * - DEK brakuje + val niepusty → THROW. **NIGDY nie zapisujemy plaintext PESEL**
 *   do kolumny `*_encrypted`. Cały save path musi działać tylko gdy EncryptionGate
 *   odblokował sesję (`supabaseStorage.setDEK(dek)`).
 *
 * Stare zachowanie ("fallback do plaintext gdy brak DEK") było źródłem wycieku
 * row_110 (Gabriel Zaklicki, dziecko, PESEL 18221803056 lądował plaintext w DB).
 */
async function encStr(val: string | null | undefined, dek: CryptoKey | null): Promise<string | null> {
  if (!val) return null;
  if (!dek) {
    throw new Error(
      '[encStr] DEK is null — odmawiam zapisu wrażliwego pola plaintext. ' +
      'Sesja musi być odblokowana przez EncryptionGate przed zapisem.',
    );
  }
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
  // Pusta lista/obiekt nie wymaga DEK — to brak danych do utajnienia.
  if (Array.isArray(val) && val.length === 0) return val;
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return val;
  if (!dek) {
    throw new Error(
      '[encJson] DEK is null — odmawiam zapisu wrażliwego JSON (phones/emails/home_details) plaintext.',
    );
  }
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
    try { const p = JSON.parse(t); return Array.isArray(p) ? p : []; } catch { /* invalid JSON — return [] below */ }
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
  // BUG #3 row_110 fix (PESEL DEK task 2026-05-15):
  // dataMapper ustawia `pesel_encrypted_pending` z col[18] "pesel kl X" przed
  // wdrożeniem DEK. Tutaj — w pierwszym miejscu z DEK w ręku — bierzemy pending
  // jako plaintext do zaszyfrowania. Nie zostawiamy plaintext nigdzie indziej.
  const peselPlaintext = c.pesel || (c as any).pesel_encrypted_pending || null;
  // v1_original_id: OBIE schematy (public + test oba mają)
  return {
    id: dbId,
    tenant_id: TENANT_ID,
    first_name: c.firstName || '',
    last_name: c.lastName || '',
    pesel_encrypted: await encStr(peselPlaintext, dek),
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

  // Businesses — nowa tabela (priorytet) lub fallback na JSONB
  const businessesFromTable: ClientBusiness[] = clientBusinessesMap.get(r.id) || [];
  const businesses = businessesFromTable.length > 0
    ? businessesFromTable.map(b => ({ name: b.name, nip: b.nip, regon: b.regon, krs: b.krs, role: b.role, notes: b.notes }))
    : toArray(r.businesses) as any;

  return {
    id: r.v1_original_id || r.id,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    pesel: await decStr(r.pesel_encrypted, dek),
    birthDate: r.birth_date || undefined,
    gender: r.gender ?? undefined,
    phones: toArray(phones),
    emails: toArray(emails),
    businesses,
    street: await decStr(r.street, dek),
    city: await decStr(r.city, dek),
    zipCode: await decStr(r.zip_code, dek),
    createdAt: r.created_at,
  };
}

async function policyToRow(p: Policy, dek: CryptoKey | null, vehicleId?: string | null) {
  const isFake = p.id.includes('demo') || p.clientId.includes('demo') || (p as any).isFake;
  const dbId = await toUUID(p.id);
  const dbClientId = await toUUID(p.clientId);
  // v1_original_id + v1_original_client_id: OBIE schematy (public + test oba mają)
  // vehicle_id / renewal_of_policy_id / referred_*: TYLKO test (migracja v2)
  const isTest = getActiveSchema() === 'test';
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
    // Kolumny test-only (v2 migration — nie istnieją w public.policies)
    ...(isTest ? {
      vehicle_id: vehicleId ?? null,
      renewal_of_policy_id: (p as any).renewalOfPolicyId ?? null,
      referred_by_name: (p as any).referredByName ?? null,
      referred_by_client_id: (p as any).referredByClientId ?? null,
    } : {}),
  };
}

async function rowToPolicy(r: any, dek: CryptoKey | null): Promise<Policy> {
  // Vehicle — nowa tabela (priorytet) lub fallback na legacy auto_details
  let vehicle: Vehicle | undefined;
  if (r.vehicle_id && vehicleMap.has(r.vehicle_id)) {
    const v = vehicleMap.get(r.vehicle_id);
    vehicle = {
      id:          v.id,
      reg:         v.reg       ?? undefined,
      brand:       v.brand     ?? undefined,
      model:       v.model     ?? undefined,
      vin:         v.vin       ?? undefined,
      year:        v.year      ?? undefined,
      fuel:        v.fuel      ?? undefined,
      vehicleType: v.vehicle_type ?? undefined,
      powerKw:     v.power_kw  ?? undefined,
      engineCc:    v.engine_cc ?? undefined,
    };
  } else if (r.auto_details) {
    vehicle = legacyAutoDetailsToVehicle(r.auto_details);
  }

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
    // Schema refactor v2
    vehicle,
    insuredPersons: insuredPersonsMap.get(r.id) || [],
    renewalOfPolicyId:   r.renewal_of_policy_id   ?? null,
    referredByName:      r.referred_by_name        ?? null,
    referredByClientId:  r.referred_by_client_id   ?? null,
  };
}

async function noteToRow(n: ClientNote, _dek: CryptoKey | null) {
  let reminderStatus: 'PRZYPOMNIENIE' | 'UKONCZONE' | 'ANULOWANE' | null = null;
  if (n.reminderDate) {
    reminderStatus = n.isCompleted ? 'UKONCZONE' : 'PRZYPOMNIENIE';
  }
  const dbId = await toUUID(n.id);
  const dbClientId = await toUUID(n.clientId);
  // v1_original_id: OBIE schematy (public + test)
  // v1_original_client_id: public ✓, test ✗ (dodaj ręcznie: patrz migration noterow_v1_client_id)
  const isTest = getActiveSchema() === 'test';
  return {
    id: dbId,
    tenant_id: TENANT_ID,
    client_id: dbClientId,
    content: n.content || null,
    tag: n.tag || null,
    reminder_date: n.reminderDate ? new Date(n.reminderDate).toISOString() : null,
    reminder_status: reminderStatus,
    linked_policy_ids: await Promise.all((n.linkedPolicyIds ?? []).map(id => toUUID(id))),
    history: n.history ?? [],
    v1_original_id: isValidUUID(n.id) ? null : n.id,
    // Nie wysyłamy v1_original_client_id do test — kolumna jeszcze nie dodana
    // Po uruchomieniu migracji: usuń warunek i zawsze wysyłaj
    ...(isTest ? {} : { v1_original_client_id: isValidUUID(n.clientId) ? null : n.clientId }),
  };
}

async function rowToNote(r: any, dek: CryptoKey | null, policyUuidToV1?: Map<string, string>): Promise<ClientNote> {
  // policy_note_links — nowa tabela (priorytet) lub fallback na uuid[]
  const linkedFromTable = noteLinksMap.get(r.id) || [];
  const rawLinkedIds = linkedFromTable.length > 0
    ? linkedFromTable
    : (r.linked_policy_ids ?? []);
  const linkedIds = rawLinkedIds.map(
    (uuid: string) => policyUuidToV1?.get(uuid) ?? uuid,
  );

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
    linkedPolicyIds: linkedIds,
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

// ─── Schema refactor v2 — moduł-level maps (aktualizowane w init()) ──────────

let vehicleMap = new Map<string, any>();
let insuredPersonsMap = new Map<string, InsuredPerson[]>();
let clientBusinessesMap = new Map<string, any[]>();
let noteLinksMap = new Map<string, string[]>();

/** Backward compat: konwertuje legacy auto_details JSONB → Vehicle */
function legacyAutoDetailsToVehicle(autoDetails: any): Vehicle | undefined {
  if (!autoDetails) return undefined;
  const v: Vehicle = {};
  if (autoDetails.vehicleType)    v.vehicleType = autoDetails.vehicleType;
  if (autoDetails.fuelType)       v.fuel = autoDetails.fuelType;
  if (autoDetails.engineCapacity) v.engineCc = Number(autoDetails.engineCapacity) || undefined;
  if (autoDetails.enginePower)    v.powerKw  = Number(autoDetails.enginePower) || undefined;
  if (autoDetails.productionYear) v.year     = Number(autoDetails.productionYear) || undefined;
  return Object.keys(v).length > 0 ? v : undefined;
}

// ─── Schema v2 — save helpers ─────────────────────────────────────────────────
//
// Każdy helper jest samodzielny: try/catch + console.error — błąd nie blokuje
// głównego save (legacy JSONB dual-write jest zawsze w policyToRow/clientToRow).
//
// UUID conversion: każdy helper sam wywołuje toUUID() na incoming IDs.

function getSupabase() {
  return getSupabaseClient();
}

/**
 * Zapisuje pojazd do tabeli `vehicles`.
 * Strategia: SELECT po (tenant_id, client_id, reg) → UPDATE jeśli istnieje,
 * INSERT jeśli nie. Nie używamy upsert onConflict (brak UNIQUE constraint).
 * Zwraca vehicle_id (uuid) lub null przy błędzie.
 */
async function saveVehicle(
  vehicle: Vehicle,
  clientDbId: string,
  _dek: CryptoKey | null,
): Promise<string | null> {
  try {
    const sb = getSupabase();

    // Jeśli mamy już id z load flow — preferuj UPDATE tego rekordu
    if (vehicle.id && isValidUUID(vehicle.id)) {
      const row = {
        tenant_id:    TENANT_ID,
        client_id:    clientDbId,
        reg:          vehicle.reg          ?? null,
        brand:        vehicle.brand        ?? null,
        model:        vehicle.model        ?? null,
        vin:          vehicle.vin          ?? null,
        year:         vehicle.year         ?? null,
        fuel:         vehicle.fuel         ?? null,
        vehicle_type: vehicle.vehicleType  ?? null,
        power_kw:     vehicle.powerKw      ?? null,
        engine_cc:    vehicle.engineCc     ?? null,
      };
      const { error } = await sb.from('vehicles').update(row).eq('id', vehicle.id);
      if (error) {
        console.error('[v2:saveVehicle] UPDATE failed:', error.message);
        return null;
      }
      // Odśwież vehicleMap
      vehicleMap.set(vehicle.id, { id: vehicle.id, ...row });
      return vehicle.id;
    }

    // Brak id — szukaj po (tenant_id, client_id, reg) jeśli reg podane
    if (vehicle.reg) {
      const { data: existing } = await sb
        .from('vehicles')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .eq('client_id', clientDbId)
        .eq('reg', vehicle.reg)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await sb.from('vehicles').update({
          brand:        vehicle.brand        ?? null,
          model:        vehicle.model        ?? null,
          vin:          vehicle.vin          ?? null,
          year:         vehicle.year         ?? null,
          fuel:         vehicle.fuel         ?? null,
          vehicle_type: vehicle.vehicleType  ?? null,
          power_kw:     vehicle.powerKw      ?? null,
          engine_cc:    vehicle.engineCc     ?? null,
        }).eq('id', existing.id);
        if (error) {
          console.error('[v2:saveVehicle] UPDATE by reg failed:', error.message);
          return null;
        }
        return existing.id;
      }
    }

    // INSERT nowego pojazdu
    const { data: inserted, error: insErr } = await sb.from('vehicles').insert({
      tenant_id:    TENANT_ID,
      client_id:    clientDbId,
      reg:          vehicle.reg          ?? null,
      brand:        vehicle.brand        ?? null,
      model:        vehicle.model        ?? null,
      vin:          vehicle.vin          ?? null,
      year:         vehicle.year         ?? null,
      fuel:         vehicle.fuel         ?? null,
      vehicle_type: vehicle.vehicleType  ?? null,
      power_kw:     vehicle.powerKw      ?? null,
      engine_cc:    vehicle.engineCc     ?? null,
    }).select('id').single();

    if (insErr || !inserted?.id) {
      console.error('[v2:saveVehicle] INSERT failed:', insErr?.message);
      return null;
    }
    vehicleMap.set(inserted.id, { id: inserted.id, reg: vehicle.reg, brand: vehicle.brand, model: vehicle.model });
    return inserted.id;
  } catch (err) {
    console.error('[v2:saveVehicle] unexpected error:', err);
    return null;
  }
}

/**
 * Zapisuje listę ubezpieczonych do tabeli `insured_persons`.
 * Strategia: DELETE WHERE policy_id + INSERT batch (pełen replace).
 * Wrażliwe pola szyfrowane przez DEK (peselEncrypted, email, phone, birthDate).
 *
 * list=undefined → skip (brak semantyki "usuń wszystkich")
 * list=[]        → usuwa wszystkich (user wyczyścił listę)
 */
async function saveInsuredPersons(
  policyDbId: string,
  list: InsuredPerson[] | undefined,
  dek: CryptoKey | null,
): Promise<void> {
  if (list === undefined) return;
  try {
    const sb = getSupabase();
    await sb.from('insured_persons').delete().eq('policy_id', policyDbId);
    if (list.length === 0) return;

    const rows = await Promise.all(list.map(async (ip) => ({
      tenant_id:       TENANT_ID,
      policy_id:       policyDbId,
      relation:        ip.relation ?? 'ubezpieczony',
      first_name:      ip.firstName  ?? null,
      last_name:       ip.lastName   ?? null,
      pesel_encrypted: await encStr(ip.peselEncrypted, dek),
      birth_date:      await encStr(ip.birthDate, dek),
      nip:             ip.nip        ?? null,
      email:           await encStr(ip.email, dek),
      phone:           await encStr(ip.phone, dek),
      notes:           ip.notes      ?? null,
      ai_extracted:    ip.aiExtracted ?? false,
    })));

    const { error } = await sb.from('insured_persons').insert(rows);
    if (error) console.error('[v2:saveInsuredPersons] INSERT failed:', error.message);

    // Odśwież insuredPersonsMap
    insuredPersonsMap.set(policyDbId, list);
  } catch (err) {
    console.error('[v2:saveInsuredPersons] unexpected error:', err);
  }
}

/**
 * Zapisuje firmy klienta do tabeli `client_businesses`.
 * Strategia: SELECT istniejących NIP-ów, DELETE orphanów, UPSERT po (client_id, nip).
 * Przyjmuje BusinessEntity[] (kształt Client.businesses).
 *
 * Pola stratne dla tabeli (street/city/zipCode/phones/emails/representation)
 * zostają w legacy JSONB (dual-write przez clientToRow).
 */
async function saveClientBusinesses(
  clientDbId: string,
  list: BusinessEntity[] | undefined,
): Promise<void> {
  if (list === undefined) return;
  try {
    const sb = getSupabase();

    if (list.length === 0) {
      // Usuń wszystkie firmy klienta
      await sb.from('client_businesses').delete().eq('client_id', clientDbId).eq('tenant_id', TENANT_ID);
      clientBusinessesMap.delete(clientDbId);
      return;
    }

    // Pobierz istniejące rekordy
    const { data: existing } = await sb
      .from('client_businesses')
      .select('id, nip, name')
      .eq('client_id', clientDbId)
      .eq('tenant_id', TENANT_ID);

    const existingByNip = new Map<string, string>(); // nip → id
    const existingByName = new Map<string, string>(); // name → id (fallback gdy brak NIP)
    for (const e of existing ?? []) {
      if (e.nip) existingByNip.set(e.nip, e.id);
      else       existingByName.set(e.name, e.id);
    }

    const incomingNips = new Set(list.filter(b => b.nip).map(b => b.nip!));
    const incomingNames = new Set(list.filter(b => !b.nip).map(b => b.name));

    // Usuń orphany (rekordy nieobecne w nowej liście)
    const toDelete: string[] = [];
    for (const [nip, id] of existingByNip) {
      if (!incomingNips.has(nip)) toDelete.push(id);
    }
    for (const [name, id] of existingByName) {
      if (!incomingNames.has(name)) toDelete.push(id);
    }
    if (toDelete.length > 0) {
      await sb.from('client_businesses').delete().in('id', toDelete);
    }

    // INSERT lub UPDATE per business
    for (const biz of list) {
      const row = {
        tenant_id:  TENANT_ID,
        client_id:  clientDbId,
        name:       biz.name,
        nip:        biz.nip   || null,
        regon:      biz.regon || null,
        krs:        biz.krs   || null,
        role:       'owner' as const,   // BusinessEntity nie ma role — default 'owner'
        notes:      biz.notes || null,
      };

      const existingId = biz.nip
        ? existingByNip.get(biz.nip)
        : existingByName.get(biz.name);

      if (existingId) {
        await sb.from('client_businesses').update(row).eq('id', existingId);
      } else {
        await sb.from('client_businesses').insert(row);
      }
    }

    // Odśwież clientBusinessesMap
    clientBusinessesMap.set(clientDbId, list.map(b => ({ ...b, client_id: clientDbId })));
  } catch (err) {
    console.error('[v2:saveClientBusinesses] unexpected error:', err);
  }
}

/**
 * Zapisuje linki notatka↔polisa do tabeli `policy_note_links`.
 * Strategia: DELETE WHERE note_id + INSERT batch.
 * Dual-write do legacy `linked_policy_ids` odbywa się automatycznie w noteToRow().
 */
async function savePolicyNoteLinks(
  noteDbId: string,
  policyIds: string[],
): Promise<void> {
  try {
    const sb = getSupabase();
    await sb.from('policy_note_links').delete().eq('note_id', noteDbId);
    if (policyIds.length === 0) {
      noteLinksMap.delete(noteDbId);
      return;
    }

    // Konwertuj v1 IDs na UUID
    const policyDbIds = await Promise.all(policyIds.map(id => toUUID(id)));

    const rows = policyDbIds.map(pid => ({
      note_id:   noteDbId,
      policy_id: pid,
    }));

    const { error } = await sb.from('policy_note_links').insert(rows);
    if (error) console.error('[v2:savePolicyNoteLinks] INSERT failed:', error.message);

    noteLinksMap.set(noteDbId, policyDbIds);
  } catch (err) {
    console.error('[v2:savePolicyNoteLinks] unexpected error:', err);
  }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: UiPreferences = {
  theme: 'dark',
  density: 'comfortable',
  primaryColor: '#d4af37',
  fontScale: 1.0,
  skin: 'luxury-gold',
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

  /**
   * Batch reconciler: re-szyfruje wszystkie wycieki plaintext PESEL w
   * `insurance_clients.pesel_encrypted` oraz `insured_persons.pesel_encrypted`,
   * używając aktualnego DEK w pamięci.
   *
   * Wymaga: sesja odblokowana (DEK ustawiony przez EncryptionGate).
   * dryRun=true (domyślnie) — tylko raport, bez UPDATE.
   *
   * RODO: PESEL nigdy nie jest logowany. Raport zawiera tylko id wierszy + count.
   */
  async reencryptOrphanPesels(opts: { dryRun?: boolean } = {}): Promise<{
    clientsFound: number;
    clientsFixed: number;
    insuredFound: number;
    insuredFixed: number;
    errors: string[];
  }> {
    const dryRun = opts.dryRun !== false;
    if (!this.dek) {
      throw new Error('reencryptOrphanPesels: sesja zablokowana, brak DEK');
    }
    const dek = this.dek;
    const sb = this.sb();
    const result = {
      clientsFound: 0, clientsFixed: 0,
      insuredFound: 0, insuredFixed: 0,
      errors: [] as string[],
    };

    // 1. insurance_clients
    const { data: clients, error: cErr } = await sb
      .from('insurance_clients')
      .select('id, pesel_encrypted')
      .eq('tenant_id', TENANT_ID)
      .not('pesel_encrypted', 'is', null);
    if (cErr) {
      result.errors.push(`select insurance_clients: ${cErr.message}`);
    } else {
      for (const r of clients ?? []) {
        if (!looksLikePlaintextPesel(r.pesel_encrypted)) continue;
        result.clientsFound++;
        if (dryRun) continue;
        try {
          const ct = await encryptField(r.pesel_encrypted, dek);
          const { error } = await sb
            .from('insurance_clients')
            .update({ pesel_encrypted: ct })
            .eq('id', r.id);
          if (error) {
            result.errors.push(`update client ${r.id}: ${error.message}`);
          } else {
            result.clientsFixed++;
          }
        } catch (e: any) {
          result.errors.push(`encrypt client ${r.id}: ${e?.message ?? String(e)}`);
        }
      }
    }

    // 2. insured_persons
    const { data: insured, error: iErr } = await sb
      .from('insured_persons')
      .select('id, pesel_encrypted')
      .eq('tenant_id', TENANT_ID)
      .not('pesel_encrypted', 'is', null);
    if (iErr) {
      result.errors.push(`select insured_persons: ${iErr.message}`);
    } else {
      for (const r of insured ?? []) {
        if (!looksLikePlaintextPesel(r.pesel_encrypted)) continue;
        result.insuredFound++;
        if (dryRun) continue;
        try {
          const ct = await encryptField(r.pesel_encrypted, dek);
          const { error } = await sb
            .from('insured_persons')
            .update({ pesel_encrypted: ct })
            .eq('id', r.id);
          if (error) {
            result.errors.push(`update insured ${r.id}: ${error.message}`);
          } else {
            result.insuredFixed++;
          }
        } catch (e: any) {
          result.errors.push(`encrypt insured ${r.id}: ${e?.message ?? String(e)}`);
        }
      }
    }

    return result;
  }

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

    const [
      clientsRes, policiesRes, notesRes, subAgentsRes, insurersRes, trashRes, sharesRes,
      vehiclesRes, insuredPersonsRes, businessesRes, noteLinksRes,
    ] = await Promise.all([
      sb.from('insurance_clients').select('*').eq('tenant_id', TENANT_ID).order('last_name'),
      sb.from('policies').select('*').eq('tenant_id', TENANT_ID),
      sb.from('policy_notes').select('*').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }),
      sb.from('sub_agents').select('*').eq('tenant_id', TENANT_ID),
      sb.from('insurers').select('name').eq('tenant_id', TENANT_ID).eq('is_visible', true),
      sb.from('insurance_trash').select('*').eq('tenant_id', TENANT_ID).order('deleted_at', { ascending: false }),
      sb.from('policy_sub_agent_shares').select('*').eq('tenant_id', TENANT_ID),
      // Schema refactor v2 — nowe tabele (graceful: błąd nie blokuje init)
      sb.from('vehicles').select('*').eq('tenant_id', TENANT_ID),
      sb.from('insured_persons').select('*').eq('tenant_id', TENANT_ID),
      sb.from('client_businesses').select('*').eq('tenant_id', TENANT_ID),
      sb.from('policy_note_links').select('*'),
    ]);

    const errors = [clientsRes.error, policiesRes.error, notesRes.error, subAgentsRes.error, insurersRes.error, trashRes.error, sharesRes.error].filter(Boolean);
    if (errors.length > 0) {
      const firstError = errors[0];
      console.error('[SupabaseStorage] Query failure:', firstError);
      throw new Error(`Błąd bazy danych: ${firstError?.message || 'unknown'}`);
    }

    // Graceful degradation dla refactor v2 tabel (zastosowane w `test`, jeszcze nie w `public`).
    // Brak tabeli (PGRST205 / 42P01) = expected → debug. Inny błąd → warn.
    const isMissingTable = (err: any) => {
      if (!err) return false;
      const m = (err.message || "").toLowerCase();
      return (
        err.code === "PGRST205" ||
        err.code === "42P01" ||
        m.includes("could not find the table") ||
        m.includes("does not exist")
      );
    };
    const logTableErr = (name: string, err: any) => {
      if (!err) return;
      const fn = isMissingTable(err) ? console.debug : console.warn;
      fn(`[SupabaseStorage] ${name} query failed:`, err.message);
    };
    logTableErr("vehicles",          vehiclesRes.error);
    logTableErr("insured_persons",   insuredPersonsRes.error);
    logTableErr("client_businesses", businessesRes.error);
    logTableErr("policy_note_links", noteLinksRes.error);

    // Aktualizuj moduł-level maps (używane przez rowToPolicy/rowToClient/rowToNote)
    vehicleMap = new Map((vehiclesRes.data ?? []).map((v: any) => [v.id, v]));

    insuredPersonsMap = new Map<string, any[]>();
    for (const ip of insuredPersonsRes.data ?? []) {
      const list = insuredPersonsMap.get(ip.policy_id) || [];
      list.push(ip);
      insuredPersonsMap.set(ip.policy_id, list);
    }

    clientBusinessesMap = new Map<string, any[]>();
    for (const b of businessesRes.data ?? []) {
      const list = clientBusinessesMap.get(b.client_id) || [];
      list.push(b);
      clientBusinessesMap.set(b.client_id, list);
    }

    noteLinksMap = new Map<string, string[]>();
    for (const nl of noteLinksRes.data ?? []) {
      const list = noteLinksMap.get(nl.note_id) || [];
      list.push(nl.policy_id);
      noteLinksMap.set(nl.note_id, list);
    }

    const dek = this.dek;
    const policyUuidToV1 = new Map<string, string>();
    for (const r of policiesRes.data ?? []) {
      if (r.v1_original_id) policyUuidToV1.set(r.id, r.v1_original_id);
    }
    // Build sub-agent shares map: policy_id -> [{agentId, rate, amount, note}]
    const sharesByPolicy = new Map<string, Array<{agentId: string; rate: number; amount: number; note?: string}>>();
    for (const s of sharesRes.data ?? []) {
      const arr = sharesByPolicy.get(s.policy_id) || [];
      arr.push({
        agentId: s.sub_agent_id,
        rate: Number(s.rate ?? 0),
        amount: Number(s.amount ?? 0),
        note: s.note ?? undefined,
      });
      sharesByPolicy.set(s.policy_id, arr);
    }
    const [clients, policies, notes, trash] = await Promise.all([
      Promise.all((clientsRes.data ?? []).map(r => rowToClient(r, dek))),
      Promise.all((policiesRes.data ?? []).map(async r => {
        const p = await rowToPolicy(r, dek);
        p.subAgentSplits = sharesByPolicy.get(r.id) || [];
        return p;
      })),
      Promise.all((notesRes.data ?? []).map(r => rowToNote(r, dek, policyUuidToV1))),
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
    // Schema v2 — firmy klienta (po udanym INSERT)
    await saveClientBusinesses(dbId, client.businesses);
    return this.init();
  }

  async updateClient(client: Client): Promise<AppState> {
    const sb = this.sb();
    const dbId = await toUUID(client.id);
    const { error } = await sb.from('insurance_clients').upsert(await clientToRow(client, this.dek)).eq('id', dbId);
    if (error) throw new Error(`Błąd aktualizacji klienta: ${error.message}`);
    // Schema v2 — firmy klienta
    await saveClientBusinesses(dbId, client.businesses);
    return this.init();
  }

  async addPolicy(policy: Policy): Promise<AppState> {
    const dbId = await toUUID(policy.id);
    const dbClientId = await toUUID(policy.clientId);

    // Schema v2 — zapisz pojazd przed polisą (potrzebujemy vehicle_id)
    let vehicleId: string | null = null;
    if (policy.vehicle && (policy.vehicle.reg || policy.vehicle.brand || policy.vehicle.id)) {
      vehicleId = await saveVehicle(policy.vehicle, dbClientId, this.dek);
    }

    const { error } = await this.sb().from('policies').insert(await policyToRow(policy, this.dek, vehicleId));
    if (error) throw new Error(`Błąd dodawania polisy: ${error.message}`);

    // Schema v2 — ubezpieczeni (po udanym INSERT polisy)
    await saveInsuredPersons(dbId, policy.insuredPersons, this.dek);

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
    const dbClientId = await toUUID(policy.clientId);

    // Schema v2 — zapisz pojazd przed polisą
    let vehicleId: string | null = null;
    if (policy.vehicle && (policy.vehicle.reg || policy.vehicle.brand || policy.vehicle.id)) {
      vehicleId = await saveVehicle(policy.vehicle, dbClientId, this.dek);
    }

    const { error } = await this.sb().from('policies').upsert(await policyToRow(policy, this.dek, vehicleId)).eq('id', dbId);
    if (error) throw new Error(`Błąd aktualizacji polisy: ${error.message}`);

    // Schema v2 — ubezpieczeni
    await saveInsuredPersons(dbId, policy.insuredPersons, this.dek);

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
    const dbId = await toUUID(note.id);
    await this.sb().from('policy_notes').insert(await noteToRow(note, this.dek));
    // Schema v2 — linki notatka↔polisa (dual-write; legacy linked_policy_ids w noteToRow)
    await savePolicyNoteLinks(dbId, note.linkedPolicyIds ?? []);
    return this.init();
  }

  async updateNote(note: ClientNote): Promise<AppState> {
    const dbId = await toUUID(note.id);
    await this.sb().from('policy_notes').upsert(await noteToRow(note, this.dek)).eq('id', dbId);
    // Schema v2 — linki notatka↔polisa
    await savePolicyNoteLinks(dbId, note.linkedPolicyIds ?? []);
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
      // v1_original_id: TYLKO public (test.sub_agents nie ma tej kolumny)
      ...(getActiveSchema() === 'test' ? {} : { v1_original_id: isValidUUID(a.id) ? null : a.id }),
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

  async listSnapshots(): Promise<Array<{ id: string; created_at: string; note: string | null; stats: any; created_by: number | null; is_auto: boolean }>> {
    const sb = this.sb();
    const { data, error } = await sb
      .from('insurance_snapshots')
      .select('id, created_at, note, stats, created_by')
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(`Błąd listowania snapshotów: ${error.message}`);
    return (data ?? []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      note: r.note,
      stats: r.stats,
      created_by: r.created_by ?? null,
      is_auto: typeof r.note === 'string' && r.note.startsWith('auto'),
    }));
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
    if (!dek) throw new Error('importState: DEK jest null — sesja zablokowana. Odblokuj EncryptionGate przed importem.');

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
      if (getActiveSchema() === 'test') {
        // test.sub_agents brak PRIMARY KEY — upsert ON CONFLICT (id) nie działa
        // workaround: DELETE + INSERT (bezpieczne bo import zawsze full-replace)
        const ids = agentRows.map(r => r.id);
        await sb.from('sub_agents').delete().in('id', ids);
        const { error } = await sb.from('sub_agents').insert(agentRows);
        if (error) throw error;
      } else {
        const { error } = await sb.from('sub_agents').upsert(agentRows, { onConflict: 'id' });
        if (error) throw error;
      }
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

  // ─── Flag Resolutions ─────────────────────────────────────────────────────

  /**
   * Ładuje wszystkie rekordy flag_resolutions dla tenantu.
   * Zwraca Map z kluczem `${targetType}:${targetId}:${flagType}`.
   * Graceful: jeśli tabela nie istnieje (pre-migration), zwraca pustą mapę.
   */
  async loadFlagResolutions(): Promise<Map<string, FlagResolution>> {
    const sb = this.sb();
    const { data, error } = await sb
      .from('flag_resolutions')
      .select('*')
      .eq('tenant_id', TENANT_ID);

    if (error) {
      const m = (error.message || "").toLowerCase();
      const missing = error.code === "PGRST205" || error.code === "42P01" ||
        m.includes("could not find the table") || m.includes("does not exist");
      (missing ? console.debug : console.warn)(
        '[SupabaseStorage] loadFlagResolutions failed (tabela może nie istnieć jeszcze):',
        error.message,
      );
      return new Map();
    }

    const map = new Map<string, FlagResolution>();
    for (const row of data ?? []) {
      const res: FlagResolution = {
        id: row.id,
        tenantId: row.tenant_id,
        targetType: row.target_type,
        targetId: row.target_id,
        flagType: row.flag_type,
        resolvedAt: row.resolved_at ?? null,
        resolvedByUserId: row.resolved_by_user_id ?? null,
        dismissedAt: row.dismissed_at ?? null,
        dismissReason: row.dismiss_reason ?? null,
        dismissedByUserId: row.dismissed_by_user_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      map.set(resolutionKey(res.targetType, res.targetId, res.flagType), res);
    }
    return map;
  }

  /**
   * Oznacza flagę jako rozwiązaną (UPSERT).
   */
  async resolveFlag(
    targetType: 'POLICY' | 'CLIENT',
    targetId: string,
    flagType: string,
  ): Promise<void> {
    const sb = this.sb();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb
      .from('flag_resolutions')
      .upsert(
        {
          tenant_id: TENANT_ID,
          target_type: targetType,
          target_id: targetId,
          flag_type: flagType,
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: user?.id ?? null,
          // Cofnij ewentualne dismiss przy rozwiązaniu
          dismissed_at: null,
          dismiss_reason: null,
        },
        { onConflict: 'tenant_id,target_type,target_id,flag_type' },
      );
    if (error) throw new Error(`[resolveFlag] ${error.message}`);
  }

  /**
   * Pomija flagę na dziś (snooze_today) lub trwale (manual_skip) (UPSERT).
   */
  async dismissFlag(
    targetType: 'POLICY' | 'CLIENT',
    targetId: string,
    flagType: string,
    reason: 'snooze_today' | 'manual_skip',
  ): Promise<void> {
    const sb = this.sb();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb
      .from('flag_resolutions')
      .upsert(
        {
          tenant_id: TENANT_ID,
          target_type: targetType,
          target_id: targetId,
          flag_type: flagType,
          dismissed_at: new Date().toISOString(),
          dismiss_reason: reason,
          dismissed_by_user_id: user?.id ?? null,
          resolved_at: null,
          resolved_by_user_id: null,
        },
        { onConflict: 'tenant_id,target_type,target_id,flag_type' },
      );
    if (error) throw new Error(`[dismissFlag] ${error.message}`);
  }

  /**
   * Cofa resolve/dismiss flagi (np. "Cofnij pominięcie" w ustawieniach).
   */
  async unmarkFlag(
    targetType: 'POLICY' | 'CLIENT',
    targetId: string,
    flagType: string,
  ): Promise<void> {
    const sb = this.sb();
    const { error } = await sb
      .from('flag_resolutions')
      .update({
        resolved_at: null,
        resolved_by_user_id: null,
        dismissed_at: null,
        dismiss_reason: null,
        dismissed_by_user_id: null,
      })
      .eq('tenant_id', TENANT_ID)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('flag_type', flagType);
    if (error) throw new Error(`[unmarkFlag] ${error.message}`);
  }
}

export const supabaseStorage = new SupabaseStorageManager();
