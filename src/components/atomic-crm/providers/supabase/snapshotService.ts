import { getSupabaseClient } from './supabase';

const INSURANCE_TABLES = [
  'insurance_clients',
  'policies',
  'policy_notes',
  'sub_agents',
  'policy_sub_agent_shares',
  'terminations',
  'insurers',
  'checklist_templates',
  'insurance_activity_log'
];

const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';

export interface SnapshotStats {
  [table: string]: number;
}

export interface SnapshotData {
  [table: string]: any[];
}

export interface Snapshot {
  id: string;
  tenant_id: string;
  created_at: string;
  created_by: string | null;
  note: string | null;
  stats: SnapshotStats;
  data: SnapshotData;
}

export const snapshotService = {
  /**
   * Tworzy nowy snapshot stanu bazy danych dla aktualnego tenantu.
   */
  async createSnapshot(note?: string): Promise<Partial<Snapshot>> {
    const sb = getSupabaseClient();
    const { data: { session } } = await sb.auth.getSession();
    const userId = session?.user?.id;

    // Pobierz ID sprzedawcy (sales) dla zalogowanego użytkownika
    let salesId: number | null = null;
    if (userId) {
      const { data: s } = await sb.from('sales').select('id').eq('user_id', userId).maybeSingle();
      salesId = s?.id ?? null;
    }

    const tenantId = (import.meta.env.VITE_SUPABASE_TENANT_ID as string) || DEFAULT_TENANT_ID;

    // Pobierz dane ze wszystkich tabel
    const fetchPromises = INSURANCE_TABLES.map(table => 
      sb.from(table).select('*').eq('tenant_id', tenantId)
    );

    const results = await Promise.all(fetchPromises);
    
    const stats: SnapshotStats = {};
    const data: SnapshotData = {};

    INSURANCE_TABLES.forEach((table, index) => {
      const result = results[index];
      if (result.error) {
        console.warn(`Błąd pobierania tabeli ${table}:`, result.error);
        data[table] = [];
        stats[table] = 0;
      } else {
        data[table] = result.data || [];
        stats[table] = (result.data || []).length;
      }
    });

    // Zapisz snapshot
    const { data: inserted, error } = await sb
      .from('insurance_snapshots')
      .insert({
        tenant_id: tenantId,
        created_by: salesId,
        note: note || null,
        stats,
        data
      })
      .select('id, created_at')
      .single();

    if (error) {
      throw new Error(`Nie udało się utworzyć snapshotu: ${error.message}`);
    }

    return inserted;
  },

  /**
   * Pobiera listę dostępnych snapshotów.
   */
  async listSnapshots(): Promise<Partial<Snapshot>[]> {
    const sb = getSupabaseClient();
    const tenantId = (import.meta.env.VITE_SUPABASE_TENANT_ID as string) || DEFAULT_TENANT_ID;

    const { data, error } = await sb
      .from('insurance_snapshots')
      .select('id, created_at, note, stats, created_by')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Błąd pobierania listy snapshotów: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Przywraca stan bazy danych z wybranego snapshotu.
   * UWAGA: To jest operacja niszcząca (usuwa obecne dane i wstawia te ze snapshotu).
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const sb = getSupabaseClient();
    const tenantId = (import.meta.env.VITE_SUPABASE_TENANT_ID as string) || DEFAULT_TENANT_ID;

    // 1. Pobierz pełne dane snapshotu
    const { data: snapshot, error: fetchError } = await sb
      .from('insurance_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (fetchError || !snapshot) {
      throw new Error(`Nie znaleziono snapshotu: ${fetchError?.message || 'Brak danych'}`);
    }

    const snapshotData = snapshot.data as SnapshotData;

    // 2. Usuń obecne dane (w kolejności odwrotnej do kluczy obcych jeśli to możliwe)
    // RLS i kaskady powinny pomóc, ale dla pewności usuwamy wszystko.
    // UWAGA: Kolejność usuwania ma znaczenie ze względu na FK.
    const tablesToDelete = [
      'policy_sub_agent_shares',
      'policy_notes',
      'terminations',
      'policies',
      'insurance_clients',
      'sub_agents',
      'insurers',
      'checklist_templates',
      'insurance_activity_log'
    ];

    for (const table of tablesToDelete) {
      const { error: deleteError } = await sb.from(table).delete().eq('tenant_id', tenantId);
      if (deleteError) {
        throw new Error(`Błąd czyszczenia tabeli ${table}: ${deleteError.message}`);
      }
    }

    // 3. Wstaw dane ze snapshotu (w kolejności kluczy obcych)
    const tablesToInsert = [
      'insurers',
      'sub_agents',
      'insurance_clients',
      'policies',
      'policy_notes',
      'policy_sub_agent_shares',
      'terminations',
      'checklist_templates',
      'insurance_activity_log'
    ];

    for (const table of tablesToInsert) {
      const rows = snapshotData[table];
      if (rows && rows.length > 0) {
        const { error: insertError } = await sb.from(table).insert(rows);
        if (insertError) {
          throw new Error(`Błąd przywracania tabeli ${table}: ${insertError.message}`);
        }
      }
    }
  },

  /**
   * Sprawdza czy dzisiaj został już wykonany automatyczny snapshot.
   * Jeśli nie — tworzy go z notatką "Automatyczny snapshot dzienny".
   */
  async checkDailySnapshot(): Promise<void> {
    const sb = getSupabaseClient();
    const tenantId = (import.meta.env.VITE_SUPABASE_TENANT_ID as string) || DEFAULT_TENANT_ID;

    const today = new Date().toISOString().split('T')[0]; // RRRR-MM-DD
    const startOfDay = `${today}T00:00:00Z`;
    const endOfDay = `${today}T23:59:59Z`;

    const { data, error } = await sb
      .from('insurance_snapshots')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .limit(1);

    if (error) {
      console.error('Błąd sprawdzania dziennego snapshotu:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('Brak snapshotu na dziś. Tworzę automatyczny punkt kontrolny...');
      try {
        await this.createSnapshot('Automatyczny snapshot dzienny (system)');
        console.log('Automatyczny snapshot utworzony pomyślnie.');
      } catch (err) {
        console.error('Nie udało się utworzyć automatycznego snapshotu:', err);
      }
    } else {
      console.log('Dzienny snapshot już istnieje. Pomijam.');
    }
  },

  /**
   * Usuwa punkt kontrolny.
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('insurance_snapshots')
      .delete()
      .eq('id', snapshotId);

    if (error) {
      throw new Error(`Błąd usuwania snapshotu: ${error.message}`);
    }
  }
};
