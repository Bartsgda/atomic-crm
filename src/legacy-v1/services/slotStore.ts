/**
 * slotStore.ts — API do obslugi zarezerwowanych tabel scratch (slot_01..slot_30).
 *
 * Cel: Claude w przyszlych sesjach moze zapisac dowolne dane tymczasowe
 * do wolnego slotu bez tworzenia nowych tabel DDL.
 *
 * Semantyka write(): INSERT-always (kazde wywolanie = nowy wiersz z nowym id).
 * Jesli potrzebujesz UPSERT — wykonaj read() -> roznica -> write() lub delete() + write().
 *
 * Schema: test (VITE_SUPABASE_SCHEMA=test — klient Supabase ma to ustawione).
 * RLS: tenant_id = public.current_tenant_id() OR public.is_insurance_admin().
 * Trigger updated_at: test.set_updated_at_insurance() (ustawia sie automatycznie).
 *
 * Rejestr slotow: src/legacy-v1/SLOT_REGISTRY.md
 * Migracja: supabase/migrations/20260515_reserved_slots.sql
 */

import { getSupabaseClient } from "../../components/atomic-crm/providers/supabase/supabase";

// ─── Walidacja nazwy slotu ────────────────────────────────────────────────────

/** Dopuszczalne nazwy: slot_01..slot_30. */
const SLOT_NAME_REGEX = /^slot_(0[1-9]|[12]\d|30)$/;

/**
 * Sprawdza czy podana nazwa slotu jest prawidlowa.
 * Chroni przed SQL injection i literowkami.
 * Eksportowane zeby testy moglyd testowac bez importu Supabase.
 */
export function assertValidSlot(slot: string): void {
  if (!SLOT_NAME_REGEX.test(slot)) {
    throw new Error(
      `[slotStore] Nieprawidlowa nazwa slotu: "${slot}". ` +
        "Dopuszczalne: slot_01..slot_30.",
    );
  }
}

// ─── Typ wstrzykiwanego klienta (minimalny interfejs) ────────────────────────

/** Minimalny interfejs klienta Supabase uzywany przez SlotStore. */
export type SlotSupabaseClient = Pick<
  ReturnType<typeof getSupabaseClient>,
  "from"
>;

// ─── Typy ─────────────────────────────────────────────────────────────────────

export interface SlotRow {
  id: string;
  tenant_id: string;
  payload: Record<string, unknown>;
  slot_purpose: string | null;
  created_at: string;
  updated_at: string;
}

// ─── SlotStore ────────────────────────────────────────────────────────────────

export class SlotStore {
  /**
   * @param clientOverride - opcjonalny fake klient do testow (dependency injection).
   *   W produkcji pomijaj — domyslnie uzywa getSupabaseClient().
   */
  constructor(private clientOverride?: SlotSupabaseClient) {}

  private sb(): SlotSupabaseClient {
    return this.clientOverride ?? getSupabaseClient();
  }

  /**
   * Zapisz wartosc do slotu. Semantyka INSERT-always — kazde wywolanie tworzy nowy wiersz.
   * Klucz `key` trafia jako pole w JSONB payload: { [key]: value }.
   *
   * @param slot  - np. 'slot_03'
   * @param key   - nazwa klucza w payload (np. 'ocr_job_id', 'import_run')
   * @param value - dowolna wartość serializowalna do JSON
   */
  async write(slot: string, key: string, value: unknown): Promise<string> {
    assertValidSlot(slot);
    const { data, error } = await this.sb()
      .from(slot)
      .insert({ payload: { [key]: value } })
      .select("id")
      .single();
    if (error) throw new Error(`[slotStore.write] ${slot}: ${error.message}`);
    return (data as { id: string }).id;
  }

  /**
   * Odczytaj wiersze ze slotu.
   * Jesli podasz `filter`, filtruje po payload->>key = value (tekst).
   * Zwraca tablice SlotRow posortowana od najnowszego.
   *
   * @param slot   - np. 'slot_03'
   * @param filter - opcjonalny { key, value } — zaweza po payload->>key
   * @param limit  - maks liczba wierszy (domyslnie 100)
   */
  async read(
    slot: string,
    filter?: { key: string; value: string },
    limit = 100,
  ): Promise<SlotRow[]> {
    assertValidSlot(slot);
    let query = this.sb()
      .from(slot)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filter) {
      // Supabase REST: filtruj po polu JSONB przez operator ->>
      // skladnia: column.eq(val) na kolumnie wirtualnej nie dziala w postgrest —
      // uzywamy filter() z operatorem cs (contains) dla JSONB
      const contains: Record<string, unknown> = { [filter.key]: filter.value };
      query = query.contains("payload", contains);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[slotStore.read] ${slot}: ${error.message}`);
    return (data ?? []) as SlotRow[];
  }

  /**
   * Listuj wszystkie wiersze slotu (paginacja przez limit/offset).
   *
   * @param slot   - np. 'slot_03'
   * @param limit  - rozmiar strony (domyslnie 100)
   * @param offset - pominij pierwsze N wierszy (domyslnie 0)
   */
  async list(slot: string, limit = 100, offset = 0): Promise<SlotRow[]> {
    assertValidSlot(slot);
    const { data, error } = await this.sb()
      .from(slot)
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`[slotStore.list] ${slot}: ${error.message}`);
    return (data ?? []) as SlotRow[];
  }

  /**
   * Usun wiersz po id.
   *
   * @param slot - np. 'slot_03'
   * @param id   - UUID wiersza (z pola id w SlotRow)
   */
  async delete(slot: string, id: string): Promise<void> {
    assertValidSlot(slot);
    const { error } = await this.sb().from(slot).delete().eq("id", id);
    if (error) throw new Error(`[slotStore.delete] ${slot}: ${error.message}`);
  }

  /**
   * Oznacz slot jako zajety przez sesje (pomocnicza notatka).
   * Wstawia jeden wiersz z `slot_purpose` opisujacym cel uzycia.
   * Nie blokuje slotu — sluzy tylko do dokumentacji w SLOT_REGISTRY.md.
   *
   * Wzorzec: po wywolaniu claim() zaktualizuj SLOT_REGISTRY.md recznie
   * (Status=CLAIMED, Purpose=..., Claimed by session=...).
   *
   * @param slot      - np. 'slot_03'
   * @param purpose   - opis co tu trzymamy (np. 'OCR audit results 2026-05')
   * @param sessionId - slug sesji lub data (np. 'dev_2026-05-15_ocr-audit')
   */
  async claim(slot: string, purpose: string, sessionId: string): Promise<void> {
    assertValidSlot(slot);
    await this.write(slot, "_claim", {
      purpose,
      sessionId,
      claimedAt: new Date().toISOString(),
    });
  }
}

/** Singleton do uzycia poza klasa (analogicznie do innych eksportow w tym folderze). */
export const slotStore = new SlotStore();
