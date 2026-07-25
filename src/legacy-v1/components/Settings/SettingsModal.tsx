/**
 * SettingsModal — panel Ustawień / Wygląd jako modal na pełny ekran (2026-07-25).
 *
 * Wcześniej `ThemeSettings` + `AiKeysPanel` renderowały się INLINE wciśnięte w wąski
 * Sidebar (w DWÓCH miejscach — luxury-gold i default skin). Za dużo treści (motywy,
 * Designer Czcionek, Edytor Statusów, [admin] Klucze AI) żeby sensownie mieściło się
 * w sidebarze. Ten komponent to jedyne miejsce renderowania — Sidebar.tsx woła go
 * RAZ, poza `<nav>`, warunkowo po `showThemeSettings`.
 *
 * Konwencja modala 1:1 z `ClientFormModal.tsx` (backdrop blur + karta `max-w-4xl`
 * `max-h-[90vh]` + header z tytułem/podtytułem/X) — NIE nowa estetyka.
 *
 * Treść (`ThemeSettings`/`StatusEditor`/`AiKeysPanel`) ma stylistykę na sztywno
 * ciemną (zero klas `dark:` w tamtych plikach — projektowane pod ciemny Sidebar).
 * Dlatego obszar treści tego modala ma STAŁE ciemne tło (nie `dark:`-warunkowe) —
 * zachowuje dokładnie ten sam wygląd co wcześniej, niezależnie od jasnego/ciemnego
 * motywu aplikacji. Header jest jasny/ciemny (theme-aware), jak reszta modali.
 */
import React, { useEffect } from "react";
import { X, Palette } from "lucide-react";
import { UiPreferences } from "../../types";
import { ThemeSettings } from "../ThemeSettings";
import { AiKeysPanel } from "./AiKeysPanel";

interface Props {
  prefs: UiPreferences;
  onUpdate: (prefs: UiPreferences) => void;
  isAdmin: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  prefs,
  onUpdate,
  isAdmin,
  onClose,
}) => {
  // Esc zamyka (SUPREME_RULES / konwencja modali w tym module)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop — klik zamyka */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[1.75rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
        {/* HEADER */}
        <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 shrink-0">
          <div>
            <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
              <Palette className="text-red-600" />
              Ustawienia / Wygląd
            </h3>
            <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">
              Motyw · Czcionki · Statusy Polis
              {isAdmin ? " · Klucze AI" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors"
            title="Zamknij (Esc)"
          >
            <X size={24} />
          </button>
        </div>

        {/* MAIN SCROLLABLE AREA — tło stałe ciemne, patrz komentarz na górze pliku */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-950 scrollbar-hide">
          <ThemeSettings prefs={prefs} onUpdate={onUpdate} />
          {isAdmin && <AiKeysPanel />}
        </div>
      </div>
    </div>
  );
};
