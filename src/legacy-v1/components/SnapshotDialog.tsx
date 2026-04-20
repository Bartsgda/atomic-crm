import { useEffect, useState } from "react";
import { Loader2, Camera, History, Trash2, RotateCcw, X, AlertTriangle } from "lucide-react";
import { supabaseStorage } from "../services/supabaseStorage";

interface SnapshotItem {
  id: string;
  created_at: string;
  note: string | null;
  stats: Record<string, number>;
}

interface SnapshotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export const SnapshotDialog: React.FC<SnapshotDialogProps> = ({ isOpen, onClose, onRestored }) => {
  const [tab, setTab] = useState<"create" | "list">("create");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [list, setList] = useState<SnapshotItem[]>([]);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const loadList = async () => {
    try {
      setList(await supabaseStorage.listSnapshots());
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setMsg(null); setErr(null); setNote(""); setConfirmRestoreId(null);
    if (tab === "list") loadList();
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await supabaseStorage.createSnapshot(note || undefined);
      setMsg(`✓ Snapshot zapisany (${new Date(res.created_at).toLocaleString("pl-PL")})`);
      setNote("");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (id: string) => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      await supabaseStorage.restoreSnapshot(id);
      setMsg("✓ Przywrócono snapshot. Odświeżanie danych…");
      onRestored();
      setTimeout(onClose, 800);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
      setConfirmRestoreId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć ten snapshot na stałe?")) return;
    setBusy(true); setErr(null);
    try {
      await supabaseStorage.deleteSnapshot(id);
      await loadList();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            Snapshoty bazy danych
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-3 text-sm font-medium transition-all ${
              tab === "create" ? "text-white border-b-2 border-indigo-500" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Camera className="w-4 h-4 inline mr-2" />Zrób snapshot
          </button>
          <button
            onClick={() => setTab("list")}
            className={`flex-1 py-3 text-sm font-medium transition-all ${
              tab === "list" ? "text-white border-b-2 border-indigo-500" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />Historia i przywracanie
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {err && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/30 border border-red-500/40 text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}
            </div>
          )}
          {msg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 text-sm">
              {msg}
            </div>
          )}

          {tab === "create" && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Snapshot zapisuje pełny stan bazy Twojego tenantu (klienci, polisy, notatki, kosz, wypowiedzenia) jako punkt przywrócenia.
                Dane wrażliwe pozostają zaszyfrowane — do przywrócenia potrzebne będzie to samo hasło.
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Opis snapshotu (opcjonalnie) — np. 'Przed importem XLSX Aliny'"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                onClick={handleCreate}
                disabled={busy}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Zapisz snapshot
              </button>
            </div>
          )}

          {tab === "list" && (
            <div className="space-y-2">
              {list.length === 0 && !busy && (
                <p className="text-gray-500 text-center py-8 text-sm">Brak snapshotów.</p>
              )}
              {list.map(s => (
                <div key={s.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">
                        {new Date(s.created_at).toLocaleString("pl-PL")}
                      </div>
                      {s.note && <div className="text-gray-400 text-xs mt-0.5 truncate">{s.note}</div>}
                      <div className="text-gray-500 text-[11px] mt-1.5 flex gap-3 flex-wrap">
                        <span>klienci: <b className="text-gray-300">{s.stats?.clients ?? 0}</b></span>
                        <span>polisy: <b className="text-gray-300">{s.stats?.policies ?? 0}</b></span>
                        <span>notatki: <b className="text-gray-300">{s.stats?.notes ?? 0}</b></span>
                        {s.stats?.trash ? <span>kosz: <b className="text-gray-300">{s.stats.trash}</b></span> : null}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {confirmRestoreId === s.id ? (
                        <>
                          <button
                            onClick={() => handleRestore(s.id)}
                            disabled={busy}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg disabled:opacity-60"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Potwierdź"}
                          </button>
                          <button
                            onClick={() => setConfirmRestoreId(null)}
                            disabled={busy}
                            className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-lg"
                          >
                            Anuluj
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setConfirmRestoreId(s.id)}
                            disabled={busy}
                            title="Przywróć — nadpisze aktualne dane!"
                            className="p-2 bg-white/5 hover:bg-indigo-600/30 text-gray-300 hover:text-white rounded-lg transition-all"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={busy}
                            title="Usuń snapshot"
                            className="p-2 bg-white/5 hover:bg-red-600/30 text-gray-300 hover:text-red-300 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {confirmRestoreId === s.id && (
                    <div className="mt-3 text-amber-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Przywrócenie zastąpi <b>całą</b> aktualną bazę tenantu zawartością snapshotu. Aktualne zmiany zostaną utracone.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnapshotDialog;
