/**
 * FlagReminderWidget.tsx — System przypomnień uzupełnień Aliny (Faza 5, 2026-05-15)
 *
 * Wyświetla top N flag do uzupełnienia dziś (quota domyślnie 5).
 * Trzy akcje per flaga: ✅ Zrobione · ⏰ Pomiń dziś · 🚫 Pomiń trwale.
 * Ustawienia (quota + reminder_interval) inline w kolapsowanej sekcji.
 *
 * Lokalny stan resolutions: ładowany z Supabase przy mount.
 * Po każdej akcji: aktualizacja lokalnej mapy (optimistic) + zapis do DB.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Settings2,
  Undo2,
  Loader2,
  X,
  Bell,
} from "lucide-react";
import type { AppState } from "../types";
import type { FlagResolution, ActiveFlagItem } from "../services/policyFlags";
import {
  collectAllFlags,
  selectTodaysFlags,
  resolutionKey,
} from "../services/policyFlags";
import { supabaseStorage } from "../services/supabaseStorage";

// ─── LocalStorage keys ────────────────────────────────────────────────────────
const LS_QUOTA = "crm-alina:flagQuota";
const LS_INTERVAL = "crm-alina:reminderInterval";
const LS_HIDDEN = "crm-alina:flagWidgetHidden";

function getQuota(): number {
  const v = localStorage.getItem(LS_QUOTA);
  return v ? Math.max(1, Math.min(20, parseInt(v, 10))) : 5;
}
function getInterval(): number {
  const v = localStorage.getItem(LS_INTERVAL);
  return v ? Math.max(1, Math.min(24, parseInt(v, 10))) : 3;
}
function setQuota(n: number) {
  localStorage.setItem(LS_QUOTA, String(n));
}
function setInterval_(n: number) {
  localStorage.setItem(LS_INTERVAL, String(n));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FlagReminderWidget: React.FC<Props> = ({ state, onNavigate }) => {
  const [resolutions, setResolutions] = useState<Map<string, FlagResolution>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // key aktualnie przetwarzanej akcji
  const [quota, setQuotaState] = useState(getQuota);
  const [intervalH, setIntervalH] = useState(getInterval);
  const [showSettings, setShowSettings] = useState(false);
  const [showAllDismissed, setShowAllDismissed] = useState(false);
  const [hidden, setHidden] = useState(
    () => localStorage.getItem(LS_HIDDEN) === "1",
  );

  const hide = () => {
    localStorage.setItem(LS_HIDDEN, "1");
    setHidden(true);
  };
  const show = () => {
    localStorage.removeItem(LS_HIDDEN);
    setHidden(false);
  };

  // Załaduj resolutions przy mount
  useEffect(() => {
    let cancelled = false;
    supabaseStorage
      .loadFlagResolutions()
      .then((map) => {
        if (!cancelled) setResolutions(map);
      })
      .catch((err) => console.warn("[FlagReminderWidget] load error:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wszystkie flagi (czysta kalkulacja)
  const allFlags = useMemo(
    () => collectAllFlags(state.clients, state.policies),
    [state.clients, state.policies],
  );

  // Top N na dziś
  const todaysFlags = useMemo(
    () => selectTodaysFlags(allFlags, resolutions, quota),
    [allFlags, resolutions, quota],
  );

  // Trwale pominięte (dla listy w ustawieniach)
  const permanentlyDismissed = useMemo(() => {
    const dismissed: ActiveFlagItem[] = [];
    for (const item of allFlags) {
      const key = resolutionKey(item.targetType, item.targetId, item.flag.code);
      const res = resolutions.get(key);
      if (res?.dismissReason === "manual_skip" && res.dismissedAt) {
        dismissed.push(item);
      }
    }
    return dismissed;
  }, [allFlags, resolutions]);

  const totalActive = useMemo(
    () => selectTodaysFlags(allFlags, resolutions, Infinity).length,
    [allFlags, resolutions],
  );

  // ─── Akcje ─────────────────────────────────────────────────────────────────

  const doAction = useCallback(
    async (item: ActiveFlagItem, action: "resolve" | "snooze" | "dismiss") => {
      const key = resolutionKey(item.targetType, item.targetId, item.flag.code);
      setActionLoading(key);
      try {
        if (action === "resolve") {
          await supabaseStorage.resolveFlag(
            item.targetType,
            item.targetId,
            item.flag.code,
          );
        } else if (action === "snooze") {
          await supabaseStorage.dismissFlag(
            item.targetType,
            item.targetId,
            item.flag.code,
            "snooze_today",
          );
        } else {
          await supabaseStorage.dismissFlag(
            item.targetType,
            item.targetId,
            item.flag.code,
            "manual_skip",
          );
        }
        // Optimistic update — przeładuj mapę
        const updated = await supabaseStorage.loadFlagResolutions();
        setResolutions(updated);
      } catch (err) {
        console.error("[FlagReminderWidget] action error:", err);
      } finally {
        setActionLoading(null);
      }
    },
    [],
  );

  const doUnmark = useCallback(async (item: ActiveFlagItem) => {
    const key = resolutionKey(item.targetType, item.targetId, item.flag.code);
    setActionLoading(key);
    try {
      await supabaseStorage.unmarkFlag(
        item.targetType,
        item.targetId,
        item.flag.code,
      );
      const updated = await supabaseStorage.loadFlagResolutions();
      setResolutions(updated);
    } catch (err) {
      console.error("[FlagReminderWidget] unmark error:", err);
    } finally {
      setActionLoading(null);
    }
  }, []);

  // ─── Quota / interval handlers ─────────────────────────────────────────────

  const handleQuotaChange = (v: number) => {
    const clamped = Math.max(1, Math.min(20, v));
    setQuotaState(clamped);
    setQuota(clamped);
  };
  const handleIntervalChange = (v: number) => {
    const clamped = Math.max(1, Math.min(24, v));
    setIntervalH(clamped);
    setInterval_(clamped);
    // Zapisz interval — toast reminder czyta z localStorage przy mount Dashboard
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-zinc-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Ładowanie flag uzupełnień…
      </div>
    );
  }

  // 2026-05-16: nic do roboty → nie pokazuj nic (zamiast "0 z 0")
  if (totalActive === 0) {
    return null;
  }

  // 2026-05-16: user ukrył ręcznie → mini-badge z liczbą, klik = unhide
  if (hidden) {
    return (
      <button
        onClick={show}
        className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg transition-colors"
        title="Pokaż chmurkę z flagami do uzupełnienia"
      >
        <Bell size={14} />
        <span className="text-xs font-bold">{totalActive}</span>
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-zinc-900 dark:text-white">
            Dziś do uzupełnienia
          </span>
          <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold rounded-full">
            {todaysFlags.length} z {totalActive}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            title="Ustawienia przypomnień"
          >
            <Settings2 size={15} />
          </button>
          <button
            onClick={hide}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-red-500 transition-colors"
            title="Ukryj chmurkę (zostanie mały dzwonek)"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Settings (kolapsowane) */}
      {showSettings && (
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 w-44 shrink-0">
              Dziennie uzupełniam:
            </label>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={quota}
              onChange={(e) => handleQuotaChange(Number(e.target.value))}
              className="flex-1 accent-orange-500"
            />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 w-6 text-right">
              {quota}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 w-44 shrink-0">
              Reminder co:
            </label>
            <input
              type="range"
              min={1}
              max={24}
              step={1}
              value={intervalH}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="flex-1 accent-orange-500"
            />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 w-12 text-right">
              {intervalH}h
            </span>
          </div>
          {/* Lista trwale pominiętych */}
          {permanentlyDismissed.length > 0 && (
            <div>
              <button
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 font-semibold"
                onClick={() => setShowAllDismissed((s) => !s)}
              >
                {showAllDismissed ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                Pominięte trwale: {permanentlyDismissed.length}
              </button>
              {showAllDismissed && (
                <div className="mt-2 space-y-1">
                  {permanentlyDismissed.map((item) => {
                    const k = resolutionKey(
                      item.targetType,
                      item.targetId,
                      item.flag.code,
                    );
                    return (
                      <div
                        key={k}
                        className="flex items-center justify-between text-xs py-1 px-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                      >
                        <span className="truncate text-zinc-600 dark:text-zinc-300">
                          {item.flag.emoji} {item.clientName} —{" "}
                          {item.flag.label}
                        </span>
                        <button
                          onClick={() => doUnmark(item)}
                          disabled={actionLoading === k}
                          className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1 shrink-0 font-semibold"
                          title="Cofnij pominięcie"
                        >
                          <Undo2 size={11} /> Cofnij
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lista flag */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {todaysFlags.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              Wszystko uzupełnione na dziś!
            </p>
            <p className="text-xs text-zinc-400 mt-1">Sprawdź jutro.</p>
          </div>
        ) : (
          todaysFlags.map((item) => {
            const k = resolutionKey(
              item.targetType,
              item.targetId,
              item.flag.code,
            );
            const isProcessing = actionLoading === k;
            return (
              <div
                key={k}
                className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* Ikona + severity */}
                <div
                  className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs
                  ${
                    item.flag.severity === "CRITICAL"
                      ? "bg-red-100 dark:bg-red-900/40"
                      : "bg-yellow-100 dark:bg-yellow-900/40"
                  }`}
                >
                  {item.flag.emoji}
                </div>

                {/* Treść */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wide
                      ${item.flag.severity === "CRITICAL" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}`}
                    >
                      {item.flag.severity === "CRITICAL" ? "PILNE" : "UWAGA"}
                    </span>
                    <span className="text-[10px] text-zinc-400">·</span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                      {item.clientName}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    {item.flag.label} — {item.contextLabel}
                  </div>
                </div>

                {/* Link + akcje */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      const client = state.clients.find(
                        (c) => c.id === item.clientId,
                      );
                      if (!client) return;
                      // AUTO_NO_REG → otwórz modal polisy do edycji danych pojazdu.
                      // Inne flagi polisowe → podświetl polisę na karcie klienta.
                      // Flagi klienta → otwórz kartę klienta.
                      if (
                        item.targetType === "POLICY" &&
                        item.flag.code === "AUTO_NO_REG"
                      ) {
                        onNavigate("client-details", {
                          client,
                          autoOpenPolicyId: item.targetId,
                        });
                      } else if (item.targetType === "POLICY") {
                        onNavigate("client-details", {
                          client,
                          highlightPolicyId: item.targetId,
                        });
                      } else {
                        onNavigate("client-details", { client });
                      }
                    }}
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 transition-colors"
                    title={
                      item.flag.code === "AUTO_NO_REG"
                        ? "Uzupełnij dane pojazdu"
                        : "Otwórz kartę klienta"
                    }
                  >
                    <ArrowRight size={13} />
                  </button>
                  {isProcessing ? (
                    <Loader2 size={13} className="animate-spin text-zinc-400" />
                  ) : (
                    <>
                      <button
                        onClick={() => doAction(item, "resolve")}
                        className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/40 text-zinc-400 hover:text-green-600 transition-colors"
                        title="Zrobione"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                      <button
                        onClick={() => doAction(item, "snooze")}
                        className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-zinc-400 hover:text-yellow-600 transition-colors"
                        title="Pomiń dziś"
                      >
                        <Clock size={13} />
                      </button>
                      <button
                        onClick={() => doAction(item, "dismiss")}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Pomiń trwale"
                      >
                        <XCircle size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {totalActive > quota && (
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            onClick={() => onNavigate("clients", { filterFlags: true })}
            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
          >
            Pełna lista ({totalActive} aktywnych) <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
};
