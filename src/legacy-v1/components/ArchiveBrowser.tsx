/**
 * ArchiveBrowser.tsx — modal read-only z historycznymi klientami z `test` schema.
 * 2026-05-16, na żądanie Bartka. Wstawiony przez StatusEye guzik "Archiwum 2025".
 */
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Loader2,
  RefreshCcw,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  Car,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  loadArchive,
  clearArchiveCache,
  type ArchiveSnapshot,
  type ArchiveClient,
} from "../services/archiveLoader";

interface Props {
  open: boolean;
  onClose: () => void;
}

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pl-PL");
  } catch {
    return iso;
  }
}

export default function ArchiveBrowser({ open, onClose }: Props) {
  const [snap, setSnap] = useState<ArchiveSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await loadArchive({ forceRefresh });
      setSnap(fresh);
    } catch (err: any) {
      setError(err?.message ?? "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !snap) fetchData(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClients = useMemo<ArchiveClient[]>(() => {
    if (!snap) return [];
    const q = normalize(search.trim());
    if (!q) return snap.clients;
    return snap.clients.filter((c) => {
      const name = normalize(`${c.first_name ?? ""} ${c.last_name ?? ""}`);
      const phonesStr = c.phones.join(" ");
      const emailsStr = c.emails.join(" ");
      return (
        name.includes(q) ||
        phonesStr.includes(q) ||
        normalize(emailsStr).includes(q) ||
        normalize(c.address).includes(q)
      );
    });
  }, [snap, search]);

  const selectedClient = useMemo(() => {
    if (!snap || !selectedClientId) return null;
    return snap.clients.find((c) => c.id === selectedClientId) ?? null;
  }, [snap, selectedClientId]);

  const clientPolicies = useMemo(() => {
    if (!snap || !selectedClientId) return [];
    return snap.policies.filter((p) => p.client_id === selectedClientId);
  }, [snap, selectedClientId]);

  const clientNotes = useMemo(() => {
    if (!snap || !selectedClientId) return [];
    return snap.notes.filter((n) => n.client_id === selectedClientId);
  }, [snap, selectedClientId]);

  if (!open) return null;

  const cacheAgeMin = snap
    ? Math.floor((Date.now() - snap.ts) / 60_000)
    : null;

  return (
    <div
      className="fixed inset-3 z-[9999] flex flex-col rounded-2xl border border-white/10 bg-[#111318] shadow-2xl overflow-hidden"
      data-feedback-ui="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          📚 Archiwum 2025
          <span className="text-xs text-amber-400 font-normal">
            (read-only · schema `test`)
          </span>
          {snap && (
            <span className="text-xs text-gray-500 font-normal">
              · {snap.clients.length} klientów · {snap.policies.length} polis
            </span>
          )}
          {cacheAgeMin !== null && cacheAgeMin > 0 && (
            <span className="text-xs text-gray-600 font-normal">
              · cache {cacheAgeMin}min temu
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              clearArchiveCache();
              fetchData(true);
            }}
            disabled={loading}
            title="Odśwież z serwera (bypass cache)"
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 flex-shrink-0 border-b border-white/10">
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <AlertCircle size={12} /> Błąd: {error}
          </p>
        </div>
      )}

      {loading && !snap && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs">Pobieram archiwum z test schema…</span>
        </div>
      )}

      {snap && (
        <div className="flex-1 flex min-h-0">
          {/* LEFT: client list */}
          <div className="w-[360px] border-r border-white/10 flex flex-col min-h-0">
            <div className="p-3 border-b border-white/10 flex-shrink-0">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj: nazwisko, telefon, email, adres…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-600"
                />
              </div>
              {search && (
                <p className="text-[10px] text-gray-500 mt-1.5">
                  {filteredClients.length} wyników
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-8">
                  Brak wyników
                </p>
              ) : (
                filteredClients.map((c) => {
                  const policiesCount = snap.policies.filter(
                    (p) => p.client_id === c.id,
                  ).length;
                  const isSelected = c.id === selectedClientId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={`w-full text-left px-3 py-2 border-b border-white/5 transition-colors ${
                        isSelected
                          ? "bg-indigo-600/20"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-200 truncate">
                            {c.last_name || "—"} {c.first_name || ""}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {c.phones[0] || c.emails[0] || c.address || "—"}
                          </p>
                        </div>
                        {policiesCount > 0 && (
                          <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                            {policiesCount}
                          </span>
                        )}
                        <ChevronRight
                          size={10}
                          className={`text-gray-600 shrink-0 ${isSelected ? "text-indigo-400" : ""}`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: details */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {!selectedClient ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                Wybierz klienta z listy ←
              </div>
            ) : (
              <div className="max-w-2xl space-y-4">
                {/* Client meta */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                  <h3 className="text-base font-bold text-white">
                    {selectedClient.last_name} {selectedClient.first_name}
                  </h3>
                  <div className="text-xs text-gray-400 space-y-1">
                    {selectedClient.phones.map((p, i) => (
                      <p key={i} className="flex items-center gap-1.5">
                        <Phone size={11} className="text-blue-400" />
                        <a
                          href={`tel:${p.replace(/\s+/g, "")}`}
                          className="text-blue-400 hover:underline"
                        >
                          {p}
                        </a>
                      </p>
                    ))}
                    {selectedClient.emails.map((e, i) => (
                      <p key={i} className="flex items-center gap-1.5">
                        <Mail size={11} className="text-emerald-400" />
                        <a
                          href={`mailto:${e}`}
                          className="text-emerald-400 hover:underline"
                        >
                          {e}
                        </a>
                      </p>
                    ))}
                    {selectedClient.address && (
                      <p className="flex items-start gap-1.5">
                        <MapPin size={11} className="text-rose-400 mt-0.5" />
                        <span>{selectedClient.address}</span>
                      </p>
                    )}
                    {selectedClient.legacy_id && (
                      <p className="text-[10px] text-gray-600 font-mono">
                        legacy_id: {selectedClient.legacy_id}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-600">
                      Założony: {formatDate(selectedClient.created_at)}
                    </p>
                  </div>
                </div>

                {/* Policies */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
                    <FileText size={12} /> Polisy ({clientPolicies.length})
                  </h4>
                  {clientPolicies.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">
                      Brak polis w archiwum.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {clientPolicies.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-gray-200">
                              {p.type} {p.policy_number ? `· ${p.policy_number}` : ""}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {p.stage ?? "—"}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 space-y-0.5">
                            {p.insurer_name && (
                              <p>Towarzystwo: {p.insurer_name}</p>
                            )}
                            {p.vehicle_brand && (
                              <p className="flex items-center gap-1">
                                <Car size={10} /> {p.vehicle_brand}{" "}
                                {p.vehicle_model ?? ""}{" "}
                                {p.vehicle_reg && (
                                  <span className="font-mono text-gray-300">
                                    {p.vehicle_reg}
                                  </span>
                                )}
                              </p>
                            )}
                            {p.premium != null && (
                              <p>Składka: {p.premium} zł</p>
                            )}
                            <p>
                              {formatDate(p.policy_start_date)} →{" "}
                              {formatDate(p.policy_end_date)}
                            </p>
                            {p.legacy_id && (
                              <p className="text-[10px] text-gray-600 font-mono">
                                legacy_id: {p.legacy_id}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {clientNotes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Notatki ({clientNotes.length})
                    </h4>
                    <div className="space-y-2">
                      {clientNotes.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            {n.tag && (
                              <span className="text-[9px] font-bold uppercase text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded">
                                {n.tag}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500 ml-auto">
                              {formatDate(n.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {n.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
