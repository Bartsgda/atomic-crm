/**
 * StatusEditor — panel Ustawień "Edytor Statusów" (obok Designer Czcionek).
 *
 * Alina ustawia dla KAŻDEGO statusu polisy (SalesStage) własną wyświetlaną nazwę
 * (label) i dwa kolory (tło/tekst). Klucz `stage` (np. "rez po ofercie_kont za rok")
 * NIGDY się nie zmienia — to mapowanie do importu XLSX/bazy (STATUS_CONFIG w
 * constants.ts). Ten panel edytuje WYŁĄCZNIE warstwę nadpisania (label/bg/fg),
 * zapisywaną przez storage.saveStatusOverrides() (localStorage, jak font prefs).
 *
 * Zapis natychmiastowy na każdą zmianę (bez osobnego przycisku "Zapisz") — spójne
 * z resztą Designer Czcionek (fontColor/fontFamily itp. w ThemeSettings.tsx).
 */
import React, { useState } from "react";
import { Tag, RotateCcw } from "lucide-react";
import { STATUS_CONFIG } from "../../constants";
import { storage } from "../../services/storage";
import type { StatusCustomization } from "../../types";

// Domyślne hex-y TYLKO jako punkt startowy dla <input type="color"> (który wymaga
// zawsze jakiejś wartości) — odpowiadają oryginalnej palecie Aliny z Excela.
// Nie są zapisywane jako override dopóki Alina faktycznie czegoś nie zmieni.
const DEFAULT_HEX: Record<string, { bg: string; fg: string }> = {
  "of_do zrobienia": { bg: "#FDD835", fg: "#713f12" },
  "pierwszy kontakt": { bg: "#EF9A9A", fg: "#881337" },
  "przeł kontakt": { bg: "#2196F3", fg: "#ffffff" },
  "czekam na dane/dokum": { bg: "#26C6DA", fg: "#164e63" },
  oferta_wysłana: { bg: "#9CCC65", fg: "#365314" },
  of_przedst: { bg: "#9CCC65", fg: "#365314" },
  "rez po ofercie_kont za rok": { bg: "#B0BEC5", fg: "#37474f" },
  "ucięty kontakt": { bg: "#B08D57", fg: "#ffffff" },
  sprzedaż: { bg: "#43A047", fg: "#ffffff" },
  sprzedany: { bg: "#5E35B1", fg: "#ffffff" },
  zbycie_pojazdu: { bg: "#F97316", fg: "#ffffff" },
  inne: { bg: "#A1A1AA", fg: "#27272a" },
};
const FALLBACK_HEX = { bg: "#71717a", fg: "#ffffff" };

export const StatusEditor: React.FC = () => {
  const [overrides, setOverrides] = useState<StatusCustomization>(() =>
    storage.getStatusOverrides(),
  );

  const stageKeys = Object.keys(STATUS_CONFIG);

  const updateField = (
    key: string,
    field: "label" | "bg" | "fg",
    value: string,
  ) => {
    setOverrides((prev) => {
      const next = { ...prev, [key]: { ...prev[key], [field]: value } };
      storage.saveStatusOverrides(next);
      return next;
    });
  };

  const resetStage = (key: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      storage.saveStatusOverrides(next);
      return next;
    });
  };

  return (
    <div>
      <p className="text-[9px] uppercase font-black text-zinc-500 mb-1 tracking-wider flex items-center gap-2 px-1">
        <Tag size={10} /> Edytor Statusów
      </p>
      <p className="text-[9px] text-zinc-600 mb-3 px-1 leading-snug">
        Twoje nazwy i kolory statusów polis (wszędzie w aplikacji). Wewnętrzny
        klucz importu/bazy się nie zmienia.
      </p>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {stageKeys.map((key) => {
          const base = STATUS_CONFIG[key];
          const ov = overrides[key];
          const hex = DEFAULT_HEX[key] || FALLBACK_HEX;
          const hasOverride = !!(ov?.label || ov?.bg || ov?.fg);

          const previewLabel = ov?.label?.trim() || base.label;
          const previewStyle: React.CSSProperties = {
            backgroundColor: ov?.bg || undefined,
            color: ov?.fg || undefined,
            borderColor: ov?.bg || undefined,
          };

          return (
            <div
              key={key}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border ${
                    ov?.bg || ov?.fg
                      ? ""
                      : `${base.color} ${base.bg} ${base.border}`
                  }`}
                  style={previewStyle}
                >
                  {previewLabel}
                </span>
                {hasOverride && (
                  <button
                    type="button"
                    onClick={() => resetStage(key)}
                    title="Przywróć domyślny label/kolor"
                    className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ov?.label ?? ""}
                  onChange={(e) => updateField(key, "label", e.target.value)}
                  placeholder={base.label}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
                />
                <input
                  type="color"
                  value={ov?.bg || hex.bg}
                  onChange={(e) => updateField(key, "bg", e.target.value)}
                  title="Kolor tła"
                  className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 cursor-pointer p-0.5 shrink-0"
                />
                <input
                  type="color"
                  value={ov?.fg || hex.fg}
                  onChange={(e) => updateField(key, "fg", e.target.value)}
                  title="Kolor tekstu"
                  className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 cursor-pointer p-0.5 shrink-0"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
