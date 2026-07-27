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
 *
 * --- ANULUJ / ZATWIERDŹ (2026-07-27) ---------------------------------------------
 * Treść tego modala zapisuje się NA BIEŻĄCO (live), nie na "Zapisz" jak zwykły
 * formularz: ThemeSettings -> onUpdate(prefs) (motyw/Designer Czcionek, natychmiast
 * do App+localStorage), StatusEditor -> storage.saveStatusOverrides(...) na każdą
 * zmianę koloru/nazwy statusu. Żeby "Anuluj" miało sens, robimy snapshot PRZY OTWARCIU
 * (w useRef, raz) i w razie odwołania przywracamy oba źródła.
 *
 * SPÓJNA SEMANTYKA (jedna, żeby nie było niejasności): X w rogu, klawisz Esc i klik
 * w backdrop to WSZYSTKIE trzy to samo co "Anuluj" — cofają do stanu sprzed otwarcia
 * i zamykają. Jedyny sposób na wyjście BEZ cofania to jawny przycisk "Zatwierdź" w
 * stopce. Wybrane celowo (nie odwrotnie) — Alina eksperymentuje z kolorami/nazwami,
 * a najbardziej intuicyjny odruch to Esc/X/klik-obok = "nie, jednak nie to, cofnij"
 * (jak w większości aplikacji "cancel dialog" = X). Gdyby X/Esc zachowywały live-save
 * a tylko "Anuluj" cofał, przypadkowy Esc podczas eksperymentowania zostawiałby
 * niechciane zmiany — dokładnie to, czego ten mechanizm ma unikać.
 *
 * StatusEditor (i cała reszta appki poza tym modalem) NIE trzyma żadnego cache'u
 * overrides — `getStatusDisplay()`/`StatusEditor`'s `useState(() => storage.
 * getStatusOverrides())` czytają storage świeżo przy KAŻDYM mouncie. Ponieważ Anuluj
 * zawsze kończy się `onClose()` (SettingsModal + StatusEditor unmountują się w
 * całości przez `{showThemeSettings && <SettingsModal/>}` w Sidebar.tsx), przy
 * następnym otwarciu StatusEditor i tak czyta świeże (już cofnięte) dane - nie
 * potrzeba osobnego `key`/licznika wymuszającego remount.
 */
import React, { useEffect, useRef } from "react";
import { X, Palette, RotateCcw, Check } from "lucide-react";
import { UiPreferences, StatusCustomization } from "../../types";
import { storage } from "../../services/storage";
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
  // Snapshot PRZY OTWARCIU (raz, na mount) — punkt powrotu dla "Anuluj".
  // AiKeysPanel (admin) ma WŁASNY explicit Save — świadomie pominięty tutaj.
  const snapshotPrefsRef = useRef<UiPreferences>(prefs);
  const snapshotOverridesRef = useRef<StatusCustomization | null>(null);
  if (snapshotOverridesRef.current === null) {
    snapshotOverridesRef.current = storage.getStatusOverrides();
  }

  const handleCancel = () => {
    onUpdate(snapshotPrefsRef.current);
    storage.saveStatusOverrides(snapshotOverridesRef.current ?? {});
    onClose();
  };

  const handleConfirm = () => {
    // Zmiany są już zapisane live (ThemeSettings/StatusEditor) — po prostu zamknij.
    onClose();
  };

  // X / Esc / klik w backdrop = to samo co "Anuluj" (patrz komentarz na górze pliku).
  // Deps = [onUpdate, onClose] (nie []): handleCancel zamyka się nad propsami, które w
  // Sidebar.tsx nie są memoizowane (nowa referencja co render App.tsx) — re-rejestrujemy
  // listener przy zmianie, żeby uniknąć polegania na "to akurat bezpieczne" stale closure.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUpdate, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop — klik = Anuluj (cofa), zob. komentarz na górze pliku */}
      <div className="absolute inset-0" onClick={handleCancel} />

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
            onClick={handleCancel}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors"
            title="Anuluj i zamknij (Esc) — cofa zmiany z tej sesji"
          >
            <X size={24} />
          </button>
        </div>

        {/* MAIN SCROLLABLE AREA — tło stałe ciemne, patrz komentarz na górze pliku */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-950 scrollbar-hide">
          <ThemeSettings prefs={prefs} onUpdate={onUpdate} />
          {isAdmin && <AiKeysPanel />}
        </div>

        {/* FOOTER — shrink-0, zawsze widoczny (treść scrolluje nad nim) */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex gap-3 shrink-0">
          <button
            onClick={handleCancel}
            title="Cofa zmiany z tej sesji do stanu sprzed otwarcia"
            className="flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} /> Anuluj
          </button>
          <button
            onClick={handleConfirm}
            title="Zamyka okno — zmiany zostają (są już zapisane)"
            className="flex-[2] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl hover:bg-black dark:hover:bg-zinc-200"
          >
            <Check size={16} /> Zatwierdź
          </button>
        </div>
      </div>
    </div>
  );
};
