/**
 * archiveLoader.ts — read-only access do schematu `test` (archiwum 2025).
 *
 * 2026-05-16: dodane na żądanie Bartka. Alina pracuje na `public`; gdy
 * trafi klienta z którym mogła mieć kontakt rok temu, klika "Wczytaj historię"
 * w StatusEye → ten loader pobiera dane z `test` schema (niezaszyfrowane,
 * historyczne) i pokazuje obok prod. NIE wlewa nic do prod.
 *
 * Cache: 1h w localStorage (klucz LS_CACHE). Klik ↻ refresh = bypass.
 */
import { getArchiveSupabaseClient } from "../../components/atomic-crm/providers/supabase/supabase";

const LS_CACHE = "crm-alina:archiveCache";
const TTL_MS = 60 * 60 * 1000; // 1h

export interface ArchiveClient {
  id: string;
  legacy_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phones: string[];
  emails: string[];
  /** Złożony adres ze street + city + zip_code (test schema nie ma jednej kolumny `address`). */
  address: string | null;
  created_at: string;
}

export interface ArchivePolicy {
  id: string;
  legacy_id: string | null;
  client_id: string;
  type: string;
  stage: string | null;
  policy_number: string | null;
  insurer_name: string | null;
  premium: number | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_reg: string | null;
  created_at: string;
}

export interface ArchiveNote {
  id: string;
  client_id: string;
  content: string;
  tag: string | null;
  created_at: string;
}

export interface ArchiveSnapshot {
  ts: number;
  clients: ArchiveClient[];
  policies: ArchivePolicy[];
  notes: ArchiveNote[];
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchFromTest(): Promise<ArchiveSnapshot> {
  const sb = getArchiveSupabaseClient();

  const [clientsRes, policiesRes, notesRes] = await Promise.all([
    sb
      .from("insurance_clients")
      .select(
        "id, legacy_id, first_name, last_name, phones, emails, street, city, zip_code, created_at",
      )
      .order("last_name", { ascending: true })
      .limit(2000),
    sb
      .from("policies")
      .select(
        "id, legacy_id, client_id, type, stage, policy_number, insurer_name, premium, policy_start_date, policy_end_date, vehicle_brand, vehicle_model, vehicle_reg, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(5000),
    sb
      .from("policy_notes")
      .select("id, client_id, content, tag, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  if (clientsRes.error) throw clientsRes.error;
  if (policiesRes.error) throw policiesRes.error;
  if (notesRes.error) throw notesRes.error;

  const clients: ArchiveClient[] = (clientsRes.data ?? []).map((r: any) => {
    const addressParts = [r.street, r.zip_code, r.city].filter(Boolean);
    return {
      id: r.id,
      legacy_id: r.legacy_id,
      first_name: r.first_name,
      last_name: r.last_name,
      phones: parseJsonArray(r.phones),
      emails: parseJsonArray(r.emails),
      address: addressParts.length > 0 ? addressParts.join(", ") : null,
      created_at: r.created_at,
    };
  });

  const policies: ArchivePolicy[] = (policiesRes.data ?? []).map((r: any) => ({
    id: r.id,
    legacy_id: r.legacy_id,
    client_id: r.client_id,
    type: r.type,
    stage: r.stage,
    policy_number: r.policy_number,
    insurer_name: r.insurer_name,
    premium: r.premium,
    policy_start_date: r.policy_start_date,
    policy_end_date: r.policy_end_date,
    vehicle_brand: r.vehicle_brand,
    vehicle_model: r.vehicle_model,
    vehicle_reg: r.vehicle_reg,
    created_at: r.created_at,
  }));

  const notes: ArchiveNote[] = (notesRes.data ?? []).map((r: any) => ({
    id: r.id,
    client_id: r.client_id,
    content: r.content ?? "",
    tag: r.tag,
    created_at: r.created_at,
  }));

  return { ts: Date.now(), clients, policies, notes };
}

export async function loadArchive(
  opts: { forceRefresh?: boolean } = {},
): Promise<ArchiveSnapshot> {
  if (!opts.forceRefresh) {
    const cached = localStorage.getItem(LS_CACHE);
    if (cached) {
      try {
        const snap = JSON.parse(cached) as ArchiveSnapshot;
        if (Date.now() - snap.ts < TTL_MS) return snap;
      } catch {
        // korupt cache — fall through do refresh
      }
    }
  }

  const fresh = await fetchFromTest();
  try {
    localStorage.setItem(LS_CACHE, JSON.stringify(fresh));
  } catch {
    // localStorage może być pełen — pomijamy
  }
  return fresh;
}

export function getCachedArchive(): ArchiveSnapshot | null {
  const cached = localStorage.getItem(LS_CACHE);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as ArchiveSnapshot;
  } catch {
    return null;
  }
}

export function clearArchiveCache() {
  localStorage.removeItem(LS_CACHE);
}
